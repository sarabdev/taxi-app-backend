import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create Stripe PaymentIntent
 * This ONLY creates intent — no booking here
 */
export async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = "gbp" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Stripe expects smallest unit (pence)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (e) {
    console.error("Stripe error:", e);
    res.status(500).json({ message: "Payment initialization failed" });
  }
}
