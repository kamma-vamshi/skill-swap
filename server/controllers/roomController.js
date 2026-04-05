import SwapRoom from "../models/SwapRoom.js";
import RoomMessage from "../models/RoomMessage.js";
import Task from "../models/Task.js";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import { getIO } from "../socket/socket.js";

// 🏠 CREATE ROOM (Internal Helper called by swapController)
export const createSwapRoom = async (swap) => {
  try {
    // 🎓 Primary logic: receiver is teacher (providing skill requested) 
    // sender is student (receiving skill requested)
    const room = await SwapRoom.create({
      skill: swap.skillRequested,
      teacher: swap.receiver?._id || swap.receiver,
      students: [swap.sender?._id || swap.sender],
      swapRequestId: swap._id,
      status: "active",
    });
    return room;
  } catch (error) {
    console.error("❌ CREATE ROOM ERROR:", error.message);
    throw error;
  }
};

// 📋 GET ROOM BY ID
export const getRoom = async (req, res) => {
  try {
    const room = await SwapRoom.findById(req.params.id)
      .populate("teacher", "name profilePic skillsOffered")
      .populate("students", "name profilePic skillsOffered");

    if (!room) return res.status(404).json({ message: "Room not found" });

    // 🔒 Auth check
    const isParticipant = room.teacher._id.toString() === req.user._id.toString() ||
                         room.students.some(s => s._id.toString() === req.user._id.toString());
    
    if (!isParticipant) return res.status(403).json({ message: "Not authorized" });

    // Fetch related data
    const tasks = await Task.find({ roomId: room._id }).sort({ createdAt: -1 });
    const messages = await RoomMessage.find({ roomId: room._id })
      .populate("senderId", "name profilePic")
      .limit(50)
      .sort({ createdAt: 1 });
    const attendance = await Attendance.find({ roomId: room._id });

    res.json({ room, tasks, messages, attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 💬 SEND MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const { roomId, message, type, fileUrl } = req.body;
    
    // 🔒 Auth check
    const room = await SwapRoom.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const isParticipant = room.teacher.toString() === req.user._id.toString() ||
                         room.students.some(s => s.toString() === req.user._id.toString());
    
    if (!isParticipant) return res.status(403).json({ message: "Not a participant in this room" });

    const newMessage = await RoomMessage.create({
      roomId,
      senderId: req.user._id,
      message,
      type: type || "text",
      fileUrl,
    });

    const populatedMessage = await RoomMessage.findById(newMessage._id)
      .populate("senderId", "name profilePic");

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ CREATE TASK
export const createTask = async (req, res) => {
  try {
    const { roomId, title, description, assignedTo, dueDate } = req.body;
    
    const room = await SwapRoom.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    // 🎓 Only teacher can assign
    // 🎓 Only teacher can assign
    if (room.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only teachers can assign tasks" });
    }

    const task = await Task.create({
      roomId,
      title,
      description,
      assignedBy: req.user._id,
      assignedTo,
      dueDate,
    });

    // 🔥 Real-time notification
    getIO().to(roomId).emit("taskAssigned", task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔄 UPDATE TASK STATUS
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    // Only assigned student or teacher can update
    const room = await SwapRoom.findById(task.roomId);
    const isAuthorized = task.assignedTo.toString() === req.user._id.toString() ||
                         room.teacher.toString() === req.user._id.toString();

    if (!isAuthorized) return res.status(403).json({ message: "Not authorized" });

    task.status = status;
    await task.save();

    // 🔥 Real-time notification
    getIO().to(task.roomId.toString()).emit("taskUpdated", task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📅 MARK ATTENDANCE
export const markAttendance = async (req, res) => {
  try {
    const { roomId, userId, date, status } = req.body;
    
    const room = await SwapRoom.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    // 🎓 Only teacher marks attendance
    // 🎓 Only teacher marks attendance
    if (room.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only teachers can mark attendance" });
    }

    // Upsert attendance
    const attendance = await Attendance.findOneAndUpdate(
      { roomId, userId, date },
      { status },
      { upsert: true, new: true }
    );

    // 🔥 Real-time notification
    getIO().to(roomId).emit("attendanceUpdated", attendance);

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🏁 COMPLETE CLASSROOM
export const completeClassroom = async (req, res) => {
  try {
    const room = await SwapRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    // Only teacher can complete
    // Only teacher can complete
    if (room.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only teachers can mark the course as completed" });
    }

    room.status = "completed";
    await room.save();

    // 📈 UPDATE PROFILE STATS
    // 👨‍🏫 Teacher
    await User.findByIdAndUpdate(room.teacher, {
      $addToSet: { skillsTaught: room.skill },
      $inc: { completedSessions: 1 }
    });

    // 👨‍🎓 Students
    await User.updateMany(
      { _id: { $in: room.students } },
      { 
        $addToSet: { skillsLearned: room.skill },
        $inc: { completedSessions: 1 }
      }
    );

    res.json({ message: "Course completed successfully!", room });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
