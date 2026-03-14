import Hospital from './hospital.model.js';
import ClinicVisit from '../clinic/clinic.model.js';
import XLSX from 'xlsx';
import fs from 'fs';
import IpAdmission from '../handI/ipAdmission/ipAdmission.model.js'; // add
import nodemailer from "nodemailer";

const managerEmailMap = {
  "AL QUOZ": "vinod.jeganathan@sobhaconst.com",

  "DIC 2": "amarnath.varadhan@sobhaconst.com",
  "DIC 3": "amarnath.varadhan@sobhaconst.com",

  "DIC 5": "jaya.barrankala@sobhaconst.com",
  "DIP 1": "jaya.barrankala@sobhaconst.com",
  "DIP 2": "jaya.barrankala@sobhaconst.com",
  "RAHABA": "jaya.barrankala@sobhaconst.com",

  "JEBAL ALI 1": "sikkandhar.batcha@sobhaconst.com",
  "JEBAL ALI 2": "sikkandhar.batcha@sobhaconst.com",
  "JEBAL ALI 3": "sikkandhar.batcha@sobhaconst.com",
  "JEBAL ALI 4": "sikkandhar.batcha@sobhaconst.com",

  "KHAWANEEJ": "mohammed.kandy@sobhaconst.com",
  "SAJJA": "mohammed.kandy@sobhaconst.com",
  "SAIF": "mohammed.kandy@sobhaconst.com",
  "SONAPUR 6": "mohammed.kandy@sobhaconst.com",

  "SONAPUR 1": "zafar.hamdan@sobhaconst.com",
  "SONAPUR 2": "zafar.hamdan@sobhaconst.com",
  "SONAPUR 3": "zafar.hamdan@sobhaconst.com",
  "SONAPUR 4": "zafar.hamdan@sobhaconst.com",
  "SONAPUR 5": "zafar.hamdan@sobhaconst.com",
  
};

export const createHospital = async (req, res, next) => {
  try {

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const payload = req.body || {};

    payload.createdBy = req.user._id;

    if (req.user.locationId) {
      payload.locationId = req.user.locationId;
    }

    // Save hospital record
    const hospital = new Hospital(payload);
    const saved = await hospital.save();

    const populated = await saved.populate({
      path: "createdBy",
      select: "name",
    });

    // Get manager email
    const managerEmail = managerEmailMap[payload.trLocation];

    if (managerEmail) {

      const transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          user: "tabrez.hakimji@sobhaconst.com",
          pass: "Nov@2025",
        },
        tls: { rejectUnauthorized: false },
      });

