import ClinicVisit from './clinic.model.js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Create a new clinic visit
async function createVisit(req, res, next) {
	try {
		if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });

		const payload = req.body || {};

		const requiredFields = [
			"date",
			"time",
			"empNo",
			"employeeName",
			"emiratesId",
			"trLocation",
			"mobileNumber",
			"natureOfCase",
			"caseCategory",
		];

		const missing = requiredFields.filter((key) => !payload[key]);
		if (missing.length) {
			return res.status(400).json({
				success: false,
				message: `Missing required fields: ${missing.join(", ")}`,
			});
		}
		// ignore any client-supplied createdBy
		if (payload.createdBy) delete payload.createdBy;
		payload.createdBy = req.user._id;
		// always take locationId from authenticated user to prevent spoofing
		if (req.user.locationId) payload.locationId = req.user.locationId;

		// Auto-generate tokenNo if not provided: <LOC4><DDMM><4-digit-seq>
		if (!payload.tokenNo) {
			// map of location display names -> short codes (use normalized keys)
			const locationCodeMap = {
				"AL QOUZ": "QOZ",
				"DIC 2": "DIC2",
				"DIC 3": "DIC3",
				"DIC 5": "DIC5",
				"DIP 1": "DIP1",
				"DIP 2": "DIP2",
				"JEBAL ALI 1": "JAB1",
				"JEBAL ALI 2": "JAB2",
				"JEBAL ALI 3": "JAB3",
				"JEBAL ALI 4": "JAB4",
				"KHAWANEEJ": "KWJ",
				"RUWAYYAH": "RUW",
				"SAJJA": "SAJJ",
				"SAIF": "SAIF",
				"SONAPUR 1": "SONA1",
				"SONAPUR 2": "SONA2",
				"SONAPUR 3": "SONA3",
				"SONAPUR 4": "SONA4",
				"SONAPUR 5": "SONA5",
				"RAHABA": "RAH",
				"SONAPUR 6": "SONA6",
			};

			const rawLoc = String(payload.locationId || req.user.locationId || "").trim();
			const locKey = rawLoc.toUpperCase().replace(/\s+/g, " ");
			let loc = locationCodeMap[locKey];
			if (!loc) {
				// fallback: take first 4 non-space characters
				loc = rawLoc.replace(/\s+/g, "").substring(0, 4).toUpperCase() || "UNKN";
			}
			const now = new Date();
			const dd = String(now.getDate()).padStart(2, "0");
			const mm = String(now.getMonth() + 1).padStart(2, "0");
			const dateKeyStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const dateKeyEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

			// Count existing visits for this location for today to derive sequence
			const todayCount = await ClinicVisit.countDocuments({
				locationId: payload.locationId,
				date: { $gte: dateKeyStart, $lt: dateKeyEnd },
			});
			const seq = todayCount + 1;
			let seqStr = String(seq).padStart(4, "0");
			if (seq > 9999) {
				// overflow: use last 4 digits and warn
				console.warn(`token sequence overflow for location ${rawLoc} on ${dd}${mm}: seq=${seq}`);
				seqStr = seqStr.slice(-4);
			}
			// if the visit is sent to an external provider, append 'XT' to the location code
			const sendToValue = String(payload.sendTo || payload.sentTo || "").toUpperCase().trim();
			let locPrefix = loc;
			if (sendToValue === 'EXTERNAL PROVIDER') {
				locPrefix = `${loc}XT`;
			}
			// format with hyphens: <LOC or LOCXT>-<DDMM>-<4-digit-seq>
			payload.tokenNo = `${locPrefix}-${dd}${mm}-${seqStr}`;
		}

		// Auto-generate referralCode if referredToHospital is provided
		if (payload.referrals && Array.isArray(payload.referrals)) {
			payload.referrals = payload.referrals.map(referral => {
				if (referral.referredToHospital && !referral.referralCode) {
					referral.referralCode = `${payload.tokenNo}-REF`;
				}
				return referral;
			});
		}

		const visit = new ClinicVisit(payload);
		const saved = await visit.save();
		const populated = await saved.populate('createdBy', 'name');
		return res.status(201).json({ success: true, data: populated });
	} catch (err) {
		next(err);
	}
}

// Get list of visits with optional filters and pagination
// async function getVisits(req, res, next) {
// 	try {
// 		const {
// 			page = 1,
// 			limit = 20,
// 			emiratesId,
// 			empNo,
// 			visitStatus,
// 			locationId,
// 			startDate,
// 			endDate,
// 			tokenNo,
// 		} = req.query;

