import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { logMood, getMoodHistory, getMoodAnalytics } from '../controllers/moodController';
import { authenticate } from '../middleware/auth';

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

// All mood routes require authentication
router.use(authenticate);

// Validation middleware
const logMoodValidation = [
  body('mood')
    .isInt({ min: 1, max: 5 })
    .withMessage('Mood must be an integer between 1 and 5'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note must be less than 500 characters')
];

const periodValidation = [
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Period must be week, month, quarter, or year')
];

const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

// Routes
router.post('/log', logMoodValidation, handleValidationErrors, logMood);
router.get('/history', daysValidation, handleValidationErrors, getMoodHistory);
router.get('/analytics', periodValidation, handleValidationErrors, getMoodAnalytics);

export default router;
