import ImageService from "../../services/image.service.js";

export const generateImageTool = {
  name: "generateImage",
  description: "Generate an AI ad image and upload to Cloudinary",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Image generation prompt" },
      type: {
        type: "string",
        description: "Ad format: facebook, instagram, story, banner",
        default: "facebook",
      },
      userId: { type: "string", description: "User ID for Cloudinary folder" },
    },
    required: ["prompt", "userId"],
  },
  handler: async ({ prompt, type = "facebook", userId }) => {
    return ImageService.generate({ prompt, type, userId });
  },
};
