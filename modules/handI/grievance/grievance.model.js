import mongoose from "mongoose";

const GrievanceSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    employeeId: {
        type: String,
        required: true
    },
    employeeName: {
        type: String,
        required: true
    },
    insuranceID: {
        type: String,
        required: true
    },
    trLocation: {
        type: String,
        required: true
    },
    Manager: {
        type: String,
        required: true
    },
    employeeMobile: {
        type: String,
        required: true
    },
    sourceOfGrievance: {
        type: String,
        required: true
    },
    grievanceRemarks: {
        type: String
    },
    typeOfIssue: {
        type: String,
        required: true
    },
    issueDate: {
        type: Date,
        required: true
    },
    closedDate: {
        type: Date
    },
    tatMins: {
        type: Number
    },
    slaTatMins: {
        type: Number
    },
    status: {
        type: String,
        default: 'Open'
    },
    rootCause: {
        type: String
    },
    correctiveAction: {
        type: String
    },
    correctiveActionStatus: {
        type: String,
    },
    preventiveAction: {
        type: String
    },
    preventiveActionStatus: {
        type: String,
    },
    responsibility: {
        type: String
    },
    remarks: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model("Grievance", GrievanceSchema);
