import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";

// Fetch Profile
export const getProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const user = await DB.Models.User.findById(userId).lean();
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      userType: user.userType,
      isAccountVerified: user.isAccountVerified,
      accountApproved: user.accountApproved,
      isAccountInRecovery: user.isAccountInRecovery,
      address: user.address,
      profile_picture: user.profile_picture,
      isInActive: user.isInActive,
      isDeleted: user.isDeleted,
      accountStatus: user.accountStatus,
      isFlagged: user.isFlagged,
      accountId: user.accountId,
    };

    let responseData: any = userResponse;

    if (user.userType === "Agent") {
      const agentData = await DB.Models.Agent.findOne({
        userId: user._id,
      }).lean();

      if (agentData?.agentType) {
        responseData = {
          ...userResponse,
          agentData,
          isAccountApproved: user.accountApproved,
        };
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        user: responseData,
      }
    });
  } catch (err) {
    next(err);
  }
};

// Update Profile (e.g. name, phone, address)
export const updateProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    const updateData = req.body;

    const updated = await DB.Models.User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Change Email (check if email exists before update)
export const changeEmail = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    const { newEmail } = req.body;

    if (!newEmail) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "New email is required",
      );
    }

    const exists = await DB.Models.User.findOne({ email: newEmail });
    if (exists) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email already in use");
    }

    const updated = await DB.Models.User.findByIdAndUpdate(
      userId,
      { email: newEmail.toLowerCase(), isAccountVerified: false },
      { new: true },
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Email changed successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Change Password (must check old password)
export const changePassword = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Old and new password are required",
      );
    }

    const user = await DB.Models.User.findById(userId);
    if (!user || !user.password) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid old password");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Request Account Deletion (Soft delete or Flag)
export const requestAccountDeletion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;

    const updated = await DB.Models.User.findByIdAndUpdate(
      userId,
      { isDeleted: true, accountStatus: "deleted" },
      { new: true },
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Account deletion requested successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Notification Settings (toggle on/off)
export const updateNotificationSettings = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    const { enableNotifications } = req.body;

    if (typeof enableNotifications !== "boolean") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Notification status is required",
      );
    }

    const updated = await DB.Models.User.findByIdAndUpdate(
      userId,
      { enableNotifications },
      { new: true },
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Notification settings updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}; 


// Dashboard Request
export const getDashboardData = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const user = await DB.Models.User.findById(userId).lean();
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    const basePropertyQuery = {
      owner: userId,
      isDeleted: { $ne: true },
    };

    const totalBriefs = await DB.Models.Property.countDocuments(basePropertyQuery);

    const totalActiveBriefs = await DB.Models.Property.countDocuments({
      ...basePropertyQuery,
      status: "active",
    });

    const totalPendingBriefs = await DB.Models.Property.countDocuments({
      ...basePropertyQuery,
      status: "pending",
    });

    const newPendingBriefs = await DB.Models.Property.find({
      ...basePropertyQuery,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id briefType status createdAt pictures price location.area location.localGovernment location.state");

    const totalViews = 0; // Placeholder for when view tracking is implemented

    // Inspection metrics
    const totalInspectionRequests = await DB.Models.InspectionBooking.countDocuments({
      owner: userId,
    });

    const totalCompletedInspectionRequests = await DB.Models.InspectionBooking.countDocuments({
      owner: userId,
      status: "completed",
    });

    const dashboardData: Record<string, any> = {
      totalBriefs,
      totalActiveBriefs,
      totalPendingBriefs,
      newPendingBriefs,
      totalViews,
      totalInspectionRequests,
      totalCompletedInspectionRequests,
    };

    // If Landowner, add propertySold
    if (user.userType === "Landowners") {
      const propertySold = await DB.Models.Property.countDocuments({
        ...basePropertyQuery,
        status: "sold",
      });
      dashboardData.propertySold = propertySold;
    }

    // If Agent, add completedDeals, commission, preference matches
    if (user.userType === "Agent") {
      const completedDeals = await DB.Models.Transaction.countDocuments({
        agent: userId,
        status: "completed",
      });

      const totalCommission = 0; // Replace with actual commission logic

      Object.assign(dashboardData, {
        completedDeals,
        totalCommission,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: dashboardData,
    });
  } catch (err) {
    next(err);
  }
};

