import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail({ to, subject, html, replyTo }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("Email skipped: SMTP configuration is incomplete");
    return { sent: false };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      replyTo,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("Email failed:", err.message);
    return { sent: false };
  }
}
