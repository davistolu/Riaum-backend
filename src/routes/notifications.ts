import express, { Router } from 'express';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth';
import {
  createNotification,
  getAllNotifications,
  getActiveNotifications,
  updateNotification,
  deleteNotification,
  toggleNotification
} from '../controllers/notificationController';

const router: Router = express.Router();

// Public routes - no authentication required for getting active notifications
router.get('/active', optionalAuth, getActiveNotifications);

// Admin routes - require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// POST /api/notifications - Create new notification (admin only)
router.post('/', createNotification);

// GET /api/notifications - Get all notifications for admin (admin only)
router.get('/', getAllNotifications);

// PUT /api/notifications/:id - Update notification (admin only)
router.put('/:id', updateNotification);

// DELETE /api/notifications/:id - Delete notification (admin only)
router.delete('/:id', deleteNotification);

// PUT /api/notifications/:id/toggle - Toggle notification active status (admin only)
router.put('/:id/toggle', toggleNotification);

export default router;
