import Photo from "../models/user.js";

// Save photo info in DB after upload
export const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No photo uploaded" });
        }

        const newPhoto = new Photo({
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
        });

        await newPhoto.save();

        res.status(201).json({
            message: "Photo uploaded successfully",
            photo: newPhoto,
        });
    } catch (err) {
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
};

// Get all photos
export const getPhotos = async (req, res) => {
    try {
        const photos = await Photo.find().sort({ uploadedAt: -1 });
        res.status(200).json(photos);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch photos", error: err.message });
    }
};

// Get single photo by ID
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
