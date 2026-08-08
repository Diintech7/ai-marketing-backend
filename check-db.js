import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkLeads() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const leads = await db.collection('leads').find({}).toArray();
    console.log("TOTAL LEADS:", leads.length);
    leads.forEach(l => {
      console.log(`- ${l.businessName} | Website: ${l.website}`);
    });
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
checkLeads();
