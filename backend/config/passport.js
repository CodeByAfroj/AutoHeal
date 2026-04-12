const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const { encrypt } = require('../utils/crypto');

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-accessToken');
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `http://localhost:${process.env.PORT || 8000}/auth/github/callback`,
    scope: ['user:email', 'repo', 'admin:repo_hook']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Encrypt the access token before storage
      const encryptedToken = encrypt(accessToken);

      // Upsert user
      const user = await User.findOneAndUpdate(
        { githubId: profile.id },
        {
          githubId: profile.id,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          email: profile.emails?.[0]?.value || '',
          avatarUrl: profile.photos?.[0]?.value || '',
          accessToken: encryptedToken
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return done(null, user);
    } catch (err) {
      console.error('❌ Passport GitHub Strategy Error:', err);
      return done(err, null);
    }
  }
));

module.exports = passport;
