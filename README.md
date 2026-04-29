# Power Zone – The Fitness Club Website

Full-stack gym website with contact form, membership plans, admin panel,
Email notifications, and WhatsApp notifications.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js + Express
- **Database**: NeDB (flat-file, no setup needed)
- **Email**: Nodemailer + Gmail
- **WhatsApp**: Twilio WhatsApp API

## Project Structure
```
powerzone-final/

├── index.html        ← Main website
├── admin.html        ← Admin dashboard
├── server.js             ← Express server + API
├── database.js           ← DB setup
├── notify.js             ← Email + WhatsApp notifications
├── .env.example          ← Copy this to .env and fill in values
├── package.json
└── README.md
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up your credentials
```bash
# Copy the example env file
cp .env.example .env

# Open .env in any text editor and fill in your values
```

### 3. Start the server
```bash
node server.js
```

### 4. Open in browser
- **Website**  → http://localhost:3000
- **Admin**    → http://localhost:3000/admin

---

## Setting Up Gmail Notifications

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** (required)
3. Go to **App Passwords** → Select "Mail" + "Other (Custom)" → name it "PowerZone"
4. Copy the 16-character password shown
5. In your `.env` file:
```
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
NOTIFY_EMAIL=yourgmail@gmail.com
```

---

## Setting Up WhatsApp Notifications (Twilio)

1. Sign up free at https://www.twilio.com
2. Go to **Console → Messaging → Try it out → Send a WhatsApp message**
3. Follow the sandbox setup — send the join code from your WhatsApp to activate
4. In your `.env` file:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+919303999966
```

> **Note:** The free Twilio trial uses a shared sandbox number.
> To use your own number, upgrade to a paid Twilio plan.

---

## How It Works

1. Visitor fills the contact form on the website
2. Form data is saved to `data/contacts.db`
3. Instantly sends you:
   - 📧 An email with the enquiry details
   - 💬 A WhatsApp message to your number
4. You can also view all enquiries at `/admin`

---

## API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/contact | Save form + trigger notifications |
| GET | /api/contacts | Get all submissions (admin) |
| GET | /api/stats | Enquiry counts by plan |

