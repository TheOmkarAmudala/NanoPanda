import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import photoRoutes from "./routes/photoRoutes.js";
import authRouter from './routes/authRouter.js';
import logRoute from './routes/logRoute.js';
import ferRouter from "./routes/ferRouter.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());  // need to make the url in  app.use(cors({ origin: "https://your-frontend-url.com" }));

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Error:", err));

app.use("/uploads", express.static("uploads"));

// Routes

app.use("/api", photoRoutes);
app.use('/api/auth', authRouter);
app.use('/api/logs', logRoute);
app.use("/api/fer", ferRouter);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
