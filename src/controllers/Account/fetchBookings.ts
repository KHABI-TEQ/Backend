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
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "../../services/whatsappClient.service";
import { dealSiteOriginFromPublicSlug } from "../../config/dealSitePublicHost";

/**
 * @swagger
 * /account/my-bookings/fetchAll:
 *   get:
 *     tags:
 *       - Account > Bookings
 *     summary: Fetch user's bookings with pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *     responses:
 *       200:
 *         description: Bookings fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 */
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

/**
 * @swagger
 * /account/my-bookings/{bookingId}:
 *   get:
 *     tags:
 *       - Account > Bookings
 *     summary: Get single booking details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Booking not found
 */
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

/**
 * @swagger
 * /account/my-bookings/stats:
 *   get:
 *     tags:
 *       - Account > Bookings
 *     summary: Get booking statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Booking stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBookings:
 *                       type: number
 *                     requestedBookings:
 *                       type: number
 *                     confirmedBookings:
 *                       type: number
 *                     cancelledBookings:
 *                       type: number
 *                     completedBookings:
 *                       type: number
 */
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
 * @swagger
 * /account/my-bookings/{bookingId}/respondToRequest:
 *   post:
 *     tags:
 *       - Account > Bookings
 *     summary: Respond to booking request (available/unavailable)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 enum: [available, unavailable]
 *               note:
 *                 type: string
 *                 description: Optional note for the buyer
 *     responses:
 *       200:
 *         description: Booking request responded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Response must be available or unavailable
 *       404:
 *         description: Booking not found or not in requested status
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
    const ownerData = property.owner as any;
    const expectedAmount = booking.meta.totalPrice;
    const propertyTitle: any = getPropertyTitleFromLocation(property.location);
   
    let paymentResponse: any;

    if (response === "available") {
      if (booking.receiverMode.type === "general") {
        paymentResponse = await PaystackService.initializePayment({
            email: buyer.email,
            amount: expectedAmount,
            fromWho: {
                kind: "Buyer",
                item: new Types.ObjectId(buyer._id as Types.ObjectId),
            },
            transactionType: "shortlet-booking",
            metadata: {
              settlementModel: "escrow",
              hostBase: booking.meta?.hostBase,
              hostPayout: booking.meta?.hostPayout,
            },
        });
      }

      if (booking.receiverMode.type === "dealSite") {
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
              hostBase: booking.meta?.hostBase,
              hostPayout: booking.meta?.hostPayout,
              dealSiteSlug: dealSite.publicSlug,
            },
        });

        await DB.Models.Booking.updateOne(
          { _id: booking._id },
          { $set: { "meta.settlementModel": "escrow" } }
        );
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

    if (response === "unavailable" && ownerData) {
      const buyerLine = (buyer.whatsAppNumber || buyer.phoneNumber || "") as string;
      const ownerLine = (ownerData.phoneNumber || "") as string;
      if (isLikelyE164CapableLocalPhone(buyerLine) && isLikelyE164CapableLocalPhone(ownerLine)) {
        void runWhatsapp("shortlet_booking_decline_whatsapp", async (wa) => {
          const agentName =
            [ownerData.firstName, ownerData.lastName].filter(Boolean).join(" ") || "Host";
          await wa.sendBookingCancellation({
            booking: {
              id: String(booking._id),
              dateTime: booking.bookingDetails.checkInDateTime,
              propertyName: String(propertyTitle),
            } as any,
            user: { name: buyer.fullName, phone: buyerLine, id: String(buyer._id) },
            agent: { name: agentName, phone: ownerLine, id: String(ownerData._id) },
            reason: note || "The host is not available for these dates",
          });
        });
      }
    }

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

