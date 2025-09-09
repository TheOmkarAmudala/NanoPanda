    import mongoose from "mongoose";

    const actionSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true,
        },
        resource: {
            type: String,
            required: true,
        },
        duration_seconds: {
            type: Number,
            required: true,
        },
        result: {
            type: String,
            enum: ['allowed', 'blocked', 'failed'], // Define allowed values
            required: true,
        },
    });

    const suspiciousActivitySchema = new mongoose.Schema({
        timestamp: {
            type: Date,
            default: Date.now,
        },
        user_id: {
            type: String,
            required: true,
        },
        device_id: {
            type: String,
            required: true,
        },
        location: {
            type: String,
            required: false,
        },
        session_name: {
            type: String,
            required: false,
        },
        actions: [actionSchema],
    });

    const SuspiciousActivity = mongoose.model('SuspiciousActivity', suspiciousActivitySchema);

    export default SuspiciousActivity;
