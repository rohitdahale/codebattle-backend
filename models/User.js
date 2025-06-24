const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true,
    unique: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  // Gaming stats
  level: {
    type: Number,
    default: 1
  },
  xp: {
    type: Number,
    default: 0
  },
  wins: {
    type: Number,
    default: 0
  },
  totalMatches: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  badges: [{
    id: String,
    name: String,
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  recentMatches: [{
    id: String,
    opponent: String,
    problem: String,
    result: String, // 'win', 'loss', 'draw'
    time: String
  }]
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
