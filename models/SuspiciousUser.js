import mongoose from "mongoose";

const suspiciousUserSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    path: { type: String, required: true },
    embedding: { type: [Number], required: true },
    suspiciousCount: { type: Number, default: 1 },
    isLegit: { type: Boolean, default: false },
    firstDetectedAt: { type: Date, default: Date.now },
    lastDetectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Check if the model is already compiled before defining it again.
const SuspiciousUser = mongoose.models.SuspiciousUser || mongoose.model('SuspiciousUser', suspiciousUserSchema);

export default SuspiciousUser;
