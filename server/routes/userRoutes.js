import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getProfile,
  updateProfile,
  getAllUsers, // ✅ ADD THIS
} from "../controllers/userController.js";

const router = express.Router();

// ✅ MARKETPLACE (IMPORTANT FIX)
router.get("/", protect, getAllUsers); // 🔥 FIXED

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;