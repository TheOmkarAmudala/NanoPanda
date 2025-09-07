import mongoose from 'mongoose';

const ferLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
    },
    user_id: {
        type: String,
        required: true,
    },
    image_path: {
        type: String,
        required: true,
    },
    predicted_emotion: {
        type: String,
        required: true,
    },
    emotion_scores: {
        type: [Number],
        required: true,
    },
    is_legit: {
        type: Boolean,
        default: false,
    }
});

const FerLog = mongoose.model(
    'FerLog',
    mongoose.models.FerLog || ferLogSchema
);

export { FerLog };