import express, { Router } from 'express';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth';
import {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
  getAllResourcesForAdmin,
  getResourceMetadata,
  submitResource,
  getPendingResources,
  reviewResource,
  getUserSubmissions
} from '../controllers/resourceController';

const router: Router = express.Router();

// Public routes - no authentication required
router.get('/', optionalAuth, getResources);
router.get('/metadata', getResourceMetadata);
router.get('/:id', optionalAuth, getResourceById);

// User routes - require authentication
router.use(authenticate);

// POST /api/resources/submit - Submit resource for approval (users)
router.post('/submit', submitResource);

// GET /api/resources/my-submissions - Get user's submitted resources
router.get('/my-submissions', getUserSubmissions);

// Admin routes - require admin role
router.use(requireAdmin);

// POST /api/resources - Create new resource (admin only)
router.post('/', createResource);

// GET /api/resources/admin - Get all resources for admin (admin only)
router.get('/admin/all', getAllResourcesForAdmin);

// GET /api/resources/admin/pending - Get pending resources for approval (admin only)
router.get('/admin/pending', getPendingResources);

// PUT /api/resources/:id - Update resource (admin only)
router.put('/:id', updateResource);

// PUT /api/resources/:id/review - Approve or reject resource (admin only)
router.put('/:id/review', reviewResource);

// DELETE /api/resources/:id - Delete resource (admin only)
router.delete('/:id', deleteResource);

export default router;
