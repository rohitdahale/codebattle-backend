const jwt = require('jsonwebtoken');
const User = require('../models/User');
const QuickMatchSystem = require('./QuickMatchSystem');
const RoomMatchSystem = require('./RoomMatchSystem');

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
        
        console.log('Socket authenticated:', { userId: socket.userId, username: socket.username });
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
};

// Initialize Socket.IO with handlers
const initializeSocket = (io) => {
    // Initialize both match systems
    const quickMatchSystem = new QuickMatchSystem(io);
    const roomMatchSystem = new RoomMatchSystem(io);

    // Apply authentication middleware
    io.use(socketAuth);

    // Socket.IO event handling
    io.on('connection', (socket) => {
        console.log(`User ${socket.username} connected with socket ${socket.id}`);
        io.emit('online_users_count', onlineUsers.size);

        // ===== QUICK MATCH EVENTS =====
        
        // Join quick match queue
        socket.on('join_queue', () => {
            quickMatchSystem.addPlayerToQueue(socket);
        });

        // Leave queue
        socket.on('leave_queue', () => {
            quickMatchSystem.removePlayerFromQueue(socket.userId);
        });

        // ===== ROOM EVENTS =====
        
        // Create room
        socket.on('create_room', (data = {}) => {
            const roomCode = roomMatchSystem.createRoom(socket, data.settings);
            console.log(`Room ${roomCode} created by ${socket.username}`);
        });

        // Join room
        socket.on('join_room', (data) => {
            if (!data.roomCode) {
                socket.emit('room_error', { message: 'Room code is required' });
                return;
            }
            roomMatchSystem.joinRoom(socket, data.roomCode);
        });

        // Leave room
        socket.on('leave_room', () => {
            roomMatchSystem.leaveRoom(socket.userId);
        });

        // Get room info
        socket.on('get_room_info', (data) => {
            if (!data.roomCode) {
                socket.emit('room_error', { message: 'Room code is required' });
                return;
            }
            const roomInfo = roomMatchSystem.getRoomInfo(data.roomCode);
            if (roomInfo) {
                socket.emit('room_info', { room: roomInfo });
            } else {
                socket.emit('room_error', { message: 'Room not found' });
            }
        });

        // Change problem in room (host only)
        socket.on('change_problem', (data = {}) => {
            const success = roomMatchSystem.changeProblem(socket.userId, data.problemId);
            if (!success) {
                socket.emit('room_error', { message: 'Cannot change problem. You must be the host and room must not be in active match.' });
            }
        });

        socket.on('start_room_match', () => {
          const roomCode = roomMatchSystem.getPlayerRoom(socket.userId);
          if (!roomCode) {
              socket.emit('room_error', { message: 'You are not in any room' });
              return;
          }
          
          const success = roomMatchSystem.startRoomMatch(socket.userId);
          if (!success) {
              socket.emit('room_error', { message: 'Cannot start match. You must be the host and room must have both players.' });
          }
      });
      

        // ===== SHARED MATCH EVENTS =====
        
        // Player ready for match
        socket.on('player_ready', () => {
            // Check if player is in quick match
            const quickMatchId = quickMatchSystem.getPlayerMatch(socket.userId);
            if (quickMatchId) {
                quickMatchSystem.playerReady(socket.userId);
                return;
            }

            // Check if player is in room
            const roomCode = roomMatchSystem.getPlayerRoom(socket.userId);
            if (roomCode) {
                roomMatchSystem.playerReady(socket.userId);
                return;
            }

            socket.emit('match_error', { message: 'You are not in any match or room' });
        });

        // Code submission
        socket.on('submit_code', (data) => {
            if (!data.code) {
                socket.emit('match_error', { message: 'Code is required' });
                return;
            }

            // Check if player is in quick match
            const quickMatchId = quickMatchSystem.getPlayerMatch(socket.userId);
            if (quickMatchId) {
                quickMatchSystem.submitCode(socket.userId, data.code);
                return;
            }

            // Check if player is in room
            const roomCode = roomMatchSystem.getPlayerRoom(socket.userId);
            if (roomCode) {
                roomMatchSystem.submitCode(socket.userId, data.code);
                return;
            }

            socket.emit('match_error', { message: 'You are not in any active match' });
        });

        // Real-time code sharing (optional - for live coding view)
        socket.on('code_update', (data) => {
            if (!data.code && data.code !== '') return; // Allow empty string

            // Check if player is in quick match
            const quickMatchId = quickMatchSystem.getPlayerMatch(socket.userId);
            if (quickMatchId) {
                socket.to(quickMatchId).emit('opponent_code_update', {
                    code: data.code,
                    userId: socket.userId
                });
                return;
            }

            // Check if player is in room
            const roomCode = roomMatchSystem.getPlayerRoom(socket.userId);
            if (roomCode) {
                socket.to(roomCode).emit('opponent_code_update', {
                    code: data.code,
                    userId: socket.userId
                });
                return;
            }
        });

        // Chat messages during match
        socket.on('match_message', (data) => {
            if (!data.message || data.message.trim() === '') return;

            const message = {
                message: data.message.trim(),
                username: socket.username,
                userId: socket.userId,
                timestamp: Date.now()
            };

            // Check if player is in quick match
            const quickMatchId = quickMatchSystem.getPlayerMatch(socket.userId);
            if (quickMatchId) {
                socket.to(quickMatchId).emit('match_message', message);
                return;
            }

            // Check if player is in room
            const roomCode = roomMatchSystem.getPlayerRoom(socket.userId);
            if (roomCode) {
                socket.to(roomCode).emit('match_message', message);
                return;
            }
        });

        // ===== SYSTEM EVENTS =====
        
        // Get system status (admin/debug)
        socket.on('get_system_status', () => {
            const quickMatchStatus = quickMatchSystem.getSystemStatus();
            const roomStatus = roomMatchSystem.getSystemStatus();
            
            socket.emit('system_status', {
                quickMatch: quickMatchStatus,
                rooms: roomStatus,
                onlineUsers: onlineUsers.size
            });
        });

        // Get all rooms (for room browser)
        socket.on('get_all_rooms', () => {
            const rooms = roomMatchSystem.getAllRooms()
                .filter(room => !room.settings?.isPrivate) // Only show public rooms
                .slice(0, 20); // Limit to 20 rooms
            
            socket.emit('room_list', { rooms });
        });

        // ===== DISCONNECT HANDLING =====
        
        socket.on('disconnect', () => {
            console.log(`User ${socket.username} disconnected`);
            
            // Remove from online users
            onlineUsers.delete(socket.userId);
            io.emit('online_users_count', onlineUsers.size);
            
            // Handle disconnects in both systems
            quickMatchSystem.handleDisconnect(socket.userId);
            roomMatchSystem.handleDisconnect(socket.userId);
        });

        // ===== ERROR HANDLING =====
        
        socket.on('error', (error) => {
            console.error(`Socket error for user ${socket.username}:`, error);
            socket.emit('socket_error', { message: 'Socket connection error' });
        });
    });

    // Periodic cleanup and user count update
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

    // Log system statistics periodically
    setInterval(() => {
        const quickMatchStatus = quickMatchSystem.getSystemStatus();
        const roomStatus = roomMatchSystem.getSystemStatus();
        
        console.log('System Status:', {
            onlineUsers: onlineUsers.size,
            quickMatch: quickMatchStatus,
            rooms: roomStatus
        });
    }, 300000); // Every 5 minutes
};

module.exports = { initializeSocket };