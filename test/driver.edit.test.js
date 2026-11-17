import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import { env } from "../src/config/env.js";
import { User } from "../src/modules/users/user.model.js";
import { Driver } from "../src/modules/drivers/driver.model.js";
import { driverRouter } from "../src/modules/drivers/driver.routes.js";
import { updateDriver } from "../src/modules/drivers/driver.controller.js";

env.JWT_SECRET = "test-only-driver-edit-secret";
const id = "507f1f77bcf86cd799439011";

async function startApp(t) {
  const app = express();
  app.use(express.json());
  app.use('/api/drivers', driverRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("driver edit accepts the admin's multipart form, saves profile fields and can clear the assigned car", async (t) => {
  let saves = 0;
  const driver = { _id: id, name: "Before", city: "Before", homeAddress: "Old address", assignedCarId: "old-car",
    licenseDocument: "/uploads/drivers/current.pdf", async save() { saves += 1; } };
  t.mock.method(User, "findById", () => ({ lean: async () => ({ _id: id, role: "ADMIN", isActive: true }) }));
  t.mock.method(Driver, "findById", async () => driver);
  const origin = await startApp(t);
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Updated Driver", phone: "07700900123", city: "Edinburgh", homeAddress: "New address", assignedCarId: "", licenseNumber: "LICENSE-2" })) form.append(key, value);
  const response = await fetch(`${origin}/api/drivers/${id}`, { method: "PUT", body: form,
    headers: { Authorization: `Bearer ${jwt.sign({ sub: id }, env.JWT_SECRET)}` } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.driver.name, "Updated Driver"); assert.equal(result.driver.city, "Edinburgh");
  assert.equal(result.driver.homeAddress, "New address"); assert.equal(result.driver.assignedCarId, null);
  assert.equal(result.driver.licenseNumber, "LICENSE-2"); assert.equal(result.driver.licenseDocument, "/uploads/drivers/current.pdf");
  assert.equal(saves, 1);
});

test("duplicate car assignment returns an error without changing the driver", async (t) => {
  let saved = false;
  const driver = { _id: id, name: "Original", async save() { saved = true; } };
  t.mock.method(Driver, "findById", async () => driver);
  t.mock.method(Driver, "findOne", async () => ({ _id: "other-driver" }));
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await updateDriver({ params: { id }, body: { name: "Changed", assignedCarId: "taken-car" } }, res);
  assert.equal(res.statusCode, 400); assert.equal(saved, false); assert.equal(driver.name, "Original");
});

test("license replacement saves the new document before removing the old document", async (t) => {
  const actions = [];
  const driver = { _id: id, licenseDocument: "/uploads/drivers/old-test-license.pdf", async save() { actions.push("saved"); } };
  t.mock.method(Driver, "findById", async () => driver);
  t.mock.method(fs.promises, "unlink", async () => { actions.push("old removed"); });
  const res = { status() { return this; }, json(value) { this.body = value; } };
  await updateDriver({ params: { id }, body: {}, file: { filename: "new-test-license.pdf" } }, res);
  assert.deepEqual(actions, ["saved", "old removed"]);
  assert.equal(res.body.driver.licenseDocument, "/uploads/drivers/new-test-license.pdf");
});

test("rejected driver edits remove the new upload while keeping the previous license file", async (t) => {
  const removed = [];
  t.mock.method(fs.promises, "unlink", async (filename) => { removed.push(filename); });
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await updateDriver({ params: { id }, body: { name: "   " }, file: { filename: "rejected-new-license.pdf" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(removed.length, 1); assert.match(removed[0], /rejected-new-license\.pdf$/);
});

test("invalid license upload types return a useful client error", async (t) => {
  t.mock.method(User, "findById", () => ({ lean: async () => ({ _id: id, role: "ADMIN", isActive: true }) }));
  const origin = await startApp(t);
  const form = new FormData(); form.append('licenseDocument', new Blob(['invalid'], { type: 'text/plain' }), 'license.txt');
  const response = await fetch(`${origin}/api/drivers/${id}`, { method: 'PUT', body: form,
    headers: { Authorization: `Bearer ${jwt.sign({ sub: id }, env.JWT_SECRET)}` } });
  assert.equal(response.status, 400); assert.match((await response.json()).message, /PDF\/JPG\/PNG/);
});
