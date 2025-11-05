import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import bcrypt from "bcryptjs";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { adminAccountCreated } from "../../../common/emailTemplates/adminMails";

// Get Admins with Filters & Pagination
export const getAdmins = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      isAccountVerified,
      isAccountInRecovery,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    if (search) {
      const regex = new RegExp(search.toString(), "i");
      query.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
      ];
    }

    if (role) query.role = role;
    if (isAccountVerified !== undefined)
      query.isAccountVerified = isAccountVerified === "true";
    if (isAccountInRecovery !== undefined)
      query.isAccountInRecovery = isAccountInRecovery === "true";

    const sortObj: any = {};
    sortObj[sortBy.toString()] = sortOrder === "asc" ? 1 : -1;

    const admins = await DB.Models.Admin.find(query)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await DB.Models.Admin.countDocuments(query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admins fetched successfully",
      data: admins,
      pagination: {
        total,
        limit,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

function generateRandomPassword(length = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Get Single Admin by ID
export const getSingleAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { adminId } = req.params;

    if (!adminId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Admin ID is required",
      });
    } 

    const admin = await DB.Models.Admin.findById(adminId).populate({
        path: 'roles',
        populate: {
          path: 'permissions',
          model: 'Permission'
        }
      })
      .populate('permissions').lean();

    if (!admin) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin fetched successfully",
      data: admin,
    });
  } catch (err) {
    next(err);
  }
};

// Create Admin
export const createAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, firstName, lastName, phoneNumber, address, password } = req.body;

    // ✅ Validate required fields
    if (!email || !firstName || !lastName || !phoneNumber || !address) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ Check if admin already exists
    const exists = await DB.Models.Admin.findOne({ email: normalizedEmail }).exec();
    if (exists) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Admin with this email already exists"
      );
    }

    // ✅ Generate a random password if not provided
    const generatedPassword = password || generateRandomPassword(10);

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // ✅ Create admin record
    const newAdmin = await DB.Models.Admin.create({
      email: normalizedEmail,
      firstName,
      lastName,
      phoneNumber,
      address,
      isAccountVerified: true,
      isVerifed: true,
      isAccountInRecovery: false,
      password: hashedPassword,
    });

    // ✅ Prepare email
    const fullName = `${firstName} ${lastName}`;
    const loginUrl = process.env.ADMIN_LOGIN_URL || "https://admin.khabiteqrealty.com/login";

    const subject = "Welcome to Khabi-Teq Realty – Your Admin Account Has Been Created";
    const emailBody = generalEmailLayout(
      adminAccountCreated(fullName, normalizedEmail, generatedPassword, loginUrl)
    );

    // ✅ Send email notification
    await sendEmail({
      to: newAdmin.email,
      subject,
      html: emailBody,
      text: emailBody
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Admin created successfully",
      data: newAdmin,
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    next(err);
  }
};

// Update Admin
export const updateAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { adminId } = req.params;
    const updateData = req.body;

    if (!adminId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    const updated = await DB.Models.Admin.findByIdAndUpdate(
      adminId,
      updateData,
      { new: true },
    ).lean();

    if (!updated) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Delete Admin
export const deleteAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { adminId } = req.params;

    const deleted = await DB.Models.Admin.findByIdAndDelete(adminId);
    if (!deleted) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Admin account not found or already deleted.",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin account deleted successfully.",
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
    const { adminId } = req.params;
    const { newPassword } = req.body;

    if (!adminId || !newPassword) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Admin ID and new password are required",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updated = await DB.Models.Admin.findByIdAndUpdate(adminId, {
      password: hashedPassword,
      isVerifed: true,
    });

    if (!updated) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Change Admin Status
export const changeAdminStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { adminId } = req.params;
    const { status } = req.body;

    let statusChanger = false;

    if (status === "active") {
      statusChanger = true;
    }

    const updated = await DB.Models.Admin.findByIdAndUpdate(
      adminId,
      { isAccountVerified: statusChanger },
      { new: true },
    ).lean();

    if (!updated) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Admin not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin status updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
