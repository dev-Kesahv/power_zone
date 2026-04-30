const nodemailer = require('nodemailer');
const twilio = require('twilio');

// ── Email via Gmail ───────────────────────────────────────────────────────────
async function sendEmail(contact) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[Email] Skipped – GMAIL_USER or GMAIL_APP_PASSWORD not set in .env');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const SITE_URL = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const acceptUrl = `${SITE_URL}/api/accept?id=${contact._id}`;

  const planLine = contact.plan ? `Plan Interested  : ${contact.plan}` : '';
  const msgLine  = contact.message ? `Message          : ${contact.message}` : '';

  await transporter.sendMail({
    from: `"Power Zone Website" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
    subject: `🏋️ New Enquiry from ${contact.name}`,
    text: `
New enquiry received on your Power Zone website!

Name             : ${contact.name}
Phone            : ${contact.phone}
${planLine}
${msgLine}

Time             : ${new Date(contact.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Accept this member: ${acceptUrl}
    `.trim(),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#1a1a1a;color:#eaeaea;border-radius:12px;overflow:hidden;">
        <div style="background:#f2c94c;padding:20px 28px;">
          <h2 style="margin:0;color:#000;font-size:1.3rem;">🏋️ New Enquiry — Power Zone</h2>
        </div>
        <div style="padding:24px 28px;">
          <table style="width:100%;border-collapse:collapse;font-size:.95rem;">
            <tr><td style="padding:8px 0;color:#999;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;">${contact.name}</td></tr>
            <tr><td style="padding:8px 0;color:#999;">Phone</td><td style="padding:8px 0;"><a href="tel:${contact.phone}" style="color:#f2c94c;">${contact.phone}</a></td></tr>
            ${contact.plan ? `<tr><td style="padding:8px 0;color:#999;">Plan</td><td style="padding:8px 0;color:#f2c94c;font-weight:600;">${contact.plan}</td></tr>` : ''}
            ${contact.message ? `<tr><td style="padding:8px 0;color:#999;vertical-align:top;">Message</td><td style="padding:8px 0;">${contact.message}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#999;">Time</td><td style="padding:8px 0;color:#888;">${new Date(contact.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
          </table>
          <div style="margin-top:24px;text-align:center;">
            <a href="${acceptUrl}" style="background:#f2c94c;color:#000;padding:12px 32px;border-radius:25px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">✅ Accept Member</a>
          </div>
          <p style="margin-top:16px;font-size:.8rem;color:#555;text-align:center;">Click the button above to accept and list this member on the dashboard.</p>
        </div>
      </div>
    `,
  });

  console.log(`[Email] Notification sent to ${process.env.NOTIFY_EMAIL || process.env.GMAIL_USER}`);
}

// ── WhatsApp via Twilio ───────────────────────────────────────────────────────
async function sendWhatsApp(contact) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('[WhatsApp] Skipped – Twilio credentials not set in .env');
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const lines = [
    `🏋️ *New Enquiry – Power Zone*`,
    ``,
    `👤 *Name:* ${contact.name}`,
    `📞 *Phone:* ${contact.phone}`,
    contact.plan    ? `💳 *Plan:* ${contact.plan}` : '',
    contact.message ? `💬 *Message:* ${contact.message}` : '',
    ``,
    `🕐 ${new Date(contact.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
  ].filter(l => l !== null && l !== undefined && !(l === '' && lines)).join('\n');

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to:   process.env.TWILIO_WHATSAPP_TO,
    body: lines,
  });

  console.log(`[WhatsApp] Notification sent to ${process.env.TWILIO_WHATSAPP_TO}`);
}

// ── Send both ─────────────────────────────────────────────────────────────────
async function notifyOwner(contact) {
  const results = await Promise.allSettled([
    sendEmail(contact),
    sendWhatsApp(contact),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[Notify] ${i === 0 ? 'Email' : 'WhatsApp'} failed:`, r.reason?.message || r.reason);
    }
  });
}

module.exports = { notifyOwner };
