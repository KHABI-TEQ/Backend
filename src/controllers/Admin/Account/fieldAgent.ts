import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";
import bcrypt from "bcryptjs";

import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";

import {
  FieldAgentCreated,
  DeleteFieldAgent,
  ToggleFieldAgentStatus,
  InspectionAssigned,
  InspectionRemoved,
} from "../../../common/emailTemplates/fieldAgentMails";
import { generateUniqueAccountId, generateUniqueReferralCode } from "../../../utils/generateUniqueAccountId";

/**
 * Creates a new FieldAgent. An admin-only operation.
 *
 * @param req - The Express request object, containing field agent details in the body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const createFieldAgent = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
  
    const {
      email,
      firstName,
      lastName,
      password,
      phoneNumber,
      whatsappNumber,
      address,
      govtId,
      utilityBill,
      regionOfOperation,
      guarantors,
    } = req.body;

    const existingUser = await DB.Models.User.findOne({ email }).exec();
    if (existingUser) {
      return next(
        new RouteError(HttpStatusCodes.CONFLICT, 'User with this email already exists')
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const accountId = await generateUniqueAccountId();
    const referralCode = await generateUniqueReferralCode();

    const newUser = await DB.Models.User.create({
      email,
      firstName,
      lastName,
      phoneNumber,
      password: hashedPassword,
      userType: 'FieldAgent',
      accountId,
      referralCode,
      accountStatus: 'active',
      accountApproved: true,
      isAccountVerified: true,
    }); 

    const newFieldAgent = await DB.Models.FieldAgent.create({
      userId: newUser._id,
      whatsappNumber,
      address,
      govtId,
      utilityBill,
      regionOfOperation,
      guarantors,
      isFlagged: false,
      assignedInspections: [],
    });

    const mailBody = generalEmailLayout(
      FieldAgentCreated(firstName, email, password)
    );

    await sendEmail({
      to: newUser.email,
      subject: 'Welcome to the Team! Your Field Agent Account is Ready',
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: 'Field Agent created successfully',
      data: {
        user: newUser.toObject(),
        fieldAgent: newFieldAgent.toObject(),
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Updates an existing Field Agent's profile.
 *
 * @param req - The Express request object, containing userId in params and updated data in the body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const updateFieldAgent = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const {
      email,
      firstName,
      lastName,
      phoneNumber,
      whatsappNumber,
      address,
      govtId,
      utilityBill,
      regionOfOperation,
      guarantors,
    } = req.body;

    const user = await DB.Models.User.findById(userId);
    if (!user || user.userType !== "FieldAgent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found"));
    }

    // Check account status
    if (user.isDeleted) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Field agent account has been deleted");
    }

    // Update user info
    if (email !== undefined) user.email = email;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

    await user.save();

    // Update FieldAgent profile
    const fieldAgent = await DB.Models.FieldAgent.findOne({ userId });
    if (!fieldAgent) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent profile not found"));
    }

    if (whatsappNumber !== undefined) fieldAgent.whatsappNumber = whatsappNumber;
    if (address !== undefined) fieldAgent.address = address;
    if (govtId !== undefined) fieldAgent.govtId = govtId;
    if (utilityBill !== undefined) fieldAgent.utilityBill = utilityBill;
    if (regionOfOperation !== undefined) fieldAgent.regionOfOperation = regionOfOperation;
    if (guarantors !== undefined && Array.isArray(guarantors)) {
      fieldAgent.guarantors = guarantors;
    }

    await fieldAgent.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Field Agent profile updated successfully",
      data: {
        user: user.toObject(),
        fieldAgent: fieldAgent.toObject(),
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Toggles the 'isInActive' status of a field agent.
 *
 * @param req - The Express request object, containing userId in params and isInActive/reason in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const toggleFieldAgentStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (typeof status !== "boolean") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Status (boolean) is required.",
      });
    }

    // Validate user existence and type
    const user = await DB.Models.User.findById(userId).exec();
    if (!user || user.userType !== "FieldAgent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "User not found or not a field agent"));
    }

    // Check account status
    if (user.isDeleted) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Field agent account has been deleted");
    }

    // Update user and field agent status
    user.accountStatus = "active";
    user.isInActive = status;
    
    if (!status) {
      user.accountStatus = "inactive";
    }
    
    await user.save();

    await DB.Models.FieldAgent.findOneAndUpdate(
      { userId },
      { accountApproved: status },
      { new: true }
    ).exec();

    // Send email notification
    const mailBody = generalEmailLayout(
      ToggleFieldAgentStatus(
        user.fullName || `${user.firstName || ""} ${user.lastName || ""}` || user.email,
        status,
        reason || ""
      )
    );

    await sendEmail({
      to: user.email,
      subject: status ? "Account Deactivated" : "Account Activated",
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: status ? "Field Agent deactivated successfully" : "Field Agent activated successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a field agent's account and associated records (soft-delete).
 *
 * @param req - The Express request object, containing userId in params and reason in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const deleteFieldAgentAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Get User and validate type
    const user = await DB.Models.User.findById(userId).exec();
    if (!user || user.userType !== "FieldAgent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found"));
    }

    // Fetch related FieldAgent record
    const fieldAgent = await DB.Models.FieldAgent.findOne({ userId: user._id }).exec();
    if (!fieldAgent) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent profile not found"));
    }

    // ✅ Check if already deleted
    if (user.isDeleted) {
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, "Field Agent account has already been deleted"));
    }

    // Perform soft-delete on both User and FieldAgent
    await DB.Models.User.findByIdAndUpdate(user._id, {
      isDeleted: true,
      accountApproved: false
    }).exec();

    await DB.Models.FieldAgent.findByIdAndUpdate(fieldAgent._id, {
      isDeleted: true,
      accountApproved: false
    }).exec();

    // Send email
    const mailBody = generalEmailLayout(
      DeleteFieldAgent(
        user.firstName || user.lastName || user.email,
        reason
      )
    );

    await sendEmail({
      to: user.email,
      subject: "Account Deleted",
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Field Agent and associated records deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Assigns a property inspection to a field agent.
 *
 * @param req - The Express request object, containing fieldAgentId and inspectionId in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const assignInspectionToFieldAgent = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => { 
  try {
    const { fieldAgentId, inspectionId } = req.body;

    if (!fieldAgentId || !inspectionId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Field Agent ID and Inspection ID are required.",
      });
    }

    const fieldAgent = await DB.Models.FieldAgent.findById(fieldAgentId).exec();
    if (!fieldAgent) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found"));
    }

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId).exec();
    if (!inspection) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found"));
    }
    
    // Check if inspection is already assigned
    if (inspection.assignedFieldAgent && inspection.assignedFieldAgent.toString() === fieldAgentId) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Inspection is already assigned to this Field Agent."
      });
    }

    // Update the inspection record
    inspection.assignedFieldAgent = fieldAgentId;
    await inspection.save();

    // Update the field agent's assigned inspections array
    fieldAgent.assignedInspections.push(inspectionId);
    await fieldAgent.save();

    // Fetch user for email
    const user = await DB.Models.User.findById(fieldAgent.userId).exec();
    
    if (user) {

        const date = new Date(inspection.inspectionDate);
        const time = new Date(inspection.inspectionTime);

        const inspectionDateStr = date.toLocaleDateString("en-NG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const inspectionTimeStr = time.toLocaleTimeString("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
        });
        // Send email notification
        const mailBody = generalEmailLayout(
            InspectionAssigned(user.firstName, inspectionDateStr, inspectionTimeStr)
        );

        await sendEmail({
            to: user.email,
            subject: "New Inspection Assigned",
            text: mailBody,
            html: mailBody,
        });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection assigned to Field Agent successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Removes a property inspection from a field agent.
 *
 * @param req - The Express request object, containing inspectionId in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const removeInspectionFromFieldAgent = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { inspectionId } = req.body;

    if (!inspectionId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Inspection ID is required.",
      });
    }

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId).exec();
    if (!inspection) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found"));
    }

    const fieldAgentId = inspection.assignedFieldAgent;

    if (!fieldAgentId) {
        return res.status(HttpStatusCodes.BAD_REQUEST).json({
            success: false,
            message: "Inspection is not currently assigned to any field agent."
        });
    }
    
    // Update the inspection record
    inspection.assignedFieldAgent = null;
    await inspection.save();

    // Remove the inspection from the field agent's assigned inspections array
    await DB.Models.FieldAgent.findByIdAndUpdate(
      fieldAgentId,
      { $pull: { assignedInspections: inspectionId } }
    );

    // Fetch user for email
    const user = await DB.Models.User.findById(inspection.assignedFieldAgent).exec();

    if (user) {

      const date = new Date(inspection.inspectionDate);
      const time = new Date(inspection.inspectionTime);

      const inspectionDateStr = date.toLocaleDateString("en-NG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const inspectionTimeStr = time.toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      });

        // Send email notification
        const mailBody = generalEmailLayout(
            InspectionRemoved(user.firstName, inspectionDateStr, inspectionTimeStr)
        );

        await sendEmail({
            to: user.email,
            subject: "Inspection Assignment Removed",
            text: mailBody,
            html: mailBody,
        });
    }


    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection removed from Field Agent successfully",
    });
  } catch (err) {
    next(err);
  }
};
 
/**
 * Retrieves all field agents with filters, search, and pagination.
 *
 * @param req - The Express request object, containing query parameters for filtering, searching, and pagination.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getAllFieldAgents = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const safePage = Math.max(1, Number(req.query.page) || 1);
    const safeLimit = Math.max(1, Number(req.query.limit) || 10);
    const skip = (safePage - 1) * safeLimit;

    const {
      search,
      isInActive,
      isFlagged,
      regionOfOperation,
      whatsappNumber,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const userMatch: any = { 
      userType: "FieldAgent", 
      isDeleted: false
    };

    const searchConditions: any[] = [];

    if (search && search.toString().trim()) {
      const regex = new RegExp(search.toString().trim(), "i");
      searchConditions.push(
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
        { fullName: regex }
      );
    }

    if (searchConditions.length > 0) {
      userMatch.$or = searchConditions;
    }

    const sort: any = {};
    sort[sortBy.toString()] = sortOrder === "asc" ? 1 : -1;

    const basePipeline = [
      { $match: userMatch },
      { 
        $lookup: {
          from: "fieldagents",
          localField: "_id",
          foreignField: "userId",
          as: "fieldAgentProfile",
        },
      },
      { $unwind: { path: "$fieldAgentProfile", preserveNullAndEmptyArrays: true } },
      {
        $match: { // exclude deleted field agent profile
          ...(isFlagged !== undefined && { "fieldAgentProfile.isFlagged": isFlagged === "true" }),
          ...(regionOfOperation && { "fieldAgentProfile.regionOfOperation": regionOfOperation }),
          ...(whatsappNumber && { "fieldAgentProfile.whatsappNumber": new RegExp(whatsappNumber.toString(), "i") }),
        },
      },
      {
        $project: {
          password: 0,
          googleId: 0,
          facebookId: 0,
          __v: 0,
          "fieldAgentProfile.__v": 0,
        },
      }
    ];

    const [fieldAgents, totalResults] = await Promise.all([
      DB.Models.User.aggregate([
        ...basePipeline,
        { $sort: sort },
        { $skip: skip },
        { $limit: safeLimit },
      ]),
      DB.Models.User.aggregate([
        ...basePipeline,
        { $count: "total" },
      ]),
    ]);

    const total = totalResults[0]?.total || 0;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Field Agents fetched successfully",
      data: fieldAgents,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Retrieves the complete profile of a single field agent, including assigned inspections.
 *
 * @param req - The Express request object, containing userId in params.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getSingleFieldAgentProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "FieldAgent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found"));
    }

    const fieldAgentData = await DB.Models.FieldAgent.findOne({ userId }).lean();
    
    if (!fieldAgentData) {
        return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent record not found"));
    }

    const inspections = await DB.Models.InspectionBooking.find({ 
        _id: { $in: fieldAgentData.assignedInspections } 
    }).populate("propertyId").lean();

    const profileData = {
      user,
      fieldAgentData,
      assignedInspections: inspections,
      stats: {
        totalAssignedInspections: inspections.length,
        completedInspections: inspections.filter((i: any) => i.status === "completed").length,
        pendingInspections: fieldAgentData.assignedInspections.length,
      },
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Field Agent profile fetched successfully",
      data: profileData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Flags or unflags a field agent's account.
 *
 * @param req - The Express request object, containing userId in params and status in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const flagOrUnflagFieldAgentAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params; // ID from the users table
    const { status } = req.body; // boolean

    if (typeof status !== "boolean") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Flag status (boolean) is required.",
      });
    }

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "FieldAgent") {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Field Agent not found or not a field agent"
        )
      );
    }

    // Find and update the field agent using userId
    const fieldAgent = await DB.Models.FieldAgent.findOneAndUpdate(
      { userId },
      { isFlagged: status },
      { new: true }
    ).exec();

    if (!fieldAgent) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent record not found")
      );
    }

    // Also update the User's flagged status
    await DB.Models.User.findByIdAndUpdate(userId, { isFlagged: status });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: status
        ? "Field Agent flagged successfully"
        : "Field Agent unflagged successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves field agent dashboard statistics.
 *
 * @param req - The Express request object, expecting userType query param.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getFieldAgentDashboardStatistics = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userType = "FieldAgent";
    
    // Compute statistics
    const [totalActiveFieldAgents, totalInactiveFieldAgents, totalFlaggedFieldAgents, totalFieldAgents] = await Promise.all([
      DB.Models.User.countDocuments({
        isInActive: false,
        isDeleted: false,
        userType,
      }),
      DB.Models.User.countDocuments({
        isInActive: true,
        isDeleted: false,
        userType,
      }),
      DB.Models.User.countDocuments({
        isFlagged: true,
        isDeleted: false,
        userType,
      }),
      DB.Models.User.countDocuments({ userType, isDeleted: false, }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Field Agent dashboard statistics fetched successfully",
      data: {
        totalActiveFieldAgents,
        totalInactiveFieldAgents,
        totalFlaggedFieldAgents,
        totalFieldAgents,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Retrieves all inspections assigned to a specific field agent with pagination.
 *
 * @param req - The Express request object, containing userId in params and query for pagination.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getFieldAgentAssignedInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const safePage = Math.max(1, Number(req.query.page) || 1);
    const safeLimit = Math.max(1, Number(req.query.limit) || 10);
    const skip = (safePage - 1) * safeLimit;

    const fieldAgent = await DB.Models.FieldAgent.findOne({ userId }).exec();

    if (!fieldAgent) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found"));
    }

    const inspectionIds = fieldAgent.assignedInspections;
    const total = inspectionIds.length;

    const inspections = await DB.Models.InspectionBooking.find({
      _id: { $in: inspectionIds },
    })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Assigned inspections fetched successfully",
      data: inspections,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Validate Field Agent account is active & approved
 */
export const validateActiveFieldAgent = async (fieldAgentId: string) => {

  // Fetch field agent record
  const fieldAgent = await DB.Models.FieldAgent.findById(fieldAgentId).exec();
  if (!fieldAgent) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Field agent not found");
  }

  // Check account status
  // if (fieldAgent.isDeleted) {
  //   throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Field agent account has been deleted");
  // }


  if (!fieldAgent.accountApproved) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Field agent account has not been approved");
  }

  return fieldAgent; // Return it so caller can use the details
};
