import { v2 as cloudinary } from 'cloudinary';

class CloudinaryAPIFileUpload {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
 

  public async uploadFile(fileBinaryData: string, public_id: string, folder: string) {
    try {
      const result = await cloudinary.uploader.upload(fileBinaryData, {
        public_id,
        folder,
        resource_type: "raw", 
        type: "upload",
      });
      return result.secure_url; // Return the secure URL of the uploaded file
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('File upload failed'); // Throw error instead of just logging
    }
  }

  public async uploadDoc(fileBinaryData: string, public_id: string, folder: string) {
    try {
      const result = await cloudinary.uploader.upload(fileBinaryData, {
        public_id,
        folder,
        resource_type: 'raw', // Ensure it's uploaded as a document
      });
      return result.secure_url; // Return the secure URL of the uploaded document
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Document upload failed'); // Throw error instead of just logging
    }
  }
}

export default new CloudinaryAPIFileUpload();
