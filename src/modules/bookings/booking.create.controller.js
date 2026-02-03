import { Booking } from "./booking.model.js";
import { calculatePrice } from "../pricing/pricing.service.js";
import { WalletTransaction } from "../wallet/wallet.model.js";

export async function createBooking(req, res) {
  try {
    const {
      // ─── Customer ───────────────────────
      customerName,
      customerEmail,
      customerPhone,

      // ─── Route ──────────────────────────
      pickupLocation,
      dropoffLocation,

      // ─── Car & Pricing Inputs ────────────
      carId,
      distanceMiles,
      isReturnTrip,
      couponCode,

      // ─── Passenger Info ─────────────────
      passengers,

      // ─── Luggage ────────────────────────
      luggage,

      // ─── Flight Info ────────────────────
      flight,
    } = req.body;

    /* ───────────────────── Basic Validation ───────────────────── */
    if (!carId || !distanceMiles) {
      return res.status(400).json({
        message: "Missing required fields: carId or distanceMiles",
      });
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({
        message: "Missing customer information",
      });
    }

    /* ───────────────────── 🔐 Price Calculation (LOCKED) ───────────────────── */
    const pricingResult = await calculatePrice({
      carId,
      distanceMiles,
      isReturnTrip,
      couponCode,
    });

    /* ───────────────────── Create Booking ───────────────────── */
    const booking = await Booking.create({
      // Customer
      customerName,
      customerEmail,
      customerPhone,

      // Route
      pickupLocation,
      dropoffLocation,

      // Car
      carId,

      // Passenger
      passengers: passengers || 1,

      // Luggage
      luggage: {
        largeBags23kg: luggage?.largeBags23kg || 0,
        smallBags15kg: luggage?.smallBags15kg || 0,
        extraLargeItemType: luggage?.extraLargeItemType || "none",
        extraLargeItemNote: luggage?.extraLargeItemNote || "",
      },

      // Flight
      flight: {
        flightNumber: flight?.flightNumber || "",
        arrivingFrom: flight?.arrivingFrom || "",
        arrivalDateTime: flight?.arrivalDateTime || null,
        meetAndGreet: !!flight?.meetAndGreet,
      },

      // 🔒 Locked Pricing Snapshot
      pricing: {
        baseFare: pricingResult.breakdown.baseFare,
        distanceMiles,
        pricePerMile: pricingResult.breakdown.pricePerMile,
        carDiscountAmount: pricingResult.breakdown.carDiscountAmount,
        couponDiscountAmount: pricingResult.breakdown.couponDiscountAmount,
        totalFare: pricingResult.totalFare,
        appliedCoupon: pricingResult.appliedCoupon,
      },
    });

    /* ───────────────────── Wallet Ledger Entry ───────────────────── */
    await WalletTransaction.create({
      driverId: null, // no driver assigned yet
      type: "CREDIT",
      amount: booking.pricing.totalFare,
      referenceType: "BOOKING",
      referenceId: booking._id,
      note: "Customer payment received",
    });

    res.json({ booking });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}
