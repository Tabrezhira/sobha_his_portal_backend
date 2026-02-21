// src/modules/patient/patient.controller.js
import Patient from './patient.model.js';
import xlsx from 'xlsx';

const mapMongoError = (err) => {
	if (err?.code === 11000) {
		const fields = Object.keys(err.keyPattern || {});
		return { status: 409, message: `Duplicate value for: ${fields.join(', ')}` };
	}
	if (err?.name === 'ValidationError') {
		return { status: 400, message: err.message };
	}
	return { status: 500, message: 'Internal server error' };
};

export const createPatient = async (req, res) => {
	try {
		const payload = { ...req.body };
		if (payload.empId) payload.empId = String(payload.empId).toUpperCase();

		const patient = await Patient.create(payload);
		return res.status(201).json(patient);
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const getPatients = async (req, res) => {
	try {
		const { page = 1, limit = 20, q, trLocation } = req.query;
		const skip = (Number(page) - 1) * Number(limit);

		const filter = {};
		
		if (trLocation) {
			filter.trLocation = trLocation;
		}
		
		if (q) {
			const regex = new RegExp(q, 'i');
			filter.$or = [{ PatientName: regex }, { empId: regex }, { emiratesId: regex }];
		}

		const [items, total] = await Promise.all([
			Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
			Patient.countDocuments(filter)
		]);

		return res.json({ items, total, page: Number(page), limit: Number(limit) });
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const getAllPatients = async (req, res) => {
	try {
		const { q, trLocation } = req.query;

		const filter = {};
		
		if (trLocation) {
			filter.trLocation = trLocation;
		}
		
		if (q) {
			const regex = new RegExp(q, 'i');
			filter.$or = [{ PatientName: regex }, { empId: regex }, { emiratesId: regex }];
		}

		const patients = await Patient.find(filter).sort({ createdAt: -1 });

		return res.json({ items: patients, total: patients.length });
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const getPatientById = async (req, res) => {
	try {
		const { id } = req.params;
		const patient = await Patient.findById(id);
		if (!patient) return res.status(404).json({ error: 'Patient not found' });
		return res.json(patient);
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const getPatientByEmpId = async (req, res) => {
	try {
		const empId = String(req.params.empId || '').toUpperCase();
		const patient = await Patient.findOne({ empId });
		if (!patient) return res.status(404).json({ error: 'Patient not found' });
		return res.json(patient);
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const updatePatient = async (req, res) => {
	try {
		const { id } = req.params;
		const updates = { ...req.body };
		if (updates.empId) updates.empId = String(updates.empId).toUpperCase();

		const patient = await Patient.findByIdAndUpdate(id, updates, {
			new: true,
			runValidators: true
		});
		if (!patient) return res.status(404).json({ error: 'Patient not found' });
		return res.json(patient);
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const deletePatient = async (req, res) => {
	try {
		const { id } = req.params;
		const deleted = await Patient.findByIdAndDelete(id);
		if (!deleted) return res.status(404).json({ error: 'Patient not found' });
		return res.json({ success: true });
	} catch (err) {
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const importPatientsFromExcel = async (req, res) => {
	try {
		if (!req.file?.path) {
			return res.status(400).json({ error: 'No file uploaded' });
		}

		const wb = xlsx.readFile(req.file.path);
		const sheetName = wb.SheetNames[0];
		const ws = wb.Sheets[sheetName];
		const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

		const normalizeKey = (k) => String(k).toLowerCase().replace(/\s+|_/g, '');
		const fieldMap = {
			staffid: 'empId',
			empid: 'empId',
			employeeid: 'empId',
			name: 'PatientName',
			patientname: 'PatientName',
			emiratesid: 'emiratesId',
			medicalcatdno: 'insuranceId',
			insuranceid: 'insuranceId',
			trlocation: 'trLocation',
			mobilenumber: 'mobileNumber',
			phone: 'mobileNumber'
		};

		// DIAGNOSTIC: Check first row to see what columns exist
		console.log('First row keys:', Object.keys(rows[0]));
		console.log('First row data:', rows[0]);

		// Step 1: Normalize all rows
		const normalizedRows = [];
		const empIds = [];
		
		for (const rawRow of rows) {
			const row = {};
			for (const [key, value] of Object.entries(rawRow)) {
				const mapped = fieldMap[normalizeKey(key)];
				if (mapped) row[mapped] = value;
			}

			const empId = String(row.empId || '').toUpperCase().trim();
			if (empId) {
				normalizedRows.push({ ...row, empId });
				empIds.push(empId);
			}
		}

		console.log('Sample empIds from Excel:', empIds.slice(0, 5));
		console.log('Total empIds extracted:', empIds.length);

		// DIAGNOSTIC: Check what's in the database
		const sampleDbPatients = await Patient.find({}).limit(5).select('empId');
		console.log('Sample empIds from DB:', sampleDbPatients.map(p => p.empId));

		// Step 2: Fetch ALL existing patients
		const existingPatients = await Patient.find(
			{ empId: { $in: empIds } },
			{ empId: 1, PatientName: 1, emiratesId: 1, insuranceId: 1, trLocation: 1, mobileNumber: 1 }
		).lean();

		console.log('Found patients in DB:', existingPatients.length);

		// Step 3: Create a map for O(1) lookup
		const patientMap = new Map();
		existingPatients.forEach(p => {
			patientMap.set(p.empId, p);
		});

		// Step 4: Build bulk operations
		const bulkOps = [];
		let updated = 0;
		let notFound = 0;
		let created = 0;
		const errors = [];
		const fields = ['PatientName', 'emiratesId', 'insuranceId', 'trLocation', 'mobileNumber'];

		for (let i = 0; i < normalizedRows.length; i++) {
			const row = normalizedRows[i];
			const patient = patientMap.get(row.empId);

			if (!patient) {
				// CREATE NEW PATIENT instead of skipping
				const newPatientData = {
					empId: row.empId
				};

				for (const f of fields) {
					const excelVal = row[f];
					const hasExcel = excelVal !== undefined && excelVal !== null && 
						String(excelVal).trim() !== '';
					if (hasExcel) {
						newPatientData[f] = typeof excelVal === 'string' ? excelVal.trim() : excelVal;
					}
				}

				bulkOps.push({
					insertOne: {
						document: newPatientData
					}
				});
				created += 1;
				continue;
			}

			// UPDATE EXISTING PATIENT
			const updateFields = {};
			let hasUpdate = false;

			for (const f of fields) {
				const dbVal = patient[f];
				const excelVal = row[f];
				const isMissing = dbVal === undefined || dbVal === null || 
					(typeof dbVal === 'string' && dbVal.trim() === '');
				const hasExcel = excelVal !== undefined && excelVal !== null && 
					String(excelVal).trim() !== '';

				if (isMissing && hasExcel) {
					updateFields[f] = typeof excelVal === 'string' ? excelVal.trim() : excelVal;
					hasUpdate = true;
				}
			}

			if (hasUpdate) {
				bulkOps.push({
					updateOne: {
						filter: { empId: row.empId },
						update: { $set: updateFields }
					}
				});
				updated += 1;
			}
		}

		// Step 5: Execute bulk operations in batches
		const BATCH_SIZE = 1000;
		if (bulkOps.length > 0) {
			for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
				const batch = bulkOps.slice(i, i + BATCH_SIZE);
				try {
					await Patient.bulkWrite(batch, { ordered: false });
				} catch (batchErr) {
					console.error(`Batch ${i}-${i+BATCH_SIZE} error:`, batchErr.message);
					errors.push({ batch: i, error: batchErr.message });
				}
			}
		}

		return res.json({
			file: req.file.filename,
			savedTo: req.file.path,
			sheet: sheetName,
			processed: normalizedRows.length,
			created,
			updated,
			notFound: normalizedRows.length - created - updated,
			errors
		});
	} catch (err) {
		console.error('Import error:', err);
		const { status, message } = mapMongoError(err);
		return res.status(status).json({ error: message });
	}
};

export const getPatientsTableData = async (req, res) => {
	try {
		const { page = 1, limit = 20, q, trLocation } = req.query
		const skip = (Number(page) - 1) * Number(limit)

		const match = {}
		if (trLocation) match.trLocation = trLocation
		if (q) {
			const regex = new RegExp(q, "i")
			match.$or = [
				{ PatientName: regex },
				{ empId: regex },
				{ emiratesId: regex },
			]
		}

		const pipeline = [
			{ $match: match },
			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: Number(limit) },
			{
				$project: {
					empId: 1,
					PatientName: 1,
					emiratesId: 1,
					insuranceId: 1,
					trLocation: 1,
					mobileNumber: 1,
				},
			},
		]

		const items = await Patient.aggregate(pipeline)
		const total = await Patient.countDocuments(match)

		return res.json({ items, total, page: Number(page), limit: Number(limit) })
	} catch (err) {
		const { status, message } = mapMongoError(err)
		return res.status(status).json({ error: message })
	}
}


export default {
	createPatient,
	getPatients,
	getAllPatients,
	getPatientById,
	getPatientByEmpId,
	updatePatient,
	deletePatient,
	importPatientsFromExcel,
	getPatientsTableData
};
