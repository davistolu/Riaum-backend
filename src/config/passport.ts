import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

// Configure Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: '/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ email: profile.emails?.[0]?.value });

        if (user) {
          // Update user info if needed
          if (profile.displayName) user.name = profile.displayName;
          if (profile.photos?.[0]?.value) user.profilePicture = profile.photos[0].value;
          user.accountType = 'registered';
          user.isAnonymous = false;
          await user.save();
        } else {
          // Create new user
          user = new User({
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            accountType: 'registered',
            isAnonymous: false,
            profilePicture: profile.photos?.[0]?.value
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, undefined);
  }
});

export default passport;
