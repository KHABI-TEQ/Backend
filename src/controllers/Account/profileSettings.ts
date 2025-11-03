import { Response, NextFunction } from "express"; 
import { AppRequest } from "../../types/express"; 
import { DB } from ".."; 
import HttpStatusCodes from "../../common/HttpStatusCodes"; 
import { RouteError } from "../../common/classes"; 
import bcrypt from "bcryptjs"; 
import { SystemSettingService } from "../../services/systemSetting.service";
import { UserSubscriptionSnapshotService } from "../../services/userSubscriptionSnapshot.service";
import { DealSiteService } from "../../services/dealSite.service";
import sendEmail from "../../common/send.email";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";
import { generateAccountDeletedEmail, generateAccountDeletionRequestEmail, generateAccountUpdatedEmail } from "../../common/emailTemplates/profileSettingsMails";

// Fetch Profile
export const getProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
   
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
      referralCode: user.referralCode,
      createdAt: user.createdAt
    };

    let responseData: any = userResponse;

    if (user.userType === "Agent") {
      const agentData = await DB.Models.Agent.findOne({ userId: user._id }).lean();

      // Get active subscription snapshot using the service
      const activeSnapshot = await UserSubscriptionSnapshotService.getActiveSnapshotWithFeatures(
        user._id.toString()
      );

      // get the agent deal site page if found
      const dealSite = await DealSiteService.getByAgent(user._id.toString());

      responseData = {
        ...userResponse,
        agentData,
        isAccountApproved: user.accountApproved,
        activeSubscription: activeSnapshot || null,
        dealSite: dealSite || null
      };
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        user: responseData,
      },
    });
  } catch (err) {
    next(err);
  }
};


// Update Profile (firstName, lastName, phoneNumber, address.street)
export const updateProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    // Define which fields are allowed
    const allowedFields = ["firstName", "lastName", "phoneNumber", "address"];
    const updateData: Record<string, any> = {};

    // Build updateData safely
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        // Special handling for nested address field
        if (key === "address" && typeof req.body.address === "string") {
          updateData["address.street"] = req.body.address;
        } else {
          updateData[key] = req.body[key];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "No valid fields provided to update"
      );
    }

    const updatedUser = await DB.Models.User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).lean();

    if (!updatedUser) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    // --- Send confirmation email ---
    const updatedFieldsList = Object.keys(updateData).map((key) => {
      const parts = key.split(".");
      const fieldName = parts[parts.length - 1]; // e.g., "street" from "address.street"
      return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    });

    const emailBody = generalEmailLayout(
      generateAccountUpdatedEmail({
        fullName: `${updatedUser.firstName || ""} ${updatedUser.lastName || ""}`.trim() || "User",
        updatedFields: updatedFieldsList,
        settingsLink: `${process.env.CLIENT_LINK}/profile-settings`,
      })
    );

    await sendEmail({
      to: updatedUser.email,
      subject: "Your Account Information Has Been Updated",
      html: emailBody,
      text: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};


// Update Profile Picture
export const updateProfilePicture = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    // Accepts already uploaded URL from frontend
    const { profile_picture } = req.body;
    if (!profile_picture) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "No profile picture provided");
    }

    const updatedUser = await DB.Models.User.findByIdAndUpdate(
      userId,
      { profile_picture },
      { new: true }
    ).lean();

    if (!updatedUser) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    // --- Send confirmation email ---
    const emailBody = generalEmailLayout(
      generateAccountUpdatedEmail({
        fullName: updatedUser.fullName || "User",
        updatedFields: ["Profile Picture"],
        settingsLink: `${process.env.CLIENT_LINK}/profile-settings`,
      })
    );

    await sendEmail({
      to: updatedUser.email,
      subject: "Your Account Information Has Been Updated",
      html: emailBody,
      text: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile picture updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};


// Change Email (check if email exists before update and notify user)
export const changeEmail = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const { newEmail } = req.body;

    if (!newEmail) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "New email is required"
      );
    }

    // Check if email already exists
    const exists = await DB.Models.User.findOne({ email: newEmail.toLowerCase() });
    if (exists) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email already in use");
    }

    // Update email and mark account unverified
    const updatedUser = await DB.Models.User.findByIdAndUpdate(
      userId,
      { email: newEmail.toLowerCase(), isAccountVerified: false },
      { new: true }
    ).lean();

    if (!updatedUser) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    // --- Send confirmation email to the new address ---
    const emailBody = generalEmailLayout(
      generateAccountUpdatedEmail({
        fullName: `${updatedUser.firstName || ""} ${updatedUser.lastName || ""}`.trim() || "User",
        updatedFields: ["Email Address"],
        settingsLink: `${process.env.CLIENT_LINK}/profile-settings`,
      })
    );

    await sendEmail({
      to: updatedUser.email,
      subject: "Your Account Email Has Been Changed",
      html: emailBody,
      text: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Email changed successfully and confirmation sent",
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};


// Change Password (must check old password)
export const changePassword = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Old and new password are required"
      );
    }

    const user = await DB.Models.User.findById(userId);
    if (!user || !user.password) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    // ✅ Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid old password");
    }

    // ✅ Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // --- Send confirmation email ---
    const emailBody = generalEmailLayout(
      generateAccountUpdatedEmail({
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
        updatedFields: ["Password"],
        settingsLink: `${process.env.CLIENT_LINK}/profile-settings?tab=password`,
      })
    );

    await sendEmail({
      to: user.email,
      subject: "Your Account Password Has Been Changed",
      html: emailBody,
      text: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    next(err);
  }
};


