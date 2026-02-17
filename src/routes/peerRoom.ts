import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  createPeerRoom,
  getPublicPeerRooms,
  getUserPeerRooms,
  joinPeerRoom,
  leavePeerRoom,
  startLiveSession,
  endLiveSession,
  updateParticipantRole,
  getRoomDetails,
  getAllRoomsDebug,
  generateShareableLink,
  joinRoomViaShareCode,
  updateRoom,
  reactivateRoom
} from '../controllers/peerRoomController';
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

// All peer room routes require authentication
router.use(authenticate);

// Validation middleware
const createRoomValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Room name must be between 3 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('category')
    .isIn(['anxiety', 'depression', 'trauma', 'relationships', 'stress', 'grief', 'addiction', 'general'])
    .withMessage('Invalid category'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 2, max: 50 })
    .withMessage('Max participants must be between 2 and 50'),
  body('settings.allowAnonymous')
    .optional()
    .isBoolean()
    .withMessage('Allow anonymous must be a boolean'),
  body('settings.requireApproval')
    .optional()
    .isBoolean()
    .withMessage('Require approval must be a boolean')
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

const roomIdValidation = [
  param('roomId')
    .isMongoId()
    .withMessage('Room ID must be a valid MongoDB ObjectId')
];

const participantIdValidation = [
  param('participantId')
    .isMongoId()
    .withMessage('Participant ID must be a valid MongoDB ObjectId')
];

const shareCodeValidation = [
  param('shareCode')
    .isLength({ min: 6, max: 6 })
    .isAlphanumeric()
    .withMessage('Share code must be 6 alphanumeric characters')
];

const updateRoleValidation = [
  body('role')
    .isIn(['host', 'moderator', 'participant'])
    .withMessage('Role must be host, moderator, or participant')
];

// Routes
router.post('/', createRoomValidation, handleValidationErrors, createPeerRoom);
router.get('/debug', getAllRoomsDebug);
router.get('/public', paginationValidation, handleValidationErrors, getPublicPeerRooms);
router.get('/my-rooms', paginationValidation, handleValidationErrors, getUserPeerRooms);
router.post('/:roomId/join', roomIdValidation, handleValidationErrors, trackAnalytics('room_join'), joinPeerRoom);
router.post('/:roomId/leave', roomIdValidation, handleValidationErrors, trackAnalytics('room_leave'), leavePeerRoom);
router.post('/:roomId/start-live', roomIdValidation, handleValidationErrors, startLiveSession);
router.post('/:roomId/end-live', roomIdValidation, handleValidationErrors, endLiveSession);
router.post('/:roomId/generate-link', roomIdValidation, handleValidationErrors, generateShareableLink);
router.post('/join/:shareCode', shareCodeValidation, handleValidationErrors, joinRoomViaShareCode);
router.put('/:roomId/participants/:participantId/role', 
  roomIdValidation, 
  participantIdValidation, 
  updateRoleValidation, 
  handleValidationErrors,
  updateParticipantRole
);
router.put('/:roomId', roomIdValidation, handleValidationErrors, updateRoom);
router.post('/:roomId/reactivate', roomIdValidation, handleValidationErrors, reactivateRoom);
router.get('/:roomId', roomIdValidation, handleValidationErrors, getRoomDetails);

export default router;
