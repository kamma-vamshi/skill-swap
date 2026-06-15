import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SwapRoom",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // Store as "YYYY-MM-DD"
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate attendance records for the same user on the same day in the same room
attendanceSchema.index({ roomId: 1, userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
