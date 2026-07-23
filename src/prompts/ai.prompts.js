export const prompts = {
  generateEmail: ({ prompt }) => ({
    systemPrompt: "You are an expert email marketing copywriter. Write a highly professional, engaging, and conversion-focused email based on the user's rough idea. Output ONLY valid JSON containing the subject and HTML body. CRITICAL: You must escape all newlines in the HTML string as \\n, or avoid newlines entirely. Do not output literal newlines inside the JSON string.",
    prompt: `Convert this rough idea into a professional email:
Idea: "${prompt}"

Return STRICT JSON:
{
  "subject": "Catchy Subject Line Here",
  "body": "<div>Your professional HTML formatted email here...</div>"
}`
  }),
  adCopy: ({ product, audience, tone = "professional", cta = "Learn More" }) => ({
    systemPrompt: "You are an expert digital marketing copywriter. Return ONLY valid JSON.",
    prompt: `Write 3 different ad copy variations for:
Product/Service: ${product}
Target Audience: ${audience}
Tone: ${tone}
CTA: ${cta}

RULES:
1. "metaAdCopy": Can include emojis. Engaging and catchy.
2. "googleAdCopy": MUST strictly follow length limits. NO EMOJIS ALLOWED AT ALL.
   - headlines: 3 to 5 options. MAX 30 characters each.
   - descriptions: 2 options. MAX 90 characters each.
   - videoHeadline: MAX 15 characters.

Return JSON EXACTLY like this:
{
  "ads": [
    {
      "metaAdCopy": {
        "headline": "...",
        "primaryText": "...",
        "description": "...",
        "cta": "${cta}"
      },
      "googleAdCopy": {
        "headlines": ["...", "...", "..."],
        "descriptions": ["...", "..."],
        "videoHeadline": "..."
      }
    }
  ]
}`,
  }),

  translateAdCopy: ({ adCopy, targetLanguage }) => ({
    systemPrompt: "You are an expert digital marketing localization specialist. Translate the provided ad copy into the requested language while maintaining the catchy marketing appeal, tone, and call-to-action. Return ONLY valid JSON.",
    prompt: `Translate this ad copy into ${targetLanguage}:
Headline: ${adCopy.headline}
Primary Text: ${adCopy.primaryText}
Description: ${adCopy.description}
CTA: ${adCopy.cta}

Return JSON:
{
  "headline": "...",
  "primaryText": "...",
  "description": "...",
  "cta": "..."
}`,
  }),


  marketingStrategy: ({ business, goal, budget, targetAudience }) => ({
    systemPrompt: "You are a senior digital marketing strategist. Return ONLY valid JSON.",
    prompt: `Create a marketing strategy for:
Business: ${business}
Goal: ${goal}
Budget: ₹${budget}
Target Audience: ${targetAudience}

Return JSON:
{
  "overview": "...",
  "channels": ["..."],
  "tactics": ["..."],
  "timeline": "...",
  "kpis": ["..."],
  "estimatedROI": "..."
}`,
  }),

  seoTitle: ({ topic, keywords }) => ({
    systemPrompt: "You are an SEO expert. Return ONLY valid JSON.",
    prompt: `Generate 5 SEO-optimized titles for:
Topic: ${topic}
Keywords: ${keywords}

Return JSON: { "titles": ["...", "...", "...", "...", "..."] }`,
  }),

  seoDescription: ({ topic, keywords }) => ({
    systemPrompt: "You are an SEO expert. Return ONLY valid JSON.",
    prompt: `Write an SEO meta description (150-160 chars) for:
Topic: ${topic}
Keywords: ${keywords}

Return JSON: { "description": "..." }`,
  }),

  keywords: ({ topic, industry }) => ({
    systemPrompt: "You are an SEO keyword researcher. Return ONLY valid JSON.",
    prompt: `Generate 15 SEO keywords for:\nTopic: ${topic}\nIndustry: ${industry}\n\nReturn JSON: { "keywords": ["keyword1", "keyword2"] }`,
  }),

  hashtags: ({ topic, platform = "instagram" }) => ({
    systemPrompt: "You are a social media expert. Return ONLY valid JSON.",
    prompt: `Generate 20 trending hashtags for:
Topic: ${topic}
Platform: ${platform}

Return JSON: { "hashtags": ["#...", "..."] }`,
  }),

  captions: ({ product, platform = "instagram", tone = "engaging" }) => ({
    systemPrompt: "You are a social media copywriter. Return ONLY valid JSON.",
    prompt: `Write 3 social media captions for:
Product: ${product}
Platform: ${platform}
Tone: ${tone}

Return JSON: { "captions": ["...", "...", "..."] }`,
  }),

  cta: ({ product, goal }) => ({
    systemPrompt: "You are a conversion rate expert. Return ONLY valid JSON.",
    prompt: `Generate 5 high-converting CTAs for:
Product: ${product}
Goal: ${goal}

Return JSON: { "ctas": ["...", "...", "...", "...", "..."] }`,
  }),

  campaignSuggestion: ({ business, budget, targetAudience, goal }) => ({
    systemPrompt: "You are a Meta Ads expert. Return ONLY valid JSON.",
    prompt: `Suggest a Meta campaign structure for:
Business: ${business}
Budget: ₹${budget}
Target Audience: ${targetAudience}
Goal: ${goal}

Return JSON:
{
  "campaignName": "...",
  "objective": "TRAFFIC|LEADS|SALES|AWARENESS",
  "adSets": [{
    "name": "...",
    "targeting": { "ageMin": 18, "ageMax": 35, "locations": ["..."], "interests": ["..."] },
    "budget": 0,
    "budgetType": "daily"
  }],
  "adCopy": { "headline": "...", "primaryText": "...", "description": "...", "cta": "..." }
}`,
  }),

  magicCampaign: ({ urlText, description, budget, platform, googleAdType }) => {
    let adCopySchema = "";
    
    let googleSchema = "";
    let googleRules = "";
    if (googleAdType === "display") {
      googleSchema = `"googleAdCopy": { "headlines": ["...", "...", "...", "...", "..."], "descriptions": ["...", "...", "...", "..."], "videoHeadline": "..." }`;
      googleRules = "- CRITICAL FOR GOOGLE DISPLAY ADS: You MUST generate 5 unique headlines (max 30 chars) and 4 descriptions (max 90 chars).";
    } else if (googleAdType === "youtube") {
      googleSchema = `"googleAdCopy": { "headlines": ["..."], "descriptions": ["...", "..." ], "videoHeadline": "..." }`;
      googleRules = "- CRITICAL FOR GOOGLE VIDEO ADS: You MUST generate exactly 1 short videoHeadline (max 15 chars), 1 regular headline (max 30 chars), and 2 descriptions (max 90 chars).";
    } else {
      googleSchema = `"googleAdCopy": { "headlines": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "..."], "descriptions": ["...", "...", "...", "..."], "videoHeadline": "..." }`;
      googleRules = `- Google Ads MUST have EXACTLY 15 UNIQUE headlines and EXACTLY 4 UNIQUE descriptions.
- CRITICAL FOR GOOGLE SEARCH ADS AD STRENGTH: You MUST generate 5-7 highly relevant keywords in the "keywords" array. Then, you MUST include these EXACT keywords in AT LEAST 5-7 of the 15 headlines. Google Ads penalizes Ad Strength if the target keywords are not present in the headlines. The remaining headlines should be a mix of brand name, benefits, and CTAs.`;
    }

    if (platform === "meta") {
      adCopySchema = `"metaAdCopy": { "headline": "...", "primaryText": "...", "description": "...", "cta": "LEARN_MORE" }`;
    } else if (platform === "google") {
      adCopySchema = googleSchema;
    } else {
      adCopySchema = `"metaAdCopy": { "headline": "...", "primaryText": "...", "description": "...", "cta": "LEARN_MORE" },
      ${googleSchema}`;
    }

    return {
      systemPrompt: "You are an elite Digital Marketing AI. You analyze websites and create complete marketing campaigns. Return ONLY valid JSON.",
      prompt: `Analyze this business and generate a complete marketing campaign.
Website Text: ${urlText}
User Description: ${description}
Budget: ${budget}
Platform: ${platform}

Return EXACTLY this JSON structure:
{
  "campaign": {
    "name": "Catchy Campaign Name",
    "objective": "TRAFFIC",
    "targeting": {
      "ageMin": 18,
      "ageMax": 45,
      "genders": [1, 2],
      "locations": [{"city": "Mumbai", "country": "IN", "region": "Maharashtra"}],
      "interests": [{"id": "0", "name": "Digital Marketing"}]
    }
  },
  "ads": [
    {
      ${adCopySchema}
    },
    {
      ${adCopySchema}
    },
    {
      ${adCopySchema}
    }
  ],
  "content": {
    "hashtags": ["#marketing", "#sales"],
    "seoTitle": ["SEO Title 1", "SEO Title 2"],
    "keywords": ["keyword1", "keyword2"],
    "captions": ["Caption 1", "Caption 2"]
  },
  "suggestedImagePrompt": "A highly detailed prompt for DALL-E/Image Gen to generate a visually appealing marketing image for this product, no text in image"
}
RULES: 
- Google Ads MUST STRICTLY follow limits (headlines max 30 chars, descriptions max 90 chars, no emojis). 
${googleRules}
- Meta Ads can have emojis.
- Objective must be one of: AWARENESS, TRAFFIC, ENGAGEMENT, LEADS, APP_PROMOTION, SALES.`
    };
  }
};
