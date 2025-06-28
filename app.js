const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const userRoutes = require("./routes/user");

// Import socket handler
const { initializeSocket } = require("./socket/socketHandler");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: [
      "https://codebattlelive.netlify.app",
      "http://localhost:5173",
      "http://localhost:3000"
      // Add additional origins as needed
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// CORS Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://codebattlelive.netlify.app",
    "http://localhost:3000"
  ],
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' })); // Increase limit for code submissions
app.use(express.urlencoded({ extended: true }));

// Database connection
connectDB();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      codeExecutor: process.env.CODE_EXECUTOR_URL || 'http://localhost:3001'
    }
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/user", userRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Code Battle Live API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      match: '/api/match',
      user: '/api/user',
      room: '/api/room',
      health: '/health'
    }
  });
});

// Initialize Socket.IO with all handlers
initializeSocket(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// 404 handler - FIXED: Use (req, res, next) instead of '*'
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Main server running on port ${PORT}`);
  console.log(`🔧 Code executor expected at: ${process.env.CODE_EXECUTOR_URL || 'http://localhost:3001'}`);
  console.log(`🏠 Room system initialized`);
  console.log(`⚡ Socket.IO server ready`);
});