// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { connectDB, getContacts } = require('./database');
const { notifyOwner }  = require('./notify');

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
  const { name, phone, message, plan } = req.body;
  if (!name  || !name.trim())  return res.status(400).json({ error: 'Name is required' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone is required' });
  try {
    const contacts = await connectDB();
    const newContact = {
      name:      name.trim(),
      phone:     phone.trim(),
      message:   (message || '').trim(),
      plan:      (plan    || '').trim(),
      createdAt: new Date().toISOString(),
    };
    const doc = await contacts.insertOne(newContact);
    const insertedDoc = { ...newContact, _id: doc.insertedId };
    // Fire notifications in background — don't block the response
    notifyOwner(insertedDoc).catch(err => console.error('[Notify] Unexpected error:', err));
    res.json({ success: true, id: doc.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contacts — all enquiries (admin)
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await connectDB();
    const all = await contacts.find({}).sort({ createdAt: -1 }).toArray();
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats — plan counts
app.get('/api/stats', async (req, res) => {
  try {
    const contacts = await connectDB();
    const all   = await contacts.find({}).toArray();
    const plans = ['Basic', 'Standard', 'Premium', 'Gold'];
    const stats = { General: 0 };
    plans.forEach(p => { stats[p] = 0; });
    all.forEach(c => {
      const p = c.plan || 'General';
      stats[p] = (stats[p] || 0) + 1;
    });
    res.json({ total: all.length, byPlan: stats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(staticPath, 'admin.html'));
});

// Index page
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Export for Vercel
module.exports = app;

// Local development server
if (!isVercel) {
  app.listen(PORT, async () => {
    await connectDB();
    console.log(`\n  Power Zone server running → http://localhost:${PORT}`);
    console.log(`  Admin panel             → http://localhost:${PORT}/admin\n`);
    if (!process.env.GMAIL_USER)         console.warn('  ⚠️  Email not configured    — add GMAIL_USER to .env');
    if (!process.env.TWILIO_ACCOUNT_SID) console.warn('  ⚠️  WhatsApp not configured — add TWILIO credentials to .env');
    if (process.env.GMAIL_USER && process.env.TWILIO_ACCOUNT_SID) {
      console.log('  ✅ Email + WhatsApp notifications active\n');
    }
  });
}
