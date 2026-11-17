import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { sendMail } from "../../utils/mailer.js";

const schema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  to: { type: String, required: true }, subject: String, html: String,
  status: { type: String, default: "PENDING" }, attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now }, leaseUntil: Date, leaseToken: String, sentAt: Date,
}, { timestamps: true });
schema.index({ status: 1, nextAttemptAt: 1 });
export const Notification = mongoose.model("Notification", schema);

export async function queueEmail(key, to, email) {
  if (!to) return;
  const recipients = Array.isArray(to) ? to : [to];
  for (const recipient of recipients) {
    const address = String(recipient).trim().toLowerCase();
    try {
      await Notification.updateOne({ key: `${key}:${address}` }, { $setOnInsert: {
        key: `${key}:${address}`, to: address, subject: email.subject, html: email.html,
      } }, { upsert: true });
    } catch (error) {
      // Concurrent recovery and request handlers may create the same unique key.
      if (error.code !== 11000 || !error.keyPattern?.key) throw error;
    }
  }
}

let running = false;
export async function deliverPendingEmails({ send = sendMail } = {}) {
  if (running) return;
  running = true;
  try {
    await Notification.updateMany({ status: "SENDING", attempts: { $gte: 8 }, leaseUntil: { $lt: new Date() } }, {
      $set: { status: "FAILED" },
    });
    for (let i = 0; i < 50; i += 1) {
      const now = new Date();
      const leaseToken = randomUUID();
      const item = await Notification.findOneAndUpdate({
        attempts: { $lt: 8 }, nextAttemptAt: { $lte: now },
        $or: [{ status: "PENDING" }, { status: "SENDING", leaseUntil: { $lt: now } }],
      }, { $set: { status: "SENDING", leaseUntil: new Date(Date.now() + 120000), leaseToken }, $inc: { attempts: 1 } }, { new: true });
      if (!item) break;
      let result;
      try { result = await send({ to: item.to, subject: item.subject, html: item.html }); }
      catch { result = { sent: false }; }
      await Notification.updateOne({ _id: item._id, leaseToken }, { $set: result?.sent
        ? { status: "SENT", sentAt: new Date() }
        : { status: item.attempts >= 8 ? "FAILED" : "PENDING", nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** item.attempts)) } });
    }
  } finally { running = false; }
}

export function startEmailDelivery({ recover = async () => {} } = {}) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      try { await recover(); } catch (error) { console.error("Booking email recovery failed:", error.message); }
      await deliverPendingEmails();
    }
    catch (error) { console.error("Email queue failed:", error.message); }
    finally { busy = false; }
  };
  run();
  const timer = setInterval(run, 30000);
  timer.unref();
  return timer;
}
