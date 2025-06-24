const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');

// Get user profile with stats
// Get user profile with stats
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get recent matches
    const recentMatches = await Match.find({
      $or: [{ player1: req.user._id }, { player2: req.user._id }]
    })
    .populate('player1 player2', 'username')
    .sort({ createdAt: -1 })
    .limit(10);

    // Format recent matches
    const formattedMatches = recentMatches.map(match => {
      const isPlayer1 = match.player1._id.toString() === req.user._id.toString();
      const opponent = isPlayer1 ? match.player2.username : match.player1.username;
      const result = match.winner ? 
        (match.winner.toString() === req.user._id.toString() ? 'win' : 'loss') : 'draw';
      
      return {
        id: match._id,
        opponent,
        problem: match.problem,
        result,
        time: match.createdAt.toLocaleDateString()
      };
    });

    // Update user's recent matches
    user.recentMatches = formattedMatches;
    await user.save();

    res.json({ 
      user: {
        ...user.toObject(),
        recentMatches: formattedMatches
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({})
      .select('username wins totalMatches winRate xp level')
      .sort({ xp: -1 })
      .limit(100);

    // Add rank
    const leaderboard = users.map((user, index) => ({
      ...user.toObject(),
      rank: index + 1
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
