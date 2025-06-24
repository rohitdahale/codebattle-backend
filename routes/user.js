const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');

// Get user profile with comprehensive stats
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get recent matches with more details
    const recentMatches = await Match.find({
      $or: [{ player1: req.user._id }, { player2: req.user._id }]
    })
      .populate('player1 player2', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    // Format recent matches for frontend
    const formattedMatches = recentMatches.map(match => {
      const isPlayer1 = match.player1._id.toString() === req.user._id.toString();
      const opponent = isPlayer1 ? match.player2.username : match.player1.username;
      const userScore = isPlayer1 ? match.player1Score : match.player2Score;
      const opponentScore = isPlayer1 ? match.player2Score : match.player1Score;
      
      let result = 'draw';
      if (match.winner) {
        result = match.winner.toString() === req.user._id.toString() ? 'win' : 'loss';
      }

      // Calculate XP gained (you can adjust this logic)
      let xpGained = 25; // Base XP
      if (result === 'win') xpGained += 25; // Winner bonus
      xpGained += Math.floor(userScore / 10); // Score bonus

      return {
        id: match._id,
        opponent,
        problem: match.problem || 'Coding Challenge',
        result,
        time: match.createdAt.toLocaleDateString(),
        duration: match.duration ? `${Math.floor(match.duration / 60000)}m ${Math.floor((match.duration % 60000) / 1000)}s` : '10m 0s',
        xpGained
      };
    });

    // Calculate user's rank (you might want to cache this)
    const userRank = await User.countDocuments({ xp: { $gt: user.xp } }) + 1;

    // Calculate achievements
    const achievements = {
      firstWin: user.wins > 0,
      winStreak: await calculateWinStreak(req.user._id),
      problemsSolved: user.totalMatches || 0,
      totalXp: user.xp || 0
    };

    // Enhanced user profile response
    const profileData = {
      id: user._id,
      username: user.username,
      email: user.email,
      xp: user.xp || 0,
      level: user.level || 1,
      wins: user.wins || 0,
      totalMatches: user.totalMatches || 0,
      winRate: user.winRate || 0,
      rank: userRank,
      joinDate: user.createdAt,
      avatar: user.avatar,
      badges: user.badges || [],
      recentMatches: formattedMatches,
      achievements
    };

    res.json({ user: profileData });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, email } = req.body;
    
    // Validate input
    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required' });
    }

    // Check if username is already taken by another user
    const existingUser = await User.findOne({ 
      username, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Check if email is already taken by another user
    const existingEmail = await User.findOne({ 
      email, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already taken' });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { username, email },
      { new: true }
    ).select('-password');

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload avatar
router.post('/avatar', auth, async (req, res) => {
  try {
    const { avatar } = req.body;
    
    if (!avatar) {
      return res.status(400).json({ message: 'Avatar URL is required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatar },
      { new: true }
    ).select('-password');

    res.json({ 
      message: 'Avatar updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Avatar update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user badges
router.get('/badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('badges');
    res.json({ badges: user.badges || [] });
  } catch (error) {
    console.error('Badges fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add badge to user (this would typically be called by your game logic)
router.post('/badges', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // Check if user already has this badge
    const existingBadge = user.badges.find(badge => badge.name === name);
    if (existingBadge) {
      return res.status(400).json({ message: 'Badge already earned' });
    }

    const newBadge = {
      id: Date.now().toString(),
      name,
      description,
      earnedAt: new Date()
    };

    user.badges.push(newBadge);
    await user.save();

    res.json({ 
      message: 'Badge earned!',
      badge: newBadge 
    });
  } catch (error) {
    console.error('Badge add error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get detailed match statistics
    const matchStats = await Match.aggregate([
      {
        $match: {
          $or: [
            { player1: req.user._id },
            { player2: req.user._id }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalMatches: { $sum: 1 },
          wins: {
            $sum: {
              $cond: [
                { $eq: ['$winner', req.user._id] },
                1,
                0
              ]
            }
          },
          averageDuration: { $avg: '$duration' },
          totalDuration: { $sum: '$duration' }
        }
      }
    ]);

    const stats = matchStats[0] || {
      totalMatches: 0,
      wins: 0,
      averageDuration: 0,
      totalDuration: 0
    };

    res.json({
      level: user.level || 1,
      xp: user.xp || 0,
      wins: stats.wins,
      totalMatches: stats.totalMatches,
      winRate: stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0,
      averageMatchDuration: Math.round(stats.averageDuration / 1000) || 0, // in seconds
      totalPlayTime: Math.round(stats.totalDuration / 1000) || 0, // in seconds
      rank: await User.countDocuments({ xp: { $gt: user.xp } }) + 1
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate win streak
async function calculateWinStreak(userId) {
  try {
    const recentMatches = await Match.find({
      $or: [{ player1: userId }, { player2: userId }]
    })
      .sort({ createdAt: -1 })
      .limit(20);

    let currentStreak = 0;
    let maxStreak = 0;

    for (const match of recentMatches) {
      if (match.winner && match.winner.toString() === userId.toString()) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  } catch (error) {
    console.error('Error calculating win streak:', error);
    return 0;
  }
}

module.exports = router;