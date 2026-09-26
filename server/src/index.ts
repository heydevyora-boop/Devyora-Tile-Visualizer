import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db";

import healthRouter from "./routes/health";
import generateRouter from "./routes/generate";
import generationsRouter from "./routes/generations";
import loginRouter from "./routes/login";

// Connect to MongoDB
connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Routes
app.use("/api", healthRouter);
app.use("/api", generateRouter);
app.use("/api", generationsRouter);
app.use("/api", loginRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});