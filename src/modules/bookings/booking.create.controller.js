import { Booking } from "./booking.model.js";
import { calculatePrice } from "../pricing/pricing.service.js";
import { WalletTransaction } from "../wallet/wallet.model.js";
export async function createBooking(req, res) {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      pickupLocation,
      dropoffLocation,
      carId,
      distanceMiles,
      isReturnTrip,
      couponCode,
    } = req.body;

    if (!carId || !distanceMiles) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 🔐 Calculate & LOCK price
    const pricingResult = await calculatePrice({
      carId,
      distanceMiles,
      isReturnTrip,
      couponCode,
    });

    const booking = await Booking.create({
      customerName,
      customerEmail,
      customerPhone,
      pickupLocation,
      dropoffLocation,
      carId,
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

    await WalletTransaction.create({
  driverId: null, // 👈 no driver yet
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
