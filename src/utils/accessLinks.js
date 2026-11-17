import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const websiteUrl = () => (process.env.WEBSITE_URL || "https://zalt.uk").replace(/\/$/, "");

export function signAccessLink(purpose, claims, expiresIn = "7d") {
  return jwt.sign({ ...claims, purpose }, env.JWT_SECRET, {
    expiresIn, issuer: "zalt-access", audience: purpose, algorithm: "HS256",
  });
}

export function verifyAccessLink(token, purpose) {
  const claims = jwt.verify(token, env.JWT_SECRET, {
    issuer: "zalt-access", audience: purpose, algorithms: ["HS256"],
  });
  if (claims.purpose !== purpose) throw new Error("Invalid access link");
  return claims;
}

export function partnerDashboardLink(partner) {
  const token = signAccessLink("partner-dashboard", { sub: String(partner._id), email: partner.email });
  return `${websiteUrl()}/partner/dashboard#token=${encodeURIComponent(token)}`;
}

export function driverCompletionLink(booking, nonce) {
  const token = signAccessLink("driver-completion", {
    sub: String(booking._id), driverId: String(booking.assignedDriverId?._id || booking.assignedDriverId), nonce,
  }, "90d");
  return `${websiteUrl()}/driver/complete#token=${encodeURIComponent(token)}`;
}
