import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { deleteLandlordMail } from "../../../common/emailTemplates/landlordMails";

/**
 * Retrieves all landlords with filters, search, and pagination.
 *
 * @param req - The Express request object, containing query parameters for filtering, searching, and pagination.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getAllLandlords = async (
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
      isAccountVerified,
      isInActive,
      isFlagged,
      accountApproved,
      accountStatus,
      excludeInactive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = { userType: "Landowners", isDeleted: false };
    const searchConditions: any[] = [];

    if (search && search.toString().trim()) {
      const regex = new RegExp(search.toString().trim(), "i");
      searchConditions.push(
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
        { fullName: regex },
      );
    }

    if (searchConditions.length > 0) {
      query.$or = searchConditions;
    }

    if (isAccountVerified !== undefined) {
      query.isAccountVerified = isAccountVerified === "true";
    }
    if (isInActive !== undefined) {
      query.isInActive = isInActive === "true";
    }
    if (isFlagged !== undefined) {
      query.isFlagged = isFlagged === "true";
    }
    if (accountApproved !== undefined) {
      query.accountApproved = accountApproved === "true";
    }

    if (accountStatus && accountStatus !== "null") {
        query.accountStatus = accountStatus;
    }

    if (excludeInactive !== false && excludeInactive !== "false") {
      query.isInActive = false;
    }

    const sortObj: any = {};
    sortObj[sortBy.toString()] = sortOrder === "asc" ? 1 : -1;

    const landlords = await DB.Models.User.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await DB.Models.User.countDocuments(query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Landlords fetched successfully",
      data: landlords,
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
 * Retrieves the profile of a single landlord by ID.
 *
 * @param req - The Express request object, containing userId in params.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getSingleLandlord = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "Landowners") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Landlord not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Landlord fetched successfully",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves all properties owned by a specific landlord.
 *
 * @param req - The Express request object, containing userId in params.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getAllLandlordProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "Landowners") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Landlord not found"));
    }

    const properties = await DB.Models.Property.find({
      owner: user._id,
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.Property.countDocuments({ owner: user._id });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Landlord properties fetched successfully",
      data: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a landlord's account.
 *
 * @param req - The Express request object, containing userId in params and reason in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const deleteLandlordAction = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Reason for deletion is required.",
      });
    }

    const user = await DB.Models.User.findOneAndDelete({
      _id: userId,
      userType: "Landowners",
    }).exec();

    if (!user) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Landlord not found or already deleted."));
    }

    // Optionally delete associated properties, transactions, inspections, etc.
    // await DB.Models.Property.deleteMany({ owner: user._id }).exec();
    // await DB.Models.Transaction.deleteMany({ buyerId: user._id }).exec(); // Or other relevant fields
    // await DB.Models.InspectionBooking.deleteMany({ bookedBy: user._id }).exec(); // Or other relevant fields

    // Placeholder for email sending - you might need a specific template
    const emailTemplate = deleteLandlordMail(user.firstName, reason);
    const mailBody = generalEmailLayout(emailTemplate);

    await sendEmail({
      to: user.email,
      subject: "Your Account Has Been Deleted",
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Landlord account deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Toggles the 'isInActive' and 'accountApproved' status of a landlord.
 *
 * @param req - The Express request object, containing userId in params and isInactive/reason in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const toggleLandlordAccountStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { isInactive, reason } = req.body;

    if (typeof isInactive !== 'boolean') {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "isInactive status (boolean) is required.",
      });
    }

    const user = await DB.Models.User.findOneAndUpdate(
      { _id: userId, userType: "Landowners" },
      {
        isInActive: isInactive,
        accountApproved: !isInactive, // If inactive, account is not approved; if active, it is approved.
      },
      { new: true }
    ).exec();

    if (!user) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Landlord not found"));
    }

    // Placeholder for email sending - you might need a specific template
    const statusMessage = isInactive ? "deactivated" : "activated";
    const mailBody = generalEmailLayout(
      `Your KhabiTeqRealty account has been ${statusMessage}. Reason: ${reason || 'N/A'}.`
    );

    await sendEmail({
      to: user.email,
      subject: `Account ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}`,
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Landlord account ${statusMessage} successfully`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Flags or unflags a landowner's account.
 *
 * @param req - The Express request object, containing userId in params and status in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const flagOrUnflagLandownerAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // boolean

    if (typeof status !== 'boolean') {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Flag status (boolean) is required.",
      });
    }

    const isFlagged = status;

    const user = await DB.Models.User.findOneAndUpdate(
      { _id: userId, userType: "Landowners" },
      { isFlagged },
      { new: true },
    ).exec();

    if (!user) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Landowner not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: isFlagged
        ? "Landowner flagged successfully"
        : "Landowner unflagged successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Retrieves only landlord dashboard statistics.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getLandlordDashboardStatistics = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userType = "Landowners"; // Fixed user type for landlords

    // Compute overall stats
    const [totalActiveLandlords, totalInactiveLandlords, totalFlaggedLandlords, totalLandlords] = await Promise.all([
      DB.Models.User.countDocuments({
        isInActive: false,
        accountApproved: true,
        userType,
      }),
      DB.Models.User.countDocuments({
        isInActive: true,
        accountApproved: true,
        userType,
      }),
      DB.Models.User.countDocuments({
        isFlagged: true,
        accountApproved: true,
        userType,
      }),
      DB.Models.User.countDocuments({ userType }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Landlord dashboard statistics fetched successfully",
      data: {
        totalActiveLandlords,
        totalInactiveLandlords,
        totalFlaggedLandlords,
        totalLandlords,
      },
    });
  } catch (err) {
    next(err);
  }
};

