import ClinicVisit from './clinic.model.js';
import MemberFeedback from '../handI/memberFeedback/memberFeedback.model.js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import DailyTokenCounter from "./DailyTokenCounter.js";

// Create a new clinic visit
async function createVisitOLD(req, res, next) {
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

		// Auto-generate referralCode if referral is true or referredToHospital is provided
		if ((payload.referral || payload.referredToHospital) && !payload.referralCode) {
			payload.referralCode = payload.tokenNo;
		}

		const visit = new ClinicVisit(payload);
		const saved = await visit.save();
		const populated = await saved.populate('createdBy', 'name');
		return res.status(201).json({ success: true, data: populated });
	} catch (err) {
		next(err);
	}
}



async function createVisit(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: "Not authenticated" });
		}

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

		// Security fields
		delete payload.createdBy;
		payload.createdBy = req.user._id;

		if (req.user.locationId) {
			payload.locationId = req.user.locationId;
		}

		// ===============================
		// TOKEN GENERATION (ATOMIC SAFE)
		// ===============================

		if (!payload.tokenNo) {

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
				"SONAPUR 6": "SONA6",
				"SONAPUR 7": "SONA7",
				"RAHABA": "RAH",
			};

			const rawLoc = String(payload.locationId || "").trim();
			const locKey = rawLoc.toUpperCase().replace(/\s+/g, " ");
			let loc = locationCodeMap[locKey];

			if (!loc) {
				loc = rawLoc.replace(/\s+/g, "").substring(0, 4).toUpperCase() || "UNKN";
			}

			const now = new Date();
			const dd = String(now.getDate()).padStart(2, "0");
			const mm = String(now.getMonth() + 1).padStart(2, "0");
			const yyyy = now.getFullYear();

			const dateKey = `${yyyy}-${mm}-${dd}`;

			// 🔥 Atomic increment
			const counter = await DailyTokenCounter.findOneAndUpdate(
				{ locationId: rawLoc, dateKey },
				{ $inc: { seq: 1 } },
				{ new: true, upsert: true }
			);

			let seqStr = String(counter.seq).padStart(4, "0");
			if (counter.seq > 9999) {
				seqStr = seqStr.slice(-4);
			}

			// External Provider logic
			const sendToValue = String(payload.sendTo || payload.sentTo || "")
				.toUpperCase()
				.trim();

			let locPrefix = loc;

			if (sendToValue === "EXTERNAL PROVIDER") {
				locPrefix = `${loc}XT`;
			}

			// 🔹 Sick Leave Logic
			const isEligible =
				payload.eligibilityForSickLeave === true ||
				String(payload.eligibilityForSickLeave).toLowerCase() === "true";

			if (isEligible) {
				locPrefix = `EL-${locPrefix}`;
			}

			payload.tokenNo = `${locPrefix}-${dd}${mm}-${seqStr}`;
		}

		// Referral logic
		if ((payload.referral || payload.referredToHospital) && !payload.referralCode) {
			payload.referralCode = payload.tokenNo;
		}

		const visit = new ClinicVisit(payload);
		const saved = await visit.save();
		const populated = await saved.populate("createdBy", "name");

		return res.status(201).json({
			success: true,
			data: populated,
		});
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
		if (tokenNo) q.tokenNo = tokenNo;

		// Role-based filtering for locationId
		if (req.user) {
			if (req.user.role === 'maleNurse') {
				q.locationId = req.user.locationId;
			} else if (req.user.role === 'manager' || req.user.role === 'superadmin') {
				const managerLocs = req.user.managerLocation || [];
				if (locationId) {
					// Ensure requested locationId is within their allowed locations
					q.locationId = managerLocs.includes(locationId) ? locationId : { $in: managerLocs };
				} else {
					q.locationId = { $in: managerLocs };
				}
			} else {
				// Fallback if other roles need filtering or just use requested
				if (locationId) q.locationId = locationId;
			}
		} else {
			if (locationId) q.locationId = locationId;
		}

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
				.sort({ date: -1, time: -1, _id: -1 }) // Sort by newest date and time first
				.skip((p - 1) * l)
				.limit(l)
				.populate('createdBy', 'name'),
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
			.populate('createdBy', 'name');
		if (!visit) return res.status(404).json({ success: false, message: 'Not found' });
		return res.json({ success: true, data: visit });
	} catch (err) {
		next(err);
	}
}

// Get employee info from a clinic visit by tokenNo
async function getEmployeeInfo(req, res, next) {
    try {
        const { id } = req.params;
        const visit = await ClinicVisit.findOne({ tokenNo: id })
            .select('empNo employeeName emiratesId insuranceId mobileNumber trLocation');
        if (!visit) return res.status(404).json({ success: false, message: 'Not found' });
        return res.json({
            success: true,
            data: {
                emp: visit.empNo,
                name: visit.employeeName,
                emiratesId: visit.emiratesId,
                insuranceId: visit.insuranceId,
                mobileNumber: visit.mobileNumber,
                trLocation: visit.trLocation
            }
        });
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
		]).allowDiskUse(true);

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

