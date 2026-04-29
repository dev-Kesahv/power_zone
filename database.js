const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let contacts;

async function connectDB() {
  if (!contacts) {
    await client.connect();
    const db = client.db('powerzone');
    contacts = db.collection('contacts');
    console.log('✅ Connected to MongoDB');
  }
  return contacts;
}

module.exports = { connectDB, getContacts: () => contacts };
