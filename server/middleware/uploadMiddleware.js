import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// ✅ Allowed formats
const allowedFormats = ["jpg", "jpeg", "png", "pdf"];

// ✅ Cloudinary Storage Config
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const format = file.mimetype.split("/")[1];

    // ❌ Reject unsupported files
    if (!allowedFormats.includes(format)) {
      throw new Error("Unsupported file type");
    }

    return {
      folder: "skillswap",
      resource_type: "auto", // auto detects image/video/file
      public_id: `${Date.now()}-${file.originalname}`,
    };
  },
});

// ✅ Multer Config
const upload = multer({
  storage,

  // 🔐 File size limit (5MB)
  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  // ✅ File filter
  fileFilter: (req, file, cb) => {
    const format = file.mimetype.split("/")[1];

    if (allowedFormats.includes(format)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, JPEG, PDF allowed"), false);
    }
  },
});

export default upload;
