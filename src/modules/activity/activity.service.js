import { Activity } from "./activity.model.js";

export async function logActivity({
  entityType,
  entityId,
  action,
  performedByRole,
  performedById,
  note = "",
}) {
  return Activity.create({
    entityType,
    entityId,
    action,
    performedByRole,
    performedById,
    note,
  });
}
