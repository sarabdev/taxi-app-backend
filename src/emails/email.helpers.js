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

function detailRow(label, value) {
  return `<tr>
    <td style="padding:6px 10px 6px 0;vertical-align:top;color:#64748b;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;vertical-align:top;color:#0f172a;font-weight:600;word-break:break-word;">${value}</td>
  </tr>`;
}

function detailSection(title, rows) {
  return `<div style="margin:18px 0;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
    <h2 style="margin:0 0 10px;font-size:16px;line-height:22px;color:#0f172a;">${escapeHtml(title)}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px;line-height:20px;">${rows.join("")}</table>
  </div>`;
}

function displayDateTime(date, time) {
  if (!date && !time) return "—";
  return escapeHtml([date, time].filter(Boolean).join(" "));
}

function extraItemLabel(value) {
  const labels = {
    none: "None",
    extra_large_bag_35kg: "Extra-large bag (35kg)",
    wheelchair: "Wheelchair",
    pram: "Pram",
    golf_bag: "Golf bag",
    other: "Other",
  };
  return labels[value] || value || "None";
}

/** The same confirmed-booking summary shown to the customer after payment. */
export function fullBookingDetails(booking) {
  const luggage = booking.luggage || {};
  const flight = booking.flight || {};
  const carName = booking.carId?.name || booking.carId || "—";
  const bagCount =
    Number(luggage.largeBags23kg || 0) +
    Number(luggage.smallBags15kg || 0) +
    Number(luggage.shoulderBags || 0);
  const luggageDescription = [
    `${bagCount} ${bagCount === 1 ? "item" : "items"}`,
    `Large (23kg): ${Number(luggage.largeBags23kg || 0)}`,
    `Small (15kg): ${Number(luggage.smallBags15kg || 0)}`,
    `Shoulder/hand carry: ${Number(luggage.shoulderBags || 0)}`,
    luggage.extraLargeItemType && luggage.extraLargeItemType !== "none"
      ? `Extra item: ${extraItemLabel(luggage.extraLargeItemType)}`
      : null,
    luggage.extraLargeItemNote ? `Note: ${luggage.extraLargeItemNote}` : null,
  ].filter(Boolean).join("; ");

  return [
    detailSection("Journey details", [
      detailRow("Pickup", escapeHtml(booking.pickupLocation || "—")),
      detailRow("Destination", escapeHtml(booking.dropoffLocation || "—")),
      detailRow("Pickup date", displayDateTime(booking.pickupDate)),
      detailRow("Pickup time", displayDateTime(null, booking.pickupTime)),
      ...(booking.isReturnTrip && booking.returnTrip
        ? [
            detailRow("Return pickup", escapeHtml(booking.returnTrip.pickupLocation || "—")),
            detailRow("Return destination", escapeHtml(booking.returnTrip.dropoffLocation || "—")),
            detailRow("Return date", displayDateTime(booking.returnTrip.pickupDate)),
            detailRow("Return time", displayDateTime(null, booking.returnTrip.pickupTime)),
          ]
        : []),
    ]),
    detailSection("Passenger details", [
      detailRow("Lead passenger", escapeHtml(booking.customerName || "—")),
      detailRow("Confirmation email", escapeHtml(booking.customerEmail || "—")),
      detailRow("Phone number", escapeHtml(booking.customerPhone || "—")),
      detailRow("Passengers", escapeHtml(booking.passengers ?? 1)),
      detailRow("Luggage", escapeHtml(luggageDescription)),
    ]),
    detailSection("Order summary", [
      detailRow("Vehicle", escapeHtml(carName)),
      detailRow("Journey type", booking.isReturnTrip ? "Return journey" : "One way"),
      ...(flight.flightNumber
        ? [detailRow("Flight number", escapeHtml(flight.flightNumber))]
        : []),
      ...(flight.meetAndGreet
        ? [detailRow("Meet & Greet", "Service included")]
        : []),
      detailRow("Total paid", `<span style="font-size:17px;">${formatMoney(booking.pricing?.totalFare)}</span>`),
    ]),
  ].join("");
}
