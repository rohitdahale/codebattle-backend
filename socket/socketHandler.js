const jwt = require('jsonwebtoken');
const User = require('../models/User');
const QuickMatchSystem = require('./QuickMatchSystem');

// Socket.IO Authentication Middleware
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error'));
    }
    
    socket.userId = user._id.toString();
    socket.username = user.username;

    // ADD THIS DEBUG LOG:
    console.log('Socket authenticated:', { 
      userId: socket.userId, 
      username: socket.username 
    });
    
    next();

    

  } catch (error) {
    next(new Error('Authentication error'));
  }
};

// Initialize Socket.IO with handlers
const initializeSocket = (io) => {
  // Initialize match system
  const quickMatchSystem = new QuickMatchSystem(io);

  // Apply authentication middleware
  io.use(socketAuth);

  // Socket.IO event handling
  io.on('connection', (socket) => {
    console.log(`User ${socket.username} connected with socket ${socket.id}`);

    // Join quick match queue
    socket.on('join_queue', () => {
      quickMatchSystem.addPlayerToQueue(socket);
    });

    // Leave queue
    socket.on('leave_queue', () => {
      quickMatchSystem.removePlayerFromQueue(socket.userId);
    });

    // Player ready for match
    socket.on('player_ready', () => {
      quickMatchSystem.playerReady(socket.userId);
    });

    // Code submission
    socket.on('submit_code', (data) => {
      quickMatchSystem.submitCode(socket.userId, data.code);
    });

    // Real-time code sharing (optional - for live coding view)
    socket.on('code_update', (data) => {
      const matchId = quickMatchSystem.getPlayerMatch(socket.userId);
      if (matchId) {
        socket.to(matchId).emit('opponent_code_update', {
          code: data.code,
          userId: socket.userId
        });
      }
    });

    // Chat messages during match
    socket.on('match_message', (data) => {
      const matchId = quickMatchSystem.getPlayerMatch(socket.userId);
      if (matchId) {
        socket.to(matchId).emit('match_message', {
          message: data.message,
          username: socket.username,
          userId: socket.userId,
          timestamp: Date.now()
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.username} disconnected`);
      quickMatchSystem.handleDisconnect(socket.userId);
    });
  });
};

module.exports = { initializeSocket };