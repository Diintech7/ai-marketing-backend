import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";

dotenv.config();

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Create admin user
  const existing = await User.findOne({ email: "admin@aimarketing.com" });
  if (!existing) {
    const admin = await User.create({
      name: "Admin",
      email: "admin@aimarketing.com",
      password: "Admin@123",
      role: "admin",
      isEmailVerified: true,
      plan: "business",
      credits: 10000,
    });

    await Subscription.create({
      user: admin._id,
      plan: "business",
      status: "active",
    });

    console.log("✅ Admin user created: admin@aimarketing.com / Admin@123");
  } else {
    console.log("ℹ️  Admin already exists");
  }

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
