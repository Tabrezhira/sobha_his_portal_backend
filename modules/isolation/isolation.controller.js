import Isolation from './isolation.model.js';
import ClinicVisit from '../clinic/clinic.model.js';

// Create isolation record
async function createIsolation(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const payload = req.body || {};

    if (payload.createdBy) delete payload.createdBy;
    payload.createdBy = req.user._id;
    if (req.user.locationId) payload.locationId = req.user.locationId;

    const item = new Isolation(payload);
    const saved = await item.save();
    const populated = await saved.populate([
      { path: 'createdBy', select: 'name' }
    ]);
    return res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
}

// List isolations with filters + pagination
async function getIsolations(req, res, next) {
  try {
    const { page = 1, limit = 20, locationId, empNo, emiratesId, dateFrom, dateTo } = req.query;
    const q = {};
    if (locationId) q.locationId = locationId;
    if (empNo) q.empNo = empNo;
    if (emiratesId) q.emiratesId = emiratesId;
    if (dateFrom || dateTo) {
      q.dateFrom = {};
      if (dateFrom) q.dateFrom.$gte = new Date(dateFrom);
      if (dateTo) q.dateFrom.$lte = new Date(dateTo);
    }

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      Isolation.countDocuments(q),
      Isolation.find(q).sort({ dateFrom: -1, siNo: 1 }).skip((p - 1) * l).limit(l).populate('createdBy', 'name'),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) { next(err); }
}

// Get by id
async function getIsolationById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Isolation.findById(id).populate('createdBy', 'name');
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

// Update
async function updateIsolation(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { id } = req.params;
    const payload = { ...req.body };
    if (payload.createdBy) delete payload.createdBy;

    let updated = await Isolation.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    updated = await updated.populate([
      { path: 'createdBy', select: 'name' }
    ]);
    return res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

// Delete
async function deleteIsolation(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { id } = req.params;
    let deleted = await Isolation.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    deleted = await deleted.populate([
      { path: 'createdBy', select: 'name' }
    ]);
    return res.json({ success: true, data: deleted });
  } catch (err) { next(err); }
}

// Get isolations for authenticated user's location
async function getIsolationsByUserLocation(req, res, next) {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const locationId = req.user.locationId;
    if (!locationId) return res.status(400).json({ success: false, message: 'User has no locationId' });

    const { page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      Isolation.countDocuments({ locationId }),
      Isolation.find({ locationId }).sort({ dateFrom: -1, siNo: 1 }).skip((p - 1) * l).limit(l).populate([
        { path: 'createdBy', select: 'name' }
      ]),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) { next(err); }
}

export default { createIsolation, getIsolations, getIsolationById, updateIsolation, deleteIsolation, getIsolationsByUserLocation };
