import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { sendOTPEmail } from "../services/mailService.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🛡️ BANNED DISPOSABLE EMAIL DOMAINS
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "temp-mail.org", "guerrillamail.com", "mailinator.com",
  "dispostable.com", "getnada.com", "dropmail.me", "tempmail.net",
  "yopmail.com", "sharklasers.com", "trbvm.com"
]);

const isDisposableEmail = (email) => {
  const domain = email.split("@")[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
};

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ================= REGISTER =================
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // 🛡️ STRICT VALIDATION
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (isDisposableEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Registration from disposable/fake email domains is not allowed for security reasons." 
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    // 🛡️ AUTHENTICATION FLOW
    const user = await User.create({
      name,
      email,
      password,
      isVerified: false, 
      otpCode: Math.floor(100000 + Math.random() * 900000).toString(),
      otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    const emailSent = await sendOTPEmail(user.email, user.otpCode, user.name);

    res.status(201).json({
      success: true,
      message: emailSent ? "Verification code sent to your email" : "Registration successful, but failed to send email. Please request a resend.",
      email: user.email 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= LOGIN =================
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  console.log("LOGIN:", email);

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // ✅ LOGIN SUCCESS (Verification optional)
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || "",
      token: generateToken(user._id),
      success: true
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
};

// ================= SOCIAL LOGIN (GOOGLE REAL-TIME) =================
export const socialLogin = async (req, res) => {
  const { idToken, provider } = req.body;

  try {
    if (provider !== "google") {
      return res.status(400).json({ success: false, message: "Only Google is supported currently" });
    }

    // 🛡️ VERIFY GOOGLE ID TOKEN
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (user) {
      // ✅ UPDATE EXISTING USER WITH GOOGLE ID
      user.googleId = googleId;
      user.isVerified = true; // Google users are pre-verified
      if (!user.profilePic) user.profilePic = picture;
      await user.save();
    } else {
      // ✅ CREATE NEW USER FROM GOOGLE DATA
      user = await User.create({
        name,
        email,
        profilePic: picture,
        googleId,
        isVerified: true, // Google users are pre-verified
        password: Math.random().toString(36).slice(-10), // Random placeholder password
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic,
      token: generateToken(user._id),
      success: true,
    });
  } catch (error) {
    console.error("❌ SOCIAL LOGIN ERROR:", error.message);
    res.status(401).json({ success: false, message: "Invalid Google Token" });
  }
};

// ================= VERIFY OTP =================
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP code" });
    }

    if (new Date() > user.otpExpires) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    // ✅ VERIFY USER
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
      success: true,
      message: "Email verified successfully!"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= RESEND OTP =================
export const resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🛡️ REGENERATE
    user.otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const emailSent = await sendOTPEmail(user.email, user.otpCode, user.name);

    res.json({
      success: true,
      message: emailSent ? "New code sent to your email" : "Failed to send email. Check your SMTP settings."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
