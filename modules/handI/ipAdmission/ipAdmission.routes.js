import express from "express";
import controller from "./ipAdmission.controller.js";
import auth from "../../../middleware/auth.js";
import role from "../../../middleware/role.js";

const router = express.Router();

const managerOrSuperAdmin = role(["manager", "superadmin"]);

// /api/ip-admission
router.post("/", auth, managerOrSuperAdmin, controller.createIpAdmission);
router.post("/from-hospital-case", auth, managerOrSuperAdmin, controller.createFromHospitalCase);
router.post("/employee-not-in-his", auth, managerOrSuperAdmin, controller.createManualNewVisit);
router.get("/", auth, managerOrSuperAdmin, controller.getIpAdmissions);
router.get("/:id", auth, managerOrSuperAdmin, controller.getIpAdmissionById);
router.put("/:id", auth, managerOrSuperAdmin, controller.updateIpAdmission);
router.patch("/:id", auth, managerOrSuperAdmin, controller.updateIpAdmission);
router.delete("/:id", auth, managerOrSuperAdmin, controller.deleteIpAdmission);

export default router;

