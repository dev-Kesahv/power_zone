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

View Dashboard to manage: ${process.env.SITE_URL || 'http://localhost:3000'}/dashboard
    `.trim(),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
        <div style="background:#f2c94c;padding:22px 28px;">
          <h2 style="margin:0;color:#000;font-size:1.3rem;">🏋️ New Enquiry — Power Zone</h2>
        </div>
        <div style="background:#ffffff;padding:28px;">
          <table style="width:100%;border-collapse:collapse;font-size:.95rem;color:#111;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:12px 0;color:#666;width:130px;font-weight:600;">Name</td>
              <td style="padding:12px 0;font-weight:700;color:#111;">${contact.name}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:12px 0;color:#666;font-weight:600;">Phone</td>
              <td style="padding:12px 0;"><a href="tel:${contact.phone}" style="color:#b8960a;font-weight:600;text-decoration:none;">${contact.phone}</a></td>
            </tr>
            ${contact.message ? `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:12px 0;color:#666;font-weight:600;vertical-align:top;">Message</td>
              <td style="padding:12px 0;color:#333;line-height:1.6;">${contact.message}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:12px 0;color:#666;font-weight:600;">Time</td>
              <td style="padding:12px 0;color:#888;">${new Date(contact.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            </tr>
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="${process.env.SITE_URL || 'http://localhost:3000'}/dashboard" style="background:#000;color:#fff;padding:12px 30px;border-radius:25px;text-decoration:none;font-weight:700;font-size:.9rem;display:inline-block;">Open Dashboard →</a>
          </div>
        </div>
        <div style="background:#f9f9f9;padding:12px 28px;text-align:center;font-size:.78rem;color:#aaa;border-top:1px solid #e0e0e0;">
          Power Zone — The Fitness Club, Panagar, MP
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
