import mongoose from "mongoose";

const happinessSurveySchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            required: true,
            index: true,
        },
        time: {
            type: String,
            required: true,
        },
        empNo: {
            type: String,
            required: true,
            index: true,
            set: (value) => (typeof value === "string" ? value.toLowerCase() : value) 
        },
        empName: {
            type: String,
            required: true,
        },
        emiratesId: {
            type: String,
        },
        insuranceId: {
            type: String,
        },
        trLocation: {
            type: String,
        },
        surveyor: {
            type: String,
        },
        q1: { type: Number, min: 1, max: 5 },
        q2: { type: Number, min: 1, max: 5 },
        q3: { type: Number, min: 1, max: 5 },
        q4: { type: Number, min: 1, max: 5 },
        q5: { type: Number, min: 1, max: 5 },
        q6: { type: Number, min: 1, max: 5 },
        overallRating: {
            type: Number,
            min: 1,
            max: 5,
        },
        suggestion: {
            type: String,
        },
        happinessScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        photoUrl: {
            type: String,
        },
        signatureUrl: {
            type: String,
        },
        photoId: {
            type: String,
        },
        signatureId: {
            type: String,
        },
    },
    { timestamps: true }
);

export default mongoose.model("HappinessSurvey", happinessSurveySchema);
