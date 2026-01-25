import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Car } from "./car.model.js";
import { listPublicCarsWithPricing } from "./car.controller.js";
export const carRouter = Router();

// Admin create
carRouter.post("/", auth, requireRole("ADMIN"), async (req, res) => {
  const car = await Car.create(req.body);
  res.json(car);
});

// Admin list
carRouter.get("/", auth, requireRole("ADMIN"), async (_, res) => {
  const cars = await Car.find().sort({ createdAt: -1 });
  res.json(cars);
});

// Admin update
carRouter.patch("/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const car = await Car.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!car) return res.status(404).json({ message: "Car not found" });
  res.json(car);
});

// Admin delete
carRouter.delete("/:id", auth, requireRole("ADMIN"), async (req, res) => {
  const car = await Car.findByIdAndDelete(req.params.id);
  if (!car) return res.status(404).json({ message: "Car not found" });
  res.json({ message: "Deleted" });
});

// Public list with distance-based pricing (one-way only)
carRouter.post("/public", async (req, res) => {
  try {
    const result = await listPublicCarsWithPricing(req);
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});
