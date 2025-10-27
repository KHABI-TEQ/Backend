import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { bookingRequestSchema } from "../../../validators/booking.validator";
import { PaystackService } from "../../../services/paystack.service";
import { Types } from "mongoose";
import { BookingLogService } from "../../../services/bookingLog.service";
import { generateBookingCode, generatePassCode, getPropertyTitleFromLocation } from "../../../utils/helper";
import { generateBookingRequestAcknowledgementForBuyer, generateBookingRequestReceivedForSeller } from "../../../common/emailTemplates/bookingMails";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
 
    export const  calculateShortletAmount = (
        property: any,
        checkIn: Date,
        checkOut: Date
    ) => {
        const msInDay = 1000 * 60 * 60 * 24;
        const diffMs = Math.max(0, checkOut.getTime() - checkIn.getTime());
        const nights = diffMs > 0 ? Math.ceil(diffMs / msInDay) : 0;

        const pricing = property.shortletDetails?.pricing || {};
        const nightlyRate = typeof pricing.nightly === "number" ? pricing.nightly : property.price;

        const base = nights * nightlyRate;
        const cleaningFee = typeof pricing.cleaningFee === "number" ? pricing.cleaningFee : 0;
        const weeklyDiscount = typeof pricing.weeklyDiscount === "number" ? pricing.weeklyDiscount : 0;
        const monthlyDiscount = typeof pricing.monthlyDiscount === "number" ? pricing.monthlyDiscount : 0;
        const securityDeposit = typeof pricing.securityDeposit === "number" ? pricing.securityDeposit : 0;

        // ✅ Decide which discount applies
        const discountPct = nights >= 30 ? monthlyDiscount : nights >= 7 ? weeklyDiscount : 0;
        const discountAmount = Math.round((base * discountPct) / 100);

        const subtotal = Math.max(0, base - discountAmount);
        const serviceCharge = (8/100) * (subtotal + cleaningFee + securityDeposit);
        const expectedAmount = subtotal + cleaningFee + securityDeposit + serviceCharge;

        return {
            nights,
            duration: nights,
            rate: nightlyRate,
            base,
            discountPct,
            discountAmount,
            subtotal,
            cleaningFee,
            securityDeposit,
            expectedAmount,
        };
    }

 
    /**
     * Submit Booking Request
    */
    export const submitBookingRequest = async (
        req: AppRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {

            const { publicSlug } = req.params;

            const { error, value } = bookingRequestSchema.validate(req.body, { abortEarly: false });
 
            if (error) {
                res.status(400).json({
                    success: false,
                    errorCode: "VALIDATION_ERROR",
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

            // ✅ Find DealSite
            const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();
            if (!dealSite) {
                res.status(HttpStatusCodes.NOT_FOUND).json({
                    success: false,
                    errorCode: "DEALSITE_NOT_FOUND",
                    message: "DealSite not found",
                    data: null,
                });
                return;
            }
        
            // ✅ Ensure it's running
            if (dealSite.status !== "running") {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    errorCode: "DEALSITE_NOT_ACTIVE",
                    message: "This DealSite is not currently active.",
                    data: null,
                });
                return;
            }

            // ✅ Get property details
            const property = await DB.Models.Property.findById(propertyId)
                .populate({
                    path: "owner",             // The field to populate
                    select: "firstName lastName email phoneNumber", // Fields you want from the owner
                })
                .lean();

            if (!property) {
                res.status(HttpStatusCodes.NOT_FOUND).json({
                    success: false,
                    errorCode: "PROPERTY_NOT_FOUND",
                    message: "Property not found",
                    data: null,
                });
                return;
            }

            if (!property.isAvailable) {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    errorCode: "PROPERTY_NOT_AVAILABLE",
                    message: "This property is not available for booking",
                    data: null,
                });
                return;
            }

            if (property.propertyType !== "shortlet") {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    errorCode: "INVALID_PROPERTY_TYPE",
                    message: "Only shortlet properties can be booked",
                    data: null,
                });
                return;
            }

            // ✅ Parse booking dates
            const checkIn = new Date(bookingDetails.checkInDateTime);
            const checkOut = new Date(bookingDetails.checkOutDateTime);

            if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    errorCode: "INVALID_BOOKING_DATES",
                    message: "Invalid check-in or check-out date",
                    data: null,
                });
                return;
            }

            const { duration, expectedAmount, nights, cleaningFee, securityDeposit } = calculateShortletAmount(property, checkIn, checkOut);

            // ✅ Compare with paymentDetails
            if (expectedAmount !== paymentDetails.amountToBePaid) {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    errorCode: "PAYMENT_AMOUNT_MISMATCH",
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
                const paymentDetails = dealSite.paymentDetails;
                const publicPageUrl = `https://${dealSite.publicSlug}.khabiteq.com`;
 
                // Calculate 15%
                const fifteenPercent = (expectedAmount * 10) / 100;
                // generate payment link
                paymentResponse = await PaystackService.initializeSplitPayment({
                    subAccount: paymentDetails.subAccountCode,
                    publicPageUrl: publicPageUrl,
                    amountCharge: fifteenPercent,
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
                },
                receiverMode: {
                    type: "dealSite",
                    dealSiteID: dealSite._id
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
                meta: { cleaningFee, securityDeposit, bookingDetails, bookingMode, dealSiteSlug: dealSite.publicSlug, dealSiteId: dealSite._id },
            });

            // send mail to owner and the buyer
            if (bookingMode === "request") {
                const propertyTitle: any = getPropertyTitleFromLocation(property.location);

                const ownerData = property.owner as any;

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
                    buyerName: bookedBy.fullName
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
  