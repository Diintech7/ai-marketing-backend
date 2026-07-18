import axios from "axios";
import FormData from "form-data";
import BaseImageProvider from "./BaseImageProvider.js";
import AppError from "../../utils/AppError.js";

class StabilityProvider extends BaseImageProvider {
  constructor() {
    super();
  }

  async generate(prompt, options = {}) {
    const apiKey = process.env.STABILITY_API_KEY;
    try {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("output_format", "png");
      formData.append("width", String(options.width || 1024));
      formData.append("height", String(options.height || 1024));

      const response = await axios.post(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        formData,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "image/*",
          },
          responseType: "arraybuffer",
          timeout: 60000,
        }
      );

      const base64 = Buffer.from(response.data).toString("base64");
      return `data:image/png;base64,${base64}`;
    } catch (err) {
      const msg = err.response?.data
        ? Buffer.from(err.response.data).toString()
        : err.message || "Image generation failed";
      console.error("[StabilityProvider] Error:", msg, "| apiKey present:", !!apiKey);
      throw new AppError(msg, 500);
    }
  }
}

export default StabilityProvider;
