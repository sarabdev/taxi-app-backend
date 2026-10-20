import { emailLayout, escapeHtml } from "./email.helpers.js";

export const PROPERTY_TYPE_LABELS = {
  HOTEL: "Hotel",
  GUEST_HOUSE: "Guest house / B&B",
  LODGE: "Lodge",
  HOLIDAY_RENTAL: "Holiday rental / Airbnb",
  SERVICED_APARTMENTS: "Serviced apartments",
  OTHER: "Other",
};

function row(label, value) {
  return `<p style="margin:0 0 8px;"><b style="color:#0f172a;">${escapeHtml(label)}:</b> ${escapeHtml(value || "Not provided")}</p>`;
}

/** Sent to the applicant to confirm their enquiry arrived. */
export function partnerApplicationReceivedEmail({ partner }) {
  return {
    subject: "We received your partner enquiry",
    html: emailLayout({
      title: "Thanks for your partner enquiry.",
      preheader: "We will review your details and be in touch shortly.",
      content: `
      <p style="margin:0 0 14px;">Hello ${escapeHtml(partner.contactName)},</p>
      <p style="margin:0 0 14px;">Thank you for your interest in partnering with Zalt on behalf of <b style="color:#0f172a;">${escapeHtml(partner.companyName)}</b>.</p>
      <p style="margin:0;">Our team will review your details. Once approved, you will receive your personal partner link by email.</p>
      `,
    }),
  };
}

/** Sent to the admin team so a new enquiry can be reviewed. */
export function adminPartnerApplicationEmail({ partner }) {
  return {
    subject: `New partner enquiry - ${partner.companyName}`,
    html: emailLayout({
      title: "New partner enquiry",
      preheader: `${partner.companyName} wants to become a partner.`,
      content: `
      <div style="margin:0 0 18px;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
        ${row("Property / company", partner.companyName)}
        ${row("Contact", partner.contactName)}
        ${row("Position", partner.position)}
        ${row("Email", partner.email)}
        ${row("Phone", partner.phone)}
        ${row("City / town", partner.city)}
        ${row("Property type", PROPERTY_TYPE_LABELS[partner.propertyType] || partner.propertyType)}
        ${row("Rooms or properties", partner.propertyCount)}
        ${partner.message ? row("Message", partner.message) : ""}
      </div>
      <p style="margin:0;">Review and approve this enquiry in the admin panel under Partners.</p>
      `,
    }),
  };
}
