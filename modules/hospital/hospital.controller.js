import Hospital from './hospital.model.js';
import ClinicVisit from '../clinic/clinic.model.js';
import XLSX from 'xlsx';
import fs from 'fs';
import IpAdmission from '../handI/ipAdmission/ipAdmission.model.js'; // add

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

    const managerLocations = req.user.managerLocation || [];

    if (!managerLocations || managerLocations.length === 0) {
      return res.status(400).json({ success: false, message: 'Manager has no assigned locations' });
    }

    const { page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    // find all hospital refs used in IpAdmission
    const usedHospitalIds = await IpAdmission.distinct('hospitalCase', { hospitalCase: { $ne: null } });

    const baseQuery = {
      locationId: { $in: managerLocations },
      status: { $ne: 'Discharge' },
      ...(usedHospitalIds.length ? { _id: { $nin: usedHospitalIds } } : {})
    };

    const [total, items] = await Promise.all([
      Hospital.countDocuments(baseQuery),
      Hospital.find(baseQuery)
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

// Import Excel
async function importExcelNEW(req, res, next) {
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
      if (val instanceof Date) return val;

      const strVal = String(val).trim();

      // Handle standard DD/MM/YYYY or DD-MM-YYYY format
      const dateParts = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dateParts) {
        // match: [1] = DD, [2] = MM, [3] = YYYY
        // Date constructor takes YYYY, MM (0-indexed), DD
        const parsedDDMMYYYY = new Date(parseInt(dateParts[3]), parseInt(dateParts[2]) - 1, parseInt(dateParts[1]));
        if (!isNaN(parsedDDMMYYYY.getTime())) return parsedDDMMYYYY;
      }

      // Standard Date parsing, handles "11-Dec-2025" or ISO strings
      const parsed = new Date(strVal);
      if (!isNaN(parsed.getTime())) return parsed;
      return strVal;
    };

    const newHospitals = [];

    for (const rawRow of jsonData) {
      // Normalize keys to handle typos and extra spaces
      const row = {};
      for (const k in rawRow) {
        let cleanKey = k.trim().replace(/\s+/g, ' ').toUpperCase();
        row[cleanKey] = rawRow[k];
      }

      // Basic mapping
      const hospitalData = {
        locationId: row['TR LOCATION'] || row['LOCATION'] || (req.user ? req.user.locationId : ''),
        clinicVisitToken: row['CLINIC VISIT TOKEN'] || '',
        empNo: row['EMP NO'] || row['EMPLOYEE NO'] || '',
        employeeName: row['NAME'] || row['EMPLOYEE NAME'] || '',
        emiratesId: row['EMIRATES ID'] || '',
        insuranceId: row['INSURANCE ID'] || '',
        trLocation: row['TR LOCATION'] || row['LOCATION'] || '',
        mobileNumber: String(row['MOBILE NUMBER'] || ''),
        hospitalName: row['HOSPITAL NAME'] || '',

        dateOfAdmission: parseDate(row['DOA'] || row['DATE OF ADMISSION']),

        natureOfCase: row['NATURE OF CASE'] || '',
        caseCategory: row['CASE CATEGORY'] || '',

        primaryDiagnosis: row['PRIMARY DIAGNOSIS'] || '',
        secondaryDiagnosis: parseArray(row['SECONDARY DIAGNOSIS'], '|'),

        status: row['STATUS'] || '',
        dischargeSummaryReceived: parseBoolean(row['DISCHARGE SUMMARY RECEIVED']),
        dateOfDischarge: parseDate(row['DOD'] || row['DATE OF DISCHARGE']),
        daysHospitalized: row['NO OF DAYS HOSPITALIZED'] ? Number(row['NO OF DAYS HOSPITALIZED']) : undefined,

        fitnessStatus: row['FITNESS STATUS'] || '',
        isolationRequired: parseBoolean(row['ISOLATION/REHABILITATION REQUIRED'] || row['ISOLATION REQUIRED']),

        finalRemarks: row['REMARKS'] || row['FINAL REMARKS'] || '',
        createdBy: req.user ? req.user._id : null
      };

      // Follow up array: FOLLOW-UP -1 matches REMARKS 1
      const followUp = [];
      let j = 1;
      while (true) {
        // Try multiple variations of 'FOLLOW-UP -1', 'FOLLOW-UP-1', 'FOLLOW UP 1', etc
        const nextDateStr = row[`FOLLOW-UP -${j}`] || row[`FOLLOW-UP - ${j}`] || row[`FOLLOW-UP-${j}`] || row[`FOLLOW UP ${j}`];
        const nextRemarksStr = row[`REMARKS ${j}`] || row[`REMARK ${j}`];

        if (!nextDateStr && !nextRemarksStr) {
          break;
        }

        followUp.push({
          date: parseDate(nextDateStr),
          remarks: nextRemarksStr || ''
        });
        if (j > 10) break; // Limit array size just in case
        j++;
      }
      hospitalData.followUp = followUp;

      newHospitals.push(hospitalData);
    }

    // Save all hospital records
    await Hospital.insertMany(newHospitals);

    // Delete the uploaded file from temp folder
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${newHospitals.length} hospital records.`,
      count: newHospitals.length
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
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const workbook = XLSX.readFile(req.file.path, {
      cellDates: false,
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
    });

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty or invalid",
      });
    }

    // ------------------------
    // 🔥 BOOLEAN PARSER
    // ------------------------
    const parseBoolean = (val) => {
      if (typeof val === "boolean") return val;
      if (!val) return false;

      const s = String(val).trim().toUpperCase();
      return s === "YES" || s === "TRUE" || s === "1";
    };

    // ------------------------
    // 🔥 ARRAY PARSER
    // ------------------------
    const parseArray = (val, sep = "|") => {
      if (!val) return [];
      return String(val)
        .split(sep)
        .map((s) => s.trim())
        .filter(Boolean);
    };

    // ------------------------
    // 🔥 UTC SAFE DATE PARSER
    // ------------------------
    const parseDate = (val) => {
      if (!val) return null;

      const strVal = String(val).trim();

      // Format: 18-Dec-2025
      const ddMmmYyyy = strVal.match(
        /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/
      );

      if (ddMmmYyyy) {
        const day = parseInt(ddMmmYyyy[1]);
        const monthStr = ddMmmYyyy[2].toLowerCase();
        const year = parseInt(ddMmmYyyy[3]);

        const months = {
          jan: 0, feb: 1, mar: 2, apr: 3,
          may: 4, jun: 5, jul: 6, aug: 7,
          sep: 8, oct: 9, nov: 10, dec: 11,
        };

        return new Date(Date.UTC(year, months[monthStr], day));
      }

      // Format: DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = strVal.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
      );

      if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1]);
        const month = parseInt(ddmmyyyy[2]) - 1;
        const year = parseInt(ddmmyyyy[3]);

        return new Date(Date.UTC(year, month, day));
      }

      // ISO or default parsing
      const parsed = new Date(strVal);
      if (!isNaN(parsed.getTime())) {
        return new Date(
          Date.UTC(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
          )
        );
      }

      return null;
    };

    const newHospitals = [];

    for (const rawRow of jsonData) {
      // Normalize keys
      const row = {};
      for (const k in rawRow) {
        const cleanKey = k.trim().replace(/\s+/g, " ").toUpperCase();
        row[cleanKey] = rawRow[k];
      }

      const hospitalData = {
        locationId:
          row["TR LOCATION"] ||
          row["LOCATION"] ||
          (req.user ? req.user.locationId : ""),

        clinicVisitToken: row["CLINIC VISIT TOKEN"] || "",
        empNo: row["EMP NO"] || row["EMPLOYEE NO"] || "",
        employeeName: row["NAME"] || row["EMPLOYEE NAME"] || "",
        emiratesId: row["EMIRATES ID"] || "",
        insuranceId: row["INSURANCE ID"] || "",
        trLocation: row["TR LOCATION"] || row["LOCATION"] || "",
        mobileNumber: String(row["MOBILE NUMBER"] || ""),
        hospitalName: row["HOSPITAL NAME"] || "",

        dateOfAdmission: parseDate(
          row["DOA"] || row["DATE OF ADMISSION"]
        ),

        natureOfCase: row["NATURE OF CASE"] || "",
        caseCategory: row["CASE CATEGORY"] || "",

        primaryDiagnosis: row["PRIMARY DIAGNOSIS"] || "",
        secondaryDiagnosis: parseArray(
          row["SECONDARY DIAGNOSIS"],
          "|"
        ),

        status: row["STATUS"] || "",
        dischargeSummaryReceived: parseBoolean(
          row["DISCHARGE SUMMARY RECEIVED"]
        ),

        dateOfDischarge: parseDate(
          row["DOD"] || row["DATE OF DISCHARGE"]
        ),

        daysHospitalized: row["NO OF DAYS HOSPITALIZED"]
          ? Number(row["NO OF DAYS HOSPITALIZED"])
          : undefined,

        fitnessStatus: row["FITNESS STATUS"] || "",
        isolationRequired: parseBoolean(
          row["ISOLATION/REHABILITATION REQUIRED"] ||
          row["ISOLATION REQUIRED"]
        ),

        finalRemarks:
          row["REMARKS"] || row["FINAL REMARKS"] || "",

        createdBy: req.user ? req.user._id : null,
      };

      // ------------------------
      // FOLLOW UP HANDLING
      // ------------------------
      const followUp = [];
      let j = 1;

      while (j <= 10) {
        const nextDateStr =
          row[`FOLLOW-UP -${j}`] ||
          row[`FOLLOW-UP-${j}`] ||
          row[`FOLLOW UP ${j}`];

        const nextRemarksStr =
          row[`REMARKS ${j}`] ||
          row[`REMARK ${j}`];

        if (!nextDateStr && !nextRemarksStr) break;

        followUp.push({
          date: parseDate(nextDateStr),
          remarks: nextRemarksStr || "",
        });

        j++;
      }

      hospitalData.followUp = followUp;

      newHospitals.push(hospitalData);
    }

    // ------------------------
    // BULK INSERT
    // ------------------------
    await Hospital.insertMany(newHospitals, {
      ordered: false,
    });

    // Delete temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${newHospitals.length} hospital records.`,
      count: newHospitals.length,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
}
export default { createHospital, getHospitals, getHospitalById, updateHospital, deleteHospital, getHospitalsByUserLocation, getHospitalsByManagerLocation, getHospitalByEmployeeAndDate, importExcel };
