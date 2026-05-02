// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { connectDB } = require('./database');
const { notifyOwner } = require('./notify');

const app  = express();
const PORT = process.env.PORT || 3000;

// Admin credentials (defined in code as requested)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; // Change this for security

// Vercel serverless support
const isVercel = process.env.VERCEL === '1';
const staticPath = isVercel
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(staticPath));

// POST /api/contact — notify owner only (DO NOT SAVE to DB)
app.post('/api/contact', async (req, res) => {
  const { name, phone, message, plan } = req.body;
  if (!name  || !name.trim())  return res.status(400).json({ error: 'Name is required' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone is required' });
  
  try {
    const newContact = {
      name:      name.trim(),
      phone:     phone.trim(),
      message:   (message || '').trim(),
      plan:      plan || '',
      createdAt: new Date().toISOString(),
    };
    
    // Notify owner via Email/WhatsApp
    notifyOwner(newContact).catch(err => console.error('[Notify] Unexpected error:', err));
    
    // Return success without saving to DB
    res.json({ success: true, message: 'Notification sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/login — Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  // Trimming to prevent accidental whitespace issues
  const user = (username || '').trim();
  const pass = (password || '').trim();

  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

// POST /api/member/login — Member login
app.post('/api/member/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const contacts = await connectDB();
    const user = await contacts.find({ username: username.trim(), password: password }).toArray();
    
    if (user.length > 0) {
      if (user[0].approved === false) {
        return res.status(403).json({ error: 'Your account is pending admin approval.' });
      }
      res.json({ success: true, name: user[0].name });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/signup — Member signup (saves to DB)
app.post('/api/signup', async (req, res) => {
  const { name, phone, username, password } = req.body;
  
  if (!name || !phone || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const contacts = await connectDB();
    const newMember = {
      name:      name.trim(),
      phone:     phone.trim(),
      username:  username.trim(),
      password:  password,
      type:      'member',
      approved:  false, // Requires admin approval
      plan:      'Pending',
      expiryDate: null,
      createdAt: new Date().toISOString(),
    };
    
    await contacts.insertOne(newMember);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/approve — Approve a member
app.post('/api/approve', async (req, res) => {
  const { id } = req.body;
  try {
    const { ObjectId } = require('mongodb');
    const contacts = await connectDB();
    await contacts.updateOne({ _id: new ObjectId(id) }, { $set: { approved: true, plan: 'Monthly' } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// POST /api/update-plan — Update member plan/expiry
app.post('/api/update-plan', async (req, res) => {
  const { id, plan, expiryDate } = req.body;
  try {
    const { ObjectId } = require('mongodb');
    const contacts = await connectDB();
    await contacts.updateOne({ _id: new ObjectId(id) }, { $set: { plan, expiryDate } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan' });
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

// Login page (Member)
app.get('/login', (req, res) => {
  res.sendFile(path.join(staticPath, 'login.html'));
});

// Admin Login page
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(staticPath, 'admin-login.html'));
});

// Admin Dashboard
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(staticPath, 'admin-dashboard.html'));
});

// Signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(staticPath, 'signup.html'));
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
