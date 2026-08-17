import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

async function run() {
  try {
    // 1. Get user details for login
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'diintech7@gmail.com' });
    if (!user) {
      console.log("User not found!");
      process.exit(1);
    }
    
    // We will simulate login request to get token
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'diintech7@gmail.com',
      password: 'password123', // Let's try password123, or we can fetch a token by generating it manually
    }).catch(err => err.response);

    let token;
    if (loginRes && loginRes.status === 200) {
      token = loginRes.data.data.accessToken;
      console.log("Logged in successfully, token retrieved.");
    } else {
      console.log("Could not login via HTTP, generating JWT token manually...");
      // Generate token using the helper
      const { generateAccessToken } = await import('../src/helpers/jwt.js');
      token = generateAccessToken(user._id);
    }

    console.log("Sending generate-api-key request with token:", token.substring(0, 15) + "...");
    const res = await axios.post('http://localhost:5000/api/auth/generate-api-key', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("SUCCESS! Response status:", res.status);
    console.log("Response data:", res.data);
    process.exit(0);
  } catch (error) {
    console.error("HTTP Request Failed!");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

run();
