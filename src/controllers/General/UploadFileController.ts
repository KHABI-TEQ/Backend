import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import cloudinary from "../../common/newCloudinary";

/**
 * File Config Map — allowed extensions, max size (MB), resource type, upload folder
 */
const fileTypeConfig: Record<
  string,
  {
    extensions: string[];
    maxSizeMB: number;
    resourceType: "image" | "raw" | "video";
    folder: string;
  }
> = {
  "property-image": {
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxSizeMB: 5,
    resourceType: "image",
    folder: "property-images",
  },
  "property-file": {
    extensions: ["pdf", "docx", "doc"],
    maxSizeMB: 5,
    resourceType: "raw",
    folder: "property-files",
  },
  "identity-doc": {
    extensions: ["jpg", "jpeg", "png", "pdf"],
    maxSizeMB: 5,
    resourceType: "raw",
    folder: "identity-docs",
  },
  "property-video": {
    extensions: ["mp4", "mov", "avi", "webm", "flv", "mkv"],
    maxSizeMB: 20,
    resourceType: "video",
    folder: "property-videos",
  },
  default: {
    extensions: ["jpg", "jpeg", "png", "pdf", "docs", "webp"],
    maxSizeMB: 5,
    resourceType: "raw",
    folder: "other-files",
  },
};

/**
 * Upload File with Dynamic Extension & Size Validation
 */
export const uploadFileToCloudinary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file)
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "File is required");

    const { for: fileFor = "default" } = req.body;

    const config = fileTypeConfig[fileFor] || fileTypeConfig["default"];

    // ✅ Validate File Extension
    const fileExt = req.file.originalname.split(".").pop()?.toLowerCase();
    if (!fileExt || !config.extensions.includes(fileExt)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid file extension. Allowed: ${config.extensions.join(", ")}`,
      );
    }

    // ✅ Validate File Size
    const fileSizeMB = req.file.size / (1024 * 1024);
    if (fileSizeMB > config.maxSizeMB) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `File too large. Max allowed is ${config.maxSizeMB} MB`,
      );
    }

    // ✅ Upload to Cloudinary
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const filename = Date.now() + "-" + fileFor;

    const uploaded = await cloudinary.uploadFile(
      fileBase64,
      filename,
      config.folder,
      config.resourceType,
    );

    if (!uploaded?.secure_url) throw new Error("Failed to upload file");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "File uploaded successfully",
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
      resource_type: config.resourceType,
    });
  } catch (err: any) {
    console.error("Upload Error:", err.message);
    next(err);
  }
};

/**
 * Delete File by Extracting Public ID from URL
 */
export const deleteFileFromCloudinary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { url } = req.body;

    if (!url)
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "File URL is required");

    const publicId = extractPublicIdFromUrl(url);

    const result = await cloudinary.deleteFile(publicId);

    if (result.result !== "ok" && result.result !== "not found")
      throw new Error("Failed to delete file");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "File deleted successfully",
      result,
    });
  } catch (err: any) {
    console.error("Delete Error:", err.message);
    next(err);
  }
};

/**
 * Extract Cloudinary Public ID from URL
 */
export const extractPublicIdFromUrl = (url: string): string => {
  try {
    const parts = url.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) throw new Error("Invalid Cloudinary URL");

    const publicIdParts = parts.slice(uploadIndex + 1);
    const filename = publicIdParts.pop()!;
    const filenameWithoutExt = filename.substring(0, filename.lastIndexOf("."));
    return [...publicIdParts, filenameWithoutExt].join("/");
  } catch (error) {
    throw new Error("Failed to extract public_id: " + (error as any).message);
  }
};