// Get Prioritized Visits for Manager based on specific criteria
async function getManagerPrioritizedVisitsOld(req, res, next) {
	try {
		// 1. Validation
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: 'Not authenticated' });
		}

		const managerLocations = req.user.managerLocation;
		if (!managerLocations || !Array.isArray(managerLocations) || managerLocations.length === 0) {
			return res.status(403).json({
				success: false,
				message: 'Manager has no assigned locations'
			});
		}

		// 2. Fetch Employee feedback to exclude them completely
		// We get all distinct employee numbers that have EVER provided feedback.
		const feedbacks = await MemberFeedback.find({}, 'employeeId');
		const excludedEmpNos = [...new Set(feedbacks.map(f => f.employeeId).filter(Boolean))];


		// 3. Date constraints
		const now = new Date();

		// "Last 30 days"
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		thirtyDaysAgo.setHours(0, 0, 0, 0);

		// "Older than 5 days" for Rank 3
		const fiveDaysAgo = new Date(now);
		fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
		fiveDaysAgo.setHours(0, 0, 0, 0);

		// Format dates as YYYY-MM-DD since ClinicVisit.date is a String
		const formatDate = (dateValue) => {
			const d = new Date(dateValue);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);
		const fiveDaysAgoStr = formatDate(fiveDaysAgo);

		// 4. Aggregation Pipeline
		const items = await ClinicVisit.aggregate([
			{
				$match: {
					locationId: { $in: managerLocations },
					// Lexicographical string comparison works for YYYY-MM-DD
					date: { $gte: thirtyDaysAgoStr },
					empNo: { $nin: excludedEmpNos }
				}
			},
			{
				// Sort by date descending so the first document we encounter is the most recent
				$sort: { date: -1, _id: -1 }
			},
			{
				$group: {
					_id: '$empNo',
					empNo: { $first: '$empNo' },
					employeeName: { $first: '$employeeName' },
					emiratesId: { $first: '$emiratesId' },
					mobileNumber: { $first: '$mobileNumber' },
					trLocation: { $first: '$trLocation' },

					// Count total visits in last 30 days
					visitCount: { $sum: 1 },

					// Check if any visit had Approved sick leave
					hasApprovedSickLeave: {
						$max: {
							$cond: [{ $eq: ['$sickLeaveStatus', 'Approved'] }, 1, 0]
						}
					},

					// Check if any visit was a referral
					anyReferral: {
						$max: {
							$cond: [{ $eq: ['$referral', true] }, 1, 0]
						}
					},

					// Find the most recent visit date (string sorting works here too for YYYY-MM-DD)
					lastVisitDate: { $max: '$date' },

					// Keep only the most recent visit for context, dropping all previous history
					lastVisit: { $first: '$$ROOT' }
				}
			},
			{
				$addFields: {
					rank: {
						$switch: {
							branches: [
								// Rank 1: Multiple visits AND sick leave approved
								{
									case: {
										$and: [
											{ $gt: ['$visitCount', 1] },
											{ $eq: ['$hasApprovedSickLeave', 1] }
										]
									},
									then: 1
								},
								// Rank 2: Multiple visits BUT sick leave not approved
								{
									case: {
										$and: [
											{ $gt: ['$visitCount', 1] },
											{ $eq: ['$hasApprovedSickLeave', 0] }
										]
									},
									then: 2
								},
								// Rank 3: Any referral AND last visit older than 5 days
								{
									case: {
										$and: [
											{ $eq: ['$anyReferral', 1] },
											{ $lt: ['$lastVisitDate', fiveDaysAgoStr] }
										]
									},
									then: 3
								}
							],
							// Rank 4: Default fallback
							default: 4
						}
					}
				}
			},
			{
				// Sort by best rank first (1 -> 4), then by most recent last visit
				$sort: {
					rank: 1,
					lastVisitDate: -1
				}
			},
			{
				// Keep only the top 50
				$limit: 50
			}
		]).allowDiskUse(true);

		// Format items to directly return the last visit details
		const formattedItems = items.map(item => ({
			...item.lastVisit,
			rank: item.rank,
			visitCount: item.visitCount
		}));

		return res.json({
			success: true,
			data: formattedItems,
			meta: {
				returned: formattedItems.length,
				totalRanked: formattedItems.length, // we only know up to 50
				excludedEmpNosCount: excludedEmpNos.length
			}
		});

	} catch (err) {
		next(err);
	}
}

