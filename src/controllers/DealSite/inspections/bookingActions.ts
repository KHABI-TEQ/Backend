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
import { dealSiteOriginFromPublicSlug } from "../../../config/dealSitePublicHost";
import { DealSiteService } from "../../../services/dealSite.service";
import {
  calculateShortletPricingFromDates,
  shortletPricingMeta,
} from "../../../utils/shortletPricing";
 
    /**
     * @deprecated Use calculateShortletPricingFromDates from utils/shortletPricing
     */
    export const calculateShortletAmount = (
        property: any,
        checkIn: Date,
        checkOut: Date
    ) => calculateShortletPricingFromDates(property, checkIn, checkOut);

 
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
        
            const access = await DealSiteService.validatePublicDealSiteVisitorAccess(dealSite);
            if (access.ok === false) {
                res.status(access.httpStatus).json({
                    success: false,
                    errorCode: access.errorCode,
                    message: access.message,
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

            const pricing = calculateShortletPricingFromDates(property, checkIn, checkOut);
            const { expectedAmount, nights, cleaningFee, securityDeposit } = pricing;

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
                const publicPageUrl = dealSiteOriginFromPublicSlug(dealSite.publicSlug);

                paymentResponse = await PaystackService.initializePayment({
                    email: buyer.email,
                    amount: expectedAmount,
                    callbackUrl: `${publicPageUrl}/payment-verification`,
                    fromWho: {
                        kind: "Buyer",
                        item: new Types.ObjectId(buyer._id as Types.ObjectId),
                    },
                    transactionType: "shortlet-booking",
                    metadata: {
                        settlementModel: "escrow",
                        hostBase: pricing.hostBase,
                        guestServiceCharge: pricing.guestServiceCharge,
                        hostCommission: pricing.hostCommission,
                        hostPayout: pricing.hostPayout,
                        platformTotalCommission: pricing.platformTotalCommission,
                        dealSiteSlug: dealSite.publicSlug,
                    },
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
                    ...shortletPricingMeta(pricing),
                    duration: pricing.duration,
                    settlementModel: "escrow",
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
  