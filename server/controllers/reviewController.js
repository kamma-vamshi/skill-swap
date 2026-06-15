import Review from "../models/Review.js";
import User from "../models/User.js";
import SwapRequest from "../models/SwapRequest.js";

// ⭐ CREATE REVIEW
export const createReview = async (req, res) => {
  try {
    const { reviewedUser, swapId, rating, comment } = req.body;
    const reviewer = req.user.id;

    // ✅ Check swap exists
    const swap = await SwapRequest.findById(swapId);

    if (!swap || swap.status !== "completed") {
      return res.status(400).json({ message: "Invalid or incomplete swap" });
    }

    // 🚫 Prevent self review
    if (reviewer === reviewedUser) {
      return res.status(400).json({ message: "Cannot review yourself" });
    }

    // ✅ Create review
    const review = await Review.create({
      reviewer,
      reviewedUser,
      swap: swapId,
      rating,
      comment,
    });

    // 🔄 Update user rating
    const reviews = await Review.find({ reviewedUser });

    const avg =
      reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

    await User.findByIdAndUpdate(reviewedUser, {
      averageRating: avg,
      totalReviews: reviews.length,
    });

    res.json(review);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Already reviewed this swap" });
    }
    res.status(500).json({ message: error.message });
  }
};

// 📊 GET USER REVIEWS
export const getUserReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      reviewedUser: req.params.userId,
    }).populate("reviewer", "name profilePic");

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