async function getManagerPrioritizedVisits(req, res, next) {
	try {
		// 1. Validation
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: 'Not authenticated' });
		}

		const managerLocations = req.user.managerLocation;
		if (!managerLocations || !Array.isArray(managerLocations) || managerLocations.length === 0) {
			return res.status(403).json({
				success: false,
				message: 'Manager has no assigned locations'
			});
		}

		// 2. Fetch Employee feedback to exclude them completely
		const feedbacks = await MemberFeedback.find({}, 'employeeId');
		const excludedEmpNos = [...new Set(feedbacks.map(f => f.employeeId).filter(Boolean))];

		// 3. Date constraints
		const now = new Date();

		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		thirtyDaysAgo.setHours(0, 0, 0, 0);

		const fiveDaysAgo = new Date(now);
		fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
		fiveDaysAgo.setHours(0, 0, 0, 0);

		const formatDate = (dateValue) => {
			const d = new Date(dateValue);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);
		const fiveDaysAgoStr = formatDate(fiveDaysAgo);

		// 4. Aggregation Pipeline
		const items = await ClinicVisit.aggregate([
			{
				// Use $expr with $substr to extract YYYY-MM-DD from ISO string for safe comparison
				$match: {
					locationId: { $in: managerLocations },
					empNo: { $nin: excludedEmpNos },
					$expr: {
						$gte: [{ $substr: ['$date', 0, 10] }, thirtyDaysAgoStr]
					}
				}
			},
			{
				$sort: { date: -1, _id: -1 }
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

					hasApprovedSickLeave: {
						$max: {
							$cond: [{ $eq: ['$sickLeaveStatus', 'Approved'] }, 1, 0]
						}
					},

					anyReferral: {
						$max: {
							$cond: [{ $eq: ['$referral', true] }, 1, 0]
						}
					},

					// Store normalized YYYY-MM-DD for safe comparison later
					lastVisitDate: { $max: { $substr: ['$date', 0, 10] } },

					lastVisit: { $first: '$$ROOT' }
				}
			},
			{
				$addFields: {
					rank: {
						$switch: {
							branches: [
								// Rank 1: Multiple visits AND sick leave approved
								{
									case: {
										$and: [
											{ $gt: ['$visitCount', 1] },
											{ $eq: ['$hasApprovedSickLeave', 1] }
										]
									},
									then: 1
								},
								// Rank 2: Multiple visits BUT sick leave not approved
								{
									case: {
										$and: [
											{ $gt: ['$visitCount', 1] },
											{ $eq: ['$hasApprovedSickLeave', 0] }
										]
									},
									then: 2
								},
								// Rank 3: Any referral AND last visit older than 5 days
								{
									case: {
										$and: [
											{ $eq: ['$anyReferral', 1] },
											// Compare normalized YYYY-MM-DD strings safely
											{ $lt: ['$lastVisitDate', fiveDaysAgoStr] }
										]
									},
									then: 3
								}
							],
							// Rank 4: Default fallback
							default: 4
						}
					}
				}
			},
			{
				$sort: {
					rank: 1,
					lastVisitDate: -1
				}
			},
			{
				$limit: 50
			}
		]).allowDiskUse(true);

		// Format items to directly return the last visit details
		const formattedItems = items.map(item => ({
			...item.lastVisit,
			rank: item.rank,
			visitCount: item.visitCount
		}));

		return res.json({
			success: true,
			data: formattedItems,
			meta: {
				returned: formattedItems.length,
				totalRanked: formattedItems.length,
				excludedEmpNosCount: excludedEmpNos.length
			}
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

		// Auto-generate referralCode if referral is true or referredToHospital is provided in payload
		if ((payload.referral || payload.referredToHospital) && !payload.referralCode) {
			const visit = await ClinicVisit.findById(id);
			if (visit) {
				payload.referralCode = visit.tokenNo;
			}
		}

		let updated = await ClinicVisit.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
		if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
		updated = await updated.populate([
			{ path: 'createdBy', select: 'name' }
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
			{ path: 'createdBy', select: 'name' }
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
				.populate('createdBy', 'name'),
		]);

		return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
	} catch (err) {
		next(err);
	}
}

