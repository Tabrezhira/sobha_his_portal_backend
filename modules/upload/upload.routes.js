import express from "express";
import { deleteFile } from "./upload.controller.js";

const router = express.Router();

router.post("/delete", deleteFile);

export default router;
