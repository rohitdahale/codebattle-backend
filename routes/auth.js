const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { register, login, verify } = require('../controllers/authController');

// Register route
router.post('/register', register);

// Login route
router.post('/login', login);

// Verify token route
router.get('/verify', auth, verify);

module.exports = router;
