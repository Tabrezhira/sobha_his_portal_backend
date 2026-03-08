import express from 'express';
import controller from './rct.controller.js';
import auth from '../../middleware/auth.js';

const router = express.Router();

// RCT record routes
router.post('/', auth, controller.createRct);
router.get('/', auth, controller.getRctRecords);
router.get('/:id', auth, controller.getRctById);
router.put('/:id', auth, controller.updateRct);
router.delete('/:id', auth, controller.deleteRct);

// RCT vital routes
router.post('/:rctId/vitals', auth, controller.createRctVital);
router.get('/:rctId/vitals', auth, controller.getRctVitals);
router.get('/vitals/:vitalId', auth, controller.getRctVitalById);
router.put('/vitals/:vitalId', auth, controller.updateRctVital);
router.delete('/vitals/:vitalId', auth, controller.deleteRctVital);

export default router;