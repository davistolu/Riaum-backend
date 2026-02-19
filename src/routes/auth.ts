import express from 'express';
import { body, validationResult } from 'express-validator';
import passport from '../config/passport';
import {
  register,
  login,
  anonymousLogin,
  oauthLogin,
  getCurrentUser,
  updateProfile,
  logout
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { trackAnalytics } from '../middleware/analytics';

const router: express.Router = express.Router();

// Handle validation errors
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  next();
};

// Validation middleware
const registerValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const profileUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications must be a boolean'),
  body('preferences.dataSharing')
    .optional()
    .isBoolean()
    .withMessage('Data sharing must be a boolean')
];

// Routes
router.post('/register', registerValidation, handleValidationErrors, trackAnalytics('login'), register);
router.post('/login', loginValidation, handleValidationErrors, trackAnalytics('login'), login);
router.post('/anonymous', anonymousLogin);
router.post('/oauth', oauthLogin);
router.get('/me', authenticate, getCurrentUser);
router.put('/profile', authenticate, profileUpdateValidation, handleValidationErrors, updateProfile);
router.post('/logout', authenticate, trackAnalytics('logout'), logout);

// Google OAuth routes
router.get('/google', passport.authenticate('google'));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/login?error=oauth_failed` }),
  async (req: any, res: express.Response) => {
    try {
      // Generate JWT token for the authenticated user
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        username: req.user.username,
        name: req.user.name,
        email: req.user.email,
        accountType: req.user.accountType,
        memberSince: req.user.memberSince,
        preferences: req.user.preferences,
        profilePicture: req.user.profilePicture
      }))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_failed`);
    }
  }
);

export default router;