// Get summary for an employee (by empNo)
async function getEmpSummary(req, res, next) {
    try {
        const rawEmpNo = req.query.empNo || req.params.empNo;
        if (!rawEmpNo) {
            return res.status(400).json({ success: false, message: 'empNo is required' });
        }

        // empNo is stored uppercase in schema, normalize for accurate matching
        const empNo = String(rawEmpNo).trim().toUpperCase();

        const now = new Date();
        const last90Start = new Date(now);
        last90Start.setDate(last90Start.getDate() - 90);
        last90Start.setHours(0, 0, 0, 0);

        const [
            allTimeTotalVisits,
            last90Visits,
            sickLeaveApprovedCount,
            totalReferrals,
            openReferrals,
        ] = await Promise.all([
            ClinicVisit.countDocuments({ empNo }),
            ClinicVisit.find({
                empNo,
                date: { $gte: last90Start, $lte: now }, // strict 90-day window up to now
            })
                .sort({ date: -1, time: -1, _id: -1 })
                .select('date providerName doctorName sentTo'),
            ClinicVisit.countDocuments({ empNo, sickLeaveStatus: 'Approved' }),
            ClinicVisit.countDocuments({ empNo, referral: true }),
            ClinicVisit.countDocuments({ empNo, referral: true, visitStatus: 'OPEN' }),
        ]);

        const visitsLast90Days = last90Visits.map((v) => ({
            date: v.date,
            provider: v.providerName || v.doctorName || v.sentTo || null,
        }));

        return res.json({
            success: true,
            data: {
                empNo,
                last90Days: {
                    from: last90Start,
                    to: now,
                    count: last90Visits.length,
                    visits: visitsLast90Days,
                },
                allTimeTotalVisits,
                sickLeaveApprovedCount,
                totalReferrals,
                openReferrals,
            },
        });
    } catch (err) {
        next(err);
    }
}

// Get last 90 days history for an employee
async function getEmpHistory(req, res, next) {
	try {
		const empNo = req.query.empNo || req.params.empNo;
		if (!empNo) return res.status(400).json({ success: false, message: 'empNo is required' });

		const now = new Date();
		const ninetyDaysAgo = new Date(now);
		ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
		ninetyDaysAgo.setHours(0, 0, 0, 0);

		const formatDate = (dateValue) => {
			const d = new Date(dateValue);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		};

		const ninetyDaysAgoStr = formatDate(ninetyDaysAgo);

		const history = await ClinicVisit.find({
			empNo,
			date: { $gte: ninetyDaysAgoStr }
		})
			.sort({ date: -1 })
			.select('date providerName doctorName sentTo primaryDiagnosis secondaryDiagnosis referral referralType visitDateReferral');

		const formattedHistory = history.map(visit => ({
			date: visit.date,
			providerName: visit.providerName || visit.doctorName || visit.sentTo,
			primaryDiagnosis: visit.primaryDiagnosis,
			secondaryDiagnosis: visit.secondaryDiagnosis,
			referral: visit.referral,
			referralType: visit.referralType,
			visitDateReferral: visit.visitDateReferral
		}));

		return res.json({
			success: true,
			data: formattedHistory
		});
	} catch (err) {
		next(err);
	}
}

