import imageProvider from "./image/imageProvider.js";
import getCloudinary from "../config/cloudinary.js";
import AppError from "../utils/AppError.js";

const AD_SIZES = {
  facebook:  { width: 1024, height: 576 },
  instagram: { width: 1024, height: 1024 },
  story:     { width: 576,  height: 1024 },
  banner:    { width: 1024, height: 576 },
};

const enhancePrompt = ({ prompt, campaignName, objective, platform, audience, tone }) => {
  const parts = [prompt];
  if (campaignName) parts.push(`campaign: ${campaignName}`);
  if (audience)     parts.push(`target audience: ${audience}`);
  if (tone)         parts.push(`style: ${tone}`);
  if (objective)    parts.push(`goal: ${objective.toLowerCase()}`);
  parts.push(`platform: ${platform || "facebook"} advertisement`);
  parts.push("professional marketing advertisement, high quality, commercial photography style, no text, no words, no letters, no typography in the image");
  return parts.join(", ");
};

const ImageService = {
  generate: async ({ prompt, type = "facebook", userId, campaignName, objective, platform, audience, tone, headline }) => {
    const size = AD_SIZES[type] || AD_SIZES.facebook;
    const enhanced = enhancePrompt({ prompt, campaignName, objective, platform: type, audience, tone });

    const base64 = await imageProvider.generate(enhanced, size);

    try {
      const uploaded = await getCloudinary().uploader.upload(base64, {
        folder: `ai-marketing/${userId}/ads`,
        resource_type: "image",
        transformation: [{ width: size.width, height: size.height, crop: "fill" }],
      });
      return { url: uploaded.secure_url, publicId: uploaded.public_id };
    } catch (err) {
      throw new AppError(err.message || "Failed to upload image", 500);
    }
  },

  delete: async (publicId) => {
    await getCloudinary().uploader.destroy(publicId);
  },
};

export default ImageService;
