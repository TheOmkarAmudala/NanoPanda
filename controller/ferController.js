import axios from 'axios';
import FormData from 'form-data';

export const detectEmotion = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const form = new FormData();
        form.append('api_key', 'w3CyygjOOJ2ILg4KR4mw6P1yXoi-KJn_');
        form.append('api_secret', 'pIowb8ki62NBm1AWLmL183MSEaEixkLI');
        form.append('image_file', req.file.buffer, { filename: req.file.originalname });
        form.append('return_attributes', 'emotion');

        const response = await axios.post(
            'https://api-us.faceplusplus.com/facepp/v3/detect',
            form,
            { headers: form.getHeaders() }
        );

        if (response.data.faces && response.data.faces.length > 0) {
            const emotions = response.data.faces[0].attributes.emotion;

            // Find the emotion with the highest value
            let maxEmotion = '';
            let maxScore = -Infinity;
            for (const [emotion, score] of Object.entries(emotions)) {
                if (score > maxScore) {
                    maxScore = score;
                    maxEmotion = emotion;
                }
            }

            return res.json({ success: true, emotion: maxEmotion, score: maxScore });
        } else {
            return res.json({ success: false, message: 'No face detected' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Face++ API error', details: error.message });
    }
};

