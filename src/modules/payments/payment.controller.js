import Stripe from "stripe";
import { calculatePrice } from "../pricing/pricing.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function metadataValue(value) {
  return value == null ? "" : String(value);
}

export async function createPaymentIntent(req, res) {
  try {
    const {
      carId,
      fromPlaceId,
      toPlaceId,
      returnFromPlaceId,
      returnToPlaceId,
      isReturnTrip = false,
      couponCode,
      meetAndGreet = false,
    } = req.body;

    const pricing = await calculatePrice({
      carId,
      fromPlaceId,
      toPlaceId,
      returnFromPlaceId,
      returnToPlaceId,
      isReturnTrip,
      couponCode,
      meetAndGreet: Boolean(meetAndGreet),
    });

    if (pricing.totalFare <= 0) {
      return res.status(400).json({ message: "Invalid booking total" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pricing.totalFare * 100),
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        pricingVersion: "3",
        carId: metadataValue(carId),
        fromPlaceId: metadataValue(fromPlaceId),
        toPlaceId: metadataValue(toPlaceId),
        returnFromPlaceId: metadataValue(returnFromPlaceId),
        returnToPlaceId: metadataValue(returnToPlaceId),
        isReturnTrip: metadataValue(Boolean(isReturnTrip)),
        couponCode: metadataValue(couponCode).toUpperCase(),
        meetAndGreet: metadataValue(Boolean(meetAndGreet)),
        basePrice: metadataValue(pricing.breakdown.basePrice),
        baseFare: metadataValue(pricing.breakdown.baseFare),
        returnBaseFare: metadataValue(pricing.breakdown.returnBaseFare),
        distanceMiles: metadataValue(pricing.breakdown.distanceMiles),
        returnDistanceMiles: metadataValue(
          pricing.breakdown.returnDistanceMiles
        ),
        pricePerMile: metadataValue(pricing.breakdown.pricePerMile),
        returnPricePerMile: metadataValue(
          pricing.breakdown.returnPricePerMile
        ),
        carDiscountAmount: metadataValue(
          pricing.breakdown.carDiscountAmount
        ),
        couponDiscountAmount: metadataValue(
          pricing.breakdown.couponDiscountAmount
        ),
        meetAndGreetFee: metadataValue(
          pricing.breakdown.meetAndGreetFee
        ),
        totalFare: metadataValue(pricing.totalFare),
        appliedCoupon: metadataValue(pricing.appliedCoupon),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      pricing,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(400).json({
      message: error.message || "Payment initialization failed",
    });
  }
}
