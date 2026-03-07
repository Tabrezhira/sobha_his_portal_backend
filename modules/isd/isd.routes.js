import express from 'express';
import controller from './isd.controller.js';
import auth from '../../middleware/auth.js';

const router = express.Router();

router.post('/', auth, controller.createIsdRecord);
router.get('/', auth, controller.getIsdRecords);
router.get('/in-isolation/emp', auth, controller.getInIsolationIsdEmpList);

// ISD vital routes
router.post('/:isdId/vitals', auth, controller.createIsdVital);
router.get('/:isdId/vitals', auth, controller.getIsdVitals);
router.get('/vitals/:vitalId', auth, controller.getIsdVitalById);
router.put('/vitals/:vitalId', auth, controller.updateIsdVital);
router.delete('/vitals/:vitalId', auth, controller.deleteIsdVital);

router.get('/:id', auth, controller.getIsdRecordById);
router.put('/:id', auth, controller.updateIsdRecord);
router.delete('/:id', auth, controller.deleteIsdRecord);

export default router;
