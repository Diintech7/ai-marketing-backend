import mongoose from "mongoose";
import dotenv from "dotenv";
import ExtensionUser from "../src/models/ExtensionUser.js";

dotenv.config();

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not defined in environment.");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const email = "diintech7@gmail.com";
    const password = "DiinTech@@2027";

    // Clean up existing operator if any
    await ExtensionUser.deleteOne({ email });

    const operator = new ExtensionUser({
      email: email,
      password: password, // will be automatically hashed by pre-save hook
      employeeName: "DiinTech Lead Operator",
      isActive: true,
      role: "operator"
    });

    await operator.save();
    console.log(`\n=== Extension User Created Successfully ===`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${operator.role}`);
    console.log(`=========================================\n`);

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
}

run();
