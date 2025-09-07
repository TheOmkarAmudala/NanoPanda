import express from 'express';
import multer from 'multer';
import { authenticateUser, getSuspiciousUsers } from '../controller/AuthenticationChecker.js';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

// POST route to authenticate a user by uploading an image
router.post('/authenticate', upload.single('photo'), authenticateUser);

// GET route to retrieve all suspicious users
router.get('/suspicious', getSuspiciousUsers);

export default router;
