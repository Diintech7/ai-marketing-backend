import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import { ROLES } from "../constants/index.js";

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const email = "superadmin@adplifai.com";
    
    // Check if it already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("Super Admin already exists.");
      process.exit(0);
    }

    // Create Super Admin
    await User.create({
      name: "Master Admin",
      email: email,
      password: "SuperSecretPassword123!",
      role: ROLES.SUPERADMIN,
      approvalStatus: "approved",
      isEmailVerified: true,
      company: "AdplifAI",
    });

    console.log("✅ Super Admin created successfully.");
    console.log(`Email: ${email}`);
    console.log(`Password: SuperSecretPassword123!`);
    
  } catch (error) {
    console.error("Error seeding Super Admin:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
};

seedSuperAdmin();
