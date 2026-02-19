import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Journal, { IJournal } from '../models/Journal';

// Create a new journal entry
export const createJournalEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { title, content, mood, date, tags } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Create journal entry
    const journalEntry = new Journal({
      userId,
      title,
      content,
      mood: mood || 'neutral',
      date: date ? new Date(date) : new Date(),
      tags: tags || [],
      isPrivate: true
    });

    await journalEntry.save();

    return res.status(201).json({
      success: true,
      message: 'Journal entry created successfully',
      data: {
        entry: journalEntry
      }
    });
  } catch (error: any) {
    console.error('Create journal entry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create journal entry',
      error: error.message
    });
  }
};

// Get all journal entries for the authenticated user
export const getUserJournalEntries = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const mood = req.query.mood as string;
    const search = req.query.search as string;

    // Build query
    const query: any = { userId };
    
    if (mood && ['good', 'neutral', 'bad'].includes(mood)) {
      query.mood = mood;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await Journal.countDocuments(query);

    // Get entries with pagination
    const entries = await Journal.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return res.status(200).json({
      success: true,
      data: {
        entries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Get journal entries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve journal entries',
      error: error.message
    });
  }
};

// Get a single journal entry by ID
export const getJournalEntryById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const entry = await Journal.findOne({ _id: id, userId });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        entry
      }
    });
  } catch (error: any) {
    console.error('Get journal entry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve journal entry',
      error: error.message
    });
  }
};

// Update a journal entry
export const updateJournalEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const { title, content, mood, tags } = req.body;

    const entry = await Journal.findOne({ _id: id, userId });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    // Update allowed fields
    if (title) entry.title = title;
    if (content) entry.content = content;
    if (mood && ['good', 'neutral', 'bad'].includes(mood)) entry.mood = mood;
    if (tags) entry.tags = tags;

    await entry.save();

    return res.status(200).json({
      success: true,
      message: 'Journal entry updated successfully',
      data: {
        entry
      }
    });
  } catch (error: any) {
    console.error('Update journal entry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update journal entry',
      error: error.message
    });
  }
};

// Delete a journal entry
export const deleteJournalEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const entry = await Journal.findOne({ _id: id, userId });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    await Journal.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Journal entry deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete journal entry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete journal entry',
      error: error.message
    });
  }
};

// Get journal analytics for the user
export const getJournalAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const period = req.query.period as string || '30'; // default to 30 days

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get mood distribution
    const moodStats = await Journal.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), date: { $gte: startDate } } },
      { $group: { _id: '$mood', count: { $sum: 1 } } }
    ]);

    // Get entry count over time
    const entryStats = await Journal.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get total entries
    const totalEntries = await Journal.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      data: {
        moodStats,
        entryStats,
        totalEntries,
        period: days
      }
    });
  } catch (error: any) {
    console.error('Get journal analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve journal analytics',
      error: error.message
    });
  }
};
