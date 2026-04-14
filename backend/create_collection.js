require('dotenv').config();
const mongoose = require('mongoose');
const CodeChunk = require('./models/CodeChunk');

async function createCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Insert a dummy document to force collection creation
    const dummyId = new mongoose.Types.ObjectId();
    const result = await CodeChunk.create({
      repositoryId: dummyId,
      filePath: 'dummy.js',
      functionName: 'dummy',
      codeContent: 'dummy',
      embedding: Array(768).fill(0) // Dummy vector
    });

    console.log('Successfully created dummy document and the codechunks collection!');
    
    // Delete the dummy document
    await CodeChunk.deleteOne({ _id: result._id });
    console.log('Cleaned up dummy document');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

createCollection();
