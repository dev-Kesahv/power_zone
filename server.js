// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
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
app.use(cookieParser());
app.use(express.static(staticPath));

// Auth middlewares
const checkAuth = (req, res, next) => {
  if (req.cookies.auth_token === 'logged_in') next();
  else res.redirect('/login');
};

const checkApiAuth = (req, res, next) => {
  if (req.cookies.auth_token === 'logged_in') next();
  else res.status(401).json({ error: 'Unauthorized' });
};

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
app.get('/api/contacts', checkApiAuth, async (req, res) => {
  try {
    const contacts = await connectDB();
    const all = await contacts.find({}).sort({ createdAt: -1 }).toArray();
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats — plan counts
app.get('/api/stats', checkApiAuth, async (req, res) => {
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

// API Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.cookie('auth_token', 'logged_in', { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// API Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(staticPath, 'login.html'));
});

// Dashboard page
app.get('/dashboard', checkAuth, (req, res) => {
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
    console.log(`  Login                   → http://localhost:${PORT}/login`);
    console.log(`  Dashboard               → http://localhost:${PORT}/dashboard\n`);
    if (!process.env.GMAIL_USER)         console.warn('  ⚠️  Email not configured    — add GMAIL_USER to .env');
    if (!process.env.TWILIO_ACCOUNT_SID) console.warn('  ⚠️  WhatsApp not configured — add TWILIO credentials to .env');
  });
}
