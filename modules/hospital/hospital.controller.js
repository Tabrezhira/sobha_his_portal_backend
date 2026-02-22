import Hospital from './hospital.model.js';
import ClinicVisit from '../clinic/clinic.model.js';

// Create a new hospital record
async function createHospital(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const payload = req.body || {};

    if (payload.createdBy) delete payload.createdBy;
    payload.createdBy = req.user._id;
    if (req.user.locationId) payload.locationId = req.user.locationId;

    const item = new Hospital(payload);
    const saved = await item.save();
    const populated = await saved.populate([
      { path: 'createdBy', select: 'name' }
    ]);
    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
}

async function getHospitals(req, res, next) {
  try {
    const { page = 1, limit = 20, locationId, empNo, emiratesId, status, startDate, endDate } = req.query;
    const q = {};
    if (empNo) q.empNo = empNo;
    if (emiratesId) q.emiratesId = emiratesId;
    if (status) q.status = status;

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

    if (startDate || endDate) {
      q.dateOfAdmission = {};
      if (startDate) q.dateOfAdmission.$gte = new Date(startDate);
      if (endDate) q.dateOfAdmission.$lte = new Date(endDate);
    }

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      Hospital.countDocuments(q),
      Hospital.find(q).sort({ dateOfAdmission: -1, _id: -1 }).skip((p - 1) * l).limit(l).populate([
        { path: 'createdBy', select: 'name' }
      ]),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) {
    next(err);
  }
}

// Get a single hospital record
async function getHospitalById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Hospital.findById(id).populate([
      { path: 'createdBy', select: 'name' }
    ]);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Update hospital record
async function updateHospital(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { id } = req.params;
    const payload = { ...req.body };
    if (payload.createdBy) delete payload.createdBy;
    // do not overwrite locationId from client; allow admin to change if needed in separate flow

    let updated = await Hospital.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    updated = await updated.populate([
      { path: 'createdBy', select: 'name' }
    ]);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// Delete hospital record
async function deleteHospital(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { id } = req.params;
    let deleted = await Hospital.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    deleted = await deleted.populate([
      { path: 'createdBy', select: 'name' }
    ]);
    return res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
}

// Get hospitals for the authenticated user's location
async function getHospitalsByUserLocation(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const locationId = req.user.locationId;
    if (!locationId) return res.status(400).json({ success: false, message: 'User has no locationId' });

    const { page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      Hospital.countDocuments({ locationId }),
      Hospital.find({ locationId }).sort({ dateOfAdmission: -1, sno: 1 }).skip((p - 1) * l).limit(l).populate([
        { path: 'createdBy', select: 'name' }
      ]),
    ]);


    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) {
    next(err);
  }
}

// Get hospitals by manager location and set discharge status
async function getHospitalsByManagerLocation(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });

    // Get manager locations from JWT
    const managerLocations = req.user.managerLocation || [];

    if (!managerLocations || managerLocations.length === 0) {
      return res.status(400).json({ success: false, message: 'Manager has no assigned locations' });
    }

    const { page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    // Filter hospitals by manager's locationId where status is NOT "Discharge"
    const [total, items] = await Promise.all([
      Hospital.countDocuments({
        locationId: { $in: managerLocations },
        status: { $ne: 'Discharge' }
      }),
      Hospital.find({
        locationId: { $in: managerLocations },
        status: { $ne: 'Discharge' }
      })
        .sort({ dateOfAdmission: -1, sno: 1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate([
          { path: 'createdBy', select: 'name' }
        ]),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) {
    next(err);
  }
}

// Get hospital by employee id and date
async function getHospitalByEmployeeAndDate(req, res, next) {
  try {
    const { empNo, date } = req.query;

    if (!empNo) {
      return res.status(400).json({ success: false, message: 'Employee ID (empNo) is required' });
    }
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    // Parse the date and create start and end of day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const item = await Hospital.findOne({
      empNo: empNo,
      dateOfAdmission: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate([
      { path: 'createdBy', select: 'name' }
    ]);

    if (!item) {
      return res.status(404).json({ success: false, message: 'No hospital record found for this employee on the specified date' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export default { createHospital, getHospitals, getHospitalById, updateHospital, deleteHospital, getHospitalsByUserLocation, getHospitalsByManagerLocation, getHospitalByEmployeeAndDate };
