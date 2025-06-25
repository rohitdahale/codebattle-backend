const Match = require('../models/Match');
const User = require('../models/User');
const CodeEvaluator = require('../utils/CodeEvaluator');

class QuickMatchSystem {
  constructor(io) {
    this.io = io;
    this.waitingPlayers = new Map(); // userId -> socket
    this.activeMatches = new Map(); // matchId -> match data
    this.playerToMatch = new Map(); // userId -> matchId
    this.codeEvaluator = new CodeEvaluator();
  }

  addPlayerToQueue(socket) {
    const userId = socket.userId;
    console.log(`Player ${socket.username} (${userId}) joined queue`);

    // Remove from any existing queue entry
    this.waitingPlayers.delete(userId);

    // Add to waiting queue
    this.waitingPlayers.set(userId, socket);

    // Try to find a match immediately
    this.tryCreateMatch(socket);

    // Notify player they're in queue
    socket.emit('queue_joined', {
      message: 'Searching for opponent...',
      queueSize: this.waitingPlayers.size
    });
  }

  removePlayerFromQueue(userId) {
    const socket = this.waitingPlayers.get(userId);
    if (socket) {
      this.waitingPlayers.delete(userId);
      socket.emit('queue_left', { message: 'Left matchmaking queue' });
      console.log(`Player ${userId} left queue`);
    }
  }

  tryCreateMatch(newPlayerSocket) {
    // Need at least 2 players
    if (this.waitingPlayers.size < 2) return;

    const players = Array.from(this.waitingPlayers.entries());
    
    // Find another player (not the one who just joined)
    let opponent = null;
    for (const [userId, socket] of players) {
      if (userId !== newPlayerSocket.userId) {
        opponent = { userId, socket };
        break;
      }
    }

    if (opponent) {
      this.createMatch(newPlayerSocket, opponent.socket);
    }
  }

  async createMatch(player1Socket, player2Socket) {
    const matchId = this.generateMatchId();

    try {
      // Load random problem
      const problems = require('../data/problems.json');
      const randomProblem = problems[Math.floor(Math.random() * problems.length)];

      const match = {
        id: matchId,
        player1: {
          id: player1Socket.userId,
          username: player1Socket.username,
          socketId: player1Socket.id,
          ready: false,
          code: '',
          submitted: false,
          score: 0,
          submissionTime: null
        },
        player2: {
          id: player2Socket.userId,
          username: player2Socket.username,
          socketId: player2Socket.id,
          ready: false,
          code: '',
          submitted: false,
          score: 0,
          submissionTime: null
        },
        problem: randomProblem,
        status: 'waiting', // waiting, active, finished
        startTime: null,
        endTime: null,
        winner: null,
        duration: 10 * 60 * 1000 // 10 minutes in milliseconds
      };

      // Remove players from queue
      this.waitingPlayers.delete(player1Socket.userId);
      this.waitingPlayers.delete(player2Socket.userId);

      // Store match
      this.activeMatches.set(matchId, match);
      this.playerToMatch.set(player1Socket.userId, matchId);
      this.playerToMatch.set(player2Socket.userId, matchId);

      // Join both players to match room
      player1Socket.join(matchId);
      player2Socket.join(matchId);

      // Prepare match data for both players
      const baseMatchData = {
        matchId,
        opponent: match.player2.username,
        problem: match.problem,
        timeLimit: match.duration
      };

      // Send match_found event with opponent info
      player1Socket.emit('match_found', {
        ...baseMatchData,
        opponent: match.player2.username
      });

      player2Socket.emit('match_found', {
        ...baseMatchData,
        opponent: match.player1.username
      });

      console.log(`Match created: ${match.player1.username} vs ${match.player2.username}`);

    } catch (error) {
      console.error('Error creating match:', error);
      // Notify players of error
      player1Socket.emit('match_error', { message: 'Failed to create match' });
      player2Socket.emit('match_error', { message: 'Failed to create match' });
    }
  }

  playerReady(userId) {
    const matchId = this.playerToMatch.get(userId);
    if (!matchId) return;

    const match = this.activeMatches.get(matchId);
    if (!match) return;

    // Mark player as ready
    if (match.player1.id === userId) {
      match.player1.ready = true;
    } else if (match.player2.id === userId) {
      match.player2.ready = true;
    }

    // Notify other player about ready status
    this.io.to(matchId).emit('player_ready_status', {
      player1Ready: match.player1.ready,
      player2Ready: match.player2.ready
    });

    // Check if both players are ready
    if (match.player1.ready && match.player2.ready) {
      this.startMatch(matchId);
    }
  }

  startMatch(matchId) {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    match.status = 'active';
    match.startTime = Date.now();

    // Notify both players that match has started
    this.io.to(matchId).emit('match_started', {
      problem: match.problem,
      timeLimit: match.duration,
      startTime: match.startTime,
      matchId: matchId,
      opponent: null // This will be set per player in the frontend
    });

    // Set match timer
    setTimeout(() => {
      this.endMatch(matchId, 'timeout');
    }, match.duration);

    console.log(`Match started: ${matchId}`);
  }

  submitCode(userId, code) {
    const matchId = this.playerToMatch.get(userId);
    if (!matchId) return;

    const match = this.activeMatches.get(matchId);
    if (!match || match.status !== 'active') return;

    // Update player's code
    if (match.player1.id === userId) {
      match.player1.code = code;
      match.player1.submitted = true;
      match.player1.submissionTime = Date.now();
    } else if (match.player2.id === userId) {
      match.player2.code = code;
      match.player2.submitted = true;
      match.player2.submissionTime = Date.now();
    }

    // Notify other player about submission
    this.io.to(matchId).emit('opponent_submitted', {
      player1Submitted: match.player1.submitted,
      player2Submitted: match.player2.submitted
    });

    // Check if both players submitted
    if (match.player1.submitted && match.player2.submitted) {
      this.endMatch(matchId, 'both_submitted');
    }
  }

