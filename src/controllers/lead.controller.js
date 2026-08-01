import LeadService from "../services/lead.service.js";
import Lead from "../models/Lead.js";

export const generateLeads = async (req, res, next) => {
  try {
    const { keyword, location, pincode, platforms } = req.body;
    
    if (!keyword || !location || !platforms || platforms.length === 0) {
      return res.status(400).json({ success: false, message: "Keyword, location, and at least one platform are required." });
    }

    const result = await LeadService.generateLeads(keyword, location, pincode, platforms);
    
    res.status(200).json({
      success: true,
      message: result.message,
      queryId: result.queryId,
      cached: result.cached
    });
  } catch (error) {
    next(error);
  }
};

export const getLeads = async (req, res, next) => {
  try {
    const filters = req.query; // basic filtering
    const leads = await LeadService.getLeads(filters);
    
    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    next(error);
  }
};

export const getQueryStatus = async (req, res, next) => {
  try {
    const { queryId } = req.params;
    const status = await LeadService.getQueryStatus(queryId);
    
    if (!status) {
      return res.status(404).json({ success: false, message: "Query not found" });
    }
    
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

export const analyzeLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = await Lead.findById(id);
    
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (lead.pitchSuggestion) {
      return res.status(400).json({ success: false, message: "Lead has already been analyzed" });
    }

    const aiData = await LeadService.generateAIPitch(lead.businessName, lead.category);
    
    lead.pitchSuggestion = aiData.pitchSuggestion;
    lead.leadQuality = aiData.leadQuality;
    await lead.save();

    res.status(200).json({
      success: true,
      message: "AI analysis completed",
      data: lead
    });
  } catch (error) {
    next(error);
  }
};
