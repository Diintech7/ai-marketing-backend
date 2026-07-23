import axios from "axios";

export const scrapeUrlText = async (url) => {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    // Remove script and style tags and their contents
    let text = data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
    
    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, " ");
    
    // Replace multiple spaces/newlines with a single space
    text = text.replace(/\s+/g, " ").trim();

    // Limit to 4000 characters to keep prompt size manageable
    return text.substring(0, 4000);
  } catch (err) {
    console.error(`Failed to scrape URL ${url}:`, err.message);
    return "";
  }
};
