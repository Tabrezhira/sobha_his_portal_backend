// src/modules/patient/patient.routes.js
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import {
	createPatient,
	getPatients,
	getAllPatients,
	getPatientById,
	getPatientByEmpId,
	updatePatient,
	deletePatient,
	importPatientsFromExcel,
	getPatientsTableData
} from './patient.controller.js';

const router = Router();

// Ensure upload directory exists (use /tmp on serverless)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadBase = isServerless ? '/tmp' : process.cwd();
const uploadDir = path.join(uploadBase, 'uploads', 'patient-excel');
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage and filters
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, uploadDir),
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname);
		const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
		cb(null, `${base}_${Date.now()}${ext}`);
	}
});

const fileFilter = (_req, file, cb) => {
	const allowedExt = ['.xlsx', '.xls'];
	const ext = path.extname(file.originalname).toLowerCase();
	if (allowedExt.includes(ext)) return cb(null, true);
	return cb(new Error('Only .xlsx or .xls files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Import Excel and update missing fields (place before POST / to avoid conflicts)
router.post('/import-excel', upload.single('file'), importPatientsFromExcel);

// Table-friendly patient data with counts
router.get('/table', getPatientsTableData);

// Create
router.post('/', createPatient);

// Read - list with optional search/pagination
router.get('/', getPatients);

// Read - all patients without pagination
router.get('/all', getAllPatients);
//GET /api/patients/all - returns all patients
//GET /api/patients/all?trLocation=alrahaba - filter by location
//GET /api/patients/all?q=search - search by name, empId,emiratesId or insuranceId

// Read - by empId (place before :id to avoid conflicts)
router.get('/emp/:empId', getPatientByEmpId);

// Read - by TR location
router.get('/tr/:trLocation', (req, res, next) => {
	req.query.trLocation = req.params.trLocation;
	return getPatients(req, res, next);
});

// Read - by Mongo _id
router.get('/:id', getPatientById);

// Update
router.put('/:id', updatePatient);

// Delete
router.delete('/:id', deletePatient);

export default router;


