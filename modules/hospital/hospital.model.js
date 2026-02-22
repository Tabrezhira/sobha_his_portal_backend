import mongoose from "mongoose";

const HospitalSchema = new mongoose.Schema({

  locationId: { type: String, index: true },

  clinicVisitToken: { type: String, index: true },

  empNo: { type: String, required: true, index: true, uppercase: true },
  employeeName: { type: String, required: true, trim: true },

  emiratesId: { type: String, required: true, },
  insuranceId: { type: String },

  trLocation: { type: String },
  mobileNumber: { type: String },

  hospitalName: { type: String },

  dateOfAdmission: { type: Date },

  natureOfCase: { type: String },
  caseCategory: { type: String },

  primaryDiagnosis: { type: String },
  secondaryDiagnosis: [{ type: String }],

  status: {
    type: String,
  },

  dischargeSummaryReceived: {
    type: Boolean,
    default: false,
  },

  dateOfDischarge: { type: Date },

  daysHospitalized: { type: Number },

  followUp: [{
    date: { type: Date },
    remarks: { type: String }
  }],

  fitnessStatus: {
    type: String,
  },

  isolationRequired: {
    type: Boolean,
    default: false,
  },

  finalRemarks: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
},

);


export default mongoose.model('Hospital', HospitalSchema);
