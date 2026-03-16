import mongoose from "mongoose";

const rctSchema = new mongoose.Schema({
  hospitalId: String,
  type: String,
  subType: String,
  subTypeAuthority: String,
  paymentCategory: String,
  severity: String,
  diagnosis: String,
  employeeHealthStatus: String,
  rctDays: Number,
  empNo: String,
  employeeName: String,
  emiratesId: String,
  insuranceId: String,
  mobileNumber: String,
  nationality: String,

  siteLocation: String,

  injuryRecoveryInDay: Date,
  injuryRecoveryOutDay: Date,
  proposedRecoveryPeriodDays: Number,
  daysAdmitted: Number,
  injuryRecoveryInTime: String,
  injuryRecoveryOutTime: String,

  slStartDate: Date,
  slEndDate: Date,
  totalSlDays: Number,

  roomNumber: String,
  bedNumber: String,

  followUps: [
    {
      date: Date,
      time: String,
      hospitalOrClinic: String,
      bystander: String,
      remarks: String
    }
  ],

  employmentFitnessStatus: String,
  fitToFly: String,

  homeCountryRestStartDate: Date,
  homeCountryRestEndDate: Date,
  homeCountryContactDetails: String,

  employeeReturnDate: Date,

  recoveryStatus: String,
  finalStatus: String,
  remarks: String,

  new:{
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },

      file: [{
      fileUrl: String,
      publicId: String,
      fileName: String,
    }],
},{ timestamps: true });

const RCT = mongoose.model("RCT", rctSchema);

export default RCT;