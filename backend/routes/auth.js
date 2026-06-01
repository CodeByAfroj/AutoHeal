const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const router = express.Router();


router.get('/github', passport.authenticate('github', {
  scope: ['user:email', 'repo', 'admin:repo_hook']
}));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed` }),
  (req, res) => {

    const token = jwt.sign(
      { userId: req.user._id, username: req.user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
);

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    id: req.user._id,
    githubId: req.user.githubId,
    username: req.user.username,
    displayName: req.user.displayName,
    email: req.user.email,
    avatarUrl: req.user.avatarUrl,
    createdAt: req.user.createdAt
  });
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
