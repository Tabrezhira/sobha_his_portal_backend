import mongoose from "mongoose";

const IsolationSchema = new mongoose.Schema({

  locationId: { type: String, index: true },

  clinicVisitToken: { type: String, index: true },

  empNo: { type: String, required: true, index: true, uppercase: true },
  type: { type: String },

  employeeName: { type: String, required: true, uppercase: true },

  emiratesId: { type: String },
  insuranceId: { type: String },

  mobileNumber: { type: String },
  trLocation: { type: String, index: true },

  isolatedIn: { type: String },
  isolationReason: { type: String },

  nationality: { type: String },

  slUpto: { type: String },

  dateFrom: { type: Date },
  dateTo: { type: Date },

  currentStatus: {
    type: String,
    index: true,
  },

  remarks: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
},

);


export default mongoose.model('Isolation', IsolationSchema);
