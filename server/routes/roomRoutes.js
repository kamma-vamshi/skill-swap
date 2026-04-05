import express from "express";
import { 
  getRoom, 
  sendMessage, 
  createTask, 
  updateTaskStatus, 
  markAttendance, 
  completeClassroom 
} from "../controllers/roomController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect); // ✅ ALL ROOM ROUTES PROTECTED

router.get("/:id", getRoom);
router.post("/messages", sendMessage);
router.post("/tasks", createTask);
router.put("/tasks/:id", updateTaskStatus);
router.post("/attendance", markAttendance);
router.put("/:id/complete", completeClassroom);

export default router;
