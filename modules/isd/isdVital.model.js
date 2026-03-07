import mongoose from "mongoose";

const isdVitalSchema = new mongoose.Schema(
{
isdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Isolation',
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

export default mongoose.model('IsdVital', isdVitalSchema);