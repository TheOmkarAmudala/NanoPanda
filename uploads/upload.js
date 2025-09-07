import multer from "multer";

// Store uploaded images in memory (buffer)
const storage = multer.memoryStorage();

// Create multer upload instance
const upload = multer({ storage });

// Export the upload object
export { upload };
