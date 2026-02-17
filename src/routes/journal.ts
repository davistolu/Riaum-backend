import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createJournalEntry,
  getUserJournalEntries,
  getJournalEntryById,
  updateJournalEntry,
  deleteJournalEntry,
  getJournalAnalytics
} from '../controllers/journalController';

const router: Router = express.Router();

// All journal routes require authentication
router.use(authenticate);

// POST /api/journal - Create new journal entry
router.post('/', createJournalEntry);

// GET /api/journal - Get all user's journal entries with pagination and filtering
router.get('/', getUserJournalEntries);

// GET /api/journal/analytics - Get journal analytics
router.get('/analytics', getJournalAnalytics);

// GET /api/journal/:id - Get specific journal entry
router.get('/:id', getJournalEntryById);

// PUT /api/journal/:id - Update journal entry
router.put('/:id', updateJournalEntry);

// DELETE /api/journal/:id - Delete journal entry
router.delete('/:id', deleteJournalEntry);

export default router;
