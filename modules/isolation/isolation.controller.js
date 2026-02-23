import Isolation from './isolation.model.js';
import ClinicVisit from '../clinic/clinic.model.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    if (empNo) q.empNo = empNo;
    if (emiratesId) q.emiratesId = emiratesId;

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

    if (dateFrom || dateTo) {
      q.dateFrom = {};
      if (dateFrom) q.dateFrom.$gte = new Date(dateFrom);
      if (dateTo) q.dateFrom.$lte = new Date(dateTo);
    }

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      Isolation.countDocuments(q),
      Isolation.find(q).sort({ dateFrom: -1, _id: -1 }).skip((p - 1) * l).limit(l).populate('createdBy', 'name'),
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

// Import Excel
async function importExcel(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const workbook = XLSX.readFile(req.file.path, {
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty or invalid",
      });
    }

    // ---------------------------
    // 🔥 UTC SAFE DATE PARSER
    // ---------------------------

    const parseDate = (val) => {
      if (!val) return null;

      // If Excel already gives Date object
      if (val instanceof Date && !isNaN(val.getTime())) {
        return new Date(Date.UTC(
          val.getFullYear(),
          val.getMonth(),
          val.getDate()
        ));
      }

      const strVal = String(val).trim();

      if (!strVal || strVal.toUpperCase() === "NA" || strVal.toUpperCase() === "N/A") {
        return null;
      }

      // ✅ Handle: 4 Dec 2025
      let match = strVal.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
      if (match) {
        const months = {
          jan: 0, feb: 1, mar: 2, apr: 3,
          may: 4, jun: 5, jul: 6, aug: 7,
          sep: 8, oct: 9, nov: 10, dec: 11,
        };

        return new Date(Date.UTC(
          parseInt(match[3]),
          months[match[2].toLowerCase()],
          parseInt(match[1])
        ));
      }

      // Fallback (handles most other formats)
      const parsed = new Date(strVal);
      if (!isNaN(parsed.getTime())) {
        return new Date(Date.UTC(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate()
        ));
      }

      return null;
    };

    const newIsolations = [];

    for (const rawRow of jsonData) {
      const row = {};

      for (const k in rawRow) {
        const cleanKey = k.trim().replace(/\s+/g, " ").toUpperCase();
        row[cleanKey] = rawRow[k];
      }

      const isolationData = {
        locationId: row["TR LOCATION"] || "",
        clinicVisitToken: row["CLINIC VISIT TOKEN"] || "",
        empNo: row["EMP NO"] || "",
        type: row["TYPE"] || "",
        employeeName: row["EMPLOYEE NAME"] || "",
        emiratesId: row["EMIRATES ID"] || "",
        insuranceId: row["INSURANCE ID"] || "",
        mobileNumber: String(row["MOBILE NUMBER"] || ""),
        trLocation: row["TR LOCATION"] || "",
        isolatedIn: row["ISOLATED IN"] || "",
        isolationReason: row["ISOLATION REASON"] || "",
        nationality: row["NATIONALITY"] || "",
        slUpto: String(row["SL UPTO"] || ""),

        dateFrom: parseDate(row["DATE FROM"]),
        dateTo: parseDate(row["DATE TO"]),

        currentStatus: row["CURRENT STATUS"] || "",
        remarks: row["REMARKS"] || "",
        createdBy: req.user ? req.user._id : null,
      };

      newIsolations.push(isolationData);
    }

    await Isolation.insertMany(newIsolations, { ordered: false });

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${newIsolations.length} records.`,
      count: newIsolations.length,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
}

export default { createIsolation, getIsolations, getIsolationById, updateIsolation, deleteIsolation, getIsolationsByUserLocation, importExcel };
