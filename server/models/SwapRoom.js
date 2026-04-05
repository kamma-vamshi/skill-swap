import mongoose from "mongoose";

const swapRoomSchema = new mongoose.Schema(
  {
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    swapRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SwapRequest",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("SwapRoom", swapRoomSchema);
