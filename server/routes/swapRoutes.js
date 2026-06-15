import express from "express";
import protect from "../middleware/authMiddleware.js";

import {
  sendSwapRequest,
  respondToSwap,
  getMySwaps,
} from "../controllers/swapController.js";

const router = express.Router();

// 🔄 Send swap request
router.post("/", protect, sendSwapRequest);

// ✅ Accept / Reject
router.put("/:id", protect, respondToSwap);

// 📋 Get all swaps (sent + received)
router.get("/", protect, getMySwaps);

export default router;
