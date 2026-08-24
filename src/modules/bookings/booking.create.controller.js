import Stripe from "stripe";
import { Booking } from "./booking.model.js";
import { sendMail } from "../../utils/mailer.js";
import { bookingConfirmedEmail } from "../../emails/bookingConfirmed.js";
import { adminBookingConfirmedEmail } from "../../emails/adminBookingConfirmed.js";
import { pricingSnapshotMatchesTotal } from "../pricing/pricing.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const BOOKING_ADMIN_EMAIL = "myairporttaxi86@gmail.com";

function metadataNumber(metadata, key) {
  const value = Number(metadata[key] || 0);
  if (!Number.isFinite(value)) {
    throw new Error("Invalid payment pricing snapshot");
  }
  return value;
}

function assertPaymentMatchesBooking(paymentIntent, request) {
  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment has not succeeded");
  }
  if (paymentIntent.currency !== "gbp") {
    throw new Error("Invalid payment currency");
  }

  const metadata = paymentIntent.metadata || {};
  const expectedReturn = request.isReturnTrip ? "true" : "false";
  const requestCoupon = String(request.couponCode || "").toUpperCase();
  const expectedMeetAndGreet = request.meetAndGreet ? "true" : "false";
  const matches =
    ["3", "4"].includes(metadata.pricingVersion) &&
    metadata.carId === String(request.carId) &&
    metadata.fromPlaceId === String(request.fromPlaceId || "") &&
    metadata.toPlaceId === String(request.toPlaceId || "") &&
    metadata.returnFromPlaceId === String(request.returnFromPlaceId || "") &&
    metadata.returnToPlaceId === String(request.returnToPlaceId || "") &&
    metadata.isReturnTrip === expectedReturn &&
    metadata.couponCode === requestCoupon &&
    metadata.meetAndGreet === expectedMeetAndGreet;

  if (!matches) {
    throw new Error("Payment does not match this booking");
  }

  const totalFare = metadataNumber(metadata, "totalFare");
  if (paymentIntent.amount_received !== Math.round(totalFare * 100)) {
    throw new Error("Paid amount does not match booking total");
  }

  const pricing = {
    basePrice: metadataNumber(metadata, "basePrice"),
    baseFare: metadataNumber(metadata, "baseFare"),
    returnBaseFare: metadataNumber(metadata, "returnBaseFare"),
    distanceMiles: metadataNumber(metadata, "distanceMiles"),
    returnDistanceMiles: metadataNumber(metadata, "returnDistanceMiles"),
    pricePerMile: metadataNumber(metadata, "pricePerMile"),
    returnPricePerMile: metadataNumber(metadata, "returnPricePerMile"),
    carDiscountAmount: metadataNumber(metadata, "carDiscountAmount"),
    couponDiscountAmount: metadataNumber(metadata, "couponDiscountAmount"),
    meetAndGreetFee: metadataNumber(metadata, "meetAndGreetFee"),
    airportPickupFee: metadataNumber(metadata, "airportPickupFee"),
    totalFare,
    appliedCoupon: metadata.appliedCoupon || null,
  };

  if (!pricingSnapshotMatchesTotal(pricing)) {
    throw new Error("Payment pricing snapshot does not reconcile");
  }

  return pricing;
}

export async function createBooking(req, res) {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      pickupLocation,
      pickupPlaceId,
      dropoffLocation,
      dropoffPlaceId,
      pickupDate,
      pickupTime,
      returnTrip,
      carId,
      isReturnTrip,
      couponCode,
      paymentIntentId,
      passengers,
      luggage,
      flight,
    } = req.body;

    if (!carId || !pickupPlaceId || !dropoffPlaceId || !paymentIntentId) {
      return res.status(400).json({
        message: "Missing car, route, or payment information",
      });
    }
    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ message: "Missing customer information" });
    }

    const existingBooking = await Booking.findOne({ paymentIntentId });
    if (existingBooking) {
      return res.json({ booking: existingBooking });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const pricing = assertPaymentMatchesBooking(paymentIntent, {
      carId,
      fromPlaceId: pickupPlaceId,
      toPlaceId: dropoffPlaceId,
      returnFromPlaceId: isReturnTrip ? returnTrip?.pickupPlaceId : "",
      returnToPlaceId: isReturnTrip ? returnTrip?.dropoffPlaceId : "",
      isReturnTrip: Boolean(isReturnTrip),
      couponCode,
      meetAndGreet: Boolean(flight?.meetAndGreet),
    });

    let booking = await Booking.create({
      customerName,
      customerEmail,
      customerPhone,
      pickupLocation,
      pickupPlaceId,
      dropoffLocation,
      dropoffPlaceId,
      pickupDate: pickupDate || "",
      pickupTime: pickupTime || "",
      isReturnTrip: Boolean(isReturnTrip),
      returnTrip: isReturnTrip
        ? {
            pickupLocation: returnTrip?.pickupLocation || "",
            pickupPlaceId: returnTrip?.pickupPlaceId || "",
            dropoffLocation: returnTrip?.dropoffLocation || "",
            dropoffPlaceId: returnTrip?.dropoffPlaceId || "",
            pickupDate: returnTrip?.pickupDate || "",
            pickupTime: returnTrip?.pickupTime || "",
          }
        : null,
      carId,
      paymentIntentId,
      passengers: passengers || 1,
      luggage: {
        largeBags23kg: luggage?.largeBags23kg || 0,
        smallBags15kg: luggage?.smallBags15kg || 0,
        shoulderBags: luggage?.shoulderBags || 0,
        extraLargeItemType: luggage?.extraLargeItemType || "none",
        extraLargeItemNote: luggage?.extraLargeItemNote || "",
      },
      flight: {
        flightNumber: flight?.flightNumber || "",
        arrivingFrom: flight?.arrivingFrom || "",
        arrivalDateTime: flight?.arrivalDateTime || null,
        meetAndGreet: Boolean(flight?.meetAndGreet),
      },
      pricing,
    });

    booking = await Booking.findById(booking._id).populate("carId");

    const customerConfirmation = bookingConfirmedEmail({ booking });
    const deliveries = [
      sendMail({
        to: booking.customerEmail,
        subject: customerConfirmation.subject,
        html: customerConfirmation.html,
      }),
    ];

    const adminConfirmation = adminBookingConfirmedEmail({ booking });
    deliveries.push(
      sendMail({
        to: BOOKING_ADMIN_EMAIL,
        subject: adminConfirmation.subject,
        html: adminConfirmation.html,
      })
    );

    await Promise.all(deliveries);

    res.json({ booking });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
