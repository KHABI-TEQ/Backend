import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { bookingRequestSchema } from "../../../validators/booking.validator";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { PaystackService } from "../../../services/paystack.service";
import { Types } from "mongoose";
import { BookingLogService } from "../../../services/bookingLog.service";
import { generateBookingRequestAcknowledgementForBuyer, generateBookingRequestReceivedForSeller } from "../../../common/emailTemplates/bookingMails";
import { generateBookingCode, generatePassCode, getPropertyTitleFromLocation } from "../../../utils/helper";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import sendEmail from "../../../common/send.email";

export class BookingController {

 // ✅ Helper for duration and pricing (fixed calculation)
    private calculateShortletAmount(
    property: any,
    checkIn: Date,
    checkOut: Date
    ) {
    const msInDay = 1000 * 60 * 60 * 24;
    const diffMs = checkOut.getTime() - checkIn.getTime();

    if (diffMs <= 0) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Check-out must be after check-in");
    }

    // Nights = any fraction of a day counts as a full day
    const nights = Math.max(1, Math.ceil(diffMs / msInDay));

    const pricing = property.shortletDetails?.pricing || {};
    let duration = 0;
    let expectedAmount = 0;

    switch (property.shortletDuration) {
        case "Daily": {
        const perNight = pricing.nightly ?? property.price;
        duration = nights;
        expectedAmount = perNight * nights;
        break;
        }

        case "Weekly": {
        const weeklyRate = pricing.weekly ?? property.price;
        const perNight = weeklyRate / 7; // ✅ spread weekly rate across 7 nights
        duration = nights;
        expectedAmount = perNight * nights;
        break;
        }

        case "Monthly": {
        const monthlyRate = pricing.monthly ?? property.price;
        const perNight = monthlyRate / 30; // ✅ spread monthly rate across 30 nights
        duration = nights;
        expectedAmount = perNight * nights;
        break;
        }

        default:
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid shortlet duration type");
    }

    // Add fixed fees (once per booking)
    expectedAmount += (pricing.cleaningFee || 0) + (pricing.securityDeposit || 0);

    // Round to nearest integer (avoid floating mismatch)
    expectedAmount = Math.round(expectedAmount);

