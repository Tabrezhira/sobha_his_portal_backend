import CaseResolution from "./resolution.model.js";

function getAllowedLocations(user) {
  if (user?.role === "superadmin") return null;
  const base = user?.locationId ? [String(user.locationId)] : [];
  const extra = Array.isArray(user?.managerLocation)
    ? user.managerLocation.map((loc) => String(loc))
    : [];
  return Array.from(new Set([...base, ...extra]));
}

function hasLocationAccess(record, user) {
  if (user?.role === "superadmin") return true;
  const recordLocation = record?.locationId ? String(record.locationId) : "";
  const allowed = getAllowedLocations(user) || [];
  return allowed.includes(recordLocation);
}

// Create case resolution record (manager only)
async function createCaseResolution(req, res, next) {
  try {
    const { locationId, ...data } = req.body;
    const newRecord = new CaseResolution({
      locationId: req.user.locationId,
      ...data,
      createdBy: req.user._id,
    });
    await newRecord.save();
    return res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    next(err);
  }
}

// Get all case resolutions for user's location (manager only)
async function getCaseResolutions(req, res, next) {
  try {
    const { page = 1, limit = 50, status, empId } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const allowedLocations = getAllowedLocations(req.user);
    const query = allowedLocations
      ? { locationId: { $in: allowedLocations } }
      : {};
    if (status) query.status = status;
    if (empId) query.empId = empId;

    const [total, items] = await Promise.all([
      CaseResolution.countDocuments(query),
      CaseResolution.find(query)
        .sort({ date: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate("createdBy", "name email"),
    ]);

    return res.json({
      success: true,
      data: items,
      meta: { total, page: p, limit: l },
    });
  } catch (err) {
    next(err);
  }
}

// Get case resolution by ID (manager only)
async function getCaseResolutionById(req, res, next) {
  try {
    const { id } = req.params;
    const record = await CaseResolution.findById(id).populate(
      "createdBy",
      "name email"
    );
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    if (!hasLocationAccess(record, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }
    return res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

// Update case resolution (manager only)
async function updateCaseResolution(req, res, next) {
  try {
    const { id } = req.params;
    const record = await CaseResolution.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    if (!hasLocationAccess(record, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    Object.assign(record, req.body);
    await record.save();
    return res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

// Delete case resolution (manager only)
async function deleteCaseResolution(req, res, next) {
  try {
    const { id } = req.params;
    const record = await CaseResolution.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    if (!hasLocationAccess(record, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    await CaseResolution.findByIdAndDelete(id);
    return res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    next(err);
  }
}

export default {
  createCaseResolution,
  getCaseResolutions,
  getCaseResolutionById,
  updateCaseResolution,
  deleteCaseResolution,
};
