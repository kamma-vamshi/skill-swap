import mongoose from "mongoose";

const swapRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    skillOffered: {
      type: String,
      required: true,
      trim: true,
    },

    skillRequested: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed"],
      default: "pending",
      index: true,
    },
    
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SwapRoom",
    }
  },
  { timestamps: true }
);

// ===============================
// 🔥 INDEXES (AFTER SCHEMA)
// ===============================

// Fast lookup for swaps between users
swapRequestSchema.index({ sender: 1, receiver: 1 });

// Prevent duplicate pending requests
swapRequestSchema.index(
  { sender: 1, receiver: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

// ===============================
// 🛡️ OPTIONAL VALIDATION
// ===============================

const SwapRequest = mongoose.model("SwapRequest", swapRequestSchema);

export default SwapRequest;