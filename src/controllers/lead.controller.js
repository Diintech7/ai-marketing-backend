import LeadService from "../services/lead.service.js";
import Lead from "../models/Lead.js";
import LeadSearchQuery from "../models/LeadSearchQuery.js";
import ScrapeHistory from "../models/ScrapeHistory.js";

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
      message: "Lead analyzed successfully",
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

export const saveExtensionLeads = async (req, res, next) => {
  try {
    const { leads } = req.body;
    
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, message: "No leads provided" });
    }

    let savedCount = 0;
    
    for (const leadData of leads) {
      // Robust deduplication based on AI Grid specifications
      const orConditions = [];

      if (leadData.phoneNumbers && leadData.phoneNumbers.length > 0) {
        orConditions.push({ phoneNumbers: { $in: leadData.phoneNumbers } });
      }
      if (leadData.website) {
        orConditions.push({ website: leadData.website });
      }
      if (leadData.googleMapsUrl) {
        orConditions.push({ googleMapsUrl: leadData.googleMapsUrl });
      }
      if (leadData.latitude && leadData.longitude) {
        // Very close coordinates with same name
        orConditions.push({ 
          latitude: leadData.latitude, 
          longitude: leadData.longitude,
          businessName: leadData.businessName
        });
      }
      
      // Fallback to name + city if no other strict identifiers
      orConditions.push({
        businessName: leadData.businessName,
        city: leadData.city
      });

      const query = { $or: orConditions };

      const existing = await Lead.findOne(query);

      if (existing) {
        // Update sources if new
        let updated = false;
        if (leadData.sources && leadData.sources.length > 0) {
          leadData.sources.forEach(src => {
            if (!existing.sources.includes(src)) {
              existing.sources.push(src);
              updated = true;
            }
          });
        }
        if (updated) await existing.save();
      } else {
        await Lead.create(leadData);
        savedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully saved ${savedCount} new leads`,
      savedCount
    });
  } catch (error) {
    next(error);
  }
};

export const checkScrapeHistory = async (req, res, next) => {
  try {
    const { category, pincode } = req.body;
    if (!category || !pincode) return res.status(400).json({ success: false, message: "Missing category or pincode" });

    // We consider it "scraped recently" if it was done in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await ScrapeHistory.findOne({
      category: new RegExp(`^${category}$`, 'i'),
      pincode: pincode,
      status: "Completed",
      scrapedAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      shouldSkip: !!history,
      history: history
    });
  } catch (error) {
    next(error);
  }
};

export const logScrapeHistory = async (req, res, next) => {
  try {
    const { category, pincode, status, leadsFound, platforms } = req.body;
    
    // Upsert the history record
    const history = await ScrapeHistory.findOneAndUpdate(
      { category: new RegExp(`^${category}$`, 'i'), pincode: pincode },
      { 
        category, 
        pincode, 
        status: status || "Completed", 
        leadsFound: leadsFound || 0,
        scrapedAt: new Date(),
        $addToSet: { platforms: { $each: platforms || [] } }
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

export const getMissingWebsiteLeads = async (req, res, next) => {
  try {
    const missingLeads = await Lead.find({
      $or: [
        { website: { $exists: false } },
        { website: null },
        { website: "" }
      ]
    }).limit(100); // Process in batches

    res.status(200).json({ success: true, count: missingLeads.length, data: missingLeads });
  } catch (error) {
    next(error);
  }
};

export const updateLeadWebsite = async (req, res, next) => {
  try {
    const { id, website } = req.body;
    if (!id || !website) {
      return res.status(400).json({ success: false, message: "Missing id or website" });
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      { website: website },
      { new: true }
    );

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};