const htmlTemplate = `
<div style="font-family:Arial, Helvetica, sans-serif;background:#f4f6f8;padding:20px">

<table width="700" align="center" style="background:#ffffff;border-collapse:collapse;border-radius:6px;overflow:hidden">

<!-- HEADER -->
<tr>
<td style="background:#1f4e79;padding:15px;color:white;font-size:18px;font-weight:bold">
HIS System Notification
</td>
</tr>

<!-- BODY -->
<tr>
<td style="padding:20px;color:#333;font-size:14px">

<p>Dear H&I Manager,</p>

<p>Good day.</p>

<p>
Please be informed that an <b>IP admission</b> has been recorded under your TR location.
The details are provided below. Kindly visit the member and do the needful.
</p>

<table width="100%" style="border-collapse:collapse;margin-top:15px">

<tr style="background:#e9eff7">
<th style="border:1px solid #d0d7e2;padding:10px;text-align:left">Field</th>
<th style="border:1px solid #d0d7e2;padding:10px;text-align:left">Details</th>
</tr>

<tr>
<td style="border:1px solid #d0d7e2;padding:8px"><b>Date of Admission</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.dateOfAdmission || "-"}</td>
</tr>

<tr style="background:#fafafa">
<td style="border:1px solid #d0d7e2;padding:8px"><b>Hospital Name</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.hospitalName || "-"}</td>
</tr>

<tr>
<td style="border:1px solid #d0d7e2;padding:8px"><b>Employee No</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.empNo || "-"}</td>
</tr>

<tr style="background:#fafafa">
<td style="border:1px solid #d0d7e2;padding:8px"><b>Employee Name</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.employeeName || "-"}</td>
</tr>

<tr>
<td style="border:1px solid #d0d7e2;padding:8px"><b>Emirates ID</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.emiratesId || "-"}</td>
</tr>

<tr style="background:#fafafa">
<td style="border:1px solid #d0d7e2;padding:8px"><b>Insurance ID</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.insuranceId || "-"}</td>
</tr>

<tr>
<td style="border:1px solid #d0d7e2;padding:8px"><b>Mobile Number</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.mobileNumber || "-"}</td>
</tr>

<tr style="background:#fafafa">
<td style="border:1px solid #d0d7e2;padding:8px"><b>TR Location</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.trLocation || "-"}</td>
</tr>

<tr>
<td style="border:1px solid #d0d7e2;padding:8px"><b>Nature of Case</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.natureOfCase || "-"}</td>
</tr>

<tr style="background:#fafafa">
<td style="border:1px solid #d0d7e2;padding:8px"><b>Case Category</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.caseCategory || "-"}</td>
</tr>

<tr>
<td style="border:1px solid #d0d7e2;padding:8px"><b>Remarks</b></td>
<td style="border:1px solid #d0d7e2;padding:8px">${payload.finalRemarks || "-"}</td>
</tr>

</table>

<p style="margin-top:25px">
Regards,<br>
<b>HIS System Notification</b>
</p>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="background:#f1f1f1;padding:10px;font-size:12px;color:#777;text-align:center">
Sobha Construction LLC • Health Information System
</td>
</tr>

</table>

</div>
`;

      await transporter.sendMail({
        from: "tabrez.hakimji@sobhaconst.com",
        to: managerEmail,
        subject: "IP Admission Notification",
        html: htmlTemplate,
      });
    }

    return res.status(201).json({
      success: true,
      data: populated,
    });

  } catch (err) {
    next(err);
  }
};
// Create a new hospital record
async function createHospitalOld(req, res, next) {
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
      } else if (req.user.role === 'ISD' || req.user.role === 'RCT') {
        q.handleBy = req.user.role;
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

// Get hospitals by user role (handleBy) with upcoming follow-up dates
async function getHospitalsByHandleBy(req, res, next) {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ 
        success: false, 
        message: 'User role not found' 
      });
    }

    const userRole = req.user.role;

    // Calculate date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 3);

    const hospitals = await Hospital.aggregate([
      {
        $match: {
          handleBy: userRole,
          'followUp.date': {
            $gte: today,
            $lt: dayAfterTomorrow
          }
        }
      },
      {
        $project: {
          id: '$_id',
          empNo: 1,
          employeeName: 1,
          mobileNumber: 1,
          hospitalName: 1,
          natureOfCase: 1,
          caseCategory: 1,
          followUp: {
            $filter: {
              input: '$followUp',
              as: 'visit',
              cond: {
                $and: [
                  { $gte: ['$$visit.date', today] },
                  { $lt: ['$$visit.date', dayAfterTomorrow] }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          nextFollowUpDate: {
            $min: '$followUp.date'
          }
        }
      },
      {
        $sort: { nextFollowUpDate: 1 }
      }
    ]);

    return res.json({
      success: true,
      count: hospitals.length,
      data: hospitals
    });
  } catch (err) {
    next(err);
  }
}

// Mark IRT notified = true
async function markIrtNotified(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;

    const updated = await Hospital.findByIdAndUpdate(
      id,
      { $set: { irtNotified: true } },
      { new: true, runValidators: true }
    ).populate([{ path: "createdBy", select: "name" }]);

    if (!updated) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    return res.json({
      success: true,
      message: "irtNotified set to true",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  createHospital,
  getHospitals,
  getHospitalById,
  updateHospital,
  deleteHospital,
  getHospitalsByUserLocation,
  getHospitalsByManagerLocation,
  getHospitalByEmployeeAndDate,
  importExcel,
  getHospitalsByHandleBy,
  markIrtNotified, // Add this
};
