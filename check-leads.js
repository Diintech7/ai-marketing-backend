import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function countLeads() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // The model is likely named 'Lead' so the collection is 'leads'
    const count = await mongoose.connection.db.collection('leads').countDocuments();
    console.log(`\n\n=== TOTAL LEADS IN DATABASE: ${count} ===\n\n`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

countLeads();
