import ScraperService from './src/services/scraper.service.js';

async function test() {
  console.log("Starting scraper...");
  try {
    const leads = await ScraperService.scrapeJustdial('gym', 'noida', '201301');
    console.log("Scraped Leads count:", leads.length);
    console.log("Leads:", leads);
  } catch (err) {
    console.error("Scraper crashed:", err);
  }
  process.exit();
}
test();
