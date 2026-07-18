import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { checkCredits } from "../middleware/credits.js";
import * as ctrl from "../controllers/ai.controller.js";

const router = Router();
router.use(protect);

router.post("/ad-copy",            checkCredits("adCopy"),             ctrl.generateAdCopy);
router.post("/email",              checkCredits("adCopy"),             ctrl.generateEmail);
router.post("/translate-ad-copy",  checkCredits("adCopy"),             ctrl.translateAdCopy);
router.post("/strategy",           checkCredits("marketingStrategy"),  ctrl.generateStrategy);
router.post("/seo-title",          checkCredits("seoTitle"),           ctrl.generateSEOTitle);
router.post("/seo-description",    checkCredits("seoDescription"),     ctrl.generateSEODescription);
router.post("/keywords",           checkCredits("keywords"),           ctrl.generateKeywords);
router.post("/hashtags",           checkCredits("hashtags"),           ctrl.generateHashtags);
router.post("/captions",           checkCredits("captions"),           ctrl.generateCaptions);
router.post("/cta",                checkCredits("cta"),                ctrl.generateCTA);
router.post("/campaign-suggestion",checkCredits("campaignSuggestion"), ctrl.generateCampaignSuggestion);
router.post("/image",              checkCredits("image"),              ctrl.generateImage);

export default router;