// 		const q = {};
// 		if (emiratesId) q.emiratesId = emiratesId;
// 		if (empNo) q.empNo = empNo;
// 		if (visitStatus) q.visitStatus = visitStatus;
// 		if (locationId) q.locationId = locationId;
// 		if (tokenNo) q.tokenNo = tokenNo;

// 		if (startDate || endDate) {
// 			q.date = {};
// 			if (startDate) q.date.$gte = new Date(startDate);
// 			if (endDate) q.date.$lte = new Date(endDate);
// 		}

// 		const p = Math.max(1, parseInt(page, 10));
// 		const l = Math.max(1, parseInt(limit, 10));

// 		const [total, items] = await Promise.all([
// 			ClinicVisit.countDocuments(q),
// 			ClinicVisit.find(q)
// 				.sort({ date: -1, tokenNo: 1 })
// 				.skip((p - 1) * l)
// 				.limit(l)
// 				.populate('createdBy', 'name')
// 				.populate('hospitalizations')
// 				.populate('isolations'),
// 		]);

// 		return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
// 	} catch (err) {
// 		next(err);
// 	}
// }
async function getVisits(req, res, next) {
	try {
		// 1️⃣ Extract query params with defaults
		const {
			page = 1,
			limit = 20,
			emiratesId,
			empNo,
			visitStatus,
			locationId,
			startDate,
			endDate,
			tokenNo,
		} = req.query;

		// 2️⃣ Build Mongo query object
		const q = {};
		if (emiratesId) q.emiratesId = emiratesId;
		if (empNo) q.empNo = empNo;
		if (visitStatus) q.visitStatus = visitStatus;
		if (locationId) q.locationId = locationId;
		if (tokenNo) q.tokenNo = tokenNo;

		// Date range filter
		if (startDate || endDate) {
			q.date = {};
			if (startDate) q.date.$gte = new Date(startDate);
			if (endDate) q.date.$lte = new Date(endDate);
		}

		// 3️⃣ Pagination
		const p = Math.max(1, parseInt(page, 10));
		const l = Math.max(1, parseInt(limit, 10));

		// 4️⃣ Fetch total count and items
		const [total, items] = await Promise.all([
			ClinicVisit.countDocuments(q),
			ClinicVisit.find(q)
				.sort({ date: -1, tokenNo: 1 }) // 🔥 newest date first, then tokenNo
				.skip((p - 1) * l)
				.limit(l)
				.populate('createdBy', 'name')
				.populate('hospitalizations')
				.populate('isolations'),
		]);

		// 5️⃣ Send response
		return res.json({
			success: true,
			data: items,
			meta: { total, page: p, limit: l },
		});
	} catch (err) {
		next(err);
	}
}


// Get a single visit by id
async function getVisitById(req, res, next) {
	try {
		const { id } = req.params;
		const visit = await ClinicVisit.findById(id)
			.populate('createdBy', 'name')
			.populate('hospitalizations')
			.populate('isolations');
		if (!visit) return res.status(404).json({ success: false, message: 'Not found' });
		return res.json({ success: true, data: visit });
	} catch (err) {
		next(err);
	}
}

// Filter clinic visits by manager's locations
async function filterByName(req, res, next) {
	try {
		// Check if user is authenticated
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: 'Not authenticated' });
		}

		// Get manager's location array from JWT user
		const managerLocations = req.user.managerLocation;
		
		if (!managerLocations || !Array.isArray(managerLocations) || managerLocations.length === 0) {
			return res.status(403).json({ 
				success: false, 
				message: 'Manager has no assigned locations' 
			});
		}

		// Calculate date 30 days ago
		const now = new Date();
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		thirtyDaysAgo.setHours(0, 0, 0, 0);

		// Aggregate to group by employee and calculate metrics
		const items = await ClinicVisit.aggregate([
			{
				$match: {
					locationId: { $in: managerLocations },
					date: { $gte: thirtyDaysAgo }
				}
			},
			{
				$group: {
					_id: '$empNo',
					empNo: { $first: '$empNo' },
					employeeName: { $first: '$employeeName' },
					emiratesId: { $first: '$emiratesId' },
					mobileNumber: { $first: '$mobileNumber' },
					trLocation: { $first: '$trLocation' },
					visitCount: { $sum: 1 },
					hasSickLeaveApproved: {
						$max: {
							$cond: [{ $eq: ['$sickLeaveStatus', 'Approved'] }, 1, 0]
						}
					},
					visits: { $push: '$$ROOT' }
				}
			},
			{
				$sort: {
					hasSickLeaveApproved: -1,
					visitCount: -1
				}
			}
		]);

		return res.json({
			success: true,
			data: items,
			meta: { 
				total: items.length,
				managerLocations,
				dateRange: {
					from: thirtyDaysAgo,
					to: now
				}
			},
		});
	} catch (err) {
		next(err);
	}
}

