import IpAdmission from "./ipAdmission.model.js";
import Hospital from "../../hospital/hospital.model.js";

const basePopulate = [
	{ path: "hospitalCase", select: "empNo employeeName hospitalName dateOfAdmission status" }
];

const exactFilters = [
	"hiManagers",
	"admissionMode",
	"admissionType",
	"insuranceApprovalStatus",
	"treatmentUndergone",
	"imVisitStatus",
	"treatmentLocation",
	"placeOfLocation",
	"postRecoveryLocation",
	"fitToTravel",
	"postRehabRequired",
	"followUpRequired",
	"rehabExtension",
	"dischargedHI",
	"source",
	"caseTypeChange"
];

const numberFilters = ["noOfVisits", "durationOfRehab", "rehabExtensionDuration"];

const parseDate = (value) => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

function buildFilters(query) {
	const filters = {};

	exactFilters.forEach((key) => {
		if (query[key] !== undefined && query[key] !== "") {
			if (["fitToTravel", "postRehabRequired", "followUpRequired", "rehabExtension", "dischargedHI"].includes(key)) {
				filters[key] = String(query[key]).toLowerCase() === "true";
			} else {
				filters[key] = query[key];
			}
		}
	});

	numberFilters.forEach((key) => {
		if (query[key] !== undefined && query[key] !== "") {
			const value = Number(query[key]);
			if (!Number.isNaN(value)) filters[key] = value;
		}
	});

	if (query.hospitalCase) filters.hospitalCase = query.hospitalCase;

	if (query.search) {
		const term = query.search.trim();
		if (term) {
			const regex = new RegExp(term, "i");
			filters.$or = [
				{ hiManagers: regex },
				{ treatmentUndergone: regex },
				{ technicianFeedbackForm: regex },
				{ source: regex },
				{ caseTypeChange: regex },
				{ dischargeComments: regex },
				{ caseTypeChangeComments: regex },
				{ "technicianVisits.technicianFeedback": regex },
				{ "technicianVisits.physicianFeedback": regex }
			];
		}
	}

	const memberResumeFrom = parseDate(query.memberResumeFrom || query.startDate);
	const memberResumeTo = parseDate(query.memberResumeTo || query.endDate);
	if (memberResumeFrom || memberResumeTo) {
		filters.memberResumeToWork = {};
		if (memberResumeFrom) filters.memberResumeToWork.$gte = memberResumeFrom;
		if (memberResumeTo) filters.memberResumeToWork.$lte = memberResumeTo;
	}

	const dodHiFrom = parseDate(query.dodHiFrom || query.dodFrom);
	const dodHiTo = parseDate(query.dodHiTo || query.dodTo);
	if (dodHiFrom || dodHiTo) {
		filters.dodHI = {};
		if (dodHiFrom) filters.dodHI.$gte = dodHiFrom;
		if (dodHiTo) filters.dodHI.$lte = dodHiTo;
	}

	const createdFrom = parseDate(query.createdFrom);
	const createdTo = parseDate(query.createdTo);
	if (createdFrom || createdTo) {
		filters.createdAt = {};
		if (createdFrom) filters.createdAt.$gte = createdFrom;
		if (createdTo) filters.createdAt.$lte = createdTo;
	}

	return filters;
}

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

function normalizeTechnicianVisits(value) {
	if (!Array.isArray(value)) return null;

	return value.map((item) => ({
		technicianFeedback: isNonEmptyString(item?.technicianFeedback) ? item.technicianFeedback.trim() : undefined,
		physicianFeedback: isNonEmptyString(item?.physicianFeedback) ? item.physicianFeedback.trim() : undefined
	}));
}

async function ensureHospitalExists(hospitalId) {
	const found = await Hospital.exists({ _id: hospitalId });
	return !!found;
}

async function createIpAdmission(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: "Not authenticated" });
		}

		const payload = req.body || {};

		if (payload.hospitalCase) {
			const hospitalExists = await ensureHospitalExists(payload.hospitalCase);
			if (!hospitalExists) {
				return res.status(404).json({ success: false, message: "Referenced hospitalCase not found" });
			}
		}

		const record = new IpAdmission(payload);
		const saved = await record.save();
		const populated = await saved.populate(basePopulate);
		return res.status(201).json({ success: true, data: populated });
	} catch (err) {
		next(err);
	}
}

