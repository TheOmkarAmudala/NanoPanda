import express from 'express';
import multer from 'multer';
import { captureLog, getLogs } from '../controller/logController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // `dest` specifies where to save the files

// POST route with multer middleware to handle file uploads
router.post('/activity', upload.single('photo'), captureLog);

// GET route to retrieve all suspicious activity logs
router.get('/activity', getLogs);

export default router;