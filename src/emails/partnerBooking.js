import { bookingReference, emailLayout, escapeHtml, formatMoney } from "./email.helpers.js";

export function partnerDashboardEmail({ partner, dashboardLink }) {
  return { subject: "Your Zalt partner dashboard", html: emailLayout({ title: "View your partner dashboard", content: `
    <p>Hello ${escapeHtml(partner.contactName || partner.companyName)},</p>
    <p>View your total earnings and the status of rides booked with your referral code.</p>
    <a href="${escapeHtml(dashboardLink)}">View dashboard</a>
    <p>This private link expires in 7 days. Please do not forward it.</p>` }) };
}

export function partnerBookingEmail({ partner, booking, dashboardLink, completed = false }) {
  return { subject: `${completed ? "Ride completed" : "New referral booking"} - ${bookingReference(booking)}`,
    html: emailLayout({ title: completed ? "Your referred ride is complete" : "Your referral code was used", content: `
      <p>Hello ${escapeHtml(partner.contactName || partner.companyName)},</p>
      <p>${completed ? "A ride booked with your code has been completed." : "A paid ride has been booked using your referral code."}</p>
      <p>Booking reference: <b>${bookingReference(booking)}</b><br />Referral code: ${escapeHtml(booking.partner?.referralCode)}<br />
      Status: ${escapeHtml(booking.status)}</p>
      <p>${completed ? "Commission earned" : "Commission payable after completion"}: <b>${formatMoney(booking.partner?.commissionAmount)}</b></p>
      <a href="${escapeHtml(dashboardLink)}">View dashboard</a>` }) };
}
