const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const userRoutes = require("./routes/user");
const { initializeSocket } = require("./socket/socketHandler");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ CORS Setup
const allowedOrigins = [
  'http://localhost:5173',
  'https://codebattlelive.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.options('*', cors()); // ✅ Handle preflight requests

app.use(express.json());

// ✅ Connect to MongoDB
connectDB();

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/user", userRoutes);

// ✅ Health Check Route
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

// ✅ Socket.IO Setup
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

initializeSocket(io);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Main server running on port ${PORT}`);
  console.log(`🔧 Code executor expected at: ${process.env.CODE_EXECUTOR_URL || 'http://localhost:3001'}`);
});
