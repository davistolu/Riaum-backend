import { Request, Response, NextFunction } from 'express';
import Analytics, { IAnalytics } from '../models/Analytics';
import { AuthenticatedRequest } from './auth';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import mongoose from 'mongoose';

// Type definitions for geoip-lite
interface GeoIP {
  country?: string;
  city?: string;
  region?: string;
  ll?: [number, number];
}

// Device detection utility
export const getDeviceInfo = (userAgent: string) => {
  const result = UAParser(userAgent);
  
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  
  if (result.device.type) {
    switch (result.device.type) {
      case 'mobile':
        deviceType = 'mobile';
        break;
      case 'tablet':
        deviceType = 'tablet';
        break;
      default:
        deviceType = 'desktop';
    }
  }
  
  return {
    type: deviceType,
    os: result.os.name,
    browser: result.browser.name,
    screenResolution: result.device.type ? `${result.device.type} device` : undefined
  };
};

// Location detection utility
export const getLocationInfo = (ip: string) => {
  const geo = geoip.lookup(ip) as GeoIP;
  if (!geo) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown'
    };
  }
  
  return {
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown',
    region: geo.region || 'Unknown',
    coordinates: geo.ll ? { lat: geo.ll[0], lng: geo.ll[1] } : undefined
  };
};

// Generate session ID
export const generateSessionId = () => {
  return 'session_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
};

// Analytics tracking middleware
export const trackAnalytics = (action: 'login' | 'logout' | 'chat_start' | 'chat_message' | 'room_join' | 'room_leave' | 'page_view') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId;
      
      if (!userId) {
        return next();
      }

      // Get or create session ID
      let sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        sessionId = generateSessionId();
        res.setHeader('x-session-id', sessionId);
      }

      // Get device info
      const userAgent = req.headers['user-agent'] || '';
      const deviceInfo = getDeviceInfo(userAgent);

      // Get location info
      const clientIP = req.headers['x-forwarded-for'] as string || 
                      req.headers['x-real-ip'] as string || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      '127.0.0.1';
      const locationInfo = getLocationInfo(clientIP);

      // Create analytics entry
      const analyticsData: Partial<IAnalytics> = {
        userId: new mongoose.Types.ObjectId(userId),
        sessionId,
        action,
        timestamp: new Date(),
        metadata: {
          userAgent,
          ip: clientIP,
          location: locationInfo,
          device: deviceInfo,
          page: req.path,
          referrer: req.headers.referer
        }
      };

      // Add action-specific metadata
      if (action === 'chat_message' && req.body.chatType) {
        analyticsData.metadata!.chatType = req.body.chatType;
        if (req.body.roomId) analyticsData.metadata!.roomId = new mongoose.Types.ObjectId(req.body.roomId);
        if (req.body.messageId) analyticsData.metadata!.messageId = req.body.messageId;
      }

      if (['room_join', 'room_leave'].includes(action) && req.body.roomId) {
        analyticsData.metadata!.roomId = new mongoose.Types.ObjectId(req.body.roomId);
      }

      // Store analytics data asynchronously (don't block response)
      setImmediate(async () => {
        try {
          const analytics = new Analytics(analyticsData);
          await analytics.save();
        } catch (error) {
          console.error('Failed to save analytics data:', error);
        }
      });

      next();
    } catch (error) {
      console.error('Analytics middleware error:', error);
      next();
    }
  };
};

// Helper function to track page views
export const trackPageView = async (req: Request, userId?: string, sessionId?: string) => {
  try {
    if (!userId) return;

    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = getDeviceInfo(userAgent);

    const clientIP = req.headers['x-forwarded-for'] as string || 
                    req.headers['x-real-ip'] as string || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress || 
                    '127.0.0.1';
    const locationInfo = getLocationInfo(clientIP);

    const analyticsData = new Analytics({
      userId: new mongoose.Types.ObjectId(userId),
      sessionId: sessionId || generateSessionId(),
      action: 'page_view',
      timestamp: new Date(),
      metadata: {
        userAgent,
        ip: clientIP,
        location: locationInfo,
        device: deviceInfo,
        page: req.path,
        referrer: req.headers.referer
      }
    });

    // Store asynchronously
    setImmediate(async () => {
      try {
        await analyticsData.save();
      } catch (error) {
        console.error('Failed to save page view analytics:', error);
      }
    });
  } catch (error) {
    console.error('Page view tracking error:', error);
  }
};

// Helper function to track session duration
export const trackSessionDuration = async (userId: string, sessionId: string, duration: number) => {
  try {
    const analyticsData = new Analytics({
      userId: new mongoose.Types.ObjectId(userId),
      sessionId,
      action: 'logout',
      timestamp: new Date(),
      metadata: {
        sessionDuration: duration
      }
    });

    await analyticsData.save();
  } catch (error) {
    console.error('Failed to track session duration:', error);
  }
};