  async endMatch(matchId, reason) {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    match.status = 'finished';
    match.endTime = Date.now();

    try {
      // Evaluate submissions
      const player1Score = await this.codeEvaluator.evaluateCode(match.player1.code, match.problem);
      const player2Score = await this.codeEvaluator.evaluateCode(match.player2.code, match.problem);

      match.player1.score = player1Score;
      match.player2.score = player2Score;

      // Determine winner (consider both score and submission time)
      if (player1Score > player2Score) {
        match.winner = match.player1.id;
    } else if (player2Score > player1Score) {
        match.winner = match.player2.id;
    } else {
        // If scores are equal, check submission time (earlier submission wins)
        if (match.player1.submissionTime && match.player2.submissionTime) {
            match.winner = match.player1.submissionTime < match.player2.submissionTime 
                ? match.player1.id 
                : match.player2.id;
        } else if (match.player1.submissionTime && !match.player2.submissionTime) {
            match.winner = match.player1.id; // Player 1 submitted, player 2 didn't
        } else if (match.player2.submissionTime && !match.player1.submissionTime) {
            match.winner = match.player2.id; // Player 2 submitted, player 1 didn't
        } else {
            match.winner = null; // Both didn't submit - draw
        }
    }    

      // Save match to database
      await this.saveMatchToDatabase(match);

      // Notify players
      this.io.to(matchId).emit('match_ended', {
        winner: match.winner,
        player1: {
          id: match.player1.id,
          username: match.player1.username,
          score: match.player1.score,
          code: match.player1.code
        },
        player2: {
          id: match.player2.id,
          username: match.player2.username,
          score: match.player2.score,
          code: match.player2.code
        },
        reason,
        matchDuration: match.endTime - match.startTime
      });

      console.log(`Match ended: ${matchId}, Winner: ${match.winner || 'Draw'}`);

    } catch (error) {
      console.error('Error ending match:', error);
      this.io.to(matchId).emit('match_error', { 
        message: 'Error processing match results' 
      });
    } finally {
      // Cleanup
      this.playerToMatch.delete(match.player1.id);
      this.playerToMatch.delete(match.player2.id);
      this.activeMatches.delete(matchId);
    }
  }

  async saveMatchToDatabase(match) {
    try {
      // Save match record
      const matchRecord = new Match({
        player1: match.player1.id,
        player2: match.player2.id,
        problem: match.problem.title,
        winner: match.winner,
        player1Score: match.player1.score,
        player2Score: match.player2.score,
        player1Code: match.player1.code,
        player2Code: match.player2.code,
        duration: match.endTime - match.startTime,
        startTime: new Date(match.startTime),
        endTime: new Date(match.endTime)
      });

      await matchRecord.save();

      // Update user stats
      await this.updateUserStats(match.player1.id, match.winner === match.player1.id, match.player1.score);
      await this.updateUserStats(match.player2.id, match.winner === match.player2.id, match.player2.score);

    } catch (error) {
      console.error('Error saving match:', error);
    }
  }

  async updateUserStats(userId, isWinner, score) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.totalMatches = (user.totalMatches || 0) + 1;
        if (isWinner) {
          user.wins = (user.wins || 0) + 1;
        }

        // XP calculation based on performance
        let xpGained = 25; // Base XP
        if (isWinner) xpGained += 25; // Winner bonus
        xpGained += Math.floor(score / 10); // Score bonus

        user.xp = (user.xp || 0) + xpGained;
        user.winRate = Math.round(((user.wins || 0) / user.totalMatches) * 100);

        // Level up logic
        const newLevel = Math.floor(user.xp / 200) + 1;
        if (newLevel > (user.level || 1)) {
          user.level = newLevel;
        }

        await user.save();
      }
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  getPlayerMatch(userId) {
    return this.playerToMatch.get(userId);
  }

  getMatchData(matchId) {
    return this.activeMatches.get(matchId);
  }

  generateMatchId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  handleDisconnect(userId) {
    // Remove from queue
    this.removePlayerFromQueue(userId);

    // Handle active match
    const matchId = this.playerToMatch.get(userId);
    if (matchId) {
      const match = this.activeMatches.get(matchId);
      if (match && (match.status === 'active' || match.status === 'waiting')) {
        // Notify other player
        this.io.to(matchId).emit('opponent_disconnected');

        if (match.status === 'active') {
          // End match, declare other player winner
          const otherPlayerId = match.player1.id === userId ? match.player2.id : match.player1.id;
          match.winner = otherPlayerId;
          this.endMatch(matchId, 'opponent_disconnected');
        } else {
          // Just cleanup if match hasn't started
          this.playerToMatch.delete(match.player1.id);
          this.playerToMatch.delete(match.player2.id);
          this.activeMatches.delete(matchId);
        }
      }
    }
  }

  // Admin/Debug methods
  getSystemStatus() {
    return {
      waitingPlayers: this.waitingPlayers.size,
      activeMatches: this.activeMatches.size,
      totalPlayers: this.playerToMatch.size
    };
  }

  forceEndMatch(matchId, reason = 'admin_ended') {
    this.endMatch(matchId, reason);
  }
}

module.exports = QuickMatchSystem;