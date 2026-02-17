import { Request, Response, NextFunction } from 'express';
import Analytics from '../models/Analytics';
import { getDeviceInfo, getLocationInfo, generateSessionId } from './analytics';

// Page view tracking middleware
export const trackPageView = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip tracking for static assets and API routes
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/static/') || 
        req.path.endsWith('.js') || 
        req.path.endsWith('.css') || 
        req.path.endsWith('.ico')) {
      return next();
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      return next();
    }

    // Get session ID from header or generate new one
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

    // Track page view asynchronously
    setImmediate(async () => {
      try {
        const analyticsData = new Analytics({
          userId,
          sessionId,
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

        await analyticsData.save();
      } catch (error) {
        console.error('Failed to track page view:', error);
      }
    });

    next();
  } catch (error) {
    console.error('Page view tracking middleware error:', error);
    next();
  }
};
