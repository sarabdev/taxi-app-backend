import { Router } from "express";
import { createPaymentIntent } from "./payment.controller.js";

export const paymentRouter = Router();

/**
 * Public: Create Stripe Payment Intent
 */
paymentRouter.post("/create-intent", createPaymentIntent);
