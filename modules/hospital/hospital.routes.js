import express from "express";
import controller from "./hospital.controller.js";
import auth from "../../middleware/auth.js";
import multer from "multer";
import os from "os";

const upload = multer({ dest: os.tmpdir() });

const router = express.Router();

// POST   /hospital       -> create a hospital record (protected)
// GET    /hospital       -> list hospital records
// GET    /hospital/manager/discharge-status -> get hospitals by manager location with discharge status check (protected)
// GET    /hospital/employee/search -> search hospital by employee id and date
// GET    /hospital/:id   -> get single record
// PUT    /hospital/:id   -> update record (protected)
// DELETE /hospital/:id   -> delete record (protected)
// /hospital/employee/search?empNo=E001&date=2026-02-20

router.post("/", auth, controller.createHospital);
router.post("/import/excel", auth, upload.single("file"), controller.importExcel);
router.get("/", auth, controller.getHospitals);
router.get("/manager/discharge-status", auth, controller.getHospitalsByManagerLocation);
router.get("/employee/search", controller.getHospitalByEmployeeAndDate);
router.get("/my-location", auth, controller.getHospitalsByUserLocation);
router.get("/:id", controller.getHospitalById);
router.put("/:id", auth, controller.updateHospital);
router.delete("/:id", auth, controller.deleteHospital);

export default router;
