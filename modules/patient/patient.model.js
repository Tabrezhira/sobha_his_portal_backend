// src/modules/patient/patient.model.js
import mongoose from 'mongoose';
import { legacyDb } from '../../config/db.js';

const PatientSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: true,
      unique: true, // ensures uniqueness
      index: true, // creates an index
      uppercase: true,
      match: /^[A-Z0-9]{6}$/ // 6 letters/numbers
    },
    PatientName: {
      type: String,
      required: true,
      trim: true
    },
    emiratesId: {
      type: String,
      default: null
    },
    insuranceId: {
      type: String,
      default: null
    },
    trLocation: {
      type: String,
      default: null
    },
    mobileNumber: {
      type: String,
      default: null,
      validate: {
        validator: function (v) {
          return v == null || /^[0-9]{10,15}$/.test(v);
        },
        message: props => `${props.value} is not a valid mobile number!`
      }
    },

  },
);

// Fallback to regular mongoose.model if legacyDb is not configured
const Patient = legacyDb ? legacyDb.model('Patient', PatientSchema) : mongoose.model('Patient', PatientSchema);

export default Patient;