    return {
        duration,
        expectedAmount,
        nights,
        cleaningFee: pricing.cleaningFee,
        securityDeposit: pricing.securityDeposit,
    };
    }


  /**
   * Submit Booking Request
   */
    public async submitBookingRequest(
        req: AppRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { error, value } = bookingRequestSchema.validate(req.body, { abortEarly: false });

            if (error) {
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map((err) => err.message),
            });
            return;
            }

            const { bookedBy, propertyId, bookingDetails, paymentDetails, bookingMode } = value;

            if (!bookedBy) {
                throw new RouteError(HttpStatusCodes.BAD_REQUEST, "BookedBy (user) is required");
            }

            if (!propertyId) {
                throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Property ID is required");
            }

            // ✅ Get property details
            const property = await DB.Models.Property.findById(propertyId)
                .populate({
                    path: "owner",             // The field to populate
                    select: "firstName lastName email phoneNumber", // Fields you want from the owner
                })
                .lean();

            if (!property) {
                throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
            }

            if (!property.isAvailable) {
                throw new RouteError(
                    HttpStatusCodes.BAD_REQUEST, // or 409 Conflict depending on your convention
                    "Property is not available for booking"
                );
            }

            if (property.propertyType !== "shortlet") {
                throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Only shortlet properties can be booked");
            }

            // ✅ Parse booking dates
            const checkIn = new Date(bookingDetails.checkInDateTime);
            const checkOut = new Date(bookingDetails.checkOutDateTime);

            if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
                throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid check-in or check-out date");
            }

            const { duration, expectedAmount, nights, cleaningFee, securityDeposit } = this.calculateShortletAmount(property, checkIn, checkOut);

            // ✅ Compare with paymentDetails
            if (expectedAmount !== paymentDetails.amountToBePaid) {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: `Payment amount mismatch. Expected ₦${expectedAmount}, but received ₦${paymentDetails.amountToBePaid}. Please check and try again.`,
                    expectedAmount,
                    receivedAmount: paymentDetails.amountToBePaid,
                });
                return;
            }

            // ✅ Create or retrieve buyer
            const buyer = await DB.Models.Buyer.findOneAndUpdate(
                { email: bookedBy.email },
                { $setOnInsert: bookedBy },
                { upsert: true, new: true }
            );

            // ✅ Generate booking + pass codes
            const bookingCode = generateBookingCode();
            const passCode = generatePassCode();
 
            let paymentResponse: any;

            if (bookingMode === "instant") {
                // generate payment link
                paymentResponse = await PaystackService.initializePayment({
                    email: buyer.email,
                    amount: expectedAmount,
                    fromWho: {
                        kind: "Buyer",
                        item: new Types.ObjectId(buyer._id as Types.ObjectId),
                    },
                    transactionType: "shortlet-booking",
                });
            }
        
             const booking = await DB.Models.Booking.create({
                propertyId: propertyId,
                bookedBy: buyer?._id,
                bookingCode,
                passCode,
                bookingDetails: bookingDetails,
                transaction: bookingMode === "instant" ? paymentResponse.transactionId : null,
                status: bookingMode === "instant" ? "pending" : "requested",
                ownerId: property.owner._id,
                ownerModel: property.createdByRole === "user" ? "User" : "Admin",
                meta: {
                    duration,
                    nights,
                    pricePerNight: expectedAmount - (cleaningFee + securityDeposit),
                    extralFees: {
                        cleaningFee, 
                        securityDeposit
                    },
                    totalPrice: expectedAmount,
                }
            });

            // ✅ Log booking activity
            await BookingLogService.logActivity({
                bookingId: booking._id.toString(),
                propertyId: propertyId,
                senderId: buyer?._id.toString(),
                senderRole: "buyer",     // "buyer" | "owner" | "admin"
                senderModel: "Buyer",   // "User" | "Buyer" | "Admin"
                message: "Booking request created",
                status: bookingMode === "instant" ? "pending" : "requested",
                stage: bookingMode === "instant" ? "payment" : "booking",
                meta: { cleaningFee, securityDeposit, bookingDetails, bookingMode },
            });

            // send mail to owner and the buyer
            if (bookingMode === "request") {
                const propertyTitle: any = getPropertyTitleFromLocation(property.location);

                const ownerData = property.owner as any;

                const sellerPagelink = `${process.env.CLIENT_LINK}/my-inspection-requests?tab=booking`;

                const buyerEmail = generateBookingRequestAcknowledgementForBuyer({
                    buyerName: bookedBy.fullName,
                    bookingCode: bookingCode,
                    propertyTitle: propertyTitle,
                    checkInDateTime: checkIn,
                    checkOutDateTime: checkOut
                });

                const sellerEmail = generateBookingRequestReceivedForSeller({
                    sellerName: ownerData.firstName,
                    bookingCode: bookingCode,
                    propertyTitle: propertyTitle,
                    checkInDateTime: checkIn,
                    checkOutDateTime: checkOut,
                    buyerName: bookedBy.fullName,
                    pageLink: sellerPagelink
                });

                await sendEmail({
                    to: bookedBy.email,
                    subject: `Booking Request Submitted – ${propertyTitle}`,
                    html: generalEmailLayout(buyerEmail),
                    text: generalEmailLayout(buyerEmail),
                });

                await sendEmail({
                    to: ownerData.email,
                    subject: `New Booking Request Received for Your Property – ${propertyTitle}`,
                    html: generalEmailLayout(sellerEmail),
                    text: generalEmailLayout(sellerEmail),
                });
            }

            res.status(HttpStatusCodes.CREATED).json({
                success: true,
                message: "Booking request submitted successfully",
                data: {
                    booking,
                    ...(paymentResponse ? { transaction: paymentResponse } : {}),
                },
            });
        } catch (error) {
            console.error("submitBookingRequest error:", error);
            next(error);
        }
    }



}


export default new BookingController();