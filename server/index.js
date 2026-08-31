const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

// Routes
const authRoutes = require("./routes/authRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const orderRoutes = require("./routes/orderRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const adminRoutes = require("./routes/adminRoutes");
const ipfsRoutes = require("./routes/ipfsRoutes");

// Models for seed data
const User = require("./models/User");
const Restaurant = require("./models/Restaurant");
const MenuItem = require("./models/MenuItem");

// Load instance-specific env file
const instance = process.env.INSTANCE || "";
if (instance) {
  dotenv.config({ path: `.env.instance${instance}` });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = process.env.NODE_ENV === "production"
  ? ["https://blockbite.xyz"]
  : [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3002",
      "http://localhost:3003",
      "http://127.0.0.1:3003",
    ];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate limiting
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: "Too many order requests. Please slow down." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/orders", orderLimiter);

// Connect Database
connectDB();

// Initialize Socket.IO
const server = app.listen(PORT, () => {
  console.log(`🚀 BLOCKBITE Express Server listening on port ${PORT}`);
});
initSocket(server);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ipfs", ipfsRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    name: "BLOCKBITE API Server",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

