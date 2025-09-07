import SuspiciousActivity from "../models/SuspiciousActivity.js";

/**
 * Capture and save suspicious activity logs from the frontend.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export const captureLog = async (req, res) => {
    try {
        const logData = req.body;
        const photoFile = req.file;

        // Basic validation of incoming data
        if (!logData.user_id || !logData.device_id || !logData.actions || !photoFile) {
            return res.status(400).json({ message: "Invalid log data or no photo provided." });
        }

        // Add the photo path to the log data
        const newLogData = {
            ...logData,
            photo_path: photoFile.path, // Save the path to the photo file
        };

        const newLog = new SuspiciousActivity(newLogData);
        await newLog.save();

        console.log(`New suspicious activity log saved for user: ${newLogData.user_id} with photo path: ${newLogData.photo_path}`);
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