import { Settings } from "./settings.model.js";

export async function getSettings() {
  return Settings.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        meetAndGreetPrice: 0,
        airportPickupFee: 0,
        defaultPartnerCommissionPercent: 10,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function getMeetAndGreetPrice() {
  const settings = await getSettings();
  return Number(settings.meetAndGreetPrice || 0);
}

export async function getAirportPickupFee() {
  const settings = await getSettings();
  return Number(settings.airportPickupFee || 0);
}
