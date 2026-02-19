import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  updateUser,
  getAllChats,
  getChatDetails,
  getAllPeerRooms,
  updateRoomStatus,
  deleteUser,
  getSystemHealth,
  getModerationQueue,
  updateModerationStatus,
  getAnalytics,
  exportData,
  adminCreateRoom,
  deletePeerRoom,
  getAllAdmins,
  createAdmin,
  removeAdminPrivileges
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middleware/auth';

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

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Validation middleware
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

const userIdValidation = [
  param('userId')
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId')
];

const chatIdValidation = [
  param('chatId')
    .isMongoId()
    .withMessage('Chat ID must be a valid MongoDB ObjectId')
];

const roomIdValidation = [
  param('roomId')
    .isMongoId()
    .withMessage('Room ID must be a valid MongoDB ObjectId')
];

const messageIdValidation = [
  param('messageId')
    .isMongoId()
    .withMessage('Message ID must be a valid MongoDB ObjectId')
];

const adminCreateValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Admin room creation validation
const adminCreateRoomValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Room name must be between 3 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Description must be between 5 and 500 characters'),
  body('category')
    .isIn(['anxiety', 'depression', 'trauma', 'relationships', 'stress', 'grief', 'addiction', 'general'])
    .withMessage('Invalid category'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 2, max: 100 })
    .withMessage('Max participants must be between 2 and 100'),
  body('hostId')
    .optional()
    .custom((value) => {
      if (!value || value === '') return true;
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Host ID must be a valid MongoDB ObjectId'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('rules')
    .optional()
    .isArray()
    .withMessage('Rules must be an array'),
  body('settings.allowAnonymous')
    .optional()
    .isBoolean()
    .withMessage('Allow anonymous must be a boolean'),
  body('settings.requireApproval')
    .optional()
    .isBoolean()
    .withMessage('Require approval must be a boolean'),
  body('settings.recordingEnabled')
    .optional()
    .isBoolean()
    .withMessage('Recording enabled must be a boolean'),
  body('settings.chatEnabled')
    .optional()
    .isBoolean()
    .withMessage('Chat enabled must be a boolean'),
  body('settings.screenShareEnabled')
    .optional()
    .isBoolean()
    .withMessage('Screen share enabled must be a boolean')
];

// Dashboard routes
router.get('/dashboard/stats', getDashboardStats);
router.get('/system/health', getSystemHealth);

// Analytics routes
router.get('/analytics', getAnalytics);

// Content moderation routes
router.get('/moderation/queue', paginationValidation, handleValidationErrors, getModerationQueue);
router.put('/moderation/:chatId/:messageId', chatIdValidation, messageIdValidation, handleValidationErrors, updateModerationStatus);

// Data export routes
router.get('/export', exportData);

// User management routes
router.get('/users', paginationValidation, handleValidationErrors, getAllUsers);
router.get('/users/:userId', userIdValidation, handleValidationErrors, getUserDetails);
router.put('/users/:userId/status', userIdValidation, handleValidationErrors, updateUserStatus);
router.put('/users/:userId', userIdValidation, handleValidationErrors, updateUser);
router.delete('/users/:userId', userIdValidation, handleValidationErrors, deleteUser);

// Admin management routes
router.get('/admins', getAllAdmins);
router.post('/admins', adminCreateValidation, handleValidationErrors, createAdmin);
router.delete('/admins/:userId', userIdValidation, handleValidationErrors, removeAdminPrivileges);

// Chat management routes
router.get('/chats', paginationValidation, handleValidationErrors, getAllChats);
router.get('/chats/:chatId', chatIdValidation, handleValidationErrors, getChatDetails);

// Peer room management routes
router.get('/rooms', paginationValidation, handleValidationErrors, getAllPeerRooms);
router.post('/rooms', adminCreateRoomValidation, handleValidationErrors, adminCreateRoom);
router.delete('/rooms/:roomId', roomIdValidation, handleValidationErrors, deletePeerRoom);
router.put('/rooms/:roomId/status', roomIdValidation, handleValidationErrors, updateRoomStatus);

export default router;
