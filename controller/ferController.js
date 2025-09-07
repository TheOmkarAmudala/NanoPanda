import { FerLog } from '../models/FerLog.js';
import * as faceapi from 'face-api.js';
import canvas from 'canvas';
import fs from 'fs';
import path from 'path';
import * as tf from '@tensorflow/tfjs-node';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
await tf.ready();

// Path to your downloaded face-api.js weights
const MODEL_PATH = path.resolve('./face-api.js/weights');

// Load models at startup
export const loadFaceApiModels = async () => {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH); // face detection
        await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_PATH); // emotion
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH); // face recognition (for embeddings)
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH); // landmarks (required for face recognition)
        console.log("✔️ Face-api.js models loaded successfully!");
    } catch (err) {
        console.error("❌ Failed to load face-api.js models:", err.message);
        throw err;
    }
};

// Immediately load models when this module is imported.
(async () => {
    try {
        await loadFaceApiModels();
    } catch (err) {
        // Exit the process if models fail to load, as the app is unusable.
        process.exit(1);
    }
})();

// Predict emotion from uploaded image
export const predictEmotion = async (req, res) => {
    try {
        const photoFile = req.file;

        if (!photoFile) {
            return res.status(400).json({ message: "No photo file uploaded." });
        }

        // Load image
        const img = await canvas.loadImage(photoFile.path);
        console.log('Image loaded:', img.width, img.height);

        // Clean up the uploaded file
        fs.unlinkSync(photoFile.path);

        // Detect face, landmarks, expressions, and descriptor
        const detections = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceExpressions()
            .withFaceDescriptor();

        if (!detections) {
            return res.status(400).json({ message: "No face detected in the image." });
        }

        // Get expressions
        const expressions = detections.expressions;
        const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
        const [predictedEmotion, confidence] = sorted[0];

        // Get embedding (face descriptor)
        const embedding = detections.descriptor;

        console.log(`✔️ Emotion predicted: ${predictedEmotion} (${confidence.toFixed(2)})`);
        console.log('Embedding length:', embedding.length, 'Non-zero elements:', embedding.filter(x => x !== 0).length);

        res.status(200).json({
            message: "Emotion predicted successfully.",
            predicted_emotion: predictedEmotion,
            all_scores: expressions,
            embedding: embedding // Include embedding for debugging
        });

    } catch (err) {
        console.error("❌ Error in predictEmotion:", err.message, err.stack);
        res.status(500).json({ message: "Failed to process image and make prediction.", error: err.message });
    }
};
// Log emotion prediction to DB (optional, can be called from frontend)
export const logPrediction = async (userId, emotionData) => {
    try {
        const newLog = new FerLog({
            user_id: userId,
            image_path: emotionData.imagePath,
            predicted_emotion: emotionData.predicted_emotion,
            emotion_scores: emotionData.all_scores,
        });
        await newLog.save();
        console.log(`✔️ Prediction logged for user: ${userId}`);
    } catch (err) {
        console.error("❌ Failed to save log:", err.message);
    }
};
