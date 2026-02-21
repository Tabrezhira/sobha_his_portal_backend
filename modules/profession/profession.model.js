import mongoose from "mongoose";
import { legacyDb } from '../../config/db.js';

const ProfessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
  },
});

// 🚀 FAST for autocomplete
ProfessionSchema.index({ category: 1, name: 1 });

const Profession = legacyDb ? legacyDb.model("Profession", ProfessionSchema) : mongoose.model("Profession", ProfessionSchema);
export default Profession;
