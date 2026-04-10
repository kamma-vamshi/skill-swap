import express from "express";
import protect from "../middleware/authMiddleware.js";

import {
  createReview,
  getUserReviews,
} from "../controllers/reviewController.js";

const router = express.Router();

// ⭐ Create review
router.post("/", protect, createReview);

// 📊 Get reviews for a user
router.get("/:userId", getUserReviews);

export default router;
