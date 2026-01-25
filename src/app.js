import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { bookingRouter } from "./modules/bookings/booking.routes.js";
import { walletRouter } from "./modules/wallet/wallet.routes.js";
import { payoutRouter } from "./modules/payouts/payout.routes.js";
import { driverRouter } from "./modules/drivers/driver.routes.js";
import { carRouter } from "./modules/cars/car.routes.js";
import { couponRouter } from "./modules/coupons/coupon.routes.js";
import { pricingRouter } from "./modules/pricing/pricing.routes.js";
import { walletAdminRouter } from "./modules/wallet/wallet.admin.routes.js";
import { activityRouter } from "./modules/activity/activity.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { paymentRouter } from "./modules/payments/payment.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: "*", credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static("uploads"));

  app.get("/health", (_, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/bookings", bookingRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/payouts", payoutRouter);
  app.use("/api/drivers", driverRouter);
  app.use("/api/cars", carRouter);
  app.use("/api/coupons", couponRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/wallet", walletAdminRouter);
  app.use("/api/activity", activityRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/payments", paymentRouter);


  // global error fallback
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  });

  return app;
}
