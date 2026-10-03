import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import bcrypt from "bcryptjs";

// Fetch Admin Profile
/**
 * @swagger
 * /admin/profile:
 *   get:
 *     tags:
 *       - Admin > Profile
 *     summary: Get admin profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *       401:
 *         description: Not authenticated
 */
export const getAdminProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.admin?._id;
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    // Find admin and populate roles with their permissions
    const admin = await DB.Models.Admin.findById(adminId)
      .populate({
        path: 'roles',
        populate: {
          path: 'permissions',
          model: 'Permission'
        }
      })
      .populate('permissions') // Also populate direct permissions
      .lean();

    if (!admin) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
    }

    // Collect all permissions from roles and direct permissions
    const rolePermissions = admin.roles?.flatMap((role: any) => role.permissions || []) || [];
    const directPermissions = admin.permissions || [];
    
    // Combine and deduplicate permissions
    const allPermissions = [...rolePermissions, ...directPermissions];
    const uniquePermissions = Array.from(
      new Map(allPermissions.map((perm: any) => [perm._id.toString(), perm])).values()
    );

    const adminResponse = {
      id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      fullName: admin.fullName,
      address: admin.address,
      profile_picture: admin.profile_picture,
      isAccountVerified: admin.isAccountVerified,
      isAccountInRecovery: admin.isAccountInRecovery,
      roles: admin.roles?.map((role: any) => ({
        id: role._id,
        name: role.name,
        description: role.description,
        level: role.level,
        isActive: role.isActive,
      })),
      permissions: uniquePermissions.map((perm: any) => ({
        id: perm._id,
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        category: perm.category,
      })),
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
    const adminId = req.admin?._id;
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
/**
 * @swagger
 * /admin/profile/change-email:
 *   put:
 *     tags:
 *       - Admin > Profile
 *     summary: Change admin email
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *               - password
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Email changed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 */
export const changeAdminEmail = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.admin?._id;
    const { newEmail, currentPassword } = req.body;
    const email = String(newEmail || "").toLowerCase().trim();

    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "New email is required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Enter a valid email address");
    }
    if (!currentPassword) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Current password is required to change email"
      );
    }

    const admin = await DB.Models.Admin.findById(adminId);
    if (!admin || !admin.password) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found");
    }

    const isMatch = await bcrypt.compare(String(currentPassword), admin.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Current password is incorrect");
    }

    if (admin.email === email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "That is already your login email");
    }

    const exists = await DB.Models.Admin.findOne({
      email,
      _id: { $ne: adminId },
    });
    if (exists) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email already in use");
    }

    admin.email = email;
    await admin.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Email changed successfully",
      data: { email: admin.email },
    });
  } catch (err) {
    next(err);
  }
};

// Change Admin Password
/**
 * @swagger
 * /admin/profile/change-password:
 *   put:
 *     tags:
 *       - Admin > Profile
 *     summary: Change admin password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 */
export const changeAdminPassword = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.admin?._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Old and new password are required");
    }
    if (String(newPassword).trim().length < 8) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "New password must be at least 8 characters"
      );
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
/**
 * @swagger
 * /admin/profile/delete-account:
 *   post:
 *     tags:
 *       - Admin > Profile
 *     summary: Request admin account deletion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - reason
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *               reason:
 *                 type: string
 *                 description: Reason for account deletion
 *     responses:
 *       200:
 *         description: Account deletion requested successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 */
export const requestAdminAccountDeletion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.admin?._id;

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
