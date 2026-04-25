import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { generateUniqueAccountId, generateUniqueReferralCode } from "../../../utils/generateUniqueAccountId";
import { generateRandomPassword } from "../../../utils/generatePassword";
import { notifyUserAdminProvisioned } from "../../../services/userProvisioningNotifications.service";
import XLSX from "xlsx";

const ALLOWED_TYPES = ["Agent", "Developer", "Landowners"] as const;
type AllowedUserType = (typeof ALLOWED_TYPES)[number];

function isAllowedUserType(t: string): t is AllowedUserType {
  return (ALLOWED_TYPES as readonly string[]).includes(t);
}

type AdminProvisionPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  address?: { street?: string; state?: string; localGovtArea?: string };
  userType?: string;
  password?: string;
};

type CreatedUserData = {
  id: unknown;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  mustChangePassword: boolean;
};

type BulkParseRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  street?: string;
  state?: string;
  localGovtArea?: string;
};

function normalizeHeader(v: unknown): string {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function buildRowsFromExcel(buffer: Buffer): BulkParseRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return {
      firstName: String(normalized.firstname || "").trim() || undefined,
      lastName: String(normalized.lastname || "").trim() || undefined,
      email: String(normalized.email || "").trim() || undefined,
      phoneNumber: String(normalized.phonenumber || normalized.phone || "").trim() || undefined,
      password: String(normalized.password || "").trim() || undefined,
      street: String(normalized.street || "").trim() || undefined,
      state: String(normalized.state || "").trim() || undefined,
      localGovtArea: String(normalized.localgovtarea || normalized.localgovernment || "").trim() || undefined,
    };
  });
}

async function createUserByAdminProvision(payload: AdminProvisionPayload): Promise<CreatedUserData> {
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    address,
    userType,
    password: bodyPassword,
  } = payload;

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !userType) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "firstName, lastName, email, and userType are required."
    );
  }

  if (!isAllowedUserType(userType)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `userType must be one of: ${ALLOWED_TYPES.join(", ")}`
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = await DB.Models.User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      "An account already exists with this email."
    );
  }

  const plainPassword = bodyPassword?.trim() || generateRandomPassword(12);
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const accountId = await generateUniqueAccountId();
  const referralCode = await generateUniqueReferralCode();

  const newUser = await DB.Models.User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    userType,
    phoneNumber: phoneNumber?.trim(),
    address: address || undefined,
    accountId,
    referralCode,
    isAccountInRecovery: false,
    profile_picture: "",
    isInActive: false,
    isDeleted: false,
    isAccountVerified: true,
    accountApproved: true,
    accountStatus: "active",
    isFlagged: false,
    mustChangePassword: true,
  });

  if (userType === "Agent") {
    await DB.Models.Agent.create({
      userId: newUser._id,
      kycStatus: "none",
    });
  }

  try {
    await notifyUserAdminProvisioned({
      email: newUser.email,
      firstName: newUser.firstName,
      phoneNumber: newUser.phoneNumber,
      temporaryPassword: plainPassword,
      userType,
    });
  } catch (notifyErr) {
    console.warn("[registerUserByAdmin] notification failed:", notifyErr);
  }

  return {
    id: newUser._id,
    email: newUser.email,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    userType: newUser.userType,
    mustChangePassword: true,
  };
}

async function bulkCreateUsersForType(
  req: AppRequest,
  res: Response,
  next: NextFunction,
  fixedUserType: AllowedUserType
) {
  try {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file?.buffer) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Excel file is required. Upload with field name 'file'.");
    }

    const rows = buildRowsFromExcel(file.buffer);
    if (rows.length === 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Excel file is empty or has no data rows.");
    }

    const created: CreatedUserData[] = [];
    const errors: Array<{ row: number; email?: string; message: string }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 2;
      if (!row.firstName || !row.lastName || !row.email) {
        errors.push({
          row: rowNumber,
          email: row.email,
          message: "firstName, lastName and email are required.",
        });
        continue;
      }

      try {
        const address =
          row.street || row.state || row.localGovtArea
            ? {
                street: row.street,
                state: row.state,
                localGovtArea: row.localGovtArea,
              }
            : undefined;

        const data = await createUserByAdminProvision({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phoneNumber: row.phoneNumber,
          password: row.password,
          address,
          userType: fixedUserType,
        });
        created.push(data);
      } catch (err) {
        const message =
          err instanceof RouteError ? err.message : "Failed to create account";
        errors.push({
          row: rowNumber,
          email: row.email,
          message,
        });
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Bulk ${fixedUserType} account creation completed.`,
      data: {
        userType: fixedUserType,
        totalRows: rows.length,
        createdCount: created.length,
        failedCount: errors.length,
        created,
        errors,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/users/register
 * Creates Agent, Developer, or Landowner with a temporary password; user must change password after first login.
 */
export const registerUserByAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = req.body as AdminProvisionPayload;
    const data = await createUserByAdminProvision(payload);

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message:
        "User created. Credentials were sent by email (and WhatsApp when configured).",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const bulkRegisterAgentsByAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => bulkCreateUsersForType(req, res, next, "Agent");

export const bulkRegisterDevelopersByAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => bulkCreateUsersForType(req, res, next, "Developer");

export const bulkRegisterLandlordsByAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => bulkCreateUsersForType(req, res, next, "Landowners");
