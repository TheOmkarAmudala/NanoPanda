import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import photoRoutes from "./routes/photoRoutes.js";
import authRouter from './routes/authRouter.js';
import logRoute from './routes/logRoute.js';
import ferRoutes from './routes/ferRoutes.js';
import { loadFaceApiModels } from './controller/ferController.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Error:", err));

app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api", photoRoutes);
app.use('/api/auth', authRouter);
app.use('/api/logs', logRoute);
app.use('/api/fer', ferRoutes);

const PORT = process.env.PORT || 5000;

// Create an async function to start the server
const startServer = async () => {
    try {
        await loadFaceApiModels(); // Wait for the model to finish loading
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1); // Exit if the model fails to load
    }
};

startServer();