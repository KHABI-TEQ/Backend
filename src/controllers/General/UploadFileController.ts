import { Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import cloudinary from "../../common/newCloudinary";
import { AppRequest } from "../../types/express";

/**
 * File Config Map — allowed extensions, max size (MB), resource type, upload folder
 */
const fileTypeConfig: Record<
  string,
  {
    extensions: string[]; // empty [] means allow all
    maxSizeMB: number;
    resourceType: "image" | "raw" | "video" | "auto";
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
    maxSizeMB: 10,
    resourceType: "raw",
    folder: "property-files",
  },
  "identity-doc": {
    extensions: ["jpg", "jpeg", "png", "pdf", "doc", "docx"],
    maxSizeMB: 10,
    resourceType: "raw",
    folder: "identity-docs",
  },
  "property-video": {
    extensions: ["mp4", "mov", "avi", "webm", "flv", "mkv"],
    maxSizeMB: 50,
    resourceType: "video",
    folder: "property-videos",
  },
  default: {
    extensions: [], // ✅ allow any file type
    maxSizeMB: 50,  // bigger limit for docs/zips
    resourceType: "raw", // ✅ raw supports any file type
    folder: "other-files",
  },
};

/**
 * Upload File with Dynamic Extension & Size Validation
 */
export const uploadFileToCloudinary = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file)
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "File is required");

    const { for: fileFor = "default" } = req.body;

    const config = fileTypeConfig[fileFor] || fileTypeConfig["default"];

    // ✅ Extract extension
    const fileExt = req.file.originalname.split(".").pop()?.toLowerCase();

    // ✅ Validate File Extension (only if extensions are defined)
    if (
      config.extensions.length > 0 &&
      (!fileExt || !config.extensions.includes(fileExt))
    ) {
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

    // ✅ Upload to Cloudinary with extension preserved
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const filename =
      Date.now() + "-" + fileFor + (fileExt ? `.${fileExt}` : "");

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
      data: {
        url: uploaded.secure_url, // ✅ now includes extension
        public_id: uploaded.public_id,
        resource_type: config.resourceType,
        file_for: fileFor, // ✅ Store this for future deletion reference
      },
    });
  } catch (err: any) {
    console.error("Upload Error:", err.message);
    next(err);
  }
};

/**
 * Helper function to determine resource type from URL or file extension
 */
const determineResourceTypeFromUrl = (url: string): "image" | "raw" | "video" => {
  const extension = url.split('.').pop()?.toLowerCase();
  
  if (!extension) return "raw";
  
  const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];
  const videoExts = ["mp4", "mov", "avi", "webm", "flv", "mkv"];
  
  if (imageExts.includes(extension)) return "image";
  if (videoExts.includes(extension)) return "video";
  
  return "raw";
};

/**
 * Delete File by Extracting Public ID from URL
 * ✅ Improved: Tries multiple resource types if deletion fails
 */ 
export const deleteFileFromCloudinary = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { url, resource_type } = req.body;

    if (!url)
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "File URL is required");

    const publicId = extractPublicIdFromUrl(url);
    
    // ✅ Use provided resource_type or determine from URL
    let resourceType: "image" | "raw" | "video" = resource_type || determineResourceTypeFromUrl(url);
    
    let result = await cloudinary.deleteFile(publicId, resourceType);

    // ✅ If deletion fails with "not found", try other resource types
    if (result.result === "not found") {
      const resourceTypes: ("image" | "raw" | "video")[] = ["image", "raw", "video"];
      
      for (const type of resourceTypes) {
        if (type !== resourceType) {
          try {
            result = await cloudinary.deleteFile(publicId, type);
            if (result.result === "ok") {
              resourceType = type; // Update to the successful type
              break;
            }
          } catch (error) {
            // Continue to next resource type
            continue;
          }
        }
      }
    }

    if (result.result !== "ok" && result.result !== "not found")
      throw new Error("Failed to delete file");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: result.result === "not found" ? "File not found or already deleted" : "File deleted successfully",
      data: { 
        result: result.result,
        resource_type: resourceType,
        public_id: publicId
      },
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
    const filenameWithoutExt = filename.includes(".")
      ? filename.substring(0, filename.lastIndexOf("."))
      : filename;

    return [...publicIdParts, filenameWithoutExt].join("/");
  } catch (error) {
    throw new Error("Failed to extract public_id: " + (error as any).message);
  }
};