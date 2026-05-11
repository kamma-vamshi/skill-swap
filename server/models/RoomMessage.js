import mongoose from "mongoose";

const roomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SwapRoom",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "file"],
      default: "text",
    },
    fileUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize querying messages for a specific classroom
roomMessageSchema.index({ roomId: 1 });

export default mongoose.model("RoomMessage", roomMessageSchema);
