import CampaignService from "../services/campaign.service.js";
import { successResponse } from "../utils/apiResponse.js";

export const create = async (req, res, next) => {
  try {
    const campaign = await CampaignService.create(req.user._id, req.user.plan, req.body);
    successResponse(res, campaign, "Campaign created", 201);
  } catch (err) { next(err); }
};

export const getAll = async (req, res, next) => {
  try {
    const campaigns = await CampaignService.getAll(req.user._id, req.query);
    successResponse(res, campaigns);
  } catch (err) { next(err); }
};

export const getOne = async (req, res, next) => {
  try {
    const campaign = await CampaignService.getOne(req.user._id, req.params.id);
    successResponse(res, campaign);
  } catch (err) { next(err); }
};

export const update = async (req, res, next) => {
  try {
    const campaign = await CampaignService.update(req.user._id, req.params.id, req.body);
    successResponse(res, campaign, "Campaign updated");
  } catch (err) { next(err); }
};

export const publish = async (req, res, next) => {
  try {
    const campaign = await CampaignService.publish(req.user, req.params.id);
    successResponse(res, campaign, "Campaign published");
  } catch (err) {
    console.error("[Publish Error]", err.message, err.stack);
    next(err);
  }
};

export const pause = async (req, res, next) => {
  try {
    const campaign = await CampaignService.pause(req.user, req.params.id);
    successResponse(res, campaign, "Campaign paused");
  } catch (err) { next(err); }
};

export const resume = async (req, res, next) => {
  try {
    const campaign = await CampaignService.resume(req.user, req.params.id);
    successResponse(res, campaign, "Campaign resumed");
  } catch (err) { next(err); }
};

export const updateBudget = async (req, res, next) => {
  try {
    const campaign = await CampaignService.updateBudget(req.user, req.params.id, req.body.budget);
    successResponse(res, campaign, "Budget updated");
  } catch (err) { next(err); }
};

export const syncInsights = async (req, res, next) => {
  try {
    const campaign = await CampaignService.syncInsights(req.user, req.params.id);
    successResponse(res, campaign, "Insights synced");
  } catch (err) { next(err); }
};

export const remove = async (req, res, next) => {
  try {
    await CampaignService.delete(req.user, req.params.id);
    successResponse(res, {}, "Campaign deleted");
  } catch (err) { next(err); }
};

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    const getCloudinary = (await import("../config/cloudinary.js")).default;
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await getCloudinary().uploader.upload(b64, {
      folder: `ai-marketing/${req.user._id}/uploads`,
      resource_type: "image",
    });
    successResponse(res, { url: result.secure_url, publicId: result.public_id }, "Image uploaded");
  } catch (err) { next(err); }
};
