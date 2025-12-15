import express from "express";
import {
    verifyWebhook,
    handleWebhook,
    sendWhatsAppMessage,
    getWhatsAppMessages,
} from "../controllers/whatsapp.js";

export const whatsappRouter = express.Router();

// WhatsApp webhook verification (GET)
whatsappRouter.get("/whatsapp/webhook", verifyWebhook);

// WhatsApp webhook for receiving messages (POST)
whatsappRouter.post("/whatsapp/webhook", handleWebhook);

// Send a WhatsApp message
whatsappRouter.post("/whatsapp/send", sendWhatsAppMessage);

// Get WhatsApp messages for a phone number
whatsappRouter.get("/whatsapp/messages/:phoneNumber", getWhatsAppMessages);
