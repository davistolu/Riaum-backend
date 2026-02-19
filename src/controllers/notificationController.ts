import { Request, Response } from 'express';
import Notification from '../models/Notification';

// Create a new notification (admin only)
export const createNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const notificationData = {
      ...req.body,
      createdBy: (req as any).user?.userId
    };

    const notification = new Notification(notificationData);
    await notification.save();

    await notification.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all notifications for admin
export const getAllNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      priority,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$text = { $search: search as string };
    }

    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const notifications = await Notification.find(filter)
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalNotifications: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get active notifications for users
export const getActiveNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    
    // Build filter for active notifications
    const filter: any = {
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    // Filter by audience
    if (!user) {
      // Anonymous users
      filter.$and = [
        { isGlobal: true },
        { 
          $or: [
            { targetAudience: 'all' },
            { targetAudience: 'anonymous' }
          ]
        }
      ];
    } else {
      // Registered users
      filter.$and = [
        {
          $or: [
            { isGlobal: true },
            { targetUsers: user.userId }
          ]
        },
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: 'registered' }
          ]
        }
      ];
    }

    const notifications = await Notification.find(filter)
      .populate('createdBy', 'name')
      .sort({ priority: -1, createdAt: -1 })
      .limit(10); // Limit to 10 most recent/important

    res.json({
      success: true,
      data: {
        notifications,
        count: notifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update notification (admin only)
export const updateNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const notification = await Notification.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Notification updated successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete notification (admin only)
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Toggle notification active status (admin only)
export const toggleNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    notification.isActive = !notification.isActive;
    await notification.save();

    await notification.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Notification ${notification.isActive ? 'activated' : 'deactivated'} successfully`,
      data: notification
    });
  } catch (error) {
    console.error('Error toggling notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
