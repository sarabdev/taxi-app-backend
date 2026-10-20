import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getSettings } from "./settings.service.js";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_, res) => {
  try {
    const settings = await getSettings();
    res.json({
      meetAndGreetPrice: settings.meetAndGreetPrice,
      defaultPartnerCommissionPercent: settings.defaultPartnerCommissionPercent,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

settingsRouter.get("/", auth, requireRole("ADMIN"), async (_, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

settingsRouter.patch("/", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const meetAndGreetPrice = Number(req.body.meetAndGreetPrice);
    const airportPickupFee = Number(req.body.airportPickupFee);

    if (!Number.isFinite(meetAndGreetPrice) || meetAndGreetPrice < 0) {
      return res.status(400).json({
        message: "Meet & Greet price must be a non-negative number",
      });
    }
    if (!Number.isFinite(airportPickupFee) || airportPickupFee < 0) {
      return res.status(400).json({
        message: "Airport pickup fee must be a non-negative number",
      });
    }

    let defaultPartnerCommissionPercent;
    if (req.body.defaultPartnerCommissionPercent !== undefined) {
      defaultPartnerCommissionPercent = Number(
        req.body.defaultPartnerCommissionPercent
      );
      if (
        !Number.isFinite(defaultPartnerCommissionPercent) ||
        defaultPartnerCommissionPercent < 0 ||
        defaultPartnerCommissionPercent > 100
      ) {
        return res.status(400).json({
          message: "Default partner commission must be between 0 and 100%",
        });
      }
    }

    const settings = await getSettings();
    settings.meetAndGreetPrice = Number(meetAndGreetPrice.toFixed(2));
    settings.airportPickupFee = Number(airportPickupFee.toFixed(2));
    if (defaultPartnerCommissionPercent !== undefined) {
      settings.defaultPartnerCommissionPercent = Number(
        defaultPartnerCommissionPercent.toFixed(2)
      );
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
