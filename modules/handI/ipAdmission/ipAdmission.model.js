import mongoose from "mongoose";



const technicianVisitSchema = new mongoose.Schema({
  technicianFeedback: { type: String },
  physicianFeedback: { type: String },
}, { _id: false });

const ipAdmissionSchema = new mongoose.Schema(
  {
    empNo: { type: String, required: true, index: true, uppercase: true },
    dateOfAdmission: { type: Date },
    hospitalName: { type: String },
    trLocation: { type: String },
    hospitalCase: {
      ref: "Hospital",
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    hiManagers: { type: String },

    admissionMode: { type: String },
    admissionType: { type: String },

    insuranceApprovalStatus: {
      type: String,
    },

    treatmentUndergone: { type: String },

    imVisitStatus: { type: String },
    noOfVisits: { type: Number },

    technicianVisits: [technicianVisitSchema],

    treatmentLocation: { type: String },
    placeOfLocation: { type: String },
    postRecoveryLocation: { type: String },

    fitToTravel: { type: Boolean },
    postRehabRequired: { type: Boolean },
    durationOfRehab: { type: Number },

    followUpRequired: { type: Boolean },
    rehabExtension: { type: Boolean },
    rehabExtensionDuration: { type: Number },

    memberResumeToWork: { type: Date },

    technicianFeedbackForm: { type: String },

    dischargedHI: { type: Boolean },
    dodHI: { type: Date },

    source: { type: String },
    caseTypeChange: { type: String },
    dischargeComments: { type: String },
    caseTypeChangeComments: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("IpAdmission", ipAdmissionSchema);
