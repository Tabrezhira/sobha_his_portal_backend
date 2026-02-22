import mongoose from "mongoose";

const IsolationSchema = new mongoose.Schema({

  locationId: { type: String, index: true },

  clinicVisitToken: { type: String, index: true },

  empNo: { type: String, required: true, index: true, uppercase: true },
  type: { type: String },

  employeeName: { type: String, required: true, trim: true },

  emiratesId: { type: String, required: true },
  insuranceId: { type: String },

  mobileNumber: { type: String },
  trLocation: { type: String, index: true },

  isolatedIn: { type: String },
  isolationReason: { type: String },

  nationality: { type: String },

  slUpto: { type: String },

  dateFrom: { type: String },
  dateTo: { type: String },

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
