import { Booking } from "../bookings/booking.model.js";
import { Coupon } from "./coupon.model.js";

export function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase();
}

export async function getCouponUsageCount(code) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return 0;

  return Booking.countDocuments({
    "pricing.appliedCoupon": normalizedCode,
  });
}

export async function findValidCoupon(code, { totalAmount } = {}) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) throw new Error("Coupon code is required");

  const coupon = await Coupon.findOne({
    code: normalizedCode,
    isActive: true,
  }).lean();

  if (!coupon) throw new Error("Invalid coupon");
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    throw new Error("Coupon expired");
  }

  const usedCount = await getCouponUsageCount(normalizedCode);
  if (coupon.usageLimit != null && usedCount >= coupon.usageLimit) {
    throw new Error("Coupon usage limit reached");
  }
  if (
    totalAmount != null &&
    coupon.minAmount &&
    Number(totalAmount) < coupon.minAmount
  ) {
    throw new Error("Coupon minimum amount not met");
  }

  return { ...coupon, usedCount };
}

export async function couponsWithUsage() {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  const usage = await Booking.aggregate([
    { $match: { "pricing.appliedCoupon": { $nin: [null, ""] } } },
    {
      $group: {
        _id: "$pricing.appliedCoupon",
        count: { $sum: 1 },
      },
    },
  ]);
  const usageMap = new Map(usage.map((item) => [item._id, item.count]));

  return coupons.map((coupon) => ({
    ...coupon,
    usedCount: usageMap.get(coupon.code) || 0,
  }));
}
