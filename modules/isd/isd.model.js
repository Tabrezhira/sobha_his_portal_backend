import mongoose from "mongoose";


const isolationSchema = new mongoose.Schema({
  hospitalId: {
    type: String
  },
  clinicId: {
    type: String
  },
  isdDays: {
    type: Number
  },
  type: {
    type: String
  },
  subType: {
    type: String
  },
  category: {
    type: String
  },
  severity: {
    type: String
  },
  empNo: {
    type: String
  },
  employeeName: {
    type: String
  },
  emiratesId: {
    type: String
  },
  insuranceId: {
    type: String
  },
  mobileNumber: {
    type: String
  },
  nationality: {
    type: String
  },
  trLocationOrigin: {
    type: String
  },
  diagnosis: {
    type: String
  },

  isolationInDay: {
    type: Date
  },
  isolationOutDay: {
    type: Date
  },
  isolationInTime: {
    type: String
  },
  isolationOutTime: {
    type: String
  },

  slStartDate: {
    type: Date
  },
  slEndDate: {
    type: Date
  },
  totalSlDays: {
    type: Number
  },

  roomNumber: {
    type: String
  },
  bedNumber: {
    type: String
  },

  followUps: [
    {
      followUpDate: Date,
      remarks: String
    }
  ],

  currentStatus: {
    type: String,
  },
  new:{
    type: Boolean,
    default: true
  },
  remarks: {
    type: String
  },
    createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });


export default mongoose.model('isd', isolationSchema);