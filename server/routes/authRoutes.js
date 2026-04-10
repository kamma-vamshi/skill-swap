import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// ================= TOKEN GENERATOR =================
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};


import { registerUser, loginUser, socialLogin, verifyOTP, resendOTP } from "../controllers/authController.js";

// ✅ SOCIAL LOGIN (GOOGLE / MICROSOFT)
router.post("/social-login", socialLogin);

// =====================================
// ✅ REGISTER USER
// =====================================
router.post("/register", registerUser);


// ✅ LOGIN USER
router.post("/login", loginUser);

// ✅ VERIFY OTP
router.post("/verify-otp", verifyOTP);

// ✅ RESEND OTP
router.post("/resend-otp", resendOTP);


// =====================================
// ✅ GET CURRENT USER (Protected)
// =====================================
import protect from "../middleware/authMiddleware.js";

router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "_id name email"
    );

    res.json(user);

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
