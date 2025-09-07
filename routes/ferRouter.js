import express from "express";
import { detectEmotion } from "../controller/ferController.js";
import { upload } from "../uploads/upload.js";

const router = express.Router();

// POST /api/detect-emotion
router.post("/detect-emotion", upload.single("photo"), detectEmotion);

export default router;
