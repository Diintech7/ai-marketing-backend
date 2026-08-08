import User from "../models/User.js";
import AppError from "../utils/AppError.js";

export const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      throw new AppError("API Key is missing in headers", 401);
    }

    const user = await User.findOne({ apiKeys: apiKey });
    if (!user) {
      throw new AppError("Invalid API Key", 401);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