// Update a visit
async function updateVisit(req, res, next) {
	try {
		const { id } = req.params;
		const payload = req.body || {};
		
		// Auto-generate referralCode if referredToHospital is provided in referrals
		if (payload.referrals && Array.isArray(payload.referrals)) {
			const visit = await ClinicVisit.findById(id);
			if (visit) {
				payload.referrals = payload.referrals.map(referral => {
					if (referral.referredToHospital && !referral.referralCode) {
						referral.referralCode = `${visit.tokenNo}-REF`;
					}
					return referral;
				});
			}
		}
		
		let updated = await ClinicVisit.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
		if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
		updated = await updated.populate([
			{ path: 'createdBy', select: 'name' },
			{ path: 'hospitalizations' },
			{ path: 'isolations' }
		]);
		return res.json({ success: true, data: updated });
	} catch (err) {
		next(err);
	}
}

// Delete a visit
async function deleteVisit(req, res, next) {
	try {
		const { id } = req.params;
		let deleted = await ClinicVisit.findByIdAndDelete(id);
		if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
		deleted = await deleted.populate([
			{ path: 'createdBy', select: 'name' },
			{ path: 'hospitalizations' },
			{ path: 'isolations' }
		]);
		return res.json({ success: true, data: deleted });
	} catch (err) {
		next(err);
	}
}

// Get visits for the authenticated user's location
async function getVisitsByUserLocation(req, res, next) {
	try {
		if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
		const locationId = req.user.locationId;
		if (!locationId) return res.status(400).json({ success: false, message: 'User has no locationId' });

		const { page = 1, limit = 50 } = req.query;
		const p = Math.max(1, parseInt(page, 10));
		const l = Math.max(1, parseInt(limit, 10));

		const [total, items] = await Promise.all([
			ClinicVisit.countDocuments({ locationId }),
			ClinicVisit.find({ locationId })
				.sort({ date: -1, tokenNo: 1 })
				.skip((p - 1) * l)
				.limit(l)
				.populate('createdBy', 'name')
				.populate('hospitalizations')
				.populate('isolations'),
		]);

		return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
	} catch (err) {
		next(err);
	}
}

// Get summary for an employee (by empNo)
async function getEmpSummary(req, res, next) {
	try {
		const empNo = req.query.empNo || req.params.empNo;
		if (!empNo) return res.status(400).json({ success: false, message: 'empNo is required' });

		const now = new Date();
		const last90Start = new Date(now);
		last90Start.setDate(last90Start.getDate() - 90);
		last90Start.setHours(0, 0, 0, 0);

		const [
			allTimeTotalVisits,
			last90Visits,
			sickLeaveApprovedCount,
			referralAgg,
		] = await Promise.all([
			ClinicVisit.countDocuments({ empNo }),
			ClinicVisit.find({ empNo, date: { $gte: last90Start } })
				.sort({ date: -1 })
				.select('date providerName doctorName sentTo'),
			ClinicVisit.countDocuments({ empNo, sickLeaveStatus: 'Approved' }),
			ClinicVisit.aggregate([
				{ $match: { empNo } },
				{
					$project: {
						refCount: { $size: { $ifNull: ['$referrals', []] } },
						openRefCount: {
							$size: {
								$filter: {
									input: { $ifNull: ['$referrals', []] },
									as: 'r',
									cond: { $eq: ['$$r.followUpRequired', true] },
								},
							},
						},
					},
				},
				{
					$group: {
						_id: null,
						totalReferrals: { $sum: '$refCount' },
						openReferrals: { $sum: '$openRefCount' },
					},
				},
			]),
		]);

		const visitsLast90Days = last90Visits.map((v) => ({
			date: v.date,
			provider: v.providerName || v.doctorName || v.sentTo || null,
		}));

		const totals = referralAgg && referralAgg.length ? referralAgg[0] : { totalReferrals: 0, openReferrals: 0 };

		return res.json({
			success: true,
			data: {
				empNo,
				last90Days: {
					count: last90Visits.length,
					visits: visitsLast90Days,
				},
				allTimeTotalVisits,
				sickLeaveApprovedCount,
				totalReferrals: totals.totalReferrals || 0,
				openReferrals: totals.openReferrals || 0,
			},
		});
	} catch (err) {
		next(err);
	}
}

