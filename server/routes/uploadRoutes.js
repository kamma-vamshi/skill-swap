import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import protect from "../middleware/authMiddleware.js";
import { uploadFile } from "../controllers/uploadController.js";

const router = express.Router();

// 📎 Upload file (with error handling)
router.post(
  "/",
  protect,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      next();
    });
  },
  uploadFile
);

export default router;
