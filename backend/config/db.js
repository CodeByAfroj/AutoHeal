const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autoheal', {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.error('   Check your MONGODB_URI in .env');
    // Don't exit — let the server still start for debugging
    setTimeout(() => connectDB(), 5000);
  }
};

module.exports = connectDB;
