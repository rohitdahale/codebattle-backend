const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> room data
    this.userRooms = new Map(); // userId -> roomId
  }

  // Create a new room
  createRoom(hostId, hostUsername, settings = {}) {
    const roomId = uuidv4();
    const room = {
      id: roomId,
      hostId,
      hostUsername,
      players: [{
        id: hostId,
        username: hostUsername,
        isReady: false,
        isHost: true
      }],
      settings: {
        maxPlayers: settings.maxPlayers || 2,
        timeLimit: settings.timeLimit || 600000, // 10 minutes default
        difficulty: settings.difficulty || 'medium',
        isPrivate: settings.isPrivate || false,
        ...settings
      },
      status: 'waiting', // waiting, starting, active, completed
      createdAt: new Date(),
      matchId: null
    };

    this.rooms.set(roomId, room);
    this.userRooms.set(hostId, roomId);
    
    console.log(`Room created: ${roomId} by ${hostUsername}`);
    return room;
  }

  // Join a room
  joinRoom(roomId, playerId, playerUsername) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Room is not accepting players');
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check if player is already in room
    if (room.players.some(p => p.id === playerId)) {
      throw new Error('Player already in room');
    }

    // Check if player is in another room
    if (this.userRooms.has(playerId)) {
      throw new Error('Player is already in another room');
    }

    // Add player to room
    room.players.push({
      id: playerId,
      username: playerUsername,
      isReady: false,
      isHost: false
    });

    this.userRooms.set(playerId, roomId);
    
    console.log(`Player ${playerUsername} joined room ${roomId}`);
    return room;
  }

  // Leave a room
  leaveRoom(playerId) {
    const roomId = this.userRooms.get(playerId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.userRooms.delete(playerId);
      return null;
    }

    // Remove player from room
    room.players = room.players.filter(p => p.id !== playerId);
    this.userRooms.delete(playerId);

    // If host left, either assign new host or delete room
    if (room.hostId === playerId) {
      if (room.players.length > 0) {
        // Assign new host
        const newHost = room.players[0];
        room.hostId = newHost.id;
        room.hostUsername = newHost.username;
        newHost.isHost = true;
        console.log(`New host assigned: ${newHost.username} for room ${roomId}`);
      } else {
        // Delete empty room
        this.rooms.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
        return { roomDeleted: true };
      }
    }

    console.log(`Player ${playerId} left room ${roomId}`);
    return room;
  }

  // Set player ready status
  setPlayerReady(playerId, isReady) {
    const roomId = this.userRooms.get(playerId);
    if (!roomId) {
      throw new Error('Player not in any room');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not in room');
    }

    player.isReady = isReady;
    console.log(`Player ${player.username} ready status: ${isReady}`);
    
    return room;
  }

  // Check if all players are ready
  areAllPlayersReady(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length < 2) {
      return false;
    }

    return room.players.every(player => player.isReady);
  }

  // Get room by ID
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Get room by player ID
  getRoomByPlayer(playerId) {
    const roomId = this.userRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  // Get all public rooms
  getPublicRooms() {
    return Array.from(this.rooms.values())
      .filter(room => !room.settings.isPrivate && room.status === 'waiting')
      .map(room => ({
        id: room.id,
        hostUsername: room.hostUsername,
        playerCount: room.players.length,
        maxPlayers: room.settings.maxPlayers,
        difficulty: room.settings.difficulty,
        timeLimit: room.settings.timeLimit,
        createdAt: room.createdAt
      }));
  }

  // Start match for room
  startMatch(roomId, matchId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    room.status = 'active';
    room.matchId = matchId;
    
    console.log(`Match started for room ${roomId}: ${matchId}`);
    return room;
  }

  // Clean up completed rooms
  cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Remove all players from userRooms map
    room.players.forEach(player => {
      this.userRooms.delete(player.id);
    });

    // Delete the room
    this.rooms.delete(roomId);
    console.log(`Room cleaned up: ${roomId}`);
  }

  // Get room stats
  getStats() {
    return {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter(r => r.status === 'active').length,
      waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
      totalPlayers: this.userRooms.size
    };
  }
}

module.exports = new RoomManager();