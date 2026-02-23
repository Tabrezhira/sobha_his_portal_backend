import EmpDoj from './empDoj.model.js';
import XLSX from 'xlsx';
import fs from 'fs';

// Create emp DOJ record
async function createEmpDoj(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const payload = req.body || {};
    if (payload.createdBy) delete payload.createdBy;
    if (payload.empNo) payload.empNo = String(payload.empNo).toUpperCase();

    payload.createdBy = req.user._id;

    const item = new EmpDoj(payload);
    const saved = await item.save();
    const populated = await saved.populate([{ path: 'createdBy', select: 'name' }]);
    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
}

// List emp DOJ records with filters + pagination
async function getEmpDojRecords(req, res, next) {
  try {
    const { page = 1, limit = 20, empNo, dateFrom, dateTo } = req.query;
    const q = {};

    if (empNo) q.empNo = String(empNo).toUpperCase();

    if (dateFrom || dateTo) {
      q.doj = {};
      if (dateFrom) q.doj.$gte = new Date(dateFrom);
      if (dateTo) q.doj.$lte = new Date(dateTo);
    }

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const [total, items] = await Promise.all([
      EmpDoj.countDocuments(q),
      EmpDoj.find(q)
        .sort({ doj: -1, _id: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate([{ path: 'createdBy', select: 'name' }]),
    ]);

    return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
  } catch (err) {
    next(err);
  }
}

// Get by id
async function getEmpDojById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await EmpDoj.findById(id).populate([{ path: 'createdBy', select: 'name' }]);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

// Get leave eligibility by empNo
async function getLeaveEligibilityByEmpNo(req, res, next) {
  try {
    const empNo = String(req.params.empNo || '').toUpperCase().trim();
    if (!empNo) {
      return res.status(400).json({ success: false, message: 'empNo is required' });
    }

    const item = await EmpDoj.findOne({ empNo })
      .sort({ doj: -1, _id: -1 })
      .select('empNo sl al el lop');

    if (!item) return res.status(404).json({ success: false, message: 'Not found' });

    const sl = Number(item.sl || 0);
    const al = Number(item.al || 0);
    const el = Number(item.el || 0);
    const lop = Number(item.lop || 0);

    const eligible = sl === 0 && al === 0 && el === 0 && lop === 0;

    return res.json({
      success: true,
      data: {
        empNo: item.empNo,
        doj: item.doj,
        leave: eligible ? 'eligible' : 'Not eligible',
      },
    });
  } catch (err) {
    next(err);
  }
}

// Update
async function updateEmpDoj(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { id } = req.params;
    const payload = { ...req.body };
    if (payload.createdBy) delete payload.createdBy;
    if (payload.empNo) payload.empNo = String(payload.empNo).toUpperCase();

    let updated = await EmpDoj.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    updated = await updated.populate([{ path: 'createdBy', select: 'name' }]);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// Delete
async function deleteEmpDoj(req, res, next) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { id } = req.params;
    let deleted = await EmpDoj.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    deleted = await deleted.populate([{ path: 'createdBy', select: 'name' }]);
    return res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
}

// Import EmpDoj records from Excel

async function importEmpDojExcel(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty or invalid' });
    }

    const normalizeKey = (k) => String(k).toLowerCase().replace(/\s+|\.|\(|\)|\/|-/g, '');
    const fieldMap = {
      empno:     'empNo',
      doj:       'doj',
      sllast3m:  'sl',
      allast6m:  'al',
      ellast6m:  'el',
      loplast3m: 'lop',
    };

    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date && !isNaN(val.getTime())) {
        return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
      }
      const str = String(val).trim();
      if (!str) return null;
      const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
      if (match) {
        const day   = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        let year    = parseInt(match[3], 10);
        if (year < 100) year = 2000 + year;
        return new Date(Date.UTC(year, month, day));
      }
      return null;
    };

    const bulkOps = [];
    let skipped = 0;

    for (const rawRow of rows) {
      const row = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const mapped = fieldMap[normalizeKey(key)];
        if (mapped) row[mapped] = value;
      }

      const empNo = String(row.empNo || '').toUpperCase().trim();
      if (!empNo) { skipped++; continue; }

      bulkOps.push({
        updateOne: {
          filter: { empNo },
          update: { $set: {
            empNo,
            doj: parseDate(row.doj),
            sl:  row.sl  === '' ? undefined : Number(row.sl),
            al:  row.al  === '' ? undefined : Number(row.al),
            el:  row.el  === '' ? undefined : Number(row.el),
            lop: row.lop === '' ? undefined : Number(row.lop),
          }},
          upsert: true,
        },
      });
    }

    // ---- batch into chunks of 100 ----
    const CHUNK_SIZE = 1000;
    let processed = 0;

    for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
      const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
      await EmpDoj.bulkWrite(chunk, { ordered: false });
      processed += chunk.length;
      console.log(`Inserted chunk ${Math.ceil((i + 1) / CHUNK_SIZE)}: ${processed}/${bulkOps.length}`);
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${processed} records. Skipped: ${skipped}`,
      count: processed,
      skipped,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
}
export default {
  createEmpDoj,
  getEmpDojRecords,
  getEmpDojById,
  getLeaveEligibilityByEmpNo,
  updateEmpDoj,
  deleteEmpDoj,
  importEmpDojExcel,
};