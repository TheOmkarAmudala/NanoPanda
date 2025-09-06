import Photo from "../models/user.js";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs-core";
import * as tfBackendCPU from "@tensorflow/tfjs-backend-cpu";
import fs from "fs/promises";
import sharp from "sharp";

// Register CPU backend
async function initializeBackend() {
    console.time("Initialize CPU Backend");
    console.log("Starting CPU backend initialization...");
    try {
        await tf.setBackend("cpu");
        await tf.ready();
        console.log("CPU backend initialized successfully");
    } catch (err) {
        console.error("Failed to initialize CPU backend:", err);
        throw new Error("Failed to initialize TensorFlow.js CPU backend");
    } finally {
        console.timeEnd("Initialize CPU Backend");
    }
}

// Load models with detailed timing
let faceModel;
let mobilenetModel;

async function loadModels() {
    try {
        console.time("Total Model Loading");

        console.time("Load BlazeFace Model");
        console.log("Starting BlazeFace model loading...");
        faceModel = await blazeface.load();
        console.log("BlazeFace model loaded");
        console.timeEnd("Load BlazeFace Model");

        console.time("Load MobileNet Model");
        console.log("Starting MobileNet model loading...");
        mobilenetModel = await mobilenet.load();
        console.log("MobileNet model loaded");
        console.timeEnd("Load MobileNet Model");

        console.log("All models loaded successfully!");
        console.timeEnd("Total Model Loading");
    } catch (err) {
        console.error("Failed to load models:", err);
        throw new Error("Application cannot start due to model loading failure.");
    }
}

// Initialize backend and models
async function initialize() {
    await initializeBackend();
    await loadModels();
}
initialize().catch((err) => {
    console.error("Initialization failed:", err);
    process.exit(1);
});

/**
 * Log errors to a file for debugging.
 * @param {Error} error - The error object.
 * @param {string} filePath - The image file path.
 */
async function logError(error, filePath) {
    try {
        await fs.appendFile(
            "errors.log",
            `${new Date().toISOString()} - ${filePath}: ${error.message}\n`
        );
    } catch (err) {
        console.error("Failed to log error to file:", err);
    }
}

/**
 * Generate an embedding for a cropped face using MobileNet.
 * @param {string} filePath - Path to the image file.
 * @returns {Promise<number[]>} - A promise that resolves with the embedding vector.
 */
