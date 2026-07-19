import { sendMail } from "../../utils/mailer.js";

const CONTACT_RECIPIENT =
  process.env.CONTACT_TO_EMAIL || "support@myairporttaxis.uk";

const subjectLabels = {
  booking: "Booking Inquiry",
  support: "Customer Support",
  feedback: "Feedback",
  partnership: "Partnership",
  other: "Other",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    html: `
      <h2>New website contact message</h2>
      <p><strong>Name:</strong> ${escapeHtml(trimmedName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(trimmedEmail)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(trimmedPhone || "Not provided")}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subjectLabel)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(trimmedMessage).replaceAll("\n", "<br />")}</p>
    `,
  });

  if (!mailResult.sent) {
    return res.status(502).json({
      message: "We could not send your message right now. Please try again.",
    });
  }

  return res.status(200).json({ message: "Message sent successfully." });
}
