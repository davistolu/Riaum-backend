import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Chat from '../models/Chat';
import PeerRoom from '../models/PeerRoom';
import Analytics from '../models/Analytics';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth';

// Generate unique share code
const generateShareCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Type assertion function to safely cast Request to AuthenticatedRequest
function asAuthenticatedRequest(req: Request): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

// Get dashboard statistics
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      registeredUsers,
      anonymousUsers,
      activeUsers,
      totalChats,
      aiChats,
      peerChats,
      liveChats,
      totalRooms,
      activeRooms,
      liveRooms
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ accountType: 'registered' }),
      User.countDocuments({ accountType: 'anonymous' }),
      User.countDocuments({ 
        lastActive: { 
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        } 
      }),
      Chat.countDocuments({ isDeleted: false }),
      Chat.countDocuments({ type: 'ai', isDeleted: false }),
      Chat.countDocuments({ type: 'peer', isDeleted: false }),
      Chat.countDocuments({ type: 'live', isDeleted: false }),
      PeerRoom.countDocuments(),
      PeerRoom.countDocuments({ isActive: true }),
      PeerRoom.countDocuments({ isLive: true })
    ]);

    // Get mood statistics
    const moodStats = await User.aggregate([
      { $unwind: '$moodHistory' },
      { $group: {
        _id: '$moodHistory.mood',
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Get daily user registrations (last 30 days)
    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get chat activity (last 7 days)
    const chatActivity = await Chat.aggregate([
      {
        $match: {
          lastMessageAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$lastMessageAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          registered: registeredUsers,
          anonymous: anonymousUsers,
          active: activeUsers
        },
        chats: {
          total: totalChats,
          ai: aiChats,
          peer: peerChats,
          live: liveChats
        },
        rooms: {
          total: totalRooms,
          active: activeRooms,
          live: liveRooms
        },
        moodStats,
        dailyRegistrations,
        chatActivity
      }
    });
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics',
      error: error.message
    });
  }
};

// Get all users with pagination
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      accountType, 
      isActive 
    } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (accountType) {
      query.accountType = accountType;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message
    });
  }
};

// Get user details
export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password')
      .populate('moodHistory');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's chat statistics
    const chatStats = await Chat.aggregate([
      { $match: { userId: user._id, isDeleted: false } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' }
        }
      }
    ]);

    // Get user's room participation
    const roomParticipation = await PeerRoom.aggregate([
      { $match: { 'participants.userId': user._id } },
      {
        $group: {
          _id: null,
          totalRooms: { $sum: 1 },
          hostedRooms: {
            $sum: { $cond: [{ $eq: ['$hostId', user._id] }, 1, 0] }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user,
        chatStats,
        roomParticipation: roomParticipation[0] || { totalRooms: 0, hostedRooms: 0 }
      }
    });
  } catch (error: any) {
    console.error('Get user details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user details',
      error: error.message
    });
  }
};

// Update user status
export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { isActive, accountType } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    if (accountType) {
      user.accountType = accountType;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });
  } catch (error: any) {
    console.error('Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

// Get all chats with pagination
export const getAllChats = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      type, 
      userId 
    } = req.query;

    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'messages.content': { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (userId) {
      query.userId = userId;
    }

    const chats = await Chat.find(query)
      .populate('userId', 'name email accountType')
      .populate('roomId', 'name category')
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Chat.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        chats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Get all chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chats',
      error: error.message
    });
  }
};

// Get chat details for admin
export const getChatDetails = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate('userId', 'name email accountType')
      .populate('roomId', 'name category hostId participants');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { chat }
    });
  } catch (error: any) {
    console.error('Get chat details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat details',
      error: error.message
    });
  }
};

// Get all peer rooms
export const getAllPeerRooms = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category, 
      isActive, 
      isLive 
    } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (isLive !== undefined) {
      query.isLive = isLive === 'true';
    }

    const rooms = await PeerRoom.find(query)
      .populate('hostId', 'name email')
      .populate('participants.userId', 'name accountType')
      .sort({ lastActivity: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit));

    const total = await PeerRoom.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        rooms,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Get all peer rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get peer rooms',
      error: error.message
    });
  }
};

