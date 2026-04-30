// database.js — uses NeDB locally, MongoDB Atlas in production (Vercel)

const isVercel = process.env.VERCEL === '1';

let contacts;

if (isVercel || process.env.MONGODB_URI) {
  // ── PRODUCTION: MongoDB Atlas ────────────────────────────────────────────
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  let connected = false;

  async function connectDB() {
    if (!connected) {
      await client.connect();
      const db = client.db('powerzone');
      contacts = db.collection('contacts');
      connected = true;
      console.log('✅ Connected to MongoDB Atlas');
    }
    return {
      find: (q) => ({ sort: () => ({ toArray: () => contacts.find(q || {}).sort({ createdAt: -1 }).toArray() }), toArray: () => contacts.find(q || {}).toArray() }),
      insertOne: (doc) => contacts.insertOne(doc),
    };
  }

  module.exports = { connectDB, getContacts: () => contacts };

} else {
  // ── LOCAL DEV: NeDB (file-based, no install needed) ─────────────────────
  const path = require('path');
  const Datastore = require('nedb-promises');

  const db = Datastore.create({
    filename: path.join(__dirname, 'data', 'contacts.db'),
    autoload: true,
  });

  // Wrap NeDB to match the MongoDB API used in server.js
  const adapter = {
    insertOne: async (doc) => {
      const inserted = await db.insert(doc);
      return { insertedId: inserted._id };
    },
    find: (query) => ({
      sort: (_s) => ({
        toArray: () => db.find(query || {}).sort({ createdAt: -1 }),
      }),
      toArray: () => db.find(query || {}),
    }),
  };

  async function connectDB() {
    return adapter;
  }

  module.exports = { connectDB, getContacts: () => adapter };
}