// Search clinic visits by empNo and/or date
async function searchVisits(req, res, next) {
	try {
		const { empNo, date } = req.query;
		if (!empNo && !date) {
			return res.status(400).json({
				success: false,
				message: 'Provide empNo, date, or both',
			});
		}

		const q = {};
		if (empNo) q.empNo = String(empNo).trim().toUpperCase();

		if (date) {
			const d = new Date(date);
			if (isNaN(d.getTime())) {
				return res.status(400).json({ success: false, message: 'Invalid date' });
			}
			const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
			const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
			q.date = { $gte: start, $lt: end };
		}

		// Role-based location filtering
		if (req.user) {
			if (req.user.role === 'maleNurse') {
				q.locationId = req.user.locationId;
			} else if (req.user.role === 'manager' || req.user.role === 'superadmin') {
				const managerLocs = req.user.managerLocation || [];
				q.locationId = { $in: managerLocs };
			}
		}

		const items = await ClinicVisit.find(q)
			.sort({ date: -1, time: -1, _id: -1 })
			.limit(200)
			.populate('createdBy', 'name');

		return res.json({ success: true, data: items, meta: { count: items.length } });
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
				'Date Of Joining': visit.dateOfJoining ? new Date(visit.dateOfJoining).toLocaleDateString() : '',
				'Eligibility For Sick Leave': visit.eligibilityForSickLeave ? 'Yes' : 'No',
				'Emirates ID': visit.emiratesId,
				'Insurance ID': visit.insuranceId,
				'Location': visit.trLocation,
				'Mobile Number': visit.mobileNumber,
				'Nature of Case': visit.natureOfCase,
				'Case Category': visit.caseCategory,
				'NURSE ASSESSMENT': visit.nurseAssessment ? visit.nurseAssessment.join(', ') : '',
				"SYMPTOM DURATION": visit.symptomDuration || '',
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

			// Add referral columns (flattened structure)
			if (visit.referralCode || visit.referredToHospital || visit.referral) {
				rowData[`REFERRAL CODE 1`] = visit.referralCode || '';
				rowData[`REFERRAL TYPE 1`] = visit.referralType || '';
				rowData[`REFERRED TO - CLINIC/NOS NAME 1`] = visit.referredToHospital || '';
				rowData[`VISIT DATE 1`] = visit.visitDateReferral ? new Date(visit.visitDateReferral).toLocaleDateString() : '';
				rowData[`SPECIALIST TYPE 1`] = visit.specialistType || '';
				rowData[`DOCTOR NAME-REF 1`] = visit.doctorNameReferral || '';
				rowData[`INVESTIGATION REPORTS 1`] = visit.investigationReports || '';
				rowData[`PRIMARY DIAGNOSIS-REF 1`] = visit.primaryDiagnosisReferral || '';
				rowData[`SECONDARY DIAGNOSIS-REF 1`] = visit.secondaryDiagnosisReferral ? visit.secondaryDiagnosisReferral.join(', ') : '';
				rowData[`NURSE REMARKS 1`] = visit.nurseRemarksReferral || '';
			rowData[`INSURANCE APPROVAL REQUESTS 1`] = visit.insuranceApprovalRequested || '';

				// Add follow-up visits array items
				if (visit.followUpVisits && visit.followUpVisits.length > 0) {
					visit.followUpVisits.forEach((fup, fupIdx) => {
						rowData[`NEXT VISIT DATE 1-${fupIdx + 1}`] = fup.visitDate ? new Date(fup.visitDate).toLocaleDateString() : '';
						rowData[`ANY ADDITIONAL INFORMATIONS 1-${fupIdx + 1}`] = fup.visitRemarks || '';
					});
				}
				// Fill empty follow-up columns up to maxFollowUpVisitsPerReferral
				for (let i = visit.followUpVisits?.length || 0; i < maxFollowUpVisitsPerReferral; i++) {
					rowData[`NEXT VISIT DATE 1-${i + 1}`] = '';
					rowData[`ANY ADDITIONAL INFORMATIONS 1-${i + 1}`] = '';
				}
			} else {
				// Empty state formatting
				rowData[`REFERRAL CODE 1`] = '';
				rowData[`REFERRAL TYPE 1`] = '';
				rowData[`REFERRED TO - CLINIC/NOS NAME 1`] = '';
				rowData[`VISIT DATE 1`] = '';
				rowData[`SPECIALIST TYPE 1`] = '';
				rowData[`DOCTOR NAME-REF 1`] = '';
				rowData[`INVESTIGATION REPORTS 1`] = '';
				rowData[`PRIMARY DIAGNOSIS-REF 1`] = '';
				rowData[`SECONDARY DIAGNOSIS-REF 1`] = '';
				rowData[`NURSE REMARKS 1`] = '';
				rowData[`INSURANCE APPROVAL REQUESTS 1`] = '';
				rowData[`FOLLOW UP REQUIRED 1`] = '';

				for (let j = 0; j < maxFollowUpVisitsPerReferral; j++) {
					rowData[`NEXT VISIT DATE 1-${j + 1}`] = '';
					rowData[`ANY ADDITIONAL INFORMATIONS 1-${j + 1}`] = '';
				}
			}

			// For the remainder of "maxReferrals" padding (legacy arrays allowed up to maxReferrals, so we must pad Excel columns linearly for backwards compatibility of sheet width if maxReferrals > 1 based on older records)
			for (let i = (visit.referralCode || visit.referredToHospital ? 1 : 0); i < maxReferrals; i++) {
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
			{ wch: 18 }, // Date Of Joining
			{ wch: 25 }, // Eligibility For Sick Leave
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

// Import Excel
async function importExcelold(req, res, next) {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'No file uploaded' });
		}

		const workbook = XLSX.readFile(req.file.path, { cellDates: true });
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];
		// Use raw: false and dateNF to ensure dates don't get shifted by timezone offsets
		const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });

		if (!jsonData || jsonData.length === 0) {
			return res.status(400).json({ success: false, message: 'Excel file is empty or invalid' });
		}

		// Helper to parse boolean from 'YES', 'NO', 'TRUE', 'FALSE'
		const parseBoolean = (val) => {
			if (typeof val === 'boolean') return val;
			if (!val) return false;
			const s = String(val).trim().toUpperCase();
			return s === 'YES' || s === 'TRUE' || s === '1';
		};

		const parseArray = (val, sep = '|') => {
			if (!val) return [];
			return String(val).split(sep).map(s => s.trim()).filter(Boolean);
		};

		const parseDate = (val) => {
			if (!val) return null;
			// Since we use dateNF: "yyyy-mm-dd", val is already a string like "2025-12-05"
			return String(val).trim();
		};

		const newVisits = [];

		for (const rawRow of jsonData) {
			// Normalize keys to handle typos and extra spaces
			const row = {};
			for (const k in rawRow) {
				let cleanKey = k.trim().replace(/\s+/g, ' ').toUpperCase();
				cleanKey = cleanKey.replace('MEIDICINE', 'MEDICINE');
				cleanKey = cleanKey.replace('REFFERED', 'REFERRED');
				cleanKey = cleanKey.replace('ASSESMENT', 'ASSESSMENT');
				row[cleanKey] = rawRow[k];
			}

			// Basic mapping
			const visitData = {
				locationId: row['TR LOCATION'] || row['LOCATION'] || (req.user ? req.user.locationId : ''),
				date: parseDate(row['DATE']),
				time: row['TIME'] || '',
				empNo: row['EMP NO'] || row['EMPLOYEE NO'] || '',
				employeeName: row['EMPLOYEE NAME'] || '',
				emiratesId: row['EMIRATES ID'] || '',
				insuranceId: row['INSURANCE ID'] || '',
				trLocation: row['TR LOCATION'] || row['LOCATION'] || '',
				mobileNumber: String(row['MOBILE NUMBER'] || ''),
				natureOfCase: row['NATURE OF CASE'] || '',
				caseCategory: row['CASE CATEGORY'] || '',

				nurseAssessment: parseArray(row['NURSE ASSESSMENT']),
				symptomDuration: String(row['SYMPTOM DURATION'] || ''),
				temperature: row['TEMP'] || row['TEMPERATURE'] ? Number(row['TEMP'] || row['TEMPERATURE']) : null,
				bloodPressure: String(row['BP'] || row['BLOOD PRESSURE'] || ''),
				heartRate: row['HEART RATE'] ? Number(row['HEART RATE']) : null,
				others: String(row['OTHERS'] || ''),

				tokenNo: row['TOKEN NO'] || '',
				sentTo: row['SENT TO'] || '',
				providerName: row['PROVIDER NAME'] || '',
				doctorName: row['DOCTOR NAME'] || '',

				primaryDiagnosis: row['PRIMARY DIAGNOSIS'] || '',
				secondaryDiagnosis: parseArray(row['SECONDARY DIAGNOSIS']),

				sickLeaveStatus: row['SICK LEAVE STATUS'] || '',
				sickLeaveStartDate: parseDate(row['SICK LEAVE START DATE']),
				sickLeaveEndDate: parseDate(row['SICK LEAVE END DATE']),
				totalSickLeaveDays: row['TOTAL SICK LEAVE DAYS'] ? Number(row['TOTAL SICK LEAVE DAYS']) : null,
				remarks: row['REMARKS'] || row['SICK LEAVE REMARKS'] || '',

				referral: parseBoolean(row['REFERRAL']),
				referralCode: row['REFERRAL CODE'] || row['REFERRAL CODE 1'] || '',
				referralType: row['REFERRAL TYPE'] || row['REFERRAL TYPE 1'] || '',
				referredToHospital: row['REFERRED TO - CLINIC/HOS NAME'] || row['REFERRED TO - CLINIC/NOS NAME'] || row['REFERRED TO - CLINIC/NOS NAME 1'] || '',
				visitDateReferral: parseDate(row['VISIT DATE'] || row['VISIT DATE 1']),
				specialistType: row['SPECIALIST TYPE'] || row['SPECIALIST TYPE 1'] || '',
				doctorNameReferral: row['DOCTOR NAME-REF'] || row['DOCTOR NAME-REF 1'] || '',
				investigationReports: row['INVESTIGATION REPORTS'] || row['INVESTIGATION REPORTS 1'] || '',
				primaryDiagnosisReferral: row['PRIMARY DIAGNOSIS-REF'] || row['PRIMARY DIAGNOSIS-REF 1'] || '',
				secondaryDiagnosisReferral: parseArray(row['SECONDARY DIAGNOSIS-REF'] || row['SECONDARY DIAGNOSIS-REF 1']),
				nurseRemarksReferral: row['NURSE REMARKS'] || row['NURSE REMARKS 1'] || '',
			insuranceApprovalRequested: row['INSURANCE APPROVAL REQUESTS'] || row['INSURANCE APPROVAL REQUESTS 1'] || '',
				followUpRequired: parseBoolean(row['FOLLOW UP REQUIRED'] || row['FOLLOW UP REQUIRED 1']),
				visitStatus: row['VISIT STATUS'] || '',
				finalRemarks: row['REMARKS-REF'] || row['FINAL REMARKS'] || '',
				ipAdmissionRequired: parseBoolean(row['IP ADMISSION'] || row['IP ADMISSION REQUIRED']),

				createdBy: req.user ? req.user._id : null
			};

			// Medicines
			const medicines = [];
			let i = 1;
			while (true) {
				const medName = row[`MEDICINE ${i}`];
				const medCourse = row[`MEDICINE ${i} COURSE`];
				const medExpiry = row[`EXPIRY DATE ${i}`];

				if (!medName && !medCourse && !medExpiry) {
					break;
				}

				medicines.push({
					name: medName || '',
					course: medCourse || '',
					expiryDate: parseDate(medExpiry)
				});
				if (i > 20) break;
				i++;
			}
			visitData.medicines = medicines;

			// Follow up visits
			const followUpVisits = [];
			let j = 1;
			while (true) {
				const nextDateStr = row[`NEXT VISIT DATE ${j}`];
				const nextRemarksStr = row[`ANY ADDITIONAL INFORMATIONS ${j}`];

				if (!nextDateStr && !nextRemarksStr) {
					break;
				}

				followUpVisits.push({
					visitDate: parseDate(nextDateStr),
					visitRemarks: nextRemarksStr || ''
				});
				if (j > 10) break;
				j++;
			}
			visitData.followUpVisits = followUpVisits;

			// Auto-generate tokenNo if not provided
			if (!visitData.tokenNo) {
				const locKey = String(visitData.locationId || "UNKN").toUpperCase().replace(/\s+/g, " ");
				const locationCodeMap = {
					"AL QOUZ": "QOZ", "DIC 2": "DIC2", "DIC 3": "DIC3",
					"DIC 5": "DIC5", "DIP 1": "DIP1", "DIP 2": "DIP2",
					"JEBAL ALI 1": "JAB1", "JEBAL ALI 2": "JAB2", "JEBAL ALI 3": "JAB3", "JEBAL ALI 4": "JAB4",
					"KHAWANEEJ": "KWJ", "RUWAYYAH": "RUW", "SAJJA": "SAJJ", "SAIF": "SAIF",
					"SONAPUR 1": "SONA1", "SONAPUR 2": "SONA2", "SONAPUR 3": "SONA3", "SONAPUR 4": "SONA4",
					"SONAPUR 5": "SONA5", "RAHABA": "RAH", "SONAPUR 6": "SONA6",
				};
				let loc = locationCodeMap[locKey];
				if (!loc) {
					loc = String(visitData.locationId || "UNKN").replace(/\s+/g, "").substring(0, 4).toUpperCase();
				}
				const d = visitData.date ? new Date(visitData.date) : new Date();
				const dd = String(d.getDate()).padStart(2, "0");
				const mm = String(d.getMonth() + 1).padStart(2, "0");

				const sendToValue = String(visitData.sentTo || "").toUpperCase().trim();
				let locPrefix = loc;
				if (sendToValue === 'EXTERNAL PROVIDER') {
					locPrefix = `${loc}XT`;
				}
				// We don't have accurate seq during bulk import easily without constant DB calls,
				// so generating a random sequence or based on index if tokenNo is missing
				const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
				visitData.tokenNo = `${locPrefix}-${dd}${mm}-${randomSeq}`;
			}

			// Auto-generate referralCode
			if (visitData.referredToHospital && !visitData.referralCode) {
				visitData.referralCode = `${visitData.tokenNo}-REF`;
			}

			newVisits.push(visitData);
		}

		// Save all visits
		await ClinicVisit.insertMany(newVisits);

		// Delete the uploaded file from temp folder
		if (req.file && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path);
		}

		return res.status(200).json({
			success: true,
			message: `Successfully imported ${newVisits.length} records.`,
			count: newVisits.length
		});
	} catch (err) {
		// Try to clean up file if it exists
		if (req.file && fs.existsSync(req.file.path)) {
			fs.unlinkSync(req.file.path);
		}
		next(err);
	}
}



