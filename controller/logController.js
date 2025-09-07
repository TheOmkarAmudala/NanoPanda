import SuspiciousActivity from "../models/SuspiciousActivity.js";

/**
 * Capture and save suspicious activity logs from the frontend.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export const captureLog = async (req, res) => {
    try {
        const logData = req.body;

        // Basic validation of incoming data
        if (!logData.user_id || !logData.device_id || !logData.actions) {
            return res.status(400).json({ message: "Invalid log data provided." });
        }

        const newLog = new SuspiciousActivity(logData);
        await newLog.save();

        console.log(`New suspicious activity log saved for user: ${logData.user_id}`);
        res.status(201).json({ message: "Log captured successfully.", log: newLog });

    } catch (err) {
        console.error("Failed to capture log:", err.message);
        res.status(500).json({ message: "Failed to capture log.", error: err.message });
    }
};

/**
 * Get all captured logs.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export const getLogs = async (req, res) => {
    try {
        const logs = await SuspiciousActivity.find().sort({ timestamp: -1 });
        res.status(200).json(logs);
    } catch (err) {
        console.error("Failed to fetch logs:", err.message);
        res.status(500).json({ message: "Failed to fetch logs.", error: err.message });
    }
};
