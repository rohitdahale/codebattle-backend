const roomManager = require('../room/roomManager');
const { getRandomProblem } = require('../utils/problemGenerator.js');

const handleRoomEvents = (io, socket) => {
  console.log(`Room handler initialized for user: ${socket.userId}`);

  // Join room socket event
  socket.on('join_room', (data) => {
    try {
      const { roomId } = data;
      
      // Join the socket room
      socket.join(`room_${roomId}`);
      
      // Get updated room data
      const room = roomManager.getRoom(roomId);
      if (room) {
        // Emit room update to all players in the room
        io.to(`room_${roomId}`).emit('room_updated', {
          room: {
            id: room.id,
            hostId: room.hostId,
            hostUsername: room.hostUsername,
            players: room.players,
            settings: room.settings,
            status: room.status
          }
        });
        
        console.log(`User ${socket.username} joined room socket: ${roomId}`);
      }
    } catch (error) {
      console.error('Error joining room socket:', error);
      socket.emit('room_error', { message: 'Failed to join room' });
    }
  });

  // Leave room socket event
  socket.on('leave_room', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.userId);
      if (room) {
        const roomId = room.id;
        
        // Leave socket room
        socket.leave(`room_${roomId}`);
        
        // Remove from room manager
        const result = roomManager.leaveRoom(socket.userId);
        
        if (result && !result.roomDeleted) {
          // Emit room update to remaining players
          io.to(`room_${roomId}`).emit('room_updated', {
            room: {
              id: result.id,
              hostId: result.hostId,
              hostUsername: result.hostUsername,
              players: result.players,
              settings: result.settings,
              status: result.status
            }
          });
        } else if (result && result.roomDeleted) {
          // Emit room deleted to any remaining sockets
          io.to(`room_${roomId}`).emit('room_deleted');
        }
        
        socket.emit('room_left');
        console.log(`User ${socket.username} left room: ${roomId}`);
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      socket.emit('room_error', { message: 'Failed to leave room' });
    }
  });

  // Set ready status
  socket.on('set_ready', (data) => {
    try {
      const { isReady } = data;
      const room = roomManager.setPlayerReady(socket.userId, Boolean(isReady));
      
      if (room) {
        // Emit room update to all players
        io.to(`room_${room.id}`).emit('room_updated', {
          room: {
            id: room.id,
            hostId: room.hostId,
            hostUsername: room.hostUsername,
            players: room.players,
            settings: room.settings,
            status: room.status
          }
        });
        
        console.log(`User ${socket.username} ready status: ${isReady}`);
        
        // Check if all players are ready and start match
        if (roomManager.areAllPlayersReady(room.id)) {
          startRoomMatch(io, room);
        }
      }
    } catch (error) {
      console.error('Error setting ready status:', error);
      socket.emit('room_error', { message: 'Failed to set ready status' });
    }
  });

  // Host starts match manually
  socket.on('start_match', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.userId);
      
      if (!room) {
        socket.emit('room_error', { message: 'Room not found' });
        return;
      }
      
      if (room.hostId !== socket.userId) {
        socket.emit('room_error', { message: 'Only host can start the match' });
        return;
      }
      
      if (room.players.length < 2) {
        socket.emit('room_error', { message: 'Need at least 2 players to start' });
        return;
      }
      
      startRoomMatch(io, room);
    } catch (error) {
      console.error('Error starting match:', error);
      socket.emit('room_error', { message: 'Failed to start match' });
    }
  });

  // Handle room chat
  socket.on('room_chat', (data) => {
    try {
      const { message } = data;
      const room = roomManager.getRoomByPlayer(socket.userId);
      
      if (room && message && message.trim()) {
        const chatMessage = {
          id: Date.now(),
          username: socket.username,
          message: message.trim(),
          timestamp: new Date().toISOString()
        };
        
        // Emit to all players in the room
        io.to(`room_${room.id}`).emit('room_chat_message', chatMessage);
      }
    } catch (error) {
      console.error('Error handling room chat:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.userId);
      if (room) {
        const roomId = room.id;
        const result = roomManager.leaveRoom(socket.userId);
        
        if (result && !result.roomDeleted) {
          // Emit room update to remaining players
          io.to(`room_${roomId}`).emit('room_updated', {
            room: {
              id: result.id,
              hostId: result.hostId,
              hostUsername: result.hostUsername,
              players: result.players,
              settings: result.settings,
              status: result.status
            }
          });
          
          // Notify remaining players
          io.to(`room_${roomId}`).emit('player_disconnected', {
            username: socket.username
          });
        } else if (result && result.roomDeleted) {
          io.to(`room_${roomId}`).emit('room_deleted');
        }
        
        console.log(`User ${socket.username} disconnected from room: ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling room disconnect:', error);
    }
  });
};

// Helper function to start a match for a room
const startRoomMatch = async (io, room) => {
  try {
    console.log(`Starting match for room: ${room.id}`);
    
    // Get a random problem based on room difficulty
    const problem = await getRandomProblem(room.settings.difficulty);
    
    if (!problem) {
      io.to(`room_${room.id}`).emit('room_error', { 
        message: 'Failed to generate problem for match' 
      });
      return;
    }
    
    // Generate match ID
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update room status
    roomManager.startMatch(room.id, matchId);
    
    // Prepare match data for each player
    const matchData = {
      matchId,
      roomId: room.id,
      problem,
      timeLimit: room.settings.timeLimit,
      startTime: Date.now(),
      players: room.players.map(p => ({
        id: p.id,
        username: p.username
      }))
    };
    
    // Emit match start to all players in the room
    io.to(`room_${room.id}`).emit('match_starting', {
      message: 'Match starting in 3 seconds...',
      matchData
    });
    
    // Start the actual match after a brief delay
    setTimeout(() => {
      io.to(`room_${room.id}`).emit('match_started', matchData);
      console.log(`Match started: ${matchId} for room: ${room.id}`);
    }, 3000);
    
  } catch (error) {
    console.error('Error starting room match:', error);
    io.to(`room_${room.id}`).emit('room_error', { 
      message: 'Failed to start match' 
    });
  }
};

module.exports = { handleRoomEvents };