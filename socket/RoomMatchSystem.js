const Match = require('../models/Match');
const User = require('../models/User');
const CodeEvaluator = require('../utils/CodeEvaluator');

class RoomMatchSystem {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomCode -> room data
        this.playerToRoom = new Map(); // userId -> roomCode
        this.codeEvaluator = new CodeEvaluator();
    }

    generateRoomCode() {
        // Generate 6-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createRoom(socket, roomSettings = {}) {
        const roomCode = this.generateRoomCode();
        const userId = socket.userId;

        // Remove player from any existing room
        this.leaveRoom(userId);

        // Load random problem
        const problems = require('../data/problems.json');
        const randomProblem = problems[Math.floor(Math.random() * problems.length)];

        const room = {
            code: roomCode,
            host: {
                id: userId,
                username: socket.username,
                socketId: socket.id,
                ready: false,
                code: '',
                submitted: false,
                score: 0,
                submissionTime: null
            },
            guest: null,
            problem: roomSettings.problemId ? 
                problems.find(p => p.id === roomSettings.problemId) || randomProblem : 
                randomProblem,
            settings: {
                isPrivate: roomSettings.isPrivate || false,
                timeLimit: roomSettings.timeLimit || 10 * 60 * 1000, // 10 minutes default
                difficulty: roomSettings.difficulty || 'any',
                category: roomSettings.category || 'any'
            },
            status: 'waiting', // waiting, ready, active, finished
            startTime: null,
            endTime: null,
            winner: null,
            createdAt: Date.now()
        };

        // Store room
        this.rooms.set(roomCode, room);
        this.playerToRoom.set(userId, roomCode);

        // Join socket room
        socket.join(roomCode);

        // Notify room created
        socket.emit('room_created', {
            roomCode,
            room: {
                code: roomCode,
                host: room.host.username,
                guest: null,
                problem: room.problem,
                settings: room.settings,
                status: room.status
            }
        });

        console.log(`Room ${roomCode} created by ${socket.username}`);
        return roomCode;
    }

    startRoomMatch(userId) {
        const roomCode = this.playerToRoom.get(userId);
        if (!roomCode) return false;
    
        const room = this.rooms.get(roomCode);
        if (!room || room.host.id !== userId) return false; // Only host can start
        
        if (!room.guest) return false; // Need both players
        
        if (room.status !== 'ready') return false; // Room must be ready
    
        // Start the match immediately (skip ready phase for room matches)
        room.status = 'active';
        room.startTime = Date.now();
    
        // Reset submissions and scores
        room.host.submitted = false;
        room.host.code = '';
        room.host.score = 0;
        room.host.submissionTime = null;
    
        room.guest.submitted = false;
        room.guest.code = '';
        room.guest.score = 0;
        room.guest.submissionTime = null;
    
        // Notify room updated first
        this.io.to(roomCode).emit('room_updated', {
            room: {
                code: roomCode,
                host: room.host.username,
                guest: room.guest.username,
                problem: room.problem,
                settings: room.settings,
                status: room.status
            }
        });
    
        // Then notify match started
        this.io.to(roomCode).emit('match_started', {
            problem: room.problem,
            timeLimit: room.settings.timeLimit,
            startTime: room.startTime,
            roomCode: roomCode
        });
    
        // Set match timer
        setTimeout(() => {
            this.endMatch(roomCode, 'timeout');
        }, room.settings.timeLimit);
    
        console.log(`Room match started in ${roomCode} by host ${room.host.username}`);
        return true;
    }
    

    joinRoom(socket, roomCode) {
        const userId = socket.userId;
        const room = this.rooms.get(roomCode.toUpperCase());
    
        if (!room) {
            socket.emit('room_error', { message: 'Room not found' });
            return false;
        }
    
        if (room.status !== 'waiting') {
            socket.emit('room_error', { message: 'Room is not available for joining' });
            return false;
        }
    
        if (room.guest) {
            socket.emit('room_error', { message: 'Room is full' });
            return false;
        }
    
        if (room.host.id === userId) {
            socket.emit('room_error', { message: 'You are already the host of this room' });
            return false;
        }
    
        // Remove player from any existing room
        this.leaveRoom(userId);
    
        // Add as guest
        room.guest = {
            id: userId,
            username: socket.username,
            socketId: socket.id,
            ready: false,
            code: '',
            submitted: false,
            score: 0,
            submissionTime: null
        };
    
        // FIXED: Set status to 'ready' when both players are present
        room.status = 'ready';
    
        // Store player mapping
        this.playerToRoom.set(userId, roomCode);
    
        // Join socket room
        socket.join(roomCode);
    
        // Notify both players
        this.io.to(roomCode).emit('room_updated', {
            room: {
                code: roomCode,
                host: room.host.username,
                guest: room.guest.username,
                problem: room.problem,
                settings: room.settings,
                status: room.status
            }
        });
    
        socket.emit('room_joined', {
            roomCode,
            room: {
                code: roomCode,
                host: room.host.username,
                guest: room.guest.username,
                problem: room.problem,
                settings: room.settings,
                status: room.status
            }
        });
    
        console.log(`${socket.username} joined room ${roomCode}`);
        return true;
    }
    

    leaveRoom(userId) {
        const roomCode = this.playerToRoom.get(userId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room) return;

        // Remove player mapping
        this.playerToRoom.delete(userId);

        if (room.host.id === userId) {
            // Host left - either promote guest or close room
            if (room.guest) {
                // Promote guest to host
                room.host = { ...room.guest };
                room.guest = null;
                room.status = 'waiting';

                this.io.to(roomCode).emit('room_updated', {
                    room: {
                        code: roomCode,
                        host: room.host.username,
                        guest: null,
                        problem: room.problem,
                        settings: room.settings,
                        status: room.status
                    }
                });

                this.io.to(roomCode).emit('room_message', {
                    message: 'Host left. You are now the host.',
                    type: 'info'
                });
            } else {
                // No guest, close room
                this.rooms.delete(roomCode);
            }
        } else if (room.guest && room.guest.id === userId) {
            // Guest left
            room.guest = null;
            room.status = 'waiting';

            this.io.to(roomCode).emit('room_updated', {
                room: {
                    code: roomCode,
                    host: room.host.username,
                    guest: null,
                    problem: room.problem,
                    settings: room.settings,
                    status: room.status
                }
            });

            this.io.to(roomCode).emit('room_message', {
                message: 'Guest left the room.',
                type: 'info'
            });
        }

        console.log(`User ${userId} left room ${roomCode}`);
    }

    playerReady(userId) {
        const roomCode = this.playerToRoom.get(userId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room || room.status !== 'ready') return;

        // Mark player as ready
        if (room.host.id === userId) {
            room.host.ready = true;
        } else if (room.guest && room.guest.id === userId) {
            room.guest.ready = true;
        }

        // Notify players about ready status
        this.io.to(roomCode).emit('player_ready_status', {
            hostReady: room.host.ready,
            guestReady: room.guest ? room.guest.ready : false
        });

        // Check if both players are ready
        if (room.host.ready && room.guest && room.guest.ready) {
            this.startMatch(roomCode);
        }
    }

    startMatch(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return;

        room.status = 'active';
        room.startTime = Date.now();

        // Reset ready status and submissions
        room.host.ready = false;
        room.host.submitted = false;
        room.host.code = '';
        room.host.score = 0;
        room.host.submissionTime = null;

        if (room.guest) {
            room.guest.ready = false;
            room.guest.submitted = false;
            room.guest.code = '';
            room.guest.score = 0;
            room.guest.submissionTime = null;
        }

        // Notify both players that match has started
        this.io.to(roomCode).emit('match_started', {
            problem: room.problem,
            timeLimit: room.settings.timeLimit,
            startTime: room.startTime,
            roomCode: roomCode
        });

        // Set match timer
        setTimeout(() => {
            this.endMatch(roomCode, 'timeout');
        }, room.settings.timeLimit);

        console.log(`Match started in room ${roomCode}`);
    }

    submitCode(userId, code) {
        const roomCode = this.playerToRoom.get(userId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room || room.status !== 'active') return;

        // Update player's code
        if (room.host.id === userId) {
            room.host.code = code;
            room.host.submitted = true;
            room.host.submissionTime = Date.now();
        } else if (room.guest && room.guest.id === userId) {
            room.guest.code = code;
            room.guest.submitted = true;
            room.guest.submissionTime = Date.now();
        }

        // Notify about submission
        this.io.to(roomCode).emit('opponent_submitted', {
            hostSubmitted: room.host.submitted,
            guestSubmitted: room.guest ? room.guest.submitted : false
        });

        // Check if both players submitted
        if (room.host.submitted && room.guest && room.guest.submitted) {
            this.endMatch(roomCode, 'both_submitted');
        }
    }

    async endMatch(roomCode, reason) {
        const room = this.rooms.get(roomCode);
        if (!room) return;

        room.status = 'finished';
        room.endTime = Date.now();

        try {
            // Evaluate submissions
            const hostScore = await this.codeEvaluator.evaluateCode(room.host.code, room.problem);
            const guestScore = room.guest ? 
                await this.codeEvaluator.evaluateCode(room.guest.code, room.problem) : 0;

            room.host.score = hostScore;
            if (room.guest) room.guest.score = guestScore;

            // Determine winner
            if (room.guest) {
                if (hostScore > guestScore) {
                    room.winner = room.host.id;
                } else if (guestScore > hostScore) {
                    room.winner = room.guest.id;
                } else {
                    // If scores are equal, check submission time
                    if (room.host.submissionTime && room.guest.submissionTime) {
                        room.winner = room.host.submissionTime < room.guest.submissionTime ? 
                            room.host.id : room.guest.id;
                    } else if (room.host.submissionTime && !room.guest.submissionTime) {
                        room.winner = room.host.id;
                    } else if (room.guest.submissionTime && !room.host.submissionTime) {
                        room.winner = room.guest.id;
                    } else {
                        room.winner = null; // Draw
                    }
                }
            } else {
                // Only host present
                room.winner = room.host.id;
            }

            // Save match to database if both players participated
            if (room.guest) {
                await this.saveMatchToDatabase(room);
            }

            // Notify players
            this.io.to(roomCode).emit('match_ended', {
                winner: room.winner,
                host: {
                    id: room.host.id,
                    username: room.host.username,
                    score: room.host.score,
                    code: room.host.code
                },
                guest: room.guest ? {
                    id: room.guest.id,
                    username: room.guest.username,
                    score: room.guest.score,
                    code: room.guest.code
                } : null,
                reason,
                matchDuration: room.endTime - room.startTime
            });

            // Reset room for another match
            setTimeout(() => {
                if (this.rooms.has(roomCode)) {
                    room.status = 'ready';
                    room.startTime = null;
                    room.endTime = null;
                    room.winner = null;
                    
                    if (room.host) {
                        room.host.ready = false;
                        room.host.submitted = false;
                        room.host.code = '';
                        room.host.score = 0;
                        room.host.submissionTime = null;
                    }
                    
                    if (room.guest) {
                        room.guest.ready = false;
                        room.guest.submitted = false;
                        room.guest.code = '';
                        room.guest.score = 0;
                        room.guest.submissionTime = null;
                    }

                    this.io.to(roomCode).emit('room_reset', {
                        room: {
                            code: roomCode,
                            host: room.host.username,
                            guest: room.guest ? room.guest.username : null,
                            problem: room.problem,
                            settings: room.settings,
                            status: room.status
                        }
                    });
                }
            }, 5000); // 5 second delay before allowing new match

            console.log(`Match ended in room ${roomCode}, Winner: ${room.winner || 'Draw'}`);

        } catch (error) {
            console.error('Error ending match:', error);
            this.io.to(roomCode).emit('match_error', { message: 'Error processing match results' });
        }
    }

    async saveMatchToDatabase(room) {
        try {
            if (!room.guest) return; // Only save matches with 2 players

            const matchRecord = new Match({
                player1: room.host.id,
                player2: room.guest.id,
                problem: room.problem.title,
                winner: room.winner,
                player1Score: room.host.score,
                player2Score: room.guest.score,
                player1Code: room.host.code,
                player2Code: room.guest.code,
                duration: room.endTime - room.startTime,
                startTime: new Date(room.startTime),
                endTime: new Date(room.endTime),
                matchType: 'room'
            });

            await matchRecord.save();

            // Update user stats
            await this.updateUserStats(room.host.id, room.winner === room.host.id, room.host.score);
            await this.updateUserStats(room.guest.id, room.winner === room.guest.id, room.guest.score);
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

                // XP calculation
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

    changeProblem(userId, problemId = null) {
        const roomCode = this.playerToRoom.get(userId);
        if (!roomCode) return false;

        const room = this.rooms.get(roomCode);
        if (!room || room.host.id !== userId || room.status === 'active') return false;

        const problems = require('../data/problems.json');
        const newProblem = problemId ? 
            problems.find(p => p.id === problemId) : 
            problems[Math.floor(Math.random() * problems.length)];

        if (newProblem) {
            room.problem = newProblem;
            
            // Reset ready status
            room.host.ready = false;
            if (room.guest) room.guest.ready = false;

            this.io.to(roomCode).emit('problem_changed', {
                problem: newProblem,
                hostReady: false,
                guestReady: false
            });

            return true;
        }

        return false;
    }

    handleDisconnect(userId) {
        const roomCode = this.playerToRoom.get(userId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room) return;

        if (room.status === 'active') {
            // End match if in progress
            const otherPlayerId = room.host.id === userId ? 
                (room.guest ? room.guest.id : null) : room.host.id;
            
            if (otherPlayerId) {
                room.winner = otherPlayerId;
                this.endMatch(roomCode, 'opponent_disconnected');
            }
        } else {
            // Handle regular disconnect
            this.leaveRoom(userId);
        }
    }

    getRoomInfo(roomCode) {
        const room = this.rooms.get(roomCode.toUpperCase());
        if (!room) return null;

        return {
            code: roomCode,
            host: room.host.username,
            guest: room.guest ? room.guest.username : null,
            problem: room.problem,
            settings: room.settings,
            status: room.status
        };
    }

    getPlayerRoom(userId) {
        return this.playerToRoom.get(userId);
    }

    // Admin/Debug methods
    getSystemStatus() {
        return {
            totalRooms: this.rooms.size,
            activeRooms: Array.from(this.rooms.values()).filter(r => r.status === 'active').length,
            totalPlayers: this.playerToRoom.size
        };
    }

    getAllRooms() {
        return Array.from(this.rooms.entries()).map(([code, room]) => ({
            code,
            host: room.host.username,
            guest: room.guest ? room.guest.username : null,
            status: room.status,
            createdAt: room.createdAt
        }));
    }
}

module.exports = RoomMatchSystem;