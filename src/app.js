import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", limiter);

// CORS
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:3000";
console.log(`🔒 CORS Allowed Origin: ${allowedOrigin}`);
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

// Raw body for Razorpay webhook signature verification
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  req.rawBody = req.body.toString("utf8");
  next();
});

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Logger (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Routes
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import metaRoutes from "./routes/meta.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import emailRoutes from "./routes/email.routes.js";
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/emails", emailRoutes);

// Background Jobs
import cron from "node-cron";
import EmailService from "./services/email.service.js";
cron.schedule("* * * * *", () => {
  EmailService.processEmailQueue();
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running", env: process.env.NODE_ENV });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
});

export default app;