async function createFromHospitalCase(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: "Not authenticated" });
		}

		const payload = req.body || {};
		const { hospitalCase, hiManagers, caseTypeChange } = payload;

		if (!hospitalCase) {
			return res.status(400).json({ success: false, message: "hospitalCase is required" });
		}

		if (!isNonEmptyString(hiManagers) || !isNonEmptyString(caseTypeChange)) {
			return res.status(422).json({
				success: false,
				message: "hiManagers and caseTypeChange are required"
			});
		}

		const hospital = await Hospital.findById(hospitalCase).select("empNo employeeName hospitalName dateOfAdmission");
		if (!hospital) {
			return res.status(404).json({ success: false, message: "Referenced hospitalCase not found" });
		}

		if (!isNonEmptyString(hospital.empNo)) {
			return res.status(422).json({ success: false, message: "Referenced hospitalCase has no empNo" });
		}

		const createPayload = {
			hospitalCase,
			empNo: hospital.empNo,
			hiManagers: hiManagers.trim(),
			caseTypeChange: caseTypeChange.trim(),
			hospitalName: payload.hospitalName || hospital.hospitalName,
			dateOfAdmission: payload.dateOfAdmission || hospital.dateOfAdmission
		};

		const record = new IpAdmission(createPayload);
		const saved = await record.save();
		const populated = await saved.populate(basePopulate);
		const response = populated.toObject ? populated.toObject() : populated;
		response.employeeName = hospital.employeeName || null;

		return res.status(201).json({ success: true, data: response });
	} catch (err) {
		next(err);
	}
}

async function createManualNewVisit(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: "Not authenticated" });
		}

		const payload = req.body || {};
		const requiredFields = [
			"empNo",
			"hiManagers",
			"caseTypeChange",
			"hospitalName",
			"dateOfAdmission",
			"treatmentUndergone"
		];

		for (const key of requiredFields) {
			if (!isNonEmptyString(payload[key])) {
				return res.status(422).json({ success: false, message: `${key} is required` });
			}
		}

		const technicianVisits = normalizeTechnicianVisits(payload.technicianVisits);
		if (!technicianVisits) {
			return res.status(422).json({ success: false, message: "technicianVisits must be an array" });
		}

		const createPayload = {
			empNo: payload.empNo.trim(),
			hiManagers: payload.hiManagers.trim(),
			caseTypeChange: payload.caseTypeChange.trim(),
			hospitalName: payload.hospitalName.trim(),
			dateOfAdmission: payload.dateOfAdmission,
			technicianVisits,
			treatmentUndergone: payload.treatmentUndergone.trim()
		};

		const record = new IpAdmission(createPayload);
		const saved = await record.save();
		const populated = await saved.populate(basePopulate);
		return res.status(201).json({ success: true, data: populated });
	} catch (err) {
		next(err);
	}
}

async function getIpAdmissions(req, res, next) {
	try {
		const filters = buildFilters(req.query || {});
		const page = Math.max(1, parseInt(req.query.page || 1, 10));
		const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || 20, 10)));

		const [total, items] = await Promise.all([
			IpAdmission.countDocuments(filters),
			IpAdmission.find(filters)
				.sort({ updatedAt: -1, createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.populate(basePopulate)
		]);

		return res.json({ success: true, data: items, meta: { total, page, limit } });
	} catch (err) {
		next(err);
	}
}

async function getIpAdmissionById(req, res, next) {
	try {
		const { id } = req.params;
		const item = await IpAdmission.findById(id).populate(basePopulate);
		if (!item) return res.status(404).json({ success: false, message: "Not found" });
		return res.json({ success: true, data: item });
	} catch (err) {
		next(err);
	}
}

async function updateIpAdmission(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: "Not authenticated" });
		}

		const { id } = req.params;
		const payload = { ...req.body };

		if (payload.hospitalCase) {
			const hospitalExists = await ensureHospitalExists(payload.hospitalCase);
			if (!hospitalExists) {
				return res.status(404).json({ success: false, message: "Referenced hospitalCase not found" });
			}
		}

		let updated = await IpAdmission.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
		if (!updated) return res.status(404).json({ success: false, message: "Not found" });
		updated = await updated.populate(basePopulate);
		return res.json({ success: true, data: updated });
	} catch (err) {
		next(err);
	}
}

async function deleteIpAdmission(req, res, next) {
	try {
		if (!req.user || !req.user._id) {
			return res.status(401).json({ success: false, message: "Not authenticated" });
		}

		const { id } = req.params;
		const deleted = await IpAdmission.findByIdAndDelete(id).populate(basePopulate);
		if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
		return res.json({ success: true, data: deleted });
	} catch (err) {
		next(err);
	}
}

export default {
	createIpAdmission,
	createFromHospitalCase,
	createManualNewVisit,
	getIpAdmissions,
	getIpAdmissionById,
	updateIpAdmission,
	deleteIpAdmission
};

