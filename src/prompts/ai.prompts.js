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
    systemPrompt: "You are an expert Meta Ads copywriter. Return ONLY valid JSON.",
    prompt: `Write a Meta ad copy for:
Product/Service: ${product}
Target Audience: ${audience}
Tone: ${tone}
CTA: ${cta}

Return JSON:
{
  "headline": "...",
  "primaryText": "...",
  "description": "...",
  "cta": "${cta}"
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
};
