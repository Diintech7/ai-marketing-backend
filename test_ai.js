import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-chat",
        messages: [{ role: "user", content: "Test" }]
      },
      {
        headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` }
      }
    );
    console.log("Success:", response.data.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}
test();