async function importExcel(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.readFile(req.file.path, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (!jsonData.length) {
      return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    const parseBoolean = (val) => {
      if (!val) return false;
      const s = String(val).trim().toUpperCase();
      return ["YES", "TRUE", "1"].includes(s);
    };

    const parseArray = (val, sep = "|") => {
      if (!val) return [];
      return String(val).split(sep).map((v) => v.trim()).filter(Boolean);
    };

    const parseDate = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      const ddMon = s.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/);
      if (ddMon) {
        const months = {
          jan: "01", feb: "02", mar: "03", apr: "04",
          may: "05", jun: "06", jul: "07", aug: "08",
          sep: "09", oct: "10", nov: "11", dec: "12",
        };
        const dd = ddMon[1].padStart(2, "0");
        const mm = months[ddMon[2].toLowerCase()];
        return new Date(`${ddMon[3]}-${mm}-${dd}`);
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    const newVisits = [];

    for (const rawRow of jsonData) {
      const row = {};
      for (const key in rawRow) {
        let cleanKey = key.trim().replace(/\s+/g, " ").toUpperCase();
        row[cleanKey] = rawRow[key];
      }

      const visitData = {
        locationId: row["TR LOCATION"] || "",
        date: parseDate(row["DATE"]),
        time: row["TIME"] || "",
        empNo: row["EMP NO"] || "",
        employeeName: row["EMPLOYEE NAME"] || "",
        emiratesId: row["EMIRATES ID"] || "",
        insuranceId: row["INSURANCE ID"] || "",
        trLocation: row["TR LOCATION"] || "",
        mobileNumber: String(row["MOBILE NUMBER"] || ""),
        natureOfCase: row["NATURE OF CASE"] || "",
        caseCategory: row["CASE CATEGORY"] || "",

        nurseAssessment: parseArray(row["NURSE ASSESSMENT"]),
        symptomDuration: row["SYMPTOM DURATION"] || "",
        temperature: row["TEMP"] ? Number(row["TEMP"]) : null,
        bloodPressure: row["BP"] || "",
        heartRate: row["HEART RATE"] ? Number(row["HEART RATE"]) : null,
        others: row["OTHERS"] || "",

        tokenNo: row["TOKEN NO"] || "",
        sentTo: row["SENT TO"] || "",
        providerName: row["PROVIDER NAME"] || "",
        doctorName: row["DOCTOR NAME"] || "",

        primaryDiagnosis: row["PRIMARY DIAGNOSIS"] || "",
        secondaryDiagnosis: parseArray(row["SECONDARY DIAGNOSIS"]),

        sickLeaveStatus: row["SICK LEAVE STATUS"] || "",
        sickLeaveStartDate: parseDate(row["SICK LEAVE START DATE"]),
        sickLeaveEndDate: parseDate(row["SICK LEAVE END DATE"]),
        totalSickLeaveDays: row["TOTAL SICK LEAVE DAYS"] ? Number(row["TOTAL SICK LEAVE DAYS"]) : null,
        remarks: row["SICK LEAVE REMARKS"] || "",

        referral: parseBoolean(row["REFERRAL"]),
        referralCode: row["REFERRAL CODE"] || "",
        referralType: row["REFERRAL TYPE"] || "",
        referredToHospital: row["REFERRED TO HOSPITAL"] || "",
        visitDateReferral: parseDate(row["REFERRAL VISIT DATE"]),
        specialistType: row["SPECIALIST TYPE"] || "",
        doctorNameReferral: row["REFERRAL DOCTOR NAME"] || "",
        investigationReports: row["INVESTIGATION REPORTS"] || "",
        primaryDiagnosisReferral: row["REFERRAL PRIMARY DIAGNOSIS"] || "",
        secondaryDiagnosisReferral: parseArray(row["REFERRAL SECONDARY DIAGNOSIS"]),
        nurseRemarksReferral: row["REFERRAL NURSE REMARKS"] || "",
        insuranceApprovalRequested: row["INSURANCE APPROVAL REQUESTED"] || "",

        followUpRequired: parseBoolean(row["FOLLOW UP REQUIRED"]),
        visitStatus: row["VISIT STATUS"] || "",
        finalRemarks: row["FINAL REMARKS"] || "",
        ipAdmissionRequired: parseBoolean(row["IP ADMISSION REQUIRED"]),

        createdBy: req.user ? req.user._id : null,
      };

      // Medicines
      const medicines = [];
      for (let i = 1; i <= 8; i++) {
        const name = row[`MEDICINE ${i} NAME`];
        const course = row[`MEDICINE ${i} COURSE`];
        const expiry = row[`MEDICINE ${i} EXPIRY`];

        if (!name && !course && !expiry) continue;

        medicines.push({
          name: name || "",
          course: course || "",
          expiryDate: parseDate(expiry),
        });
      }
      visitData.medicines = medicines;

      // Follow Up Visits
      const followUps = [];
      for (let j = 1; j <= 6; j++) {
        const dateVal = row[`NEXT VISIT DATE ${j}`];
        const remarksVal = row[`NEXT VISIT REMARKS ${j}`];

        if (!dateVal && !remarksVal) continue;

        followUps.push({
          visitDate: parseDate(dateVal),
          visitRemarks: remarksVal || "",
        });
      }
      visitData.followUpVisits = followUps;

      newVisits.push(visitData);
    }

    // Insert all
    await ClinicVisit.insertMany(newVisits, { ordered: false });

    // Cleanup file
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${newVisits.length} records`,
      count: newVisits.length,
    });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
}






export default { createVisit, getVisits, getVisitById, getEmployeeInfo, updateVisit, deleteVisit, getVisitsByUserLocation, getManagerPrioritizedVisits, getEmpSummary, getEmpHistory, exportToExcel, filterByName, importExcel, searchVisits };
