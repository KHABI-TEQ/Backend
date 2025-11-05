import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { formatInspectionForTable } from "../../../utils/formatInspectionForTable";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { BuyerDetailsToSellerTemplate, SellerDetailsToBuyerTemplate } from "../../../common/emailTemplates/inspectionMails";
import sendEmail from "../../../common/send.email";

// Fetch all inspections assigned to field agent
export const fetchAssignedInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      inspectionType,
      inspectionMode,
      inspectionStatus,
      stage,
      propertyId,
    } = req.query;

    const filter: any = {
      assignedFieldAgent: req.user._id,
    };

    if (status) filter.status = status;
    if (inspectionType) filter.inspectionType = inspectionType;
    if (inspectionMode) filter.inspectionMode = inspectionMode;
    if (inspectionStatus) filter.inspectionStatus = inspectionStatus;
    if (stage) filter.stage = stage;
    if (propertyId) filter.propertyId = propertyId;

    const inspections = await DB.Models.InspectionBooking.find(filter)
      .populate("propertyId")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await DB.Models.InspectionBooking.countDocuments(filter);

    const formattedInspections = inspections.map((inspection) =>
      formatInspectionForTable(inspection),
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: formattedInspections,
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


// Fetch 5 most recent inspections assigned to field agent
export const fetchRecentAssignedInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      assignedFieldAgent: req.user._id,
    };

    const inspections = await DB.Models.InspectionBooking.find(filter)
      .populate("propertyId")
      .sort({ createdAt: -1 })
      .limit(5);

    const formattedInspections = inspections.map((inspection) =>
      formatInspectionForTable(inspection),
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: formattedInspections,
    });
  } catch (err) {
    next(err);
  }
};


// Fetch single assigned inspection
export const getOneAssignedInspection = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;

    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
      assignedFieldAgent: req.user._id,
    })
      .populate("propertyId")
      .populate("owner")
      .populate("requestedBy")

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: inspection,
    });
  } catch (err) {
    next(err);
  }
};


// Send inspection participant details
export const sendInspectionParticipantDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;
    const { send } = req.body;

    if (!["buyer-to-seller", "seller-to-buyer", "send-both"].includes(send)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid send direction");
    }

    // 🔍 Find inspection and populate participants
    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
    })
      .populate("propertyId")
      .populate("owner")
      .populate("requestedBy");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const property = inspection.propertyId as any;
    const buyer = inspection.requestedBy as any;
    const seller = inspection.owner as any;

    if (!buyer || !seller) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing buyer or seller info");
    }

    // ✅ Shared email templates
    const buyerToSeller = {
      to: seller.email,
      subject: "Seller details for your property inspection",
      html: generalEmailLayout(
        BuyerDetailsToSellerTemplate(seller, buyer, inspection, property)
      ),
      text: generalEmailLayout(
        BuyerDetailsToSellerTemplate(seller, buyer, inspection, property)
      ),
    };

    const sellerToBuyer = {
      to: buyer.email,
      subject: "Buyer details for your property inspection",
      html: generalEmailLayout(
        SellerDetailsToBuyerTemplate(buyer, seller, inspection, property)
      ),
      text: generalEmailLayout(
        SellerDetailsToBuyerTemplate(buyer, seller, inspection, property)
      ),
    };

    // 📨 Determine send direction
    if (send === "buyer-to-seller") {
      await sendEmail(buyerToSeller);
    } else if (send === "seller-to-buyer") {
      await sendEmail(sellerToBuyer);
    } else if (send === "send-both") {
      // ✅ Send both concurrently
      await Promise.all([sendEmail(buyerToSeller), sendEmail(sellerToBuyer)]);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        send === "send-both"
          ? "Both buyer and seller details sent successfully"
          : `Details sent successfully from ${send.replace("-", " ")}`,
    });
  } catch (err) {
    next(err);
  }
};

 


// Get stats for field agent
export const getAssignedInspectionStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user._id;

    const baseFilter = { assignedFieldAgent: userId };

    const [
      totalInspections,
      pendingInspections,
      completedInspections,
      cancelledInspections,
      avgResponse
    ] = await Promise.all([
      DB.Models.InspectionBooking.countDocuments(baseFilter),

      DB.Models.InspectionBooking.countDocuments({
        ...baseFilter,
        status: {
          $in: [
            "pending_transaction",
            "inspection_rescheduled",
            "inspection_approved",
            "active_negotiation",
            "negotiation_countered",
            "negotiation_accepted",
            "negotiation_rejected",
            "negotiation_cancelled",
          ],
        },
      }),

      DB.Models.InspectionBooking.countDocuments({
        ...baseFilter,
        status: "completed",
      }),

      DB.Models.InspectionBooking.countDocuments({
        ...baseFilter,
        status: "cancelled",
      }),

      DB.Models.InspectionBooking.aggregate([
        { $match: { assignedFieldAgent: userId } },
        {
          $project: {
            createdAt: 1,
            updatedAt: 1,
            diffInHours: {
              $divide: [
                { $subtract: ["$updatedAt", "$createdAt"] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTimeInHours: { $avg: "$diffInHours" },
          },
        },
      ]),
    ]);

    const averageResponseTimeInHours = avgResponse[0]?.avgResponseTimeInHours || 0;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        totalInspections,
        pendingInspections,
        completedInspections,
        cancelledInspections,
        averageResponseTimeInHours: Number(averageResponseTimeInHours.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
};


// Submit inspection attendance report
export const submitInspectionReport = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;
    const {
      buyerPresent,
      sellerPresent,
      buyerInterest,
      notes,
    } = req.body;

    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
      assignedFieldAgent: req.user._id,
    });

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found or not assigned to you");
    }

     // Determine status based on attendance
    const bothPresent = Boolean(buyerPresent) && Boolean(sellerPresent);
    const status = bothPresent ? "completed" : "absent";

    inspection.inspectionReport = {
      ...inspection.inspectionReport,
      buyerPresent: Boolean(buyerPresent),
      sellerPresent: Boolean(sellerPresent),
      buyerInterest: buyerInterest || null,
      notes: notes || "",
      wasSuccessful: bothPresent,
      status,
      submittedAt: new Date(),
    };

    await inspection.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection report submitted successfully",
      data: inspection.inspectionReport,
    });
  } catch (err) {
    next(err);
  }
};

// Start an inspection
export const startInspection = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;

    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
      assignedFieldAgent: req.user._id,
    });

    if (!inspection) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Inspection not found or not assigned to you"
      );
    }

    if (inspection.status === "completed") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Inspection has already been completed"
      );
    }

    if (inspection.inspectionReport.status === "in-progress") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Inspection already started"
      );
    }

    inspection.inspectionReport.status = "in-progress";
    inspection.inspectionReport.inspectionStartedAt = new Date();

    await inspection.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection started successfully",
      data: {
        status: inspection.inspectionReport.status,
        startedAt: inspection.inspectionReport.inspectionStartedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Stop / Complete an inspection
export const completeInspection = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;

    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
      assignedFieldAgent: req.user._id,
    });

    if (!inspection) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Inspection not found or not assigned to you"
      );
    }

    if (inspection.inspectionReport.status !== "in-progress") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "You can only complete an inspection that is in progress"
      );
    }

    inspection.inspectionReport.status = "awaiting-report";
    inspection.inspectionReport.inspectionCompletedAt = new Date();

    await inspection.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection marked as complete, pending report submission",
      data: {
        status: inspection.inspectionReport.status,
        completedAt: inspection.inspectionReport.inspectionCompletedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

