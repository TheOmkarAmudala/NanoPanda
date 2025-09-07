import SuspiciousUser from "../models/SuspiciousUser.js";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs-core";
import fs from "fs/promises";
import sharp from "sharp";

// Use the pure JavaScript CPU backend to avoid native module issues.
tf.setBackend('cpu');

// === Model Loading: Load once when the server starts ===
let faceModel;
let mobilenetModel;

async function loadModels() {
    try {
        console.time("Total Model Loading");
        console.log("Loading TensorFlow.js models...");
        faceModel = await blazeface.load();
        mobilenetModel = await mobilenet.load();
        console.log("All models loaded successfully!");
        console.timeEnd("Total Model Loading");
    } catch (err) {
        console.error("Failed to load models:", err);
        throw new Error("Application cannot start due to model loading failure.");
    }
}

// Initialize backend and models
async function initialize() {
    await loadModels();
}
initialize().catch((err) => {
    console.error("Initialization failed:", err);
    process.exit(1);
});

// A threshold to determine if two embeddings are a "match" (0.85 is a common value)
const SIMILARITY_THRESHOLD = 0.85;

/**
 * Calculate the cosine similarity between two embedding vectors.
 * @param {number[]} vec1
 * @param {number[]} vec2
 * @returns {number} The similarity score.
 */
function cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
        return 0; // Return 0 for non-comparable vectors
    }
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Generate an embedding for a cropped face using MobileNet.
 * @param {Buffer} imageBuffer - Buffer of the image file.
 * @returns {Promise<number[]>} - A promise that resolves with the embedding vector.
 */
async function generateFaceEmbedding(imageBuffer) {
    let decodedImage;
    let info;
    try {
        const sharpResult = await sharp(imageBuffer)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        info = sharpResult.info;
        decodedImage = tf.tensor3d(new Uint8Array(sharpResult.data), [info.height, info.width, 3]);
    } catch (err) {
        console.error("Image decoding error:", err);
        throw new Error("Failed to decode the uploaded image. Please ensure it's a valid format.");
    }

    let predictions;
    try {
        predictions = await faceModel.estimateFaces(decodedImage);
    } catch (err) {
        console.error("BlazeFace model error:", err);
        throw new Error("Failed to run the face detection model.");
    } finally {
        if (decodedImage) decodedImage.dispose();
    }

    if (!predictions || predictions.length === 0) {
        throw new Error("No face detected in the image.");
    }

    const start = predictions[0].topLeft;
    const end = predictions[0].bottomRight;
    const size = [end[0] - start[0], end[1] - start[1]];
    const left = Math.max(0, Math.round(start[0]));
    const top = Math.max(0, Math.round(start[1]));
    const width = Math.min(info.width - left, Math.round(size[0]));
    const height = Math.min(info.height - top, Math.round(size[1]));

    let croppedImageTensor;
    try {
        const croppedBufferResult = await sharp(imageBuffer)
            .extract({ left, top, width, height })
            .resize(224, 224, { fit: "fill" })
            .raw()
            .toBuffer({ resolveWithObject: true });

        croppedImageTensor = tf.tensor3d(
            new Uint8Array(croppedBufferResult.data),
            [croppedBufferResult.info.height, croppedBufferResult.info.width, 3]
        );
    } catch (err) {
        console.error("Image cropping error:", err);
        throw new Error("Failed to crop the face from the image.");
    }

    let embedding;
    try {
        embedding = mobilenetModel.infer(croppedImageTensor, true);
        return embedding.arraySync()[0];
    } catch (err) {
        console.error("MobileNet embedding error:", err);
        throw new Error("Failed to run the embedding model.");
    } finally {
        if (croppedImageTensor) croppedImageTensor.dispose();
    }
}

/**
 * The main authentication function.
 */
export const authenticateUser = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image uploaded for authentication" });
        }

        console.log("Authenticating image:", req.file.filename);

        // Generate embedding for the new photo
        const imageBuffer = await fs.readFile(`uploads/${req.file.filename}`);
        const newEmbedding = await generateFaceEmbedding(imageBuffer);

        // Find similar users in the database
        const suspiciousUsers = await SuspiciousUser.find({});
        let foundUser = null;
        let highestSimilarity = 0;

        for (const user of suspiciousUsers) {
            const similarity = cosineSimilarity(newEmbedding, user.embedding);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                if (similarity >= SIMILARITY_THRESHOLD) {
                    foundUser = user;
                }
            }
        }

        // Handle results
        if (foundUser) {
            console.log("Match found with user ID:", foundUser._id);
            foundUser.suspiciousCount += 1;
            foundUser.lastDetectedAt = new Date();
            await foundUser.save();
            res.status(200).json({
                message: "Suspicious user detected again",
                user: foundUser,
                similarity: highestSimilarity
            });
        } else {
            console.log("New suspicious user detected.");
            const newSuspiciousUser = new SuspiciousUser({
                filename: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                embedding: newEmbedding,
                isLegit: false, // Default to false for new users
            });
            await newSuspiciousUser.save();
            res.status(201).json({
                message: "New suspicious user added to database",
                user: newSuspiciousUser
            });
        }

    } catch (err) {
        console.error("Authentication failed:", err.message);
        res.status(500).json({ message: "Authentication failed", error: err.message });
    }
};

/**
 * Get all suspicious users.
 */
export const getSuspiciousUsers = async (req, res) => {
    try {
        const users = await SuspiciousUser.find().sort({ suspiciousCount: -1 });
        res.status(200).json(users);
    } catch (err) {
        console.error("Failed to fetch suspicious users:", err.message);
        res.status(500).json({ message: "Failed to fetch suspicious users", error: err.message });
    }
};
