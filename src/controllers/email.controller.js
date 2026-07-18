import EmailService from "../services/email.service.js";
import { successResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";

const handler = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req, res);
    if (result) successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const createCampaign = handler(async (req, res) => {
  const { name, subject, body, emails, status } = req.body;
  if (!name || !subject || !body) {
    throw new AppError("Name, Subject, and Body are required", 400);
  }
  const campaign = await EmailService.createCampaign(req.user, { name, subject, body, emails, status });
  return campaign;
});

export const getCampaigns = handler(async (req, res) => {
  const campaigns = await EmailService.getCampaignsByUser(req.user._id);
  return campaigns;
});

export const publishCampaign = handler(async (req, res) => {
  const { id } = req.params;
  const campaign = await EmailService.updateCampaignStatus(id, "active");
  if (!campaign) throw new AppError("Campaign not found", 404);
  return campaign;
});
