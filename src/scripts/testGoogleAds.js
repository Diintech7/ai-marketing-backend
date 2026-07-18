import "dotenv/config";
import axios from "axios";

try {
  console.log("Fetching access token...");
  const r = await axios.post("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const token = r.data.access_token;
  console.log("Token OK:", token.slice(0, 30) + "...");

  const customerId = (process.env.GOOGLE_CUSTOMER_ID || "4951963493").replace(/-/g, "");
  const managerId = "6016163107"; // Your Test Manager Account ID
  
  console.log(`Running search query on Client ID: ${customerId} under Manager ID: ${managerId} using v23...`);
  
  const r2 = await axios.post(
    `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
    { query: "SELECT campaign.id, campaign.name FROM campaign LIMIT 1" },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": process.env.GOOGLE_DEVELOPER_TOKEN,
        "login-customer-id": managerId, // Critical header for manager authorization!
        "Content-Type": "application/json",
      },
    }
  );
  console.log("API Connection SUCCESSFUL!");
  console.log("Query Results:", JSON.stringify(r2.data, null, 2));
} catch (e) {
  console.error("Status:", e.response?.status);
  console.error("Data:", JSON.stringify(e.response?.data, null, 2));
}
