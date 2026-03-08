import express from "express";
import controller from "./mail.controller.js";

const router = express.Router();

// Support both POST and GET for easy browser testing
router.post("/send", controller.sendMail);
router.get("/send", controller.sendMail);

export default router;
