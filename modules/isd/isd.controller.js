import Isd from './isd.model.js';
import IsdVital from './isdVital.model.js';

// Create ISD record
async function createIsdRecord(req, res, next) {
  try {
    const item = new Isd(req.body || {});
    const saved = await item.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    return next(err);
  }
}

// List ISD records with basic filters + pagination
async function getIsdRecords(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      empNo,
      emiratesId,
      insuranceId,
      currentStatus,
      type,
      subType,
      category,
      severity,
      dateFrom,
      dateTo,
    } = req.query;

    const query = {};

    if (empNo) query.empNo = String(empNo).trim();
    if (emiratesId) query.emiratesId = String(emiratesId).trim();
    if (insuranceId) query.insuranceId = String(insuranceId).trim();
    if (currentStatus) query.currentStatus = String(currentStatus).trim();
    if (type) query.type = String(type).trim();
    if (subType) query.subType = String(subType).trim();
    if (category) query.category = String(category).trim();
    if (severity) query.severity = String(severity).trim();

    if (dateFrom || dateTo) {
      query.isolationInDay = {};
      if (dateFrom) query.isolationInDay.$gte = new Date(dateFrom);
      if (dateTo) query.isolationInDay.$lte = new Date(dateTo);
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, parseInt(limit, 10) || 20);

    const [total, items] = await Promise.all([
      Isd.countDocuments(query),
      Isd.find(query)
        .sort({ isolationInDay: -1, createdAt: -1, _id: -1 })
        .skip((p - 1) * l)
        .limit(l),
    ]);

    return res.json({
      success: true,
      data: items,
      meta: { total, page: p, limit: l },
    });
  } catch (err) {
    return next(err);
  }
}

// List ISD records in isolation with minimal fields
async function getInIsolationIsdEmpList(req, res, next) {
  try {
    const items = await Isd.find({ currentStatus: 'IN ISOLATION' })
      .select('_id empNo employeeName')
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const data = items.map((item) => ({
      _id: item._id,
      emp: item.empNo || '',
      employeeName: item.employeeName || '',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

// Get ISD record by id
async function getIsdRecordById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Isd.findById(id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'ISD record not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

// Update ISD record
async function updateIsdRecord(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Isd.findByIdAndUpdate(id, req.body || {}, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'ISD record not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

// Delete ISD record
async function deleteIsdRecord(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Isd.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'ISD record not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

// Create ISD vital record for an ISD case
async function createIsdVital(req, res, next) {
  try {
    const { isdId } = req.params;

    const isdRecord = await Isd.findById(isdId);
    if (!isdRecord) {
      return res.status(404).json({ success: false, message: 'ISD record not found' });
    }

    const payload = { ...(req.body || {}), isdId };
    const item = new IsdVital(payload);
    const saved = await item.save();

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    return next(err);
  }
}

// Create bulk ISD vital records
async function createBulkIsdVitals(req, res, next) {
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
    const savedVitals = await IsdVital.insertMany(vitalsToInsert);

    return res.status(201).json({ success: true, data: savedVitals, message: `${savedVitals.length} vitals recorded successfully.` });
  } catch (err) {
    return next(err);
  }
}

// List vitals by ISD id with pagination
async function getIsdVitals(req, res, next) {
  try {
    const { isdId } = req.params;
    const { page = 1, limit = 20, dateFrom, dateTo } = req.query;

    const isdRecord = await Isd.findById(isdId);
    if (!isdRecord) {
      return res.status(404).json({ success: false, message: 'ISD record not found' });
    }

    const query = { isdId };

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, parseInt(limit, 10) || 20);

    const [total, items] = await Promise.all([
      IsdVital.countDocuments(query),
      IsdVital.find(query)
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip((p - 1) * l)
        .limit(l),
    ]);

    return res.json({
      success: true,
      data: items,
      meta: { total, page: p, limit: l },
    });
  } catch (err) {
    return next(err);
  }
}

// Get single ISD vital by id
async function getIsdVitalById(req, res, next) {
  try {
    const { vitalId } = req.params;
    const item = await IsdVital.findById(vitalId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'ISD vital record not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

// Update ISD vital by id
async function updateIsdVital(req, res, next) {
  try {
    const { vitalId } = req.params;
    const item = await IsdVital.findByIdAndUpdate(vitalId, req.body || {}, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'ISD vital record not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

// Delete ISD vital by id
async function deleteIsdVital(req, res, next) {
  try {
    const { vitalId } = req.params;
    const item = await IsdVital.findByIdAndDelete(vitalId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'ISD vital record not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

export default {
  createIsdRecord,
  getIsdRecords,
  getInIsolationIsdEmpList,
  getIsdRecordById,
  updateIsdRecord,
  deleteIsdRecord,
  createIsdVital,
  getIsdVitals,
  getIsdVitalById,
  updateIsdVital,
  deleteIsdVital,
  createBulkIsdVitals,
};
