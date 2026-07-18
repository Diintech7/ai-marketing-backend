import "dotenv/config";
import http from "http";
import { URL } from "url";
import axios from "axios";

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = "http://localhost:9999/callback";
const SCOPE         = "https://www.googleapis.com/auth/adwords";

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log("\n✅ Step 1: Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n⏳ Waiting for Google to redirect to localhost:9999...\n");

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, "http://localhost:9999");
  const code = url.searchParams.get("code");
  if (!code) { res.end("No code found"); return; }

  try {
    const { data } = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    });

    res.end("<h2 style='font-family:sans-serif;color:green'>✅ Success! Check your terminal.</h2>");

    console.log("\n✅ NEW REFRESH TOKEN:\n");
    console.log(data.refresh_token);
    console.log("\n👉 Copy this and update GOOGLE_REFRESH_TOKEN in your .env file\n");
  } catch (err) {
    const msg = err.response?.data || err.message;
    res.end("<h2 style='color:red'>Error: " + JSON.stringify(msg) + "</h2>");
    console.error("\n❌ Error:", msg);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(9999);
