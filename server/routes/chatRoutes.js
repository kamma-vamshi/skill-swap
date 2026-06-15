import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getMessages } from "../controllers/chatController.js";

const router = express.Router();

// 💬 Get chat history
router.get("/:userId", protect, getMessages);

export default router;
