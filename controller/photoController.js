import Photo from "../models/user.js";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs-core";
import * as tfBackendCPU from "@tensorflow/tfjs-backend-cpu"; // required so CPU backend registers
import fs from "fs/promises";
import sharp from "sharp";
import async from "async"; // CommonJS package - use default import

// ✅ Create a processing queue (1 task at a time)
const { queue } = async;
const processingQueue = queue(async (task, done) => {
    try {
        await task();
    } catch (err) {
        console.error("Queue task failed:", err);
    }
    done();
}, 1);

// Push tasks into queue
function pushToQueue(fn) {
    processingQueue.push(async () => {
        await fn();
    });
}

// Register CPU backend
async function initializeBackend() {
    try {
        await tf.setBackend("cpu");
        await tf.ready();
    } catch (err) {
        await logError(err, "backend-initialization");
        throw new Error("Failed to initialize TensorFlow.js CPU backend");
    }
}

// Load models
let faceModel;
let mobilenetModel;

async function loadModels() {
    try {
        faceModel = await blazeface.load();
        mobilenetModel = await mobilenet.load();
    } catch (err) {
        await logError(err, "model-loading");
        throw new Error("Application cannot start due to model loading failure.");
    }
}

// Initialize backend + models
async function initialize() {
    await initializeBackend();
    await loadModels();
}
initialize().catch((err) => {
    logError(err, "initialization").then(() => process.exit(1));
});

/**
 * Log errors to a file for debugging.
 */
async function logError(error, filePath) {
    try {
        await fs.appendFile(
            "errors.log",
            `${new Date().toISOString()} - ${filePath}: ${error.message}\n`
        );
    } catch {
        // ignore logging errors
    }
}

/**
 * Generate an embedding for a cropped face using MobileNet.
 */
async function generateFaceEmbedding(filePath) {
    let imageBuffer;
    try {
        imageBuffer = await fs.readFile(filePath);
    } catch (err) {
        await logError(err, filePath);
        throw new Error(`Failed to read image file from path: ${filePath}`);
    }

    let decodedImage;
    let info;
    try {
        const sharpResult = await sharp(imageBuffer)
            .resize({ width: 320, height: 240, fit: "inside" })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        info = sharpResult.info;
        decodedImage = tf.tensor3d(new Uint8Array(sharpResult.data), [
            info.height,
            info.width,
            3,
        ]);
    } catch (err) {
        await logError(err, filePath);
        throw new Error("Failed to decode the uploaded image.");
    }

    let predictions;
    try {
        predictions = await faceModel.estimateFaces(decodedImage);
    } catch (err) {
        await logError(err, filePath);
        throw new Error("Failed to run the face detection model.");
    } finally {
        if (decodedImage) decodedImage.dispose();
    }

    if (!predictions || predictions.length === 0) {
        await logError(new Error("No face detected"), filePath);
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
        await logError(err, filePath);
        throw new Error("Failed to crop the face from the image.");
    }

    try {
        const embedding = mobilenetModel.infer(croppedImageTensor, true);
        const embeddingArray = embedding.arraySync()[0];
        return embeddingArray;
    } catch (err) {
        await logError(err, filePath);
        throw new Error("Failed to run the embedding model.");
    } finally {
        if (croppedImageTensor) croppedImageTensor.dispose();
    }
}

/**
 * Process photo in the background and save to database.
 */
async function processPhotoInBackground(filePath, photoData) {
    pushToQueue(async () => {
        try {
            const embedding = await generateFaceEmbedding(filePath);
            const newPhoto = new Photo({
                filename: photoData.filename,
                path: photoData.path,
                embedding: embedding,
            });
            await newPhoto.save();
            console.log("✅ Saved photo:", newPhoto._id);
        } catch (err) {
            await logError(err, filePath);
        }
    });
}

/**
 * Upload photo + trigger background processing.
 */
export const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No photo uploaded" });
        }

        const filePath = `uploads/${req.file.filename}`;
        const photoData = {
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
        };

        await fs.readFile(filePath); // just to confirm file exists

        res.status(202).json({
            message: "Image received, processing started",
            filename: req.file.filename,
        });

        processPhotoInBackground(filePath, photoData);
    } catch (err) {
        await logError(err, req.file?.filename || "unknown");
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
};

/**
 * Get all photos.
 */
export const getPhotos = async (req, res) => {
    try {
        const photos = await Photo.find().sort({ uploadedAt: -1 });
        res.status(200).json(photos);
    } catch (err) {
        await logError(err, "get-photos");
        res.status(500).json({ message: "Failed to fetch photos", error: err.message });
    }
};

/**
 * Get single photo by ID.
 */
export const getPhotoById = async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }
        res.status(200).json(photo);
    } catch (err) {
        await logError(err, `photo-${req.params.id}`);
        res.status(500).json({ message: "Error fetching photo", error: err.message });
    }
};
