// database.js — NeDB locally, MongoDB Atlas in production (Vercel)

const isVercel = process.env.VERCEL === '1';

if (isVercel || process.env.MONGODB_URI) {
  // ── PRODUCTION: MongoDB Atlas ────────────────────────────────────────────
  const { MongoClient, ObjectId } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  let col;

  async function connectDB() {
    if (!col) {
      await client.connect();
      col = client.db('powerzone').collection('contacts');
      console.log('✅ Connected to MongoDB Atlas');
    }
    return {
      insertOne: (doc) => col.insertOne(doc),
      find: (q) => ({
        sort: (s) => ({ toArray: () => col.find(q || {}).sort(s || {}).toArray() }),
        toArray: () => col.find(q || {}).toArray(),
      }),
      updateOne: (id, update) => col.updateOne({ _id: new ObjectId(id) }, update),
    };
  }

  module.exports = { connectDB };

} else {
  // ── LOCAL DEV: NeDB (file-based, no MongoDB install needed) ─────────────
  const path = require('path');
  const Datastore = require('nedb-promises');

  const db = Datastore.create({
    filename: path.join(__dirname, 'data', 'contacts.db'),
    autoload: true,
  });

  async function connectDB() {
    return {
      insertOne: async (doc) => {
        const inserted = await db.insert(doc);
        return { insertedId: inserted._id };
      },
      find: (query) => ({
        sort: (s) => ({
          toArray: async () => {
            const results = await db.find(query || {});
            // Sort by createdAt descending
            return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          },
        }),
        toArray: () => db.find(query || {}),
      }),
      updateOne: (id, update) => db.update({ _id: id }, update, {}),
    };
  }

  module.exports = { connectDB };
}