// Export all clinic visits to Excel
async function exportToExcel(req, res, next) {
	try {
		// Get all clinic visits
		const visits = await ClinicVisit.find({})
			.populate('createdBy', 'name')
			.populate('hospitalizations')
			.populate('isolations')
			.lean();

		if (visits.length === 0) {
			return res.status(400).json({ success: false, message: 'No clinic visits found to export' });
		}

		// Find max medicines and referrals with follow-up visits
		let maxMedicines = 0;
		let maxReferrals = 0;
		let maxFollowUpVisitsPerReferral = 0;

		visits.forEach(visit => {
			if (visit.medicines && visit.medicines.length > maxMedicines) {
				maxMedicines = visit.medicines.length;
			}
			if (visit.referrals && visit.referrals.length > maxReferrals) {
				maxReferrals = visit.referrals.length;
			}
			if (visit.referrals) {
				visit.referrals.forEach(ref => {
					if (ref.followUpVisits && ref.followUpVisits.length > maxFollowUpVisitsPerReferral) {
						maxFollowUpVisitsPerReferral = ref.followUpVisits.length;
					}
				});
			}
		});

		// Cap at reasonable limits
		maxMedicines = Math.min(maxMedicines, 10);
		maxReferrals = Math.min(maxReferrals, 5);
		maxFollowUpVisitsPerReferral = Math.min(maxFollowUpVisitsPerReferral, 5);

		// Transform data for Excel
		const excelData = visits.map((visit, idx) => {
			const rowData = {
				'SR NO': idx + 1,
				'Date': visit.date ? new Date(visit.date).toLocaleDateString() : '',
				'Time': visit.time,
				'Employee No': visit.empNo,
				'Employee Name': visit.employeeName,
				'Emirates ID': visit.emiratesId,
				'Insurance ID': visit.insuranceId,
				'Location': visit.trLocation,
				'Mobile Number': visit.mobileNumber,
				'Nature of Case': visit.natureOfCase,
				'Case Category': visit.caseCategory,
				'NURSE ASSESSMENT': visit.nurseAssessment ? visit.nurseAssessment.join(', ') : '',
				"SYMPTOM DURATION":visit.symptomDuration || '',
				'Temperature': visit.temperature || '',
				'Blood Pressure': visit.bloodPressure || '',
				'Heart Rate': visit.heartRate || '',
				'OTHERS': visit.others || '',
				'Token No': visit.tokenNo,
			    'SENT TO': visit.sentTo || '',
				'Provider Name': visit.providerName || '',
				'Doctor Name': visit.doctorName || '',
				'Primary Diagnosis': visit.primaryDiagnosis || '',
				'Secondary Diagnosis': visit.secondaryDiagnosis ? visit.secondaryDiagnosis.join(', ') : '',
				'Sick Leave Status': visit.sickLeaveStatus || '',
				'SICK LEAVE START DATE': visit.sickLeaveStartDate ? new Date(visit.sickLeaveStartDate).toLocaleDateString() : '',
				'SICK LEAVE END DATE': visit.sickLeaveEndDate ? new Date(visit.sickLeaveEndDate).toLocaleDateString() : '',
				'TOTAL SICK LEAVE DAYS': visit.totalSickLeaveDays ?? '',
				'SICK LEAVE REMARKS': visit.remarks || '',
				'Visit Status': visit.visitStatus,
				'IP ADMISSION REQUIRED': visit.ipAdmissionRequired ? 'Yes' : 'No',
				'FINAL REMARKS': visit.finalRemarks || '',
				'Created By': visit.createdBy ? visit.createdBy.name : '',
				'Created At': visit.createdAt ? new Date(visit.createdAt).toLocaleString() : '',
			};

			// Add medicine columns
			if (visit.medicines && visit.medicines.length > 0) {
				visit.medicines.forEach((med, idx) => {
					rowData[`MEDICINE ${idx + 1}`] = med.name || '';
					rowData[`MEDICINE ${idx + 1} COURSE`] = med.course || '';
					rowData[`EXPIRY DATE ${idx + 1}`] = med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : '';
				});
			}
			// Fill empty medicine columns
			for (let i = visit.medicines?.length || 0; i < maxMedicines; i++) {
				rowData[`MEDICINE ${i + 1}`] = '';
				rowData[`MEDICINE ${i + 1} COURSE`] = '';
				rowData[`EXPIRY DATE ${i + 1}`] = '';
			}

			// Add referral columns
			if (visit.referrals && visit.referrals.length > 0) {
				visit.referrals.forEach((ref, refIdx) => {
					rowData[`REFERRAL CODE ${refIdx + 1}`] = ref.referralCode || '';
					rowData[`REFERRAL TYPE ${refIdx + 1}`] = ref.referralType || '';
					rowData[`REFERRED TO - CLINIC/NOS NAME ${refIdx + 1}`] = ref.referredToHospital || '';
					rowData[`VISIT DATE ${refIdx + 1}`] = ref.visitDateReferral ? new Date(ref.visitDateReferral).toLocaleDateString() : '';
					rowData[`SPECIALIST TYPE ${refIdx + 1}`] = ref.specialistType || '';
					rowData[`DOCTOR NAME-REF ${refIdx + 1}`] = ref.doctorName || '';
					rowData[`INVESTIGATION REPORTS ${refIdx + 1}`] = ref.investigationReports || '';
					rowData[`PRIMARY DIAGNOSIS-REF ${refIdx + 1}`] = ref.primaryDiagnosisReferral || '';
					rowData[`SECONDARY DIAGNOSIS-REF ${refIdx + 1}`] = ref.secondaryDiagnosisReferral ? ref.secondaryDiagnosisReferral.join(', ') : '';
					rowData[`NURSE REMARKS ${refIdx + 1}`] = ref.nurseRemarksReferral || '';
					rowData[`INSURANCE APPROVAL REQUESTS ${refIdx + 1}`] = ref.insuranceApprovalRequested ? 'Yes' : 'No';
					rowData[`FOLLOW UP REQUIRED ${refIdx + 1}`] = ref.followUpRequired ? 'Yes' : 'No';

					// Add follow-up visits
					if (ref.followUpVisits && ref.followUpVisits.length > 0) {
						ref.followUpVisits.forEach((fup, fupIdx) => {
							rowData[`NEXT VISIT DATE ${refIdx + 1}-${fupIdx + 1}`] = fup.visitDate ? new Date(fup.visitDate).toLocaleDateString() : '';
							rowData[`ANY ADDITIONAL INFORMATIONS ${refIdx + 1}-${fupIdx + 1}`] = fup.visitRemarks || '';
						});
					}
					// Fill empty follow-up columns
					for (let i = ref.followUpVisits?.length || 0; i < maxFollowUpVisitsPerReferral; i++) {
						rowData[`NEXT VISIT DATE ${refIdx + 1}-${i + 1}`] = '';
						rowData[`ANY ADDITIONAL INFORMATIONS ${refIdx + 1}-${i + 1}`] = '';
					}
				});
			}
			// Fill empty referral columns
			for (let i = visit.referrals?.length || 0; i < maxReferrals; i++) {
				rowData[`REFERRAL CODE ${i + 1}`] = '';
				rowData[`REFERRAL TYPE ${i + 1}`] = '';
				rowData[`REFERRED TO - CLINIC/NOS NAME ${i + 1}`] = '';
				rowData[`VISIT DATE ${i + 1}`] = '';
				rowData[`SPECIALIST TYPE ${i + 1}`] = '';
				rowData[`DOCTOR NAME-REF ${i + 1}`] = '';
				rowData[`INVESTIGATION REPORTS ${i + 1}`] = '';
				rowData[`PRIMARY DIAGNOSIS-REF ${i + 1}`] = '';
				rowData[`SECONDARY DIAGNOSIS-REF ${i + 1}`] = '';
				rowData[`NURSE REMARKS ${i + 1}`] = '';
				rowData[`INSURANCE APPROVAL REQUESTS ${i + 1}`] = '';
				rowData[`FOLLOW UP REQUIRED ${i + 1}`] = '';

				for (let j = 0; j < maxFollowUpVisitsPerReferral; j++) {
					rowData[`NEXT VISIT DATE ${i + 1}-${j + 1}`] = '';
					rowData[`ANY ADDITIONAL INFORMATIONS ${i + 1}-${j + 1}`] = '';
				}
			}

			return rowData;
		});

		// Create workbook and worksheet
		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.json_to_sheet(excelData);

		// Set column widths
		const colWidths = [
			{ wch: 8 },  // SR NO
			{ wch: 15 }, // Token No
			{ wch: 12 }, // Date
			{ wch: 8 },  // Time
			{ wch: 12 }, // Employee No
			{ wch: 20 }, // Employee Name
			{ wch: 15 }, // Emirates ID
			{ wch: 15 }, // Insurance ID
			{ wch: 15 }, // Mobile Number
			{ wch: 15 }, // Location
			{ wch: 15 }, // Nature of Case
			{ wch: 15 }, // Case Category
			{ wch: 20 }, // NURSE ASSESSMENT
			{ wch: 10 }, // Temperature
			{ wch: 15 }, // Blood Pressure
			{ wch: 10 }, // Heart Rate
			{ wch: 20 }, // OTHERS
			{ wch: 15 }, // Doctor Name
			{ wch: 20 }, // Primary Diagnosis
			{ wch: 25 }, // Secondary Diagnosis
			{ wch: 15 }, // Sick Leave Status
			{ wch: 18 }, // SICK LEAVE START DATE
			{ wch: 18 }, // SICK LEAVE END DATE
			{ wch: 18 }, // TOTAL SICK LEAVE DAYS
			{ wch: 20 }, // SICK LEAVE REMARKS
			{ wch: 12 }, // Visit Status
			{ wch: 15 }, // Provider Name
			{ wch: 15 }, // SENT TO
			{ wch: 18 }, // IP ADMISSION REQUIRED
			{ wch: 20 }, // FINAL REMARKS
			{ wch: 15 }, // Created By
			{ wch: 20 }, // Created At
		];

		// Add medicine columns
		for (let i = 0; i < maxMedicines; i++) {
			colWidths.push({ wch: 18 }); // MEDICINE
			colWidths.push({ wch: 15 }); // COURSE
			colWidths.push({ wch: 15 }); // EXPIRY DATE
		}

		// Add referral columns
		for (let i = 0; i < maxReferrals; i++) {
			colWidths.push({ wch: 15 }); // REFERRAL CODE
			colWidths.push({ wch: 15 }); // REFERRAL TYPE
			colWidths.push({ wch: 25 }); // REFERRED TO
			colWidths.push({ wch: 12 }); // VISIT DATE
			colWidths.push({ wch: 15 }); // SPECIALIST TYPE
			colWidths.push({ wch: 18 }); // DOCTOR NAME-REF
			colWidths.push({ wch: 20 }); // INVESTIGATION REPORTS
			colWidths.push({ wch: 20 }); // PRIMARY DIAGNOSIS-REF
			colWidths.push({ wch: 25 }); // SECONDARY DIAGNOSIS-REF
			colWidths.push({ wch: 20 }); // NURSE REMARKS
			colWidths.push({ wch: 20 }); // INSURANCE APPROVAL
			colWidths.push({ wch: 18 }); // FOLLOW UP REQUIRED

			// Follow-up visits
			for (let j = 0; j < maxFollowUpVisitsPerReferral; j++) {
				colWidths.push({ wch: 15 }); // NEXT VISIT DATE
				colWidths.push({ wch: 25 }); // ADDITIONAL INFORMATIONS
			}
		}

		worksheet['!cols'] = colWidths;
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Clinic Visits');

		// Generate filename with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
		const filename = `clinic-visits-${timestamp}.xlsx`;

		// Get the uploads/clinic-excel directory
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const uploadsDir = path.join(__dirname, '../../uploads/clinic-excel');

		// Ensure directory exists
		if (!fs.existsSync(uploadsDir)) {
			fs.mkdirSync(uploadsDir, { recursive: true });
		}

		const filepath = path.join(uploadsDir, filename);

		// Write file to disk
		XLSX.writeFile(workbook, filepath);

		// Return success response with file info
		return res.json({
			success: true,
			message: `Excel file exported successfully`,
			data: {
				filename,
				filepath,
				recordsExported: visits.length,
				downloadUrl: `/uploads/clinic-excel/${filename}`,
			},
		});
	} catch (err) {
		next(err);
	}
}

export default { createVisit, getVisits, getVisitById, updateVisit, deleteVisit, getVisitsByUserLocation, getEmpSummary, exportToExcel, filterByName };

