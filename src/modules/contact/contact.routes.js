import { Router } from "express";
import { submitContactForm } from "./contact.controller.js";

export const contactRouter = Router();

contactRouter.post("/", submitContactForm);
