import mongoose from "mongoose";

const ClinicVisitSchema = new mongoose.Schema(
  {
    locationId: { type: String, index: true },

    date: { type: Date, index: true },
    time: { type: String, },

    empNo: { type: String, index: true, uppercase: true },
    employeeName: { type: String, trim: true, },
    dateOfJoining: { type: String},
    eligibilityForSickLeave: { type: Boolean },
    emiratesId: {
      type: String,
    },

    insuranceId: { type: String, },
    trLocation: { type: String, index: true },
    mobileNumber: { type: String, },

    natureOfCase: { type: String, },
    caseCategory: { type: String, },

    nurseAssessment: [{ type: String }],
    symptomDuration: { type: String },

    temperature: { type: String },
    bloodPressure: { type: String },
    heartRate: { type: String },

    others: { type: String },

    tokenNo: { type: String, index: true },
    sentTo: { type: String },
    providerName: { type: String },

    doctorName: { type: String },

    primaryDiagnosis: { type: String },
    secondaryDiagnosis: [{ type: String }],

    // MEDICINE (array of objects – still same schema)
    medicines: [
      {
        name: { type: String },
        course: { type: String },
        expiryDate: { type: Date },
      },
    ],

    // SICK LEAVE
    sickLeaveStatus: {
      type: String,
      index: true,
    },
    sickLeaveStartDate: { type: Date },
    sickLeaveEndDate: { type: Date },
    totalSickLeaveDays: { type: String },
    remarks: { type: String },
    referral: { type: Boolean, index: true },
    referralCode: { type: String },
    referralType: { type: String },
    referredToHospital: { type: String },
    visitDateReferral: { type: Date },
    specialistType: { type: String },
    doctorNameReferral: { type: String }, // Renamed to avoid collision with top-level doctorName if we flatten
    investigationReports: { type: String },
    primaryDiagnosisReferral: { type: String },
    secondaryDiagnosisReferral: [{ type: String }],
    nurseRemarksReferral: { type: String },
    insuranceApprovalRequested: { type: Boolean, default: false },
    followUpRequired: { type: Boolean, default: false },
    followUpVisits: [
      {
        visitDate: { type: Date },
        visitRemarks: { type: String },
      },
    ],


    visitStatus: {
      type: String,
      uppercase: true,
      index: true,
    },

    finalRemarks: { type: String },
    ipAdmissionRequired: { type: Boolean, default: false },


    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    }
  }
);

export default mongoose.model("ClinicVisit", ClinicVisitSchema);
