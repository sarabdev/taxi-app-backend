import { sendMail } from "../../utils/mailer.js";
import {
  emailLayout,
  escapeHtml,
} from "../../emails/email.helpers.js";

const CONTACT_RECIPIENT =
  process.env.CONTACT_TO_EMAIL || "support@myairporttaxis.uk";

const subjectLabels = {
  booking: "Booking Inquiry",
  support: "Customer Support",
  feedback: "Feedback",
  partnership: "Partnership",
  other: "Other",
};

export async function submitContactForm(req, res) {
  const {
    name = "",
    email = "",
    phone = "",
    subject = "",
    message = "",
  } = req.body ?? {};

  const trimmedName = String(name).trim();
  const trimmedEmail = String(email).trim();
  const trimmedPhone = String(phone).trim();
  const trimmedMessage = String(message).trim();
  const subjectLabel = subjectLabels[subject];

  if (
    !trimmedName ||
    !trimmedEmail ||
    !subjectLabel ||
    !trimmedMessage ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  ) {
    return res.status(400).json({ message: "Please complete all required fields." });
  }

  if (
    trimmedName.length > 120 ||
    trimmedEmail.length > 254 ||
    trimmedPhone.length > 40 ||
    trimmedMessage.length > 5000
  ) {
    return res.status(400).json({ message: "One or more fields are too long." });
  }

  const mailResult = await sendMail({
    to: CONTACT_RECIPIENT,
    replyTo: trimmedEmail,
    subject: `Website contact: ${subjectLabel}`,
    html: emailLayout({
      title: "New website contact message",
      preheader: `${subjectLabel} from ${trimmedName}`,
      content: `
        <p style="margin:0 0 10px;"><strong style="color:#0f172a;">Name:</strong> ${escapeHtml(trimmedName)}</p>
        <p style="margin:0 0 10px;"><strong style="color:#0f172a;">Email:</strong> ${escapeHtml(trimmedEmail)}</p>
        <p style="margin:0 0 10px;"><strong style="color:#0f172a;">Phone:</strong> ${escapeHtml(trimmedPhone || "Not provided")}</p>
        <p style="margin:0 0 18px;"><strong style="color:#0f172a;">Subject:</strong> ${escapeHtml(subjectLabel)}</p>
        <div style="padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
          <p style="margin:0 0 8px;"><strong style="color:#0f172a;">Message</strong></p>
          <p style="margin:0;">${escapeHtml(trimmedMessage).replaceAll("\n", "<br />")}</p>
        </div>
      `,
    }),
  });

  if (!mailResult.sent) {
    return res.status(502).json({
      message: "We could not send your message right now. Please try again.",
    });
  }

  return res.status(200).json({ message: "Message sent successfully." });
}
