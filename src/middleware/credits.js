import User from "../models/User.js";
import AIUsage from "../models/AIUsage.js";
import { AI_TOOL_CREDITS } from "../constants/index.js";
import AppError from "../utils/AppError.js";

export const checkCredits = (tool) => async (req, res, next) => {
  try {
    const cost = AI_TOOL_CREDITS[tool];
    if (!cost) return next();

    const user = await User.findById(req.user._id);
    if (user.credits < cost)
      throw new AppError(`Insufficient credits. This action requires ${cost} credits.`, 402);

    // Deduct credits
    user.credits -= cost;
    await user.save();

    // Log usage
    await AIUsage.create({
      user: user._id,
      tool,
      creditsUsed: cost,
      campaignId: req.body.campaignId || null,
    });

    req.user = user;
    next();
  } catch (err) { next(err); }
};
