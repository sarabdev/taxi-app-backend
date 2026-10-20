import { emailLayout, escapeHtml } from "./email.helpers.js";

export function partnerApprovedEmail({ partner, link }) {
  const title = "Your partner link is ready.";
  const safeLink = escapeHtml(link);
  const commission = Number(partner.commissionPercent || 0);

  return {
    subject: "Welcome to the Zalt partner programme",
    html: emailLayout({
      title,
      preheader: `${partner.companyName} is now a Zalt partner.`,
      content: `
      <p style="margin:0 0 14px;">Hello ${escapeHtml(partner.contactName)},</p>
      <p style="margin:0 0 14px;">Great news: <b style="color:#0f172a;">${escapeHtml(partner.companyName)}</b> has been approved as a Zalt partner.</p>
      <p style="margin:0 0 14px;">Share the link below with your guests, for example in booking confirmations, digital guestbooks, or at reception. Every completed journey booked through it earns you <b style="color:#0f172a;">${escapeHtml(commission)}%</b> of the fare.</p>
      <div style="margin:22px 0;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Your partner link</p>
        <p style="margin:0 0 14px;word-break:break-all;"><a href="${safeLink}" style="color:#0f172a;font-weight:700;">${safeLink}</a></p>
        <p style="margin:0;font-size:13px;color:#64748b;">Referral code: <b style="color:#0f172a;">${escapeHtml(partner.referralCode)}</b></p>
      </div>
      <a href="${safeLink}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#ffffff;border-radius:12px;font-weight:700;text-decoration:none;">Open your partner link</a>
      <p style="margin:22px 0 0;">If you have any questions, just reply to this email.</p>
      `,
    }),
  };
}
