// userController.js

import Photo from "../models/user.js";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs";
import fs from "fs";
import sharp from "sharp";

// Use CPU backend
tf.setBackend('cpu');

/**
 * Generate an embedding for a cropped face using MobileNet
 */
async function generateFaceEmbedding(filePath) {
    const imageBuffer = fs.readFileSync(filePath);

    // Decode image to get dimensions (ignore alpha channel)
    const { data, info } = await sharp(imageBuffer)
        .removeAlpha() // remove alpha channel if present
        .raw()
        .toBuffer({ resolveWithObject: true });

    const decodedImage = tf.tensor3d(
        new Uint8Array(data),
        [info.height, info.width, 3] // ensure 3 channels (RGB)
    );

    // Load BlazeFace for face detection
    const faceModel = await blazeface.load();
    const predictions = await faceModel.estimateFaces(decodedImage);

    decodedImage.dispose();

    if (predictions.length === 0) {
        throw new Error("No face detected in the image.");
    }

    // Use the first detected face
    const start = predictions[0].topLeft;
    const end = predictions[0].bottomRight;
    const size = [end[0] - start[0], end[1] - start[1]];

    const left = Math.max(0, Math.round(start[0]));
    const top = Math.max(0, Math.round(start[1]));
    const width = Math.min(info.width - left, Math.round(size[0]));
    const height = Math.min(info.height - top, Math.round(size[1]));

    // Crop and resize the face using Sharp
    const croppedBuffer = await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .resize(224, 224) // MobileNet requires 224x224
        .removeAlpha() // ensure RGB only
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Create tensor for MobileNet
    const croppedImageTensor = tf.tensor3d(
        new Uint8Array(croppedBuffer.data),
        [croppedBuffer.info.height, croppedBuffer.info.width, 3]
    );

    // Load MobileNet and generate embedding
    const mobilenetModel = await mobilenet.load();
    const embedding = mobilenetModel.infer(croppedImageTensor, true);

    croppedImageTensor.dispose();

    return embedding.arraySync()[0];
}

/**
 * Upload photo + generate embedding
 */
export const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No photo uploaded" });
        }
        console.log("Received file:", req.file);
        console.log("Body:", req.body);


        const filePath = `uploads/${req.file.filename}`;
        const embedding = await generateFaceEmbedding(filePath);

        const newPhoto = new Photo({
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
            embedding: embedding, // Save embedding array in DB
        });

        await newPhoto.save();

        res.status(201).json({
            message: "Photo uploaded successfully with face embedding",
            photo: newPhoto,
        });
    } catch (err) {
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
};

/**
 * Get all photos
 */
export const getPhotos = async (req, res) => {
    try {
        const photos = await Photo.find().sort({ uploadedAt: -1 });
        res.status(200).json(photos);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch photos", error: err.message });
    }
};


export const getPhotoById = async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }
        res.status(200).json(photo);
    } catch (err) {
        res.status(500).json({ message: "Error fetching photo", error: err.message });
    }
};