// Request Account Deletion (Schedule deletion, not immediate)
export const requestAccountDeletion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const user = await DB.Models.User.findById(userId);

    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    // Set deletion metadata
    const deletionRequestedAt = new Date();
    const deletionGracePeriodDays = 7;
    const cancellationDate = new Date(
      deletionRequestedAt.getTime() + deletionGracePeriodDays * 24 * 60 * 60 * 1000
    );

    // Update user record
    user.deletionRequestedAt = deletionRequestedAt;
    user.deletionGracePeriodDays = deletionGracePeriodDays;
    user.accountStatus = "pending_deletion";
    await user.save();

    // Format dates nicely for the email
    const deletionRequestDateStr = deletionRequestedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const cancellationDateStr = cancellationDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate a secure link to revert deletion (frontend route)
    const revertDeletionLink = `${process.env.CLIENT_LINK}/profile-settings?tab=account`;

    // Generate email content
    const emailBody = generalEmailLayout(
      generateAccountDeletionRequestEmail({
        fullName: `${user.firstName} ${user.lastName}`,
        deletionRequestDate: deletionRequestDateStr,
        cancellationDate: cancellationDateStr,
        revertDeletionLink,
      })
    );

    // Send email notification to the user
    await sendEmail({
      to: user.email,
      subject: "Your Account Deletion Request",
      html: emailBody,
      text: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Account deletion requested. Your account will be permanently deleted after ${deletionGracePeriodDays} days unless you cancel.`,
    });
  } catch (err) {
    next(err);
  }
};


// Cancel Account Deletion
export const cancelAccountDeletion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    const updated = await DB.Models.User.findByIdAndUpdate(
      userId,
      {
        $unset: { deletionRequestedAt: "", deletionGracePeriodDays: "" },
        accountStatus: "active",
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Account deletion request canceled successfully",
    });
  } catch (err) {
    next(err);
  }
};


// Permanently Delete Account (immediate)
export const deleteAccountImmediately = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const user = await DB.Models.User.findById(userId);

    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    const fullName = `${user.firstName} ${user.lastName}`.trim();

    // 🧹 Clean up related data
    await Promise.all([
      DB.Models.Property.deleteMany({ owner: userId }),
      DB.Models.DealSite.deleteMany({ createdBy: userId }),
      DB.Models.PaymentMethod.deleteMany({ user: userId }),
      DB.Models.NewTransaction.deleteMany({ "fromWho.kind": "User", "fromWho.item": userId }),
      DB.Models.Notification.deleteMany({ user: userId }),
    ]);

    // 🗑️ Permanently remove user
    await user.deleteOne();

    // 📧 Notify admin
    const adminEmailBody = generalEmailLayout(
      generateAccountDeletedEmail({
        fullName,
        deletionDate: new Date().toISOString(),
      })
    );

    await sendEmail({
      to: user.email,
      subject: "User Account Permanently Deleted",
      html: adminEmailBody,
      text: adminEmailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Account deleted permanently",
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

    
    // FieldAgent: inspection-focused dashboard
    if (user.userType === "FieldAgent") {
      const totalInspections = await DB.Models.InspectionBooking.countDocuments({
        assignedFieldAgent: userId,
      });

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const assignedToday = await DB.Models.InspectionBooking.countDocuments({
        assignedFieldAgent: userId,
        createdAt: { $gte: startOfToday },
      });

      const completedInspections = await DB.Models.InspectionBooking.countDocuments({
        assignedFieldAgent: userId,
        status: "completed",
      });

      const completionRate =
        totalInspections > 0
          ? parseFloat(((completedInspections / totalInspections) * 100).toFixed(2))
          : 0;

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Dashboard data fetched successfully",
        data: {
          totalInspections,
          assignedToday,
          completedInspections,
          completionRate,
        },
      });
    }

    // Other user types (Landowners, Agent) keep their existing logic
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
      .select(
        "_id briefType status createdAt pictures price location.area location.localGovernment location.state"
      );

    const totalViews = 0; // Placeholder for when view tracking is implemented
    const totalInspectionRequests = await DB.Models.InspectionBooking.countDocuments({
      owner: userId,
    });
    const totalCompletedInspectionRequests = await DB.Models.InspectionBooking.countDocuments({
      owner: userId,
      status: "completed",
    });

    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    let referralData = {
      totalReferred: 0,
      totalEarnings: 0
    };

    if (referralStatusSettings?.value) {
      // fetch all referral logs
      const logs = await DB.Models.ReferralLog.find({ referrerId: userId });

      const totalReferred = new Set(logs.map((l) => String(l.referredUserId))).size;
      const totalEarnings = logs.reduce((sum, l) => sum + (l.rewardAmount || 0), 0);

      referralData.totalReferred = totalReferred;
      referralData.totalEarnings = totalEarnings;
    }

    const dashboardData: Record<string, any> = {
      totalBriefs,
      totalActiveBriefs,
      totalPendingBriefs,
      newPendingBriefs,
      totalViews,
      totalInspectionRequests,
      totalCompletedInspectionRequests,
      referralData
    };

    if (user.userType === "Landowners") {
      const propertySold = await DB.Models.Property.countDocuments({
        ...basePropertyQuery,
        status: "sold",
      });
      dashboardData.propertySold = propertySold;
    }

    if (user.userType === "Agent") {
      const completedDeals = await DB.Models.NewTransaction.countDocuments({
        "fromWho.item": userId,
        "fromWho.kind": "User",
        status: "completed",
      });
      const totalCommission = 0; // Replace with actual commission logic
      Object.assign(dashboardData, { completedDeals, totalCommission });
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