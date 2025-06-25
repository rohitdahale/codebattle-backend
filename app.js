const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const userRoutes = require("./routes/user"); // Add this line
const { initializeSocket } = require("./socket/socketHandler");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Database connection
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/user", userRoutes); // Add this line

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

// Initialize Socket.IO
initializeSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Main server running on port ${PORT}`);
  console.log(`🔧 Code executor expected at: ${process.env.CODE_EXECUTOR_URL || 'http://localhost:3001'}`);
});