import axios from "axios";
import BaseImageProvider from "./BaseImageProvider.js";
import AppError from "../../utils/AppError.js";

const MODEL_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";

class HuggingFaceProvider extends BaseImageProvider {
  async generate(prompt, options = {}) {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) throw new AppError("HF_API_KEY not set", 500);

    const payload = {
      inputs: prompt,
      parameters: {
        width: options.width || 1024,
        height: options.height || 1024,
        num_inference_steps: options.steps || 4,
        guidance_scale: options.guidance || 0.0,
      },
    };

    // Retry up to 3 times for cold start (503 Model loading)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.post(MODEL_URL, payload, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "image/jpeg",
          },
          responseType: "arraybuffer",
          timeout: 120000,
        });

        const base64 = Buffer.from(response.data).toString("base64");
        return `data:image/jpeg;base64,${base64}`;
      } catch (err) {
        const status = err.response?.status;

        // 503 = model loading — wait and retry
        if (status === 503 && attempt < 3) {
          const wait = JSON.parse(Buffer.from(err.response.data).toString())?.estimated_time || 20;
          console.log(`[HuggingFaceProvider] Model loading, waiting ${wait}s (attempt ${attempt}/3)...`);
          await new Promise(r => setTimeout(r, Math.min(wait, 30) * 1000));
          continue;
        }

        const msg =
          status === 401 ? "HuggingFace: Invalid API key" :
          status === 403 ? "HuggingFace: Model access denied — request access at huggingface.co/black-forest-labs/FLUX.1-schnell" :
          status === 503 ? "HuggingFace: Model still loading, try again in a moment" :
          err.message || "Image generation failed";

        console.error(`[HuggingFaceProvider] Error ${status}:`, msg);
        throw new AppError(msg, 500);
      }
    }
  }
}

export default HuggingFaceProvider;
