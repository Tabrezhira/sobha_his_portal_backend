import "../../config/env.js";
import { v2 as cloudinary } from "cloudinary";

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.Cloud_name,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_key,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_secret,
});

export const deleteFile = async (req, res, next) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ success: false, message: "publicId is required" });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    return res.json({ success: true, message: "File deleted successfully" });
  } catch (err) {
    next(err);
  }
};
