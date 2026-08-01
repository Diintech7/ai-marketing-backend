import LeadSearchQuery from "../models/LeadSearchQuery.js";
import Lead from "../models/Lead.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import ScraperService from "./scraper.service.js";
import axios from "axios";

class LeadService {
  // Helper function to generate pitch using DeepSeek
  async generateAIPitch(businessName, category) {
    try {
      const response = await axios.post(
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions",
        {
          model: process.env.AI_MODEL || "deepseek/deepseek-chat",
          messages: [
            { role: "system", content: "You are an expert marketing strategist for a SaaS company. Output EXACTLY in this format separated by a pipe (|): \n<1 sentence description & pitch suggestion>|<Lead Quality: Hot, Warm, or Cold based on if it's a valuable niche>." },
            { role: "user", content: `Business: ${businessName}\nCategory/Keyword: ${category}` }
          ]
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 8000
        }
      );
      
      const content = response.data.choices[0].message.content.trim();
      const parts = content.split('|');
      let pitchSuggestion = parts[0]?.trim() || content;
      let leadQuality = 'Warm';
      if (parts[1]) {
        const q = parts[1].toLowerCase();
        if (q.includes('hot')) leadQuality = 'Hot';
        else if (q.includes('cold')) leadQuality = 'Cold';
      }

      return { pitchSuggestion, leadQuality };
    } catch (error) {
      console.error("AI Pitch Generation failed:", error.response?.data?.error || error.message);
      throw new Error(error.response?.data?.error?.message || "Failed to generate AI strategy. Please check your API key.");
    }
  }
  async generateLeads(keyword, location, pincode, platforms) {
    // 1. Check 15-day Cache
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const existingQuery = await LeadSearchQuery.findOne({
      keyword: keyword.toLowerCase(),
      location: location.toLowerCase(),
      pincode: pincode || "",
      lastScrapedAt: { $gte: fifteenDaysAgo }
    });

    if (existingQuery && existingQuery.status === 'completed') {
      return { 
        message: "Fresh data is already available from recent scans!",
        queryId: existingQuery._id,
        cached: true 
      };
    }

    // 2. Create new query record
    let queryRecord = existingQuery;
    if (!queryRecord) {
      queryRecord = await LeadSearchQuery.create({
        keyword,
        location,
        pincode: pincode || "",
        platforms,
        status: "scraping"
      });
    } else {
      queryRecord.status = "scraping";
      queryRecord.lastScrapedAt = new Date();
      queryRecord.platforms = [...new Set([...queryRecord.platforms, ...platforms])];
      await queryRecord.save();
    }

    // 3. Trigger Background Scraping Task (Do not await this so API returns fast)
    this.runScrapingJob(queryRecord._id, keyword, location, pincode, platforms).catch(console.error);

    return {
      message: "Lead extraction started in the background. We will notify you once done.",
      queryId: queryRecord._id,
      cached: false
    };
  }

  async runScrapingJob(queryId, keyword, location, pincode, platforms) {
    let totalLeads = 0;
    
    // Let ScraperService handle the browser launch, looping over platforms, and initial deduplication
    const scrapedLeads = await ScraperService.runScrapingJob(queryId, keyword, location, pincode, platforms);
    
    for (const leadData of scrapedLeads) {
      // Save and deduplicate in MongoDB
      await this.saveLead(leadData, queryId);
      totalLeads++;
    }

    // Mark query as completed
    await LeadSearchQuery.findByIdAndUpdate(queryId, { 
      status: "completed",
      totalLeadsFound: totalLeads
    });

    // Notify users
    const admin = await User.findOne({ role: "admin" });
    if (admin) {
      await Notification.create({
        user: admin._id,
        title: "Lead Extraction Complete",
        message: `Found ${totalLeads} leads for '${keyword}' in ${location}.`,
        type: "success",
        link: "/dashboard/leads"
      });
    }
  }

  async saveLead(leadData, queryId) {
    const { businessName, pincode, phoneNumbers, sources } = leadData;
    
    let existingLead = null;

    // Deduplication Rule 1: Phone Number match
    if (phoneNumbers && phoneNumbers.length > 0) {
      existingLead = await Lead.findOne({ phoneNumbers: { $in: phoneNumbers } });
    }

    // Deduplication Rule 2: Name + Pincode match
    if (!existingLead && businessName && pincode) {
      existingLead = await Lead.findOne({ 
        businessName: new RegExp(`^${businessName}$`, 'i'), 
        pincode 
      });
    }

    if (existingLead) {
      // Note: We no longer generate AI pitch inline here to save time and API limits.
      // The user will generate it on-demand via the UI.
      
      // Merge sources
      const newSources = sources.filter(src => !existingLead.sources.includes(src));
      if (newSources.length > 0) {
        existingLead.sources.push(...newSources);
      }
      
      // Update missing phone numbers
      const newPhones = phoneNumbers.filter(ph => !existingLead.phoneNumbers.includes(ph));
      if (newPhones.length > 0) {
        existingLead.phoneNumbers.push(...newPhones);
      }
      
      await existingLead.save();
      return existingLead;
    } else {
      // Create new (Without inline AI pitch to save time)
      return await Lead.create({
        ...leadData,
        pitchSuggestion: null,
        leadQuality: "Unknown",
        searchQueryId: queryId
      });
    }
  }

  async getLeads(filters) {
    return await Lead.find(filters).sort({ createdAt: -1 });
  }

  async getQueryStatus(queryId) {
    return await LeadSearchQuery.findById(queryId);
  }
}

export default new LeadService();
