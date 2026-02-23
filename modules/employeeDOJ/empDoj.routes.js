import express from 'express';
import controller from './empDoj.controller.js';
import auth from '../../middleware/auth.js';
import multer from 'multer';
import os from 'os';

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// POST   /emp-doj       -> create record (protected)
// POST   /emp-doj/import/excel -> import from excel (protected)
// GET    /emp-doj       -> list records (protected)
// GET    /emp-doj/emp/:empNo/leave-eligibility -> leave eligibility by empNo
// GET    /emp-doj/:id   -> get single record
// PUT    /emp-doj/:id   -> update record (protected)
// DELETE /emp-doj/:id   -> delete record (protected)

router.post('/', auth, controller.createEmpDoj);
router.post('/import/excel', auth, upload.single('file'), controller.importEmpDojExcel);
router.get('/', controller.getEmpDojRecords);
router.get('/emp/:empNo/leave-eligibility', controller.getLeaveEligibilityByEmpNo);
router.get('/:id', controller.getEmpDojById);
router.put('/:id', auth, controller.updateEmpDoj);
router.delete('/:id', auth, controller.deleteEmpDoj);

export default router;
