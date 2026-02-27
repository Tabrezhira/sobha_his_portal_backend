import mongoose from "mongoose";

const dailyTokenCounterSchema = new mongoose.Schema({
    locationId: { type: String, required: true },
    dateKey: { type: String, required: true }, // format: YYYY-MM-DD
    seq: { type: Number, default: 0 },
}, { timestamps: true });

dailyTokenCounterSchema.index({ locationId: 1, dateKey: 1 }, { unique: true });

const DailyTokenCounter = mongoose.model("DailyTokenCounter", dailyTokenCounterSchema);

export default DailyTokenCounter;