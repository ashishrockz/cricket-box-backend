const nodemailer = require("nodemailer");

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn("SMTP_USER or SMTP_PASS not set — emails will fail until configured.");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * sendMail(to, subject, html)
 * returns: info object or throws
 */
const sendMail = async (to, subject, html) => {
  if (!to) throw new Error("Recipient email 'to' is required");
  const from = process.env.SMTP_USER || "no-reply@cricketbox.local";
  const mailOptions = { from: `"Cricket Box" <${from}>`, to, subject, html };
  const info = await transporter.sendMail(mailOptions);
  return info;
};

module.exports = sendMail;
