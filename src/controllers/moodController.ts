import { Request, Response } from 'express';
import User from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';

// Type assertion function to safely cast Request to AuthenticatedRequest
function asAuthenticatedRequest(req: Request): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

// Log mood
export const logMood = async (req: Request, res: Response): Promise<Response> => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const { mood, note } = req.body;

    // Validate mood value
    if (!mood || mood < 1 || mood > 5) {
      return res.status(400).json({
        success: false,
        message: 'Mood must be a number between 1 and 5'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add mood to history
    user.moodHistory.push({
      date: new Date(),
      mood,
      note: note || undefined
    });

    // Keep only last 365 mood entries
    if (user.moodHistory.length > 365) {
      user.moodHistory = user.moodHistory.slice(-365);
    }

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Mood logged successfully',
      data: {
        mood: {
          date: new Date(),
          mood,
          note
        }
      }
    });
  } catch (error: any) {
    console.error('Log mood error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to log mood',
      error: error.message
    });
  }
};

// Get mood history
export const getMoodHistory = async (req: Request, res: Response): Promise<Response> => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const { days = 30 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get mood history for specified number of days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(days));

    const moodHistory = user.moodHistory
      .filter(mood => mood.date >= cutoffDate)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate statistics
    const moodStats = {
      average: 0,
      mostFrequent: 0,
      trend: 'stable' as 'improving' | 'declining' | 'stable',
      totalEntries: moodHistory.length
    };

    if (moodHistory.length > 0) {
      // Calculate average
      const sum = moodHistory.reduce((acc, mood) => acc + mood.mood, 0);
      moodStats.average = Math.round((sum / moodHistory.length) * 10) / 10;

      // Find most frequent mood
      const moodCounts: { [key: number]: number } = {};
      moodHistory.forEach(mood => {
        moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;
      });
      
      let maxCount = 0;
      let mostFrequentMood = 1;
      for (const [mood, count] of Object.entries(moodCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentMood = parseInt(mood);
        }
      }
      moodStats.mostFrequent = mostFrequentMood;

      // Calculate trend (compare first half with second half)
      if (moodHistory.length >= 4) {
        const halfPoint = Math.floor(moodHistory.length / 2);
        const firstHalf = moodHistory.slice(halfPoint);
        const secondHalf = moodHistory.slice(0, halfPoint);
        
        const firstHalfAvg = firstHalf.reduce((acc, mood) => acc + mood.mood, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((acc, mood) => acc + mood.mood, 0) / secondHalf.length;
        
        if (firstHalfAvg > secondHalfAvg + 0.3) {
          moodStats.trend = 'improving';
        } else if (secondHalfAvg > firstHalfAvg + 0.3) {
          moodStats.trend = 'declining';
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        moodHistory,
        stats: moodStats
      }
    });
  } catch (error: any) {
    console.error('Get mood history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get mood history',
      error: error.message
    });
  }
};

// Get mood analytics
export const getMoodAnalytics = async (req: Request, res: Response): Promise<Response> => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const { period = 'month' } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let cutoffDate = new Date();
    
    // Set cutoff date based on period
    switch (period) {
      case 'week':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
      case 'quarter':
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
      case 'year':
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        break;
      default:
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
    }

    const relevantMoods = user.moodHistory.filter(mood => mood.date >= cutoffDate);

    // Group by mood value
    const moodDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    relevantMoods.forEach(mood => {
      moodDistribution[mood.mood]++;
    });

    // Group by day of week
    const dayOfWeekStats: { [key: string]: { total: number; count: number; avg: number } } = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    dayNames.forEach(day => {
      dayOfWeekStats[day] = { total: 0, count: 0, avg: 0 };
    });

    relevantMoods.forEach(mood => {
      const dayName = dayNames[mood.date.getDay()];
      dayOfWeekStats[dayName].total += mood.mood;
      dayOfWeekStats[dayName].count++;
    });

    // Calculate averages
    Object.keys(dayOfWeekStats).forEach(day => {
      const stats = dayOfWeekStats[day];
      stats.avg = stats.count > 0 ? Math.round((stats.total / stats.count) * 10) / 10 : 0;
    });

    // Group by hour of day
    const hourOfDayStats: { [key: number]: { total: number; count: number; avg: number } } = {};
    
    for (let i = 0; i < 24; i++) {
      hourOfDayStats[i] = { total: 0, count: 0, avg: 0 };
    }

    relevantMoods.forEach(mood => {
      const hour = mood.date.getHours();
      hourOfDayStats[hour].total += mood.mood;
      hourOfDayStats[hour].count++;
    });

    // Calculate averages
    Object.keys(hourOfDayStats).forEach(hour => {
      const stats = hourOfDayStats[parseInt(hour)];
      stats.avg = stats.count > 0 ? Math.round((stats.total / stats.count) * 10) / 10 : 0;
    });

    return res.status(200).json({
      success: true,
      data: {
        period,
        totalEntries: relevantMoods.length,
        moodDistribution,
        dayOfWeekStats,
        hourOfDayStats,
        recentTrend: relevantMoods.slice(-7).map(m => ({
          date: m.date,
          mood: m.mood,
          note: m.note
        }))
      }
    });
  } catch (error: any) {
    console.error('Get mood analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get mood analytics',
      error: error.message
    });
  }
};
