import nodemailer from "nodemailer";

export const sendOTPEmail = async (email, otp, name) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"SkillSwap Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your SkillSwap Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #6366f1; text-align: center;">Welcome to SkillSwap, ${name}!</h2>
          <p style="font-size: 16px; color: #333;">To finalize your registration and start swapping skills, please verify your email address by entering the 6-digit code below:</p>
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #64748b;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 SkillSwap Team. All rights reserved.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📨 Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ ERROR SENDING EMAIL:", error.message);
    return false;
  }
};
