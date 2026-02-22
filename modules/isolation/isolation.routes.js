import express from "express";
import controller from "./isolation.controller.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

// POST   /isolation       -> create (protected)
// GET    /isolation       -> list
// GET    /isolation/:id   -> get
// PUT    /isolation/:id   -> update (protected)
// DELETE /isolation/:id   -> delete (protected)
// GET    /isolation/my-location -> list for authenticated user's location

router.post("/", auth, controller.createIsolation);
router.get("/", auth, controller.getIsolations);
router.get("/my-location", auth, controller.getIsolationsByUserLocation);
router.get("/:id", controller.getIsolationById);
router.put("/:id", auth, controller.updateIsolation);
router.delete("/:id", auth, controller.deleteIsolation);

export default router;
