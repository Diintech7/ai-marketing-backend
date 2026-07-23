import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function testOAuth() {
  console.log("Testing with Client ID:", process.env.GOOGLE_CLIENT_ID);
  console.log("Secret:", process.env.GOOGLE_CLIENT_SECRET.substring(0, 5) + "...");
  console.log("Refresh Token:", process.env.GOOGLE_REFRESH_TOKEN.substring(0, 10) + "...");
  
  try {
    const { data } = await axios.post(TOKEN_URL, {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });
    console.log("SUCCESS! Access Token received:", data.access_token.substring(0, 10) + "...");
  } catch (err) {
    console.error("OAUTH ERROR:");
    console.error(err.response?.data || err.message);
  }
}

testOAuth();
