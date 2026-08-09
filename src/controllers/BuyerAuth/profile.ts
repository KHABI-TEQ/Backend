import { Response, NextFunction } from "express";
import { DB } from "..";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError, generateToken } from "../../common/classes";

export const buyerPublic = (buyer: any) => ({
  id: buyer._id,
  fullName: buyer.fullName,
  email: buyer.email,
  phoneNumber: buyer.phoneNumber,
  whatsAppNumber: buyer.whatsAppNumber || "",
  address: buyer.address || "",
  profilePicture: buyer.profilePicture || "",
  enableNotifications: buyer.enableNotifications !== false,
});

export const getBuyerProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Buyer not authenticated.");
    }
    const buyer = await DB.Models.Buyer.findById(req.buyer._id).select("-password");
    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found.");
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { buyer: buyerPublic(buyer) },
    });
  } catch (err) {
    next(err);
  }
};

export const updateBuyerProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Buyer not authenticated.");
    }

    const buyer = await DB.Models.Buyer.findById(req.buyer._id);
    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found.");
    }

    const {
      fullName,
      phoneNumber,
      email,
      whatsAppNumber,
      address,
      profilePicture,
    } = req.body;

    if (fullName != null) buyer.fullName = String(fullName).trim();
    if (phoneNumber != null) buyer.phoneNumber = String(phoneNumber).trim();
    if (whatsAppNumber != null) buyer.whatsAppNumber = String(whatsAppNumber).trim();
    if (address != null) buyer.address = String(address).trim();
    if (profilePicture != null) buyer.profilePicture = String(profilePicture).trim();

    let emailChanged = false;
    if (email != null) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (normalizedEmail !== buyer.email) {
        const exists = await DB.Models.Buyer.findOne({
          email: normalizedEmail,
          _id: { $ne: buyer._id },
        });
        if (exists) {
          throw new RouteError(
            HttpStatusCodes.CONFLICT,
            "Email already registered to another account."
          );
        }
        buyer.email = normalizedEmail;
        emailChanged = true;
      }
    }

    await buyer.save();

    const token = emailChanged
      ? generateToken({
          id: buyer._id.toString(),
          email: buyer.email,
          userType: "Buyer",
          role: "buyer",
        })
      : undefined;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        buyer: buyerPublic(buyer),
        ...(token ? { token } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
};
