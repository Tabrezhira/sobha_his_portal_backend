import ExcelJS from "exceljs";
import fs from "fs";
// import Profession from "./profession.model.js";



// GET all unique categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Profession.distinct("category", { category: { $ne: null, $ne: "" } });
    res.json({ success: true, data: categories.filter(Boolean).sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
import XLSX from "xlsx";
import Profession from "./profession.model.js";

// GET dropdown / autofill
// export const getProfessions = async (req, res) => {
//   try {
//     const {
//       search = "",
//       category,
//       page = 1,
//       limit = 20,
//     } = req.query

//     const skip = (Number(page) - 1) * Number(limit)

//     const query = {}

//     // category filter (VERY important for speed)
//     if (category) {
//       query.category = category
//     }

//     // optimized search (starts-with)
//     if (search) {
//       query.name = { $regex: `^${search}`, $options: "i" }
//     }

//     const [data, total] = await Promise.all([
//       Profession.find(query)
//         .select("name category")
//         .sort({ name: 1 })
//         .skip(skip)
//         .limit(Number(limit))
//         .lean(), // 🚀 faster
//       Profession.countDocuments(query),
//     ])

//     res.json({
//       success: true,
//       total,
//       page: Number(page),
//       limit: Number(limit),
//       data,
//     })
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message })
//   }
// }

export const getProfessions = async (req, res) => {
  try {
    const { search = "", category, limit = 10 } = req.query;

    if (!search) {
      return res.json({ success: true, data: [], count: 0 });
    }

    // Split user input into words
    const words = search
      .trim()
      .split(/\s+/)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // escape regex

    // Build regex for each word (case-insensitive)
    const regexes = words.map(w => new RegExp(w, "i"));

    const query = {
      name: { $all: regexes }, // all words must match
    };

    if (category) query.category = category;

    const data = await Profession.find(query)
      .select("name category")
      .sort({ name: 1 })
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST create single profession
export const createProfession = async (req, res) => {
  try {
    const profession = await Profession.create(req.body);
    res.status(201).json({ success: true, data: profession });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST upload excel

export const uploadExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const BATCH_SIZE = 20000; // bigger batch = faster
  let batch = [];
  let insertedCount = 0;

  try {
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(
      fs.createReadStream(req.file.path)
    );

    for await (const worksheet of workbookReader) {
      let headers = {};

      for await (const row of worksheet) {
        // Header row
        if (row.number === 1) {
          row.eachCell((cell, colNumber) => {
            headers[colNumber] = String(cell.value).trim().toLowerCase();
          });
          continue;
        }

        let name = "";
        let category = "";

        row.eachCell((cell, colNumber) => {
          if (headers[colNumber] === "name") {
            name = String(cell.value || "").trim();
          }
          if (headers[colNumber] === "category") {
            category = String(cell.value || "").trim();
          }
        });

        if (!name) continue;

        batch.push({ name, category });

        if (batch.length === BATCH_SIZE) {
          await Profession.insertMany(batch); // 🔥 NO ordered:false
          insertedCount += batch.length;
          batch = [];
        }
      }
    }

    // insert remaining
    if (batch.length) {
      await Profession.insertMany(batch);
      insertedCount += batch.length;
    }

    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: "Excel uploaded successfully",
      totalInserted: insertedCount,
    });
  } catch (error) {
    console.error(error);

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
};

// GET complete list by category name
export const getListByCategory = async (req, res) => {
  try {
    const { categoryName } = req.params;

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const data = await Profession.find({
      category: { $regex: `^${categoryName}$`, $options: "i" },
    })
      .select("name category")
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      category: categoryName,
      count: data.length,
      data: data.map((item) => item.name),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
