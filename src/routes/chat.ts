import express, { Router, RequestHandler } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  createChat,
  sendAIMessage,
  getUserChats,
  getChatById,
  getChatByRoomId,
  updateMessage,
  deleteChat,
  archiveChat,
  generateChatSummary,
  sendPeerMessage,
  exportChatData
} from '../controllers/chatController';
import { authenticate } from '../middleware/auth';
import { visitorAuth, incrementVisitorMessageCount, VisitorRequest } from '../middleware/visitorAuth';
import { trackAnalytics } from '../middleware/analytics';
import { filterProfanity, detectInappropriateContent } from '../middleware/contentFilter';

// Type assertion helper for authenticated routes
const asAuthenticatedHandler = (handler: (req: any, res: any) => Promise<any>): RequestHandler => {
  return handler as RequestHandler;
};

// Type assertion helper for visitor routes
const asVisitorHandler = (handler: (req: any, res: any) => Promise<any>): RequestHandler => {
  return handler as RequestHandler;
};

// Visitor chat handler wrapper
const withVisitorTracking = (handler: (req: any, res: any) => Promise<any>): RequestHandler => {
  return [incrementVisitorMessageCount, asVisitorHandler(handler)] as any;
};

const router: Router = express.Router();

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

// All chat routes support visitor access (with limitations)
router.use(visitorAuth);

// Validation middleware
const createChatValidation = [
  body('type')
    .optional()
    .isIn(['ai', 'peer', 'live'])
    .withMessage('Chat type must be ai, peer, or live'),
  body('roomId')
    .optional()
    .isMongoId()
    .withMessage('Room ID must be a valid MongoDB ObjectId')
];

const sendMessageValidation = [
  body('chatId')
    .isMongoId()
    .withMessage('Chat ID must be a valid MongoDB ObjectId'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
  body('userMood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('User mood must be an integer between 1 and 5')
];

const updateMessageValidation = [
  param('chatId')
    .isMongoId()
    .withMessage('Chat ID must be a valid MongoDB ObjectId'),
  param('messageId')
    .isUUID()
    .withMessage('Message ID must be a valid UUID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const peerMessageValidation = [
    body('chatId')
    .isMongoId()
    .withMessage('Chat ID must be a valid MongoDB ObjectId'),
    body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters')
  ];

// Routes
router.post('/', createChatValidation, handleValidationErrors, trackAnalytics('chat_start'), asVisitorHandler(createChat));
router.post('/ai-message', sendMessageValidation, handleValidationErrors, trackAnalytics('chat_message'), withVisitorTracking(sendAIMessage));
router.post('/peer-message', peerMessageValidation, handleValidationErrors, trackAnalytics('chat_message'), asVisitorHandler(sendPeerMessage));
router.get('/', paginationValidation, handleValidationErrors, asVisitorHandler(getUserChats));
router.get('/room/:roomId', param('roomId').isMongoId().withMessage('Room ID must be a valid MongoDB ObjectId'), handleValidationErrors, asVisitorHandler(getChatByRoomId));
router.get('/:chatId', param('chatId').isMongoId().withMessage('Chat ID must be a valid MongoDB ObjectId'), handleValidationErrors, asVisitorHandler(getChatById));
router.put('/:chatId/messages/:messageId', updateMessageValidation, handleValidationErrors, asVisitorHandler(updateMessage));
router.delete('/:chatId', param('chatId').isMongoId().withMessage('Chat ID must be a valid MongoDB ObjectId'), handleValidationErrors, asVisitorHandler(deleteChat));
router.patch('/:chatId/archive', param('chatId').isMongoId().withMessage('Chat ID must be a valid MongoDB ObjectId'), handleValidationErrors, asVisitorHandler(archiveChat));
router.post('/:chatId/summary', param('chatId').isMongoId().withMessage('Chat ID must be a valid MongoDB ObjectId'), handleValidationErrors, asVisitorHandler(generateChatSummary));
router.get('/export/data', query('format').optional().isIn(['json']).withMessage('Format must be json'), handleValidationErrors, asVisitorHandler(exportChatData));

export default router;
