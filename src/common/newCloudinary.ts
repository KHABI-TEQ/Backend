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
  resourceType: "image" | "raw" | "video" = "raw",
): Promise<UploadApiResponse> => {
  return cloudinary.uploader.upload(base64, {
    public_id: filename,
    folder: folder,
    resource_type: resourceType,
    type: "upload",
  });
};

export const deleteFile = async (publicId: string) => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: "auto",
    invalidate: true,
  });
};

export default {
  uploadFile,
  deleteFile,
};