// Update room status
export const updateRoomStatus = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { isActive, isLive } = req.body;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (isActive !== undefined) {
      room.isActive = isActive;
    }

    if (isLive !== undefined) {
      room.isLive = isLive;
      if (isLive && !room.startTime) {
        room.startTime = new Date();
      } else if (!isLive && room.startTime) {
        room.endTime = new Date();
      }
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Room status updated successfully',
      data: { room }
    });
  } catch (error: any) {
    console.error('Update room status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update room status',
      error: error.message
    });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by deactivating
    user.isActive = false;
    await user.save();

    // Mark all user's chats as deleted
    await Chat.updateMany(
      { userId },
      { isDeleted: true }
    );

    // Remove user from all peer rooms
    await PeerRoom.updateMany(
      { 'participants.userId': userId },
      { $pull: { participants: { userId } } }
    );

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// Get system health
export const getSystemHealth = async (req: Request, res: Response) => {
  try {
    if (!mongoose.connection.db) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const dbStatus = await mongoose.connection.db.admin().ping();
    
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return res.status(200).json({
      success: true,
      data: {
        database: {
          status: dbStatus ? 'connected' : 'disconnected',
          responseTime: dbStatus ? 'OK' : 'Error'
        },
        server: {
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
          }
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Get system health error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get system health',
      error: error.message
    });
  }
};

// Get content moderation queue
export const getModerationQueue = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query: any = {};
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['pending', 'flagged'] };
    }

    const [reports, total] = await Promise.all([
      Chat.aggregate([
        { $match: { isDeleted: false, 'messages.isFlagged': true } },
        { $unwind: '$messages' },
        { $match: { 'messages.isFlagged': true } },
        { $sort: { 'messages.timestamp': -1 } },
        { $skip: (Number(page) - 1) * Number(limit) },
        { $limit: Number(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            chatId: '$_id',
            message: '$messages',
            user: { name: '$user.name', email: '$user.email' },
            type: '$type'
          }
        }
      ]),
      Chat.aggregate([
        { $match: { isDeleted: false, 'messages.isFlagged': true } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        reports: reports,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: total[0]?.total || 0,
          pages: Math.ceil((total[0]?.total || 0) / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Get moderation queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get moderation queue',
      error: error.message
    });
  }
};

// Update moderation status
export const updateModerationStatus = async (req: Request, res: Response) => {
  try {
    const { chatId, messageId } = req.params;
    const { action, reason } = req.body; // action: 'approve', 'reject', 'delete'

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const message = chat.messages.find(msg => msg.id === messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    switch (action) {
      case 'approve':
        message.isFlagged = false;
        message.moderationStatus = 'approved';
        break;
      case 'reject':
        message.isFlagged = false;
        message.moderationStatus = 'rejected';
        message.moderationReason = reason;
        break;
      case 'delete':
        message.content = '[Message deleted by admin]';
        message.isDeleted = true;
        message.moderationStatus = 'deleted';
        message.moderationReason = reason;
        break;
    }

    await chat.save();

    return res.status(200).json({
      success: true,
      message: `Message ${action}d successfully`,
      data: { message }
    });
  } catch (error: any) {
    console.error('Update moderation status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update moderation status',
      error: error.message
    });
  }
};

// Get analytics data
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    
    let days = 30;
    if (period === '7d') days = 7;
    if (period === '90d') days = 90;
    if (period === '1y') days = 365;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      userGrowth,
      chatActivity,
      moodTrends,
      popularRooms,
      deviceStats,
      locationStats,
      sessionStats,
      pageViews,
      userEngagement
    ] = await Promise.all([
      // User growth over time
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            registered: { $sum: { $cond: [{ $eq: ['$accountType', 'registered'] }, 1, 0] } },
            anonymous: { $sum: { $cond: [{ $eq: ['$accountType', 'anonymous'] }, 1, 0] } },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Chat activity
      Chat.aggregate([
        { $match: { lastMessageAt: { $gte: startDate }, isDeleted: false } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastMessageAt' } },
            ai: { $sum: { $cond: [{ $eq: ['$type', 'ai'] }, 1, 0] } },
            peer: { $sum: { $cond: [{ $eq: ['$type', 'peer'] }, 1, 0] } },
            live: { $sum: { $cond: [{ $eq: ['$type', 'live'] }, 1, 0] } },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Mood trends
      User.aggregate([
        { $unwind: '$moodHistory' },
        { $match: { 'moodHistory.date': { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$moodHistory.date' } },
            avgMood: { $avg: '$moodHistory.mood' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Popular rooms
      PeerRoom.aggregate([
        { $match: { lastActivity: { $gte: startDate } } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgParticipants: { $avg: { $size: '$participants' } }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Real device stats from analytics
      Analytics.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: '$metadata.device.type',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Location statistics
      Analytics.aggregate([
        { $match: { timestamp: { $gte: startDate }, 'metadata.location.country': { $ne: 'Unknown' } } },
        {
          $group: {
            _id: '$metadata.location.country',
            count: { $sum: 1 },
            cities: { $addToSet: '$metadata.location.city' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Session statistics
      Analytics.aggregate([
        { $match: { timestamp: { $gte: startDate }, action: { $in: ['login', 'logout'] } } },
        {
          $group: {
            _id: '$sessionId',
            userId: { $first: '$userId' },
            loginTime: { $min: '$timestamp' },
            logoutTime: { $max: '$timestamp' },
            duration: { $sum: '$metadata.sessionDuration' }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            avgSessionDuration: { $avg: '$duration' },
            uniqueUsers: { $addToSet: '$userId' }
          }
        }
      ]),
      
      // Page views
      Analytics.aggregate([
        { $match: { timestamp: { $gte: startDate }, action: 'page_view' } },
        {
          $group: {
            _id: '$metadata.page',
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        { $sort: { views: -1 } },
        { $limit: 10 }
      ]),
      
      // User engagement metrics
      Analytics.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: '$userId',
            actions: { $sum: 1 },
            pages: { $addToSet: '$metadata.page' },
            chatMessages: { $sum: { $cond: [{ $eq: ['$action', 'chat_message'] }, 1, 0] } },
            roomJoins: { $sum: { $cond: [{ $eq: ['$action', 'room_join'] }, 1, 0] } }
          }
        },
        {
          $group: {
            _id: null,
            avgActionsPerUser: { $avg: '$actions' },
            totalChatMessages: { $sum: '$chatMessages' },
            totalRoomJoins: { $sum: '$roomJoins' },
            uniquePages: { $sum: { $size: '$pages' } }
          }
        }
      ])
    ]);

    // Format device stats
    const deviceStatsFormatted = deviceStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    // Format location stats
    const locationStatsFormatted = locationStats.map(stat => ({
      country: stat._id,
      count: stat.count,
      cities: stat.cities.slice(0, 5) // Show top 5 cities per country
    }));

    // Calculate session metrics
    const sessionMetrics = sessionStats[0] || {
      totalSessions: 0,
      avgSessionDuration: 0,
      uniqueUsers: []
    };

    // Format page views
    const pageViewsFormatted = pageViews.map(view => ({
      page: view._id,
      views: view.views,
      uniqueUsers: view.uniqueUsers.length
    }));

    // Format engagement metrics
    const engagementMetrics = userEngagement[0] || {
      avgActionsPerUser: 0,
      totalChatMessages: 0,
      totalRoomJoins: 0,
      uniquePages: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        period,
        userGrowth,
        chatActivity,
        moodTrends,
        popularRooms,
        deviceStats: {
          mobile: deviceStatsFormatted.mobile || 0,
          desktop: deviceStatsFormatted.desktop || 0,
          tablet: deviceStatsFormatted.tablet || 0
        },
        locationStats: locationStatsFormatted,
        sessionStats: {
          totalSessions: sessionMetrics.totalSessions,
          avgSessionDuration: Math.round(sessionMetrics.avgSessionDuration || 0),
          uniqueUsers: sessionMetrics.uniqueUsers.length
        },
        pageViews: pageViewsFormatted,
        engagement: engagementMetrics,
        realTimeStats: {
          activeUsers: await Analytics.countDocuments({ 
            timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) } 
          }),
          currentHour: new Date().getHours(),
          today: new Date().toISOString().split('T')[0]
        }
      }
    });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
};

// Export data
export const exportData = async (req: Request, res: Response) => {
  try {
    const { type, format = 'json', startDate, endDate } = req.query;
    
    const query: any = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }

    let data;
    let filename;

    switch (type) {
      case 'users':
        data = await User.find(query).select('-password').lean();
        filename = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      case 'chats':
        data = await Chat.find(query).lean();
        filename = `chats_export_${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      case 'rooms':
        data = await PeerRoom.find(query).lean();
        filename = `rooms_export_${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type. Use users, chats, or rooms.'
        });
    }

    if (format === 'csv') {
      // Convert to CSV (simplified)
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json({
        success: true,
        data,
        exportedAt: new Date().toISOString(),
        totalRecords: data.length
      });
    }
  } catch (error: any) {
    console.error('Export data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message
    });
  }
};

// Admin create room (with enhanced privileges)
export const adminCreateRoom = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    if (!authReq.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const adminId = authReq.user.userId;
    const { 
      name, 
      description, 
      category, 
      isPrivate, 
      maxParticipants, 
      settings,
      tags,
      rules,
      schedule,
      hostId // Admin can optionally assign a different host
    } = req.body;

    // Verify admin user
    const admin = await User.findById(adminId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // If hostId is provided, validate it's a valid user
    let finalHostId = new mongoose.Types.ObjectId(adminId);
    if (hostId) {
      const host = await User.findById(hostId);
      if (!host) {
        return res.status(400).json({
          success: false,
          message: 'Invalid host ID'
        });
      }
      finalHostId = new mongoose.Types.ObjectId(hostId);
    }

    // Create room with admin privileges (bypass normal limits)
    const shareCode = generateShareCode();
    const room = new PeerRoom({
      name,
      description,
      category,
      isPrivate: isPrivate || false,
      maxParticipants: maxParticipants || 50, // Admin can create larger rooms
      hostId: finalHostId,
      shareCode: shareCode,
      shareableLink: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/room/${shareCode}`,
      participants: [{
        userId: finalHostId,
        joinedAt: new Date(),
        role: 'host'
      }],
      tags: tags || [],
      rules: rules || [],
      schedule: schedule || undefined,
      settings: {
        allowAnonymous: settings?.allowAnonymous ?? true,
        requireApproval: settings?.requireApproval ?? false,
        recordingEnabled: settings?.recordingEnabled ?? true, // Admin gets recording by default
        chatEnabled: settings?.chatEnabled ?? true,
        screenShareEnabled: settings?.screenShareEnabled ?? true, // Admin gets screen share by default
        ...settings
      },
      // Admin rooms get special statistics tracking
      statistics: {
        totalParticipants: 0,
        averageDuration: 0,
        totalSessions: 0,
        satisfactionScore: 1
      }
    });

    console.log('Admin room data before save:', {
      name: room.name,
      isPrivate: room.isPrivate,
      isActive: room.isActive,
      category: room.category,
      shareCode: room.shareCode,
      shareableLink: room.shareableLink
    });

    await room.save();

    console.log('Admin room saved successfully:', room._id);
    console.log('Generated share info:', {
      shareCode: room.shareCode,
      shareableLink: room.shareableLink
    });

    // Create chat for the room
    const chat = new Chat({
      userId: finalHostId,
      type: 'peer',
      roomId: room._id,
      messages: [],
      title: `${name} - Admin Managed Room`
    });

    await chat.save();

    return res.status(201).json({
      success: true,
      message: 'Admin room created successfully',
      data: { 
        room,
        adminCreated: true,
        hostId: finalHostId
      }
    });
  } catch (error: any) {
    console.error('Admin create room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin room',
      error: error.message
    });
  }
};

// Delete peer room
export const deletePeerRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    await PeerRoom.findByIdAndDelete(roomId);

    return res.status(200).json({
      success: true,
      message: 'Peer room deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete peer room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete peer room',
      error: error.message
    });
  }
};

// Helper function to convert to CSV
const convertToCSV = (data: any[]): string => {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
};
