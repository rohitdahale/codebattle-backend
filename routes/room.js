const express = require('express');
const auth = require('../middleware/auth');
const roomManager = require('../room/roomManager');
const router = express.Router();

// Static routes first (routes without parameters)
// Create a new room
router.post('/create', auth, async (req, res) => {
  try {
    const { settings = {} } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    // Check if user is already in a room
    const existingRoom = roomManager.getRoomByPlayer(userId);
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: 'You are already in a room'
      });
    }

    // Validate settings
    const validatedSettings = {
      maxPlayers: Math.min(Math.max(settings.maxPlayers || 2, 2), 4), // 2-4 players
      timeLimit: Math.min(Math.max(settings.timeLimit || 600000, 300000), 1800000), // 5-30 minutes
      difficulty: ['easy', 'medium', 'hard'].includes(settings.difficulty) ? settings.difficulty : 'medium',
      isPrivate: Boolean(settings.isPrivate)
    };

    const room = roomManager.createRoom(userId, username, validatedSettings);

    res.json({
      success: true,
      room: {
        id: room.id,
        hostId: room.hostId,
        hostUsername: room.hostUsername,
        players: room.players,
        settings: room.settings,
        status: room.status,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room'
    });
  }
});

// Leave a room
router.post('/leave', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = roomManager.leaveRoom(userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'You are not in any room'
      });
    }

    res.json({
      success: true,
      message: 'Left room successfully',
      roomDeleted: result.roomDeleted
    });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave room'
    });
  }
});

// Get current room
router.get('/current', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const room = roomManager.getRoomByPlayer(userId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'You are not in any room'
      });
    }

    res.json({
      success: true,
      room: {
        id: room.id,
        hostId: room.hostId,
        hostUsername: room.hostUsername,
        players: room.players,
        settings: room.settings,
        status: room.status,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting current room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room'
    });
  }
});

// Get public rooms list
router.get('/public', auth, async (req, res) => {
  try {
    const publicRooms = roomManager.getPublicRooms();
    res.json({
      success: true,
      rooms: publicRooms
    });
  } catch (error) {
    console.error('Error getting public rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rooms'
    });
  }
});

// Dynamic routes with parameters come after static routes
// Join a room
router.post('/join/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const username = req.user.username;

    const room = roomManager.joinRoom(roomId, userId, username);

    res.json({
      success: true,
      room: {
        id: room.id,
        hostId: room.hostId,
        hostUsername: room.hostUsername,
        players: room.players,
        settings: room.settings,
        status: room.status,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get room details by ID
router.get('/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = roomManager.getRoom(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.json({
      success: true,
      room: {
        id: room.id,
        hostId: room.hostId,
        hostUsername: room.hostUsername,
        players: room.players,
        settings: room.settings,
        status: room.status,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room'
    });
  }
});

module.exports = router;