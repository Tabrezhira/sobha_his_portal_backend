import express from 'express';
import controller from './isd.controller.js';
import auth from '../../middleware/auth.js';
import mongoose from "mongoose";
import Isd from "./isd.model.js";

const router = express.Router();

router.post('/', auth, controller.createIsdRecord);
router.get('/', auth, controller.getIsdRecords);
router.get('/in-isolation/emp', auth, controller.getInIsolationIsdEmpList);

// ISD vital routes
router.post('/vitals/bulk', auth, controller.createBulkIsdVitals);
router.post('/:isdId/vitals', auth, controller.createIsdVital);
router.get('/:isdId/vitals', auth, controller.getIsdVitals);
router.get('/vitals/:vitalId', auth, controller.getIsdVitalById);
router.put('/vitals/:vitalId', auth, controller.updateIsdVital);
router.delete('/vitals/:vitalId', auth, controller.deleteIsdVital);

router.get('/:id', auth, controller.getIsdRecordById);
router.put('/:id', auth, controller.updateIsdRecord);
router.delete('/:id', auth, controller.deleteIsdRecord);

// PATCH /isd/:id/mark-old
router.patch("/:id/mark-old", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid _id" });
    }

    const updated = await Isd.findByIdAndUpdate(
      id,
      { $set: { new: false } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Record not found" });
    }

    return res.status(200).json({
      message: "`new` set to false successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
