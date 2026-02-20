import mongoose from "mongoose";

const CASE_RESOLUTION_TRACKER = new mongoose.Schema(
  {
    locationId: { type: String, index: true },
    date: { type: Date, required: true },
    empId: { type: String, required: true },
    empName: { type: String, required: true },
    insuranceID: { type: String, required: true },
    trLocation: { type: String, required: true },
    MANAGER: { type: String, required: true },
    empMobileNo: { type: String, required: true },
    TypeOfAdmission: { type: String, required: true },
    insuranceType: { type: String, required: true },
    providerName: { type: String, required: true },
    issue: { type: String, required: true },
    typeOfIssue: { type: String, required: true },
    issueDate: { type: Date, required: true },
    closedDate: { type: Date },
    TAT: { type: Number },
    slaTAT: { type: Number },
    status: { type: String },
    rootCause: { type: String },
    correctiveAction: { type: String },
    correctiveActionStatus: { type: String },
    preventiveAction: { type: String },
    preventiveActionStatus: { type: String },
    responsibility: { type: String },
    remarks: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("CASE_RESOLUTION_TRACKER", CASE_RESOLUTION_TRACKER);
