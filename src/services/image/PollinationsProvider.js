import axios from "axios";
import BaseImageProvider from "./BaseImageProvider.js";
import AppError from "../../utils/AppError.js";

class PollinationsProvider extends BaseImageProvider {
  async generate(prompt, options = {}) {
    try {
      const width = options.width || 1024;
      const height = options.height || 1024;
      const encoded = encodeURIComponent(prompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux`;

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
      });

      const base64 = Buffer.from(response.data).toString("base64");
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      const msg = err.response?.status === 401
        ? "Pollinations API: Not authorized"
        : err.message || "Image generation failed";
      console.error("[PollinationsProvider] Error:", err.response?.status, msg);
      throw new AppError(msg, 500);
    }
  }
}

export default PollinationsProvider;
