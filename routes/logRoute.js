import express from 'express';
import { captureLog, getLogs } from '../controller/logController.js';

const router = express.Router();

// POST route to capture new suspicious activity logs
router.post('/activity', captureLog);

// GET route to retrieve all suspicious activity logs
router.get('/activity', getLogs);

export default router;
