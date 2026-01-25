import { Router } from "express";
import { calculatePrice } from "./pricing.service.js";

export const pricingRouter = Router();

pricingRouter.post("/calculate", async (req, res) => {
  try {
    const result = await calculatePrice(req.body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

pricingRouter.post("/distance", async (req, res) => {
  try {
    const { fromPlaceId, toPlaceId } = req.body;

    const distanceMiles = await calculateDistanceMiles({
      fromPlaceId,
      toPlaceId,
    });

    res.json({ distanceMiles });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});


