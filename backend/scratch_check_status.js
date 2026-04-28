const mongoose = require('mongoose');
require('dotenv').config();
const Execution = require('./models/Execution');

async function checkStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const latest = await Execution.find().sort({ createdAt: -1 }).limit(1);
    if (latest.length > 0) {
      const exec = latest[0];
      console.log('Latest Execution Status:');
      console.log(`ID: ${exec._id}`);
      console.log(`Repo: ${exec.repoFullName}`);
      console.log(`Status: ${exec.status}`);
      console.log(`Branch: ${exec.branch}`);
      console.log(`Fix Branch: ${exec.fixBranch}`);
      console.log(`Error Message: ${exec.errorMessage}`);
    } else {
      console.log('No executions found.');
    }
    
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

checkStatus();
