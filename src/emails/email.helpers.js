export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatMoney(value) {
  return `&pound;${Number(value || 0).toFixed(2)}`;
}

export function bookingReference(booking) {
  return String(booking._id || "").slice(-8).toUpperCase();
}

export function emailLayout({ title, preheader = "", content }) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;color:#334155;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:24px 28px;">
                <div style="font-family:Arial,sans-serif;font-size:22px;line-height:28px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  MYAIRPORT<span style="color:#d4af37;">TAXIS</span>
                </div>
                <div style="margin-top:5px;font-family:Arial,sans-serif;font-size:11px;line-height:16px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.8px;">
                  Premium Airport Transfers
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:#475569;">
                <h1 style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:26px;line-height:34px;color:#0f172a;font-weight:800;">
                  ${safeTitle}
                </h1>
                ${content}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#64748b;">
                <strong style="color:#0f172a;">My Airport Taxis</strong><br />
                Need help? Email
                <a href="mailto:support@myairporttaxis.uk" style="color:#0f172a;font-weight:700;text-decoration:underline;">support@myairporttaxis.uk</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function journeySummary(booking) {
  const outward = `
    <p style="margin:0 0 8px;"><b style="color:#0f172a;">Pickup:</b> ${escapeHtml(booking.pickupLocation)}</p>
    <p style="margin:0 0 8px;"><b style="color:#0f172a;">Drop-off:</b> ${escapeHtml(booking.dropoffLocation)}</p>
    <p style="margin:0;"><b style="color:#0f172a;">Booked for:</b> ${escapeHtml(booking.pickupDate)} ${escapeHtml(booking.pickupTime)}</p>
  `;

  if (!booking.isReturnTrip || !booking.returnTrip) {
    return `<div style="margin:20px 0;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">${outward}</div>`;
  }

  return `<div style="margin:20px 0;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
    ${outward}
    <hr style="margin:16px 0;border:0;border-top:1px solid #e2e8f0;" />
    <p style="margin:0 0 8px;"><b style="color:#0f172a;">Return pickup:</b> ${escapeHtml(booking.returnTrip.pickupLocation)}</p>
    <p style="margin:0 0 8px;"><b style="color:#0f172a;">Return drop-off:</b> ${escapeHtml(booking.returnTrip.dropoffLocation)}</p>
    <p style="margin:0;"><b style="color:#0f172a;">Return booked for:</b> ${escapeHtml(booking.returnTrip.pickupDate)} ${escapeHtml(booking.returnTrip.pickupTime)}</p>
  </div>`;
}
