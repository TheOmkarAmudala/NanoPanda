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

        console.log(`✅ New suspicious activity log saved for user: ${logData.user_id}`);
        res.status(201).json({ message: "Log captured successfully.", log: newLog });

    } catch (err) {
        console.error("❌ Failed to capture log:", err.message);
        res.status(500).json({ message: "Failed to capture log.", error: err.message });
    }
};


import axios from 'axios';

export const getLogs = async (req, res) => {
    try {
        // Find the most recent log entry to get the user_id of the latest user
        const latestLog = await SuspiciousActivity.findOne().sort({ timestamp: -1 });

        if (!latestLog) {
            return res.status(200).json({ message: "No logs found.", newAttempt: null, history: [] });
        }

        const latestUserId = latestLog.user_id;

        // Fetch all logs for this latest user and sort by timestamp
        const allLogs = await SuspiciousActivity.find({ user_id: latestUserId }).sort({ timestamp: -1 });

        // The first element is the latest log for this user
        const newAttempt = allLogs[0];

        // The rest are their history
        const history = allLogs.slice(1);

        // Trigger n8n webhook with the fetched logs data
        const n8nWebhookUrl = 'http://localhost:5680/webhook-test/webhook'; // Replace with your n8n webhook URL

        const webhookPayload = {
            userId: latestUserId,
            newAttempt: newAttempt,
            history: history,
        };

        await axios.post(n8nWebhookUrl, webhookPayload);

        // Send the structured response after triggering n8n
        res.status(200).json({
            message: "Logs fetched successfully and n8n workflow triggered.",
            userId: latestUserId,
            newAttempt: newAttempt,
            history: history,
        });

    } catch (err) {
        console.error("❌ Failed to fetch logs or trigger n8n:", err.message);
        res.status(500).json({ message: "Failed to fetch logs or trigger n8n.", error: err.message });
    }
};
