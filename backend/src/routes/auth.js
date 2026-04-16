const router = require('express').Router();
const { register, login, me } = require('../controllers/authController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Public
router.post('/login', login);

// Protected — only run_manager can create new users
router.post('/register', auth, authorize('run_manager'), register);

// Protected — get current user from token
router.get('/me', auth, me);

module.exports = router;
