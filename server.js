// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { connectDB } = require('./database');
const { notifyOwner } = require('./notify');

const app  = express();
const PORT = process.env.PORT || 3000;

// Vercel serverless support
const isVercel = process.env.VERCEL === '1';
const staticPath = isVercel
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(staticPath));

// POST /api/contact — save enquiry + notify owner
app.post('/api/contact', async (req, res) => {
  const { name, phone, message } = req.body;
  if (!name  || !name.trim())  return res.status(400).json({ error: 'Name is required' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone is required' });
  try {
    const contacts = await connectDB();
    const newContact = {
      name:      name.trim(),
      phone:     phone.trim(),
      message:   (message || '').trim(),
      createdAt: new Date().toISOString(),
    };
    const doc = await contacts.insertOne(newContact);
    const insertedDoc = { ...newContact, _id: doc.insertedId };
    // Fire notifications in background
    notifyOwner(insertedDoc).catch(err => console.error('[Notify] Unexpected error:', err));
    res.json({ success: true, id: doc.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/members — all members
app.get('/api/members', async (req, res) => {
  try {
    const contacts = await connectDB();
    const all = await contacts.find({}).sort({ createdAt: -1 }).toArray();
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats — basic stats
app.get('/api/stats', async (req, res) => {
  try {
    const contacts = await connectDB();
    const all = await contacts.find({}).toArray();
    res.json({ total: all.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/delete?id=xxx
app.get('/api/delete', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('Missing id');
  try {
    const contacts = await connectDB();
    await contacts.deleteOne(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard page — public
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(staticPath, 'dashboard.html'));
});

// Index page
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Export for Vercel
module.exports = app;

// Local development server
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n  Power Zone server running → http://localhost:${PORT}`);
    console.log(`  Dashboard               → http://localhost:${PORT}/dashboard\n`);
  });
}
