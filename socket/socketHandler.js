const jwt = require('jsonwebtoken');
const User = require('../models/User');
const QuickMatchSystem = require('./QuickMatchSystem');
const { handleRoomEvents } = require('./roomHandler'); // Import room handlers

const onlineUsers = new Set();

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
        
        // Track online user
        onlineUsers.add(socket.userId);
        
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
        
        // Emit updated online users count
        io.emit('online_users_count', onlineUsers.size);
        
        // Initialize room event handlers for this socket
        handleRoomEvents(io, socket);
        
        // Quick Match Events
        socket.on('join_queue', () => {
            quickMatchSystem.addPlayerToQueue(socket);
        });
        
        socket.on('leave_queue', () => {
            quickMatchSystem.removePlayerFromQueue(socket.userId);
        });
        
        socket.on('player_ready', () => {
            quickMatchSystem.playerReady(socket.userId);
        });
        
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
        
        // Handle general disconnect
        socket.on('disconnect', () => {
            console.log(`User ${socket.username} disconnected`);
            
            // Remove from online users
            onlineUsers.delete(socket.userId);
            io.emit('online_users_count', onlineUsers.size);
            
            // Handle quick match disconnect
            quickMatchSystem.handleDisconnect(socket.userId);
            
            // Room disconnect is handled automatically by the room event handler
        });
    });
    
    // Periodic cleanup of online users
    setInterval(() => {
        const connectedSockets = Array.from(io.sockets.sockets.values());
        const activeUserIds = new Set(connectedSockets.map(s => s.userId).filter(Boolean));
        
        // Remove users who are no longer connected
        for (const userId of onlineUsers) {
            if (!activeUserIds.has(userId)) {
                onlineUsers.delete(userId);
            }
        }
        
        // Broadcast updated count
        io.emit('online_users_count', onlineUsers.size);
    }, 30000); // Every 30 seconds
};

module.exports = { initializeSocket };