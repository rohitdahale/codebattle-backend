const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  // Players
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  player2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Match details
  problem: {
    type: String,
    required: true
  },
  problemData: {
    title: String,
    description: String,
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium'
    },
    category: String,
    tags: [String]
  },
  
  // Results
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Scores and performance
  player1Score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  player2Score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Code submissions
  player1Code: {
    type: String,
    default: ''
  },
  player2Code: {
    type: String,
    default: ''
  },
  
  // Submission details
  player1SubmissionTime: {
    type: Date,
    default: null
  },
  player2SubmissionTime: {
    type: Date,
    default: null
  },
  
  // Match timing
  duration: {
    type: Number, // in milliseconds
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  
  // Match status and metadata
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished', 'cancelled'],
    default: 'waiting'
  },
  endReason: {
    type: String,
    enum: ['completed', 'timeout', 'disconnect', 'both_submitted', 'admin_ended'],
    default: 'completed'
  },
  
  // XP rewards
  player1XpGained: {
    type: Number,
    default: 0
  },
  player2XpGained: {
    type: Number,
    default: 0
  },
  
  // Match type
  matchType: {
    type: String,
    enum: ['quick', 'room', 'tournament', 'practice'],
    default: 'quick'
  },
  
  // Additional metadata
  metadata: {
    matchId: String,
    serverVersion: String,
    clientVersions: {
      player1: String,
      player2: String
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
MatchSchema.index({ player1: 1, createdAt: -1 });
MatchSchema.index({ player2: 1, createdAt: -1 });
MatchSchema.index({ winner: 1 });
MatchSchema.index({ createdAt: -1 });
MatchSchema.index({ status: 1 });

// Compound index for player match history
MatchSchema.index([
  { player1: 1, player2: 1 },
  { createdAt: -1 }
]);

// Virtual to get match result for a specific player
MatchSchema.methods.getResultForPlayer = function(playerId) {
  if (!this.winner) return 'draw';
  return this.winner.toString() === playerId.toString() ? 'win' : 'loss';
};

// Virtual to get opponent for a specific player
MatchSchema.methods.getOpponentForPlayer = function(playerId) {
  if (this.player1._id.toString() === playerId.toString()) {
    return this.player2;
  } else if (this.player2._id.toString() === playerId.toString()) {
    return this.player1;
  }
  return null;
};

// Method to calculate XP for a match result
MatchSchema.methods.calculateXP = function(playerId, isWinner, score) {
  let xp = 25; // Base XP for participation
  
  if (isWinner) {
    xp += 25; // Winner bonus
  }
  
  // Score bonus (0-25 XP based on score)
  xp += Math.floor(score / 4);
  
  // Time bonus (faster completion = more XP)
  if (this.duration < 300000) { // Less than 5 minutes
    xp += 10;
  } else if (this.duration < 600000) { // Less than 10 minutes
    xp += 5;
  }
  
  return Math.min(xp, 100); // Cap at 100 XP per match
};

// Static method to get match statistics for a user
MatchSchema.statics.getPlayerStats = async function(playerId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { player1: playerId },
          { player2: playerId }
        ],
        status: 'finished'
      }
    },
    {
      $group: {
        _id: null,
        totalMatches: { $sum: 1 },
        wins: {
          $sum: {
            $cond: [
              { $eq: ['$winner', playerId] },
              1,
              0
            ]
          }
        },
        totalDuration: { $sum: '$duration' },
        averageScore: {
          $avg: {
            $cond: [
              { $eq: ['$player1', playerId] },
              '$player1Score',
              '$player2Score'
            ]
          }
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalMatches: 0,
      wins: 0,
      winRate: 0,
      totalDuration: 0,
      averageScore: 0
    };
  }
  
  const result = stats[0];
  result.winRate = result.totalMatches > 0 ? 
    Math.round((result.wins / result.totalMatches) * 100) : 0;
  
  return result;
};

module.exports = mongoose.model('Match', MatchSchema);