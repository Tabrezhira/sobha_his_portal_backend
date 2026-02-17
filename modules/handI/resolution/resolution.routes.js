

import express from "express";
import controller from "./resolution.controller.js";
import auth from "../../../middleware/auth.js";
import role from "../../../middleware/role.js";

const router = express.Router();

// All resolution endpoints require authentication and manager role
router.post("/", auth, role(["manager", "superadmin"]), controller.createCaseResolution);
router.get("/", auth, role(["manager", "superadmin"]), controller.getCaseResolutions);
router.get("/:id", auth, role(["manager", "superadmin"]), controller.getCaseResolutionById);
router.put("/:id", auth, role(["manager", "superadmin"]), controller.updateCaseResolution);
router.delete("/:id", auth, role(["manager", "superadmin"]), controller.deleteCaseResolution);

export default router;
