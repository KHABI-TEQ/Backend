import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadFile = async (
  base64: string,
  filename: string,
  folder: string,
  resourceType: "image" | "raw" | "video" | "auto" = "auto",
  additionalOptions: any = {}
): Promise<UploadApiResponse> => {
  const baseOptions = {
    public_id: filename,
    folder: folder,
    resource_type: resourceType,
    type: "upload",
    // ✅ Allow access to the file
    access_mode: "public",
  };

  // ✅ Merge additional options
  const uploadOptions = { ...baseOptions, ...additionalOptions };

  return cloudinary.uploader.upload(base64, uploadOptions);
};

// ✅ Fixed: Default to "raw" instead of "auto" for delete operations
export const deleteFile = async (publicId: string, resourceType: "image" | "raw" | "video" = "raw") => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
};

// ✅ Generate viewing URL for different file types
export const generateViewUrl = (
  publicId: string,
  resourceType: string = "auto",
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  } = {}
): string => {
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`;
  
  let transformations = [];
  
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  
  const transformationString = transformations.length > 0 
    ? `/${transformations.join(',')}/` 
    : '/';
  
  return `${baseUrl}/${resourceType}/upload${transformationString}${publicId}`;
};

// ✅ Generate direct download URL
export const generateDownloadUrl = (publicId: string, resourceType: string = "raw"): string => {
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`;
  return `${baseUrl}/${resourceType}/upload/fl_attachment/${publicId}`;
};

export default {
  uploadFile,
  deleteFile,
  generateViewUrl,
  generateDownloadUrl,
};