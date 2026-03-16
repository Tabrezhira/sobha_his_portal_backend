import RCT from './rct.model.js';
import RCTVital from './rctVital.model.js';

// Create RCT record
async function createRct(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const payload = req.body || {};
    if (payload.createdBy) delete payload.createdBy;
    payload.createdBy = req.user._id;
    if (req.user.locationId) payload.locationId = req.user.locationId;

    const item = new RCT(payload);
    const saved = await item.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
}

// Get RCT records with filters + pagination
async function getRctRecords(req, res, next) {
  try {
    const { page = 1, limit = 50, empNo, employeeName, severity } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const query = {};
    if (empNo) query.empNo = empNo;
    if (employeeName) query.employeeName = new RegExp(employeeName, 'i');
    if (severity) query.severity = severity;

    const [total, items] = await Promise.all([
      RCT.countDocuments(query),
      RCT.find(query)
        .sort({ injuryRecoveryInDay: -1, createdAt: -1, _id: -1 })
        .skip((p - 1) * l)
        .limit(l),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) {
    next(err);
  }
}

// Get RCT by id
async function getRctById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await RCT.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Get RCTs currently in injury recovery
async function getInInjuryRecovery(req, res, next) {
  try {
    const items = await RCT.find({ recoveryStatus: 'IN INJURY RECOVERY' })
      .select({ _id: 1, empNo: 1, employeeName: 1 });

    return res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}


// Update RCT record
async function updateRct(req, res, next) {
  try {
    const { id } = req.params;
    const item = await RCT.findByIdAndUpdate(id, req.body || {}, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Delete RCT record
async function deleteRct(req, res, next) {
  try {
    const { id } = req.params;
    const item = await RCT.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Create RCT vital record
async function createRctVital(req, res, next) {
  try {
    const { rctId } = req.params;
    const rctRecord = await RCT.findById(rctId);
    if (!rctRecord) {
      return res.status(404).json({ success: false, message: 'RCT record not found' });
    }

    const payload = { ...(req.body || {}), rctId };
    const item = new RCTVital(payload);
    const saved = await item.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
}

// Get RCT vitals by RCT id with pagination
async function getRctVitals(req, res, next) {
  try {
    const { rctId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      RCTVital.countDocuments({ rctId }),
      RCTVital.find({ rctId })
        .sort({ date: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate('rctId', 'empNo employeeName'),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) {
    next(err);
  }
}

// Get single RCT vital by id
async function getRctVitalById(req, res, next) {
  try {
    const { vitalId } = req.params;
    const item = await RCTVital.findById(vitalId).populate('rctId', 'empNo employeeName');
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Update RCT vital
async function updateRctVital(req, res, next) {
  try {
    const { vitalId } = req.params;
    const item = await RCTVital.findByIdAndUpdate(vitalId, req.body || {}, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Delete RCT vital
async function deleteRctVital(req, res, next) {
  try {
    const { vitalId } = req.params;
    const item = await RCTVital.findByIdAndDelete(vitalId);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Create bulk RCT vital records
async function createBulkRctVitals(req, res, next) {
  try {
    const { date, time, vitals } = req.body;

    if (!Array.isArray(vitals) || vitals.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid vitals array is required' });
    }

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required for bulk vitals' });
    }

    // Process each vital and add the global date and time
    const vitalsToInsert = vitals.map(vital => ({
      ...vital,
      date,
      time
    }));

    // Perform bulk insertion
    const savedVitals = await RCTVital.insertMany(vitalsToInsert);

    return res.status(201).json({ success: true, data: savedVitals, message: `${savedVitals.length} vitals recorded successfully.` });
  } catch (err) {
    next(err);
  }
}

export default {
  createRct,
  getRctRecords,
  getRctById,
  getInInjuryRecovery,
  updateRct,
  deleteRct,
  createRctVital,
  getRctVitals,
  getRctVitalById,
  updateRctVital,
  deleteRctVital,
  createBulkRctVitals,
};