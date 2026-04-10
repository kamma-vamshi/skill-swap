import SwapRequest from "../models/SwapRequest.js";
import { emitSwapRequest, emitSwapUpdate } from "../socket/socket.js";
import { createSwapRoom } from "./roomController.js";
import SwapRoom from "../models/SwapRoom.js";
import User from "../models/User.js";

// 📤 SEND SWAP REQUEST
export const sendSwapRequest = async (req, res) => {
  try {
    const { receiverId, skillOffered, skillRequested } = req.body;
    const senderId = req.user._id;

    // ❌ Self swap
    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: "Cannot swap with yourself" });
    }

    // ❌ Required fields
    if (!skillOffered || !skillRequested) {
      return res.status(400).json({
        message: "Skill offered and requested are required",
      });
    }

    // 🛡️ VERIFY RECEIVER EXISTS AND IS VERIFIED
    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.isVerified) {
      return res.status(404).json({ message: "User not found or account not verified" });
    }

    // ❌ Prevent duplicate (both directions)
    const existing = await SwapRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId, status: "pending" },
        { sender: receiverId, receiver: senderId, status: "pending" },
      ],
    });

    if (existing) {
      return res.status(400).json({ message: "Request already exists" });
    }

    // ✅ Create swap
    const swap = await SwapRequest.create({
      sender: senderId,
      receiver: receiverId,
      skillOffered,
      skillRequested,
    });
    
    const populatedSwap = await SwapRequest.findById(swap._id)
      .populate("sender", "name")
      .populate("receiver", "name");

    // 🔥 REAL-TIME EVENT (Both parties)
    emitSwapRequest(senderId.toString(), receiverId, populatedSwap);

    res.status(201).json(populatedSwap);
  } catch (error) {
    console.error("SWAP ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ ACCEPT / REJECT SWAP
export const respondToSwap = async (req, res) => {
  try {
    const { status } = req.body;
    const swapId = req.params.id;
    const userId = req.user.id;

    // ✅ VALID STATUS
    const validStatuses = ["accepted", "rejected", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const swap = await SwapRequest.findById(swapId);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    // ✅ AUTHORIZE
    const isReceiver = swap.receiver.toString() === userId;
    const isSender = swap.sender.toString() === userId;

    if (!isReceiver && !isSender) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // ❌ AUTHORIZE STATUS CHANGES
    if (status === "accepted" || status === "rejected") {
      if (!isReceiver) return res.status(403).json({ message: "Only receiver can accept/reject" });
      if (swap.status !== "pending") return res.status(400).json({ message: "Swap already processed" });
    }

    if (status === "completed") {
      if (swap.status !== "accepted") return res.status(400).json({ message: "Only accepted swaps can be completed" });
    }

    swap.status = status;
    await swap.save();

    const updatedSwap = await SwapRequest.findById(swapId)
      .populate("sender", "name")
      .populate("receiver", "name");

    // 🔥 REAL-TIME UPDATE
    emitSwapUpdate(
      swap.sender.toString(),
      updatedSwap,
      `Your request was ${status}`
    );

    // 🏫 AUTO-CREATE CLASSROOM ON ACCEPT
    if (status === "accepted") {
      const existingRoom = await SwapRoom.findOne({ swapRequestId: swapId });
      if (!existingRoom) {
        const room = await createSwapRoom(updatedSwap);
        
        // Link room back to swap
        swap.classroom = room._id;
        await swap.save();
      }
    }

    res.json(updatedSwap);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 GET MY SWAPS
export const getMySwaps = async (req, res) => {
  try {
    const userId = req.user._id;

    const swaps = await SwapRequest.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .sort({ createdAt: -1 });

    res.json(swaps);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
