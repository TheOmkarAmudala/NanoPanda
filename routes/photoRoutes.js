import express from "express";
import multer from "multer";
import path from "path";
import { uploadPhoto, getPhotos, getPhotoById } from "../controller/photoController.js";

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

router.post("/upload", upload.single("photo"), uploadPhoto);
router.get("/photos", getPhotos);
router.get("/photos/:id", getPhotoById);

export default router;