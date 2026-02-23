
import mongoose from "mongoose";
import { legacyDb } from '../../config/db.js';

const empDojSchema = new mongoose.Schema(
  {
    empNo: { type: String, index: true, uppercase: true },
    doj: { type: Date },
    sl: { type: Number },
    al: { type: Number },
    el: { type: Number },
    lop: { type: Number },
  },
  { timestamps: true }
);

// const EmpDoj = legacyDb ? legacyDb.model['EmpDoj'] ?? mongoose.model('EmpDoj', empDojSchema) : mongoose.model('EmpDoj', empDojSchema);

// export default EmpDoj;
// Fallback to regular mongoose.model if legacyDb is not configured
const EmpDoj = legacyDb ? legacyDb.model('EmpDoj', empDojSchema) : mongoose.model('EmpDoj', empDojSchema);

export default EmpDoj;