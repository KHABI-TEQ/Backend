import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";
import { BookingLogService } from "../../services/bookingLog.service";
import { generateBookingRequestReviewedForBuyer } from "../../common/emailTemplates/bookingMails";
import { getPropertyTitleFromLocation } from "../../utils/helper";
import sendEmail from "../../common/send.email";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";
 
export const fetchUserBookings = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      propertyId,
    } = req.query;

    const filter: any = {
      ownerId: req.user._id, // Only fetch user's bookings
    };

    if (status) filter.status = status;
    if (propertyId) filter.propertyId = propertyId;
 
    const bookings = await DB.Models.Booking.find(filter)
      .populate("propertyId")
      .populate("transaction")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await DB.Models.Booking.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getOneUserBooking = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookingId } = req.params;

    const booking = await DB.Models.Booking.findOne({
      _id: bookingId,
      ownerId: req.user._id,
    })
      .populate("propertyId")
      .populate("transaction");

    if (!booking) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Booking not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
};

export const getBookingStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;

    const baseFilter = { ownerId: userId };

    const [
      totalBookings,
      requestedBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
    ] = await Promise.all([
      DB.Models.Booking.countDocuments(baseFilter),

      DB.Models.Booking.countDocuments({
        ...baseFilter,
        status: "requested",
      }),

      DB.Models.Booking.countDocuments({
        ...baseFilter,
        status: "confirmed",
      }),

      DB.Models.Booking.countDocuments({
        ...baseFilter,
        status: "cancelled",
      }),

      DB.Models.Booking.countDocuments({
        ...baseFilter,
        status: "completed",
      }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        totalBookings,
        requestedBookings,
        confirmedBookings,
        cancelledBookings,
        completedBookings,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Owner responds to a booking request.
 * Marks it as accepted or declined, optionally adding a note.
 */
export const respondToBookingRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {

    const userId = req.user._id;

    const { bookingId } = req.params;
    const { response, note } = req.body; // response: 'available' | 'unavailable'

    if (!["available", "unavailable"].includes(response)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Response must be either 'available' or 'unavailable'"
      );
    } 
 
    // Find booking that is currently requested
    const booking = await DB.Models.Booking.findOne({
      ownerId: userId,
      _id: bookingId,
      status: "requested",
    })
    .populate("bookedBy") // populate buyer
    .populate({
        path: "propertyId",       // populate property
        populate: {
          path: "owner",          // populate owner inside property
          select: "firstName lastName email phoneNumber", // fields you need
        },
    }); 

    if (!booking) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Booking not found or not in requested status");
    }

    let dealSite: any;
    if (booking.receiverMode.type === "dealSite") {
      // ✅ Find DealSite
      dealSite = await DB.Models.DealSite.findOne({ _id: booking.receiverMode.dealSiteID }).lean();
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

    }

    // Update owner response
    booking.ownerResponse = {
      response: response === "available" ? "pending" : "declined",
      respondedAt: new Date(),
      note: note || null,
    };

    // Update booking status accordingly
    booking.status = response === "available" ? "pending" : "unavailable";

    const buyer = booking.bookedBy as any;
    const property = booking.propertyId as any;
    const onwerData = property.owner as any;
    const expectedAmount = booking.meta.totalPrice;
    const propertyTitle: any = getPropertyTitleFromLocation(property.location);
   
    let paymentResponse: any;

    if (response === "available") {
      if (booking.receiverMode.type === "general") {
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

      if (booking.receiverMode.type === "dealSite") {

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
        

        booking.transaction = paymentResponse.transactionId;
        booking.meta = {
            ...booking.meta,
            paymentLink: paymentResponse.authorization_url,
        };
    }

    await booking.save();

    // ✅ Log booking activity
    await BookingLogService.logActivity({
        bookingId: booking._id.toString(),
        propertyId: property._id.toString(),
        senderId: buyer?._id.toString(),
        senderRole: "owner",     // "buyer" | "owner" | "admin"
        senderModel: "User",   // "User" | "Buyer" | "Admin"
        message: response === "available" ? "Booking request marked as available by the owner" : "Booking request marked as unavailable by the owner",
        status: response === "available" ? "accepted" : "rejected",
        stage: response === "available" ? "payment" : "cancelled",
        meta: { 
            cleaningFee: booking.meta.extralFees.cleaningFee, 
            securityDeposit: booking.meta.extralFees.securityDeposit, 
            bookingDetails: booking.bookingDetails,
        },
    });

    const buyerEmail = generateBookingRequestReviewedForBuyer({
        buyerName: buyer.fullName,
        bookingCode: booking.bookingCode,
        propertyTitle: propertyTitle,
        checkInDateTime: booking.bookingDetails.checkInDateTime,
        checkOutDateTime: booking.bookingDetails.checkOutDateTime,
        status: response,
        paymentLink: `${process.env.CLIENT_LINK}/check-booking-details`,
    });

    const subject =
        response === "available"
            ? `Your booking request on ${propertyTitle} is available`
            : `Your booking request on ${propertyTitle} is not available`;

    await sendEmail({
        to: buyer.email,
        subject: subject,
        html: generalEmailLayout(buyerEmail),
        text: generalEmailLayout(buyerEmail),
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Booking has been ${response}`,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticate buyer using booking code and return booking details
 */
export const authenticateBookingCode = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Booking code is required");
    }

    // Find booking by code
    const booking = await DB.Models.Booking.findOne({ bookingCode: code })
      .populate("propertyId")
      .populate("bookedBy")
      .populate("transaction")
      .lean();

    if (!booking) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid booking code");
    }

    // Extract necessary details
    const property = booking.propertyId as any;
    const buyer = booking.bookedBy as any;

    const bookingData = {
      bookingCode: booking.bookingCode,
      status: booking.status,
      ownerResponse: booking.ownerResponse || null,
      meta: booking.meta || {},
      bookingDetails: booking.bookingDetails,
      property: {
        _id: property._id,
        pictures: property.pictures,
        videos: property.videos,
        briefType: property.briefType,
        propertyType: property.propertyType,
        propertyCategory: property.propertyCategory,
        propertyCondition: property.propertyCondition,
        typeOfBuilding: property.typeOfBuilding,
        shortletDuration: property.shortletDuration,
        location: property.location,
        features: property.features,
        additionalFeatures: property.additionalFeatures,
        shortletDetails: property.shortletDetails,
        price: property.price,
      },
      buyer: {
        _id: buyer._id,
        fullName: buyer.fullName,
        email: buyer.email,
        phoneNumber: buyer.phoneNumber,
      },
      transaction: booking.transaction || null,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Booking code authenticated successfully",
      data: bookingData,
    });
  } catch (err) {
    next(err);
  }
};


export const getBookingByBookingCode = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookingCode } = req.params;

    if (!bookingCode || typeof bookingCode !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Booking code is required");
    }

    // Find booking by code
    const booking = await DB.Models.Booking.findOne({ bookingCode })
      .populate("propertyId")
      .populate("bookedBy")
      .populate("transaction")
      .lean();

    if (!booking) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid booking code");
    }

    // Extract necessary details
    const property = booking.propertyId as any;
    const buyer = booking.bookedBy as any;

    const bookingData = {
      bookingCode: booking.bookingCode,
      status: booking.status,
      ownerResponse: booking.ownerResponse || null,
      meta: booking.meta || {},
      bookingDetails: booking.bookingDetails,
      property: {
        _id: property._id,
        pictures: property.pictures,
        videos: property.videos,
        briefType: property.briefType,
        propertyType: property.propertyType,
        propertyCategory: property.propertyCategory,
        propertyCondition: property.propertyCondition,
        typeOfBuilding: property.typeOfBuilding,
        shortletDuration: property.shortletDuration,
        location: property.location,
        features: property.features,
        additionalFeatures: property.additionalFeatures,
        shortletDetails: property.shortletDetails,
        price: property.price,
      },
      buyer: {
        _id: buyer._id,
        fullName: buyer.fullName,
        email: buyer.email,
        phoneNumber: buyer.phoneNumber,
      },
      transaction: booking.transaction || null,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Booking code authenticated successfully",
      data: bookingData,
    });
  } catch (err) {
    next(err);
  }
};