async function generateFaceEmbedding(filePath) {
    console.time("Total Embedding Generation");
    console.log("Starting embedding generation for:", filePath);

    let imageBuffer;
    try {
        console.time("Read Image File");
        console.log("Reading image file...");
        imageBuffer = await fs.readFile(filePath);
        console.log("Image file read successfully, size:", imageBuffer.length, "bytes");
        console.timeEnd("Read Image File");
    } catch (err) {
        console.error("File system error:", err);
        await logError(err, filePath);
        throw new Error(`Failed to read image file from path: ${filePath}`);
    }

    let decodedImage;
    let info;
    try {
        console.time("Decode and Create Tensor");
        console.log("Decoding image and creating tensor...");
        const sharpResult = await sharp(imageBuffer)
            .resize({ width: 320, height: 240, fit: "inside" }) // Lower resolution for Render
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        info = sharpResult.info;
        console.log(`Image decoded: ${info.width}x${info.height}, channels: ${info.channels}`);

        decodedImage = tf.tensor3d(new Uint8Array(sharpResult.data), [
            info.height,
            info.width,
            3,
        ]);
        console.log("Tensor created");
        console.timeEnd("Decode and Create Tensor");
    } catch (err) {
        console.error("Image decoding error with sharp:", err);
        await logError(err, filePath);
        throw new Error("Failed to decode the uploaded image.");
    }

    let predictions;
    try {
        console.time("Face Detection");
        console.log("Running BlazeFace face detection...");
        predictions = await faceModel.estimateFaces(decodedImage);
        console.log(`Face detection completed, found ${predictions.length} faces`);
        console.timeEnd("Face Detection");
    } catch (err) {
        console.error("BlazeFace model error:", err);
        await logError(err, filePath);
        throw new Error("Failed to run the face detection model.");
    } finally {
        if (decodedImage) {
            console.log("Disposing decoded image tensor...");
            decodedImage.dispose();
            console.log("Decoded image tensor disposed");
        }
    }

    if (!predictions || predictions.length === 0) {
        console.warn("No face detected in the image.");
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
    console.log(`Face detected at: left=${left}, top=${top}, width=${width}, height=${height}`);

    let croppedImageTensor;
    try {
        console.time("Crop and Resize Image");
        console.log("Cropping and resizing face region...");
        const croppedBufferResult = await sharp(imageBuffer)
            .extract({ left, top, width, height })
            .resize(224, 224, { fit: "fill" })
            .raw()
            .toBuffer({ resolveWithObject: true });

        croppedImageTensor = tf.tensor3d(
            new Uint8Array(croppedBufferResult.data),
            [croppedBufferResult.info.height, croppedBufferResult.info.width, 3]
        );
        console.log("Cropped image tensor created");
        console.timeEnd("Crop and Resize Image");
    } catch (err) {
        console.error("Image cropping error:", err);
        await logError(err, filePath);
        throw new Error("Failed to crop the face from the image.");
    }

    let embedding;
    try {
        console.time("Generate Embedding");
        console.log("Running MobileNet embedding generation...");
        embedding = mobilenetModel.infer(croppedImageTensor, true);
        const embeddingArray = embedding.arraySync()[0];
        console.log("Embedding generated successfully, length:", embeddingArray.length);
        console.timeEnd("Generate Embedding");
        return embeddingArray;
    } catch (err) {
        console.error("MobileNet embedding error:", err);
        await logError(err, filePath);
        throw new Error("Failed to run the embedding model.");
    } finally {
        if (croppedImageTensor) {
            console.log("Disposing cropped image tensor...");
            croppedImageTensor.dispose();
            console.log("Cropped image tensor disposed");
        }
        console.timeEnd("Total Embedding Generation");
    }
}

/**
 * Process photo in the background and save to database.
 * @param {string} filePath - Path to the image file.
 * @param {Object} photoData - Data to save to the database.
 */
async function processPhotoInBackground(filePath, photoData) {
    try {
        console.log("Starting background processing for:", filePath);
        const embedding = await generateFaceEmbedding(filePath);

        console.time("Save to Database");
        console.log("Saving photo to database...");
        const newPhoto = new Photo({
            filename: photoData.filename,
            path: photoData.path,
            embedding: embedding, // Save embedding
        });

        await newPhoto.save();
        console.log("--> Photo saved to database:", newPhoto._id);
        console.timeEnd("Save to Database");
    } catch (err) {
        console.error("Background processing error:", err.message);
        await logError(err, filePath);
    }
}

/**
 * Upload photo + trigger background processing.
 */
export const uploadPhoto = async (req, res) => {
    console.time("Upload Photo Total");
    console.log("Received upload request at", new Date().toISOString());
    try {
        if (!req.file) {
            console.log("No file provided in request");
            return res.status(400).json({ message: "No photo uploaded" });
        }
        console.log("--> Received file:", req.file);
        console.log("--> Body:", req.body);

        const filePath = `uploads/${req.file.filename}`;
        const photoData = {
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
        };

        // Read file to ensure it’s accessible
        console.time("Read Image File for Validation");
        console.log("Validating image file...");
        await fs.readFile(filePath);
        console.log("Image file validated successfully");
        console.timeEnd("Read Image File for Validation");

        // Send early response to frontend
        res.status(202).json({
            message: "Image received, processing started",
            filename: req.file.filename,
        });
        console.log("Response sent to frontend");

        // Process in background
        processPhotoInBackground(filePath, photoData).catch((err) => {
            console.error("Background processing failed:", err.message);
            logError(err, filePath);
        });
    } catch (err) {
        console.error("--> Caught an error in uploadPhoto:", err.message);
        res.status(500).json({ message: "Upload failed", error: err.message });
    } finally {
        console.timeEnd("Upload Photo Total");
    }
};

/**
 * Get all photos.
 */
export const getPhotos = async (req, res) => {
    console.time("Get All Photos");
    console.log("Fetching all photos from database...");
    try {
        const photos = await Photo.find().sort({ uploadedAt: -1 });
        console.log(`Fetched ${photos.length} photos`);
        res.status(200).json(photos);
    } catch (err) {
        console.error("--> Caught an error in getPhotos:", err.message);
        res.status(500).json({ message: "Failed to fetch photos", error: err.message });
    } finally {
        console.timeEnd("Get All Photos");
    }
};

/**
 * Get single photo by ID.
 */
export const getPhotoById = async (req, res) => {
    console.time("Get Photo by ID");
    console.log(`Fetching photo with ID: ${req.params.id}`);
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) {
            console.log("Photo not found");
            return res.status(404).json({ message: "Photo not found" });
        }
        console.log("Photo fetched successfully");
        res.status(200).json(photo);
    } catch (err) {
        console.error("--> Caught an error in getPhotoById:", err.message);
        res.status(500).json({ message: "Error fetching photo", error: err.message });
    } finally {
        console.timeEnd("Get Photo by ID");
    }
};