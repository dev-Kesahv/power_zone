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
      status:    'pending',       // ← starts as pending
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

// GET /api/accept?id=xxx — owner clicks Accept button in email
app.get('/api/accept', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('Missing id');
  try {
    const contacts = await connectDB();
    await contacts.updateOne(id, { $set: { status: 'accepted' } });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Member Accepted – Power Zone</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          *{margin:0;padding:0;box-sizing:border-box;}
          body{background:#111;color:#eaeaea;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;}
          .card{background:#1a1a1a;border:1px solid #252525;border-radius:18px;padding:40px;text-align:center;max-width:400px;}
          .icon{font-size:3rem;margin-bottom:16px;}
          h2{color:#f2c94c;font-size:1.4rem;margin-bottom:10px;}
          p{color:#777;font-size:.9rem;}
          a{display:inline-block;margin-top:20px;background:#f2c94c;color:#000;padding:10px 24px;border-radius:20px;text-decoration:none;font-weight:700;}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h2>Member Accepted!</h2>
          <p>This member is now listed on the Power Zone dashboard.</p>
          <a href="/dashboard">View Dashboard →</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// GET /api/members — only accepted members (for dashboard)
app.get('/api/members', async (req, res) => {
  try {
    const contacts = await connectDB();
    const members = await contacts.find({ status: 'accepted' }).sort({ createdAt: -1 }).toArray();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats — counts of accepted members
app.get('/api/stats', async (req, res) => {
  try {
    const contacts = await connectDB();
    const all = await contacts.find({ status: 'accepted' }).toArray();
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
    if (!process.env.GMAIL_USER)         console.warn('  ⚠️  Email not configured    — add GMAIL_USER to .env');
    if (!process.env.TWILIO_ACCOUNT_SID) console.warn('  ⚠️  WhatsApp not configured — add TWILIO credentials to .env');
  });
}
