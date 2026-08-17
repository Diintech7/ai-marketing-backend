import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AuthService from '../src/services/auth.service.js';
import User from '../src/models/User.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findOne({ email: 'diintech07@gmail.com' });
    if (!user) {
      console.log("User not found!");
      process.exit(1);
    }
    console.log("Found user:", user.email, "Current apiKeys:", user.apiKeys);

    const result = await AuthService.generateApiKey(user._id);
    console.log("Generated API Key successfully:", result);
    process.exit(0);
  } catch (error) {
    console.error("ERROR running generateApiKey:", error);
    process.exit(1);
  }
}

run();
