import mongoose from "mongoose";

const rctVitalSchema = new mongoose.Schema(
{
rctId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RCT',
    required: true
  },
  date: {
    type: Date,
    required: true
  },

  time: {
    type: String
  },

  employeeId: {
    type: String,
    required: true
  },

  name: {
    type: String
  },

  bp: {
    type: String
  },

  temp: {
    type: Number
  },

  patientFeedbackGrievance: {
    type: String
  },

  feedbackGrievanceStatus: {
    type: String,
   
  },

  feedbackGrievanceActionTaken: {
    type: String
  },

  patientStatus: {
    type: String,

  },

  remarks: {
    type: String
  }

},
{ timestamps: true }
);

export default mongoose.model('RCTVital', rctVitalSchema);