import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { generateToken, RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

export const loginAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Find admin and populate roles with their permissions
    const admin = await DB.Models.Admin.findOne({ email: normalizedEmail })
      .populate({
        path: 'roles',
        populate: {
          path: 'permissions',
          model: 'Permission'
        }
      })
      .populate('permissions'); // Also populate direct permissions

    if (!admin) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Admin account not found.");
    }

    if (!admin.password) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This admin was registered without a password."
      );
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid password.");
    }

    if (!admin.isAccountVerified) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Admin account is not active. Please contact the super admin."
      );
    }

    // Collect all permissions from roles and direct permissions
    const rolePermissions = admin.roles?.flatMap((role: any) => role.permissions || []) || [];
    const directPermissions = admin.permissions || [];
    
    // Combine and deduplicate permissions
    const allPermissions = [...rolePermissions, ...directPermissions];
    const uniquePermissions = Array.from(
      new Map(allPermissions.map((perm: any) => [perm._id.toString(), perm])).values()
    );

    const token = generateToken({
      id: admin._id.toString(),
      email: admin.email,
      userType: "Admin",
      roles: admin.roles?.map((role: any) => role._id.toString()),
    });

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
      message: "Login successful",
      data: {
        token,
        admin: adminResponse,
      },
    });
  } catch (err: any) {
    console.error("Admin login error:", err.message);
    next(err);
  }
};