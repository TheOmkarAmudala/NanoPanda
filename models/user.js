import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
    filename: String,
    path: String,
    embedding: { type: [Number] }, // array of numbers (vector)
    uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Photo", photoSchema);
