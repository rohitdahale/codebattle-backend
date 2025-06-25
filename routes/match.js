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

// Get match history with pagination and filtering
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      search = '',
      result = '',
      difficulty = '',
      language = ''
    } = req.query;

    // Build match filter
    const matchFilter = {
      $or: [
        { player1: userId },
        { player2: userId }
      ]
    };

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'player1',
          foreignField: '_id',
          as: 'player1Info'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'player2',
          foreignField: '_id',
          as: 'player2Info'
        }
      },
      {
        $addFields: {
          player1Info: { $arrayElemAt: ['$player1Info', 0] },
          player2Info: { $arrayElemAt: ['$player2Info', 0] },
          isPlayer1: { $eq: ['$player1', userId] },
          opponent: {
            $cond: {
              if: { $eq: ['$player1', userId] },
              then: { $arrayElemAt: ['$player2Info.username', 0] },
              else: { $arrayElemAt: ['$player1Info.username', 0] }
            }
          },
          userScore: {
            $cond: {
              if: { $eq: ['$player1', userId] },
              then: '$player1Score',
              else: '$player2Score'
            }
          },
          opponentScore: {
            $cond: {
              if: { $eq: ['$player1', userId] },
              then: '$player2Score',
              else: '$player1Score'
            }
          },
          result: {
            $cond: {
              if: { $eq: ['$winner', userId] },
              then: 'win',
              else: {
                $cond: {
                  if: { $eq: ['$winner', null] },
                  then: 'draw',
                  else: 'loss'
                }
              }
            }
          }
        }
      }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { opponent: { $regex: search, $options: 'i' } },
            { problem: { $regex: search, $options: 'i' } },
            { 'problemDetails.title': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add result filter if provided
    if (result && result !== 'all') {
      pipeline.push({
        $match: { result: result }
      });
    }

    // Add difficulty filter if provided
    if (difficulty && difficulty !== 'all') {
      pipeline.push({
        $match: { difficulty: difficulty }
      });
    }

    // Add language filter if provided
    if (language && language !== 'all') {
      pipeline.push({
        $match: { language: language }
      });
    }

    // Add sorting
    pipeline.push({
      $sort: { createdAt: -1 }
    });

    // Get total count for pagination
    const totalPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Match.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    // Execute aggregation
    const matches = await Match.aggregate(pipeline);

    // Format matches for frontend
    const formattedMatches = matches.map(match => {
      // Calculate XP gained
      let xpGained = 25; // Base XP
      if (match.result === 'win') {
        xpGained += 25; // Winner bonus
      } else if (match.result === 'loss') {
        xpGained -= 10; // Loss penalty
      }
      xpGained += Math.floor((match.userScore || 0) / 10); // Score bonus

      // Format duration
      const durationInSeconds = match.duration ? Math.floor(match.duration / 1000) : 600;
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;

      // Format date and time
      const matchDate = new Date(match.createdAt);
      const date = matchDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const time = matchDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      return {
        id: match._id,
        opponent: match.opponent || 'Unknown',
        problem: match.problem || match.problemDetails?.title || 'Coding Challenge',
        result: match.result,
        time: time,
        date: date,
        duration: durationInSeconds,
        xpGained: xpGained,
        difficulty: match.difficulty || 'medium',
        language: match.language || 'javascript',
        userScore: match.userScore || 0,
        opponentScore: match.opponentScore || 0
      };
    });

    res.json({
      success: true,
      matches: formattedMatches,
      total: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      hasNextPage: skip + parseInt(limit) < total,
      hasPrevPage: parseInt(page) > 1
    });

  } catch (error) {
    console.error('Match history fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Match.aggregate([
      {
        $match: {
          $or: [
            { player1: userId },
            { player2: userId }
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
                { $eq: ['$winner', userId] },
                1,
                0
              ]
            }
          },
          losses: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$winner', null] },
                    { $ne: ['$winner', userId] }
                  ]
                },
                1,
                0
              ]
            }
          },
          draws: {
            $sum: {
              $cond: [
                { $eq: ['$winner', null] },
                1,
                0
              ]
            }
          },
          totalDuration: { $sum: '$duration' },
          averageDuration: { $avg: '$duration' },
          totalScore: {
            $sum: {
              $cond: {
                if: { $eq: ['$player1', userId] },
                then: '$player1Score',
                else: '$player2Score'
              }
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalDuration: 0,
      averageDuration: 0,
      totalScore: 0
    };

    // Calculate additional stats
    const winRate = result.totalMatches > 0 
      ? Math.round((result.wins / result.totalMatches) * 100) 
      : 0;

    const averageScore = result.totalMatches > 0 
      ? Math.round(result.totalScore / result.totalMatches) 
      : 0;

    const averageDurationSeconds = result.averageDuration 
      ? Math.round(result.averageDuration / 1000) 
      : 0;

    const totalPlayTimeSeconds = result.totalDuration 
      ? Math.round(result.totalDuration / 1000) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalMatches: result.totalMatches,
        wins: result.wins,
        losses: result.losses,
        draws: result.draws,
        winRate: winRate,
        averageScore: averageScore,
        averageDuration: averageDurationSeconds,
        totalPlayTime: totalPlayTimeSeconds
      }
    });

  } catch (error) {
    console.error('Match stats fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;