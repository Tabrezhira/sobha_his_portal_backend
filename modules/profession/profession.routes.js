import express from "express";
import upload from "../../middleware/upload.middleware.js";

import {
  getProfessions,
  createProfession,
  uploadExcel,
  getCategories,
  getListByCategory,
} from "./profession.controller.js";

const router = express.Router();

router.get("/category/:categoryName", getListByCategory);
router.get("/", getProfessions);
router.post("/", createProfession);
router.post("/upload-excel", upload.single("file"), uploadExcel);
router.get("/categories", getCategories);
export default router;
