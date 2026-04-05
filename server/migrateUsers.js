import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for migration...");

    // Update all users who don't have isVerified or have it as undefined
    const result = await User.updateMany(
      { isVerified: { $exists: false } },
      { $set: { isVerified: true } }
    );

    console.log(`🚀 Migration complete! Updated ${result.modifiedCount} users to isVerified: true.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
};

migrate();
