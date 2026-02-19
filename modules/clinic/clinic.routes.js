import express from "express";
import controller from "./clinic.controller.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

// POST   /clinic       -> create a visit
// GET    /clinic       -> list visits (filters + pagination)
// GET    /clinic/:id   -> get single visit
// PUT    /clinic/:id   -> update visit
// DELETE /clinic/:id   -> delete visit

router.post("/", auth, controller.createVisit);
router.get("/export/excel", controller.exportToExcel);
router.get("/", controller.getVisits);
router.get("/summary", controller.getEmpSummary);
router.get("/filter-by-name", controller.filterByName);
router.get("/my-location", auth, controller.getVisitsByUserLocation);
router.get("/:id", controller.getVisitById);
router.put("/:id", controller.updateVisit);
router.delete("/:id", controller.deleteVisit);

export default router;
