import { randomInt, timingSafeEqual } from "node:crypto";

/** Wrong guesses allowed before the driver must contact the office. */
export const MAX_COMPLETION_CODE_ATTEMPTS = 5;

/** A 4-digit job-end code the customer gives the driver at drop-off. */
export function generateCompletionCode() {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function normalizeCompletionCode(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

export function completionCodeMatches(expected, provided) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(normalizeCompletionCode(provided));
  return a.length === 4 && a.length === b.length && timingSafeEqual(a, b);
}
