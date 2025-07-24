import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import bcrypt from "bcryptjs";

// Fetch Admin Profile
export const getAdminProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?._id;
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const admin = await DB.Models.Admin.findById(adminId).lean();
    if (!admin) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
    }

    const adminResponse = {
      id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      fullName: admin.fullName,
      role: admin.role,
      address: admin.address,
      profile_picture: admin.profile_picture,
      isAccountVerified: admin.isAccountVerified,
      isAccountInRecovery: admin.isAccountInRecovery,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin profile fetched successfully",
      data: { admin: adminResponse },
    });
  } catch (err) {
    next(err);
  }
};

// Update Admin Profile
export const updateAdminProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?._id;
    const updateData = req.body;

    const updated = await DB.Models.Admin.findByIdAndUpdate(adminId, updateData, {
      new: true,
    }).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin profile updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Change Admin Email
export const changeAdminEmail = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?._id;
    const { newEmail } = req.body;

    if (!newEmail) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "New email is required");
    }

    const exists = await DB.Models.Admin.findOne({ email: newEmail });
    if (exists) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email already in use");
    }

    const updated = await DB.Models.Admin.findByIdAndUpdate(
      adminId,
      { email: newEmail.toLowerCase(), isAccountVerified: false },
      { new: true },
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
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

// Change Admin Password
export const changeAdminPassword = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Old and new password are required");
    }

    const admin = await DB.Models.Admin.findById(adminId);
    if (!admin || !admin.password) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid old password");
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Request Admin Account Deletion
export const requestAdminAccountDeletion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user?._id;

    const updated = await DB.Models.Admin.findByIdAndUpdate(
      adminId,
      { isDeleted: true },
      { new: true },
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Account deletion requested successfully",
    });
  } catch (err) {
    next(err);
  }
};
