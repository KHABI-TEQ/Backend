import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";

/** RN Image often fails on Cloudinary f_auto (webp/avif). Force JPEG. */
function jpegCloudinaryUrl(url: string): string {
  if (url.includes("/image/upload/") && !/\/f_jpe?g/i.test(url)) {
    return url.replace("/image/upload/", "/image/upload/f_jpg,q_auto/");
  }
  return url;
}

export const listActiveBrms = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await DB.Models.BusinessRelationManager.find({
      isActive: true,
    })
      .select("fullName profilePicture phoneNumber gender serviceMessage")
      .sort({ fullName: 1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: items.map((b) => ({
        id: b._id,
        fullName: b.fullName,
        profilePicture: b.profilePicture,
        phoneNumber: b.phoneNumber,
        gender: b.gender,
        serviceMessage: b.serviceMessage,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/** Stream a BRM portrait through this API so Android emulators can load it via 10.0.2.2. */
export const getBrmPicture = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).end();
    }

    const brm = await DB.Models.BusinessRelationManager.findById(id)
      .select("profilePicture")
      .lean();

    const source = String(brm?.profilePicture || "").trim();
    if (!source) {
      return res.status(HttpStatusCodes.NOT_FOUND).end();
    }

    const upstream = await fetch(jpegCloudinaryUrl(source), {
      headers: { Accept: "image/jpeg" },
    });

    if (!upstream.ok) {
      return res.status(upstream.status || HttpStatusCodes.BAD_GATEWAY).end();
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(HttpStatusCodes.OK).send(buffer);
  } catch (err) {
    next(err);
  }
};
