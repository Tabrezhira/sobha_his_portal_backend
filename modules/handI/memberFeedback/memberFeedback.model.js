import mongoose from "mongoose";

const memberFeedback = new mongoose.Schema(
  {
    employeeId: { type: String, index: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "ClinicVisit" },
    manager: { type: String },
    dateOfCall: { type: Date },
    wasTreatmentEffective: { type: Boolean },
    technicianFeedback: { type: String },
    wasTreatmentEffective1: { type: Boolean },
    technicianFeedback1: { type: String },
    refReqToSpecialist: { type: Boolean },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MEMBER_FEEDBACK", memberFeedback);
