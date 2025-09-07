import express from 'express';
import multer from 'multer';
import { predictEmotion } from '../controller/ferController.js';
import { FerLog } from '../models/FerLog.js'; // Import FerLog for `get` route

const router = express.Router();

const upload = multer({ dest: 'uploads/fer/' });

// Route for facial emotion recognition
router.post('/', upload.single('photo'), predictEmotion);

// Optional: a GET route to retrieve all emotion detection logs
router.get('/', async (req, res) => {
    try {
        const logs = await FerLog.find().sort({ timestamp: -1 });
        res.status(200).json(logs);
    } catch (err) {
        console.error("Failed to fetch FER logs:", err.message);
        res.status(500).json({ message: "Failed to fetch FER logs.", error: err.message });
    }
});

export default router;