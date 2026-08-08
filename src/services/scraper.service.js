import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36'
];

class ScraperService {
  async runScrapingJob(queryId, keyword, location, pincode, platforms) {
    const results = [];
    
    console.log(`[Scraper] Initializing headless browser with Human-Mimic Strategy...`);
    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
      });

      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        
        // Human-like delay between platform searches (30 to 45 seconds), skip for the very first platform
        if (i > 0) {
          const delayMs = 30000 + Math.random() * 15000;
          console.log(`[Scraper] IP Cooldown: Waiting ${Math.round(delayMs/1000)}s before next platform...`);
          await new Promise(r => setTimeout(r, delayMs));
        }

        console.log(`[Scraper] Starting extraction for ${platform} - ${keyword} in ${location}`);
        try {
          const platformData = await this.scrapePlatform(browser, platform, keyword, location, pincode);
          results.push(...platformData);
        } catch (err) {
          console.error(`[Scraper] Error scraping ${platform}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[Scraper] Fatal browser error:`, err);
    } finally {
      if (browser) await browser.close();
      console.log(`[Scraper] Browser closed.`);
    }

    // Deduplicate results
    const uniqueResults = [];
    const seen = new Set();
    for (const lead of results) {
      const key = `${lead.businessName}-${lead.phoneNumbers?.[0] || 'nophone'}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(lead);
      } else {
        const existing = uniqueResults.find(r => `${r.businessName}-${r.phoneNumbers?.[0] || 'nophone'}`.toLowerCase() === key);
        if (existing) {
          lead.sources.forEach(src => {
            if (!existing.sources.includes(src)) existing.sources.push(src);
          });
        }
      }
    }

    return uniqueResults; // Only return real data, no mock fallback!
  }

  async scrapePlatform(browser, platform, keyword, location, pincode) {
    let leads = [];
    
    // Generate the Google Dork query
    let dorkQuery = "";
    if (platform === "gmb") dorkQuery = `${keyword} ${location}`;
    else if (platform === "justdial") dorkQuery = `site:justdial.com ${keyword} ${location}`;
    else if (platform === "indiamart") dorkQuery = `site:indiamart.com ${keyword} ${location}`;
    else if (platform === "tradeindia") dorkQuery = `site:tradeindia.com ${keyword} ${location}`;
    else if (platform === "exportersindia") dorkQuery = `site:exportersindia.com ${keyword} ${location}`;
    else return [];

    // Create a fresh Incognito context for every platform to wipe cookies
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    // Randomize Viewport and User-Agent
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(randomUserAgent);
    await page.setViewport({ width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 200) });

    try {
      console.log(`[Scraper] Navigating to Google homepage...`);
      await page.goto("https://www.google.com", { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for search box
      await page.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 10000 });
      
      // Simulate human typing
      console.log(`[Scraper] Typing query: ${dorkQuery}`);
      await page.type('textarea[name="q"], input[name="q"]', dorkQuery, { delay: 100 + Math.random() * 100 });
      
      // Press enter and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.keyboard.press('Enter')
      ]);

      // Simulate human scrolling
      console.log(`[Scraper] Scrolling through results...`);
      for (let s = 0; s < 3; s++) {
        await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 400));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
      }

      const html = await page.content();
      const $ = cheerio.load(html);

      // Check for Captcha
      if ($('form[action="/errors/Fallback"]').length > 0 || html.includes('detected unusual traffic')) {
        console.warn(`[Scraper] Google Captcha triggered for ${platform}.`);
        return [];
      }

      // Enhanced extraction regex
      const phoneRegex = /(?:\+91|0)?[ -]?[6-9]\d{9}/g;
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;

      $('.g').each((i, el) => {
        const title = $(el).find('h3').text();
        const snippet = $(el).find('.VwiC3b').text() || $(el).text();
        
        if (!title) return;

        let businessName = title.split('-')[0].split('|')[0].trim();
        if (businessName.length < 3) businessName = title;

        const phones = [...new Set(snippet.match(phoneRegex) || [])].map(p => p.replace(/[^\d+]/g, ''));
        const emails = [...new Set(snippet.match(emailRegex) || [])].map(e => e.toLowerCase());

        if (phones.length > 0 || emails.length > 0 || platform === "gmb" || platform === "linkedin") {
          leads.push({
            businessName,
            category: keyword,
            phoneNumbers: phones.slice(0, 2),
            emails: emails.slice(0, 2),
            address: location,
            city: location.split(',')[0],
            pincode: pincode || "",
            rating: null,
            sources: [platform]
          });
        }
      });
      
    } catch (e) {
      console.error(`[Scraper] Google search failed for ${platform}:`, e.message);
    } finally {
      await context.close();
    }

    return leads;
  }
}

export default new ScraperService();
