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

// Check if an IP is private/local
const isPrivateIP = (ip: string): boolean => {
  if (!ip) return true;
  // Normalize IPv6 loopback and IPv4-mapped IPv6
  const normalized = ip === '::1' ? '127.0.0.1' : ip.replace(/^::ffff:/, '');
  if (normalized === '127.0.0.1') return true;
  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  // 172.16.0.0 – 172.31.255.255 only (not all of 172.x.x.x)
  const parts = normalized.split('.');
  if (parts[0] === '172') {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
};

// Extract the first public IP from an x-forwarded-for chain or a single IP.
// x-forwarded-for can look like: "clientIP, proxy1, proxy2" — the leftmost
// non-private entry is the real user IP.
export const extractPublicIP = (raw: string): string | null => {
  const candidates = raw.split(',').map(s => s.trim());
  for (const candidate of candidates) {
    if (candidate && !isPrivateIP(candidate)) return candidate;
  }
  return null;
};

// Resolve the best available client IP from a request
export const getClientIP = (req: Request): string => {
  // x-forwarded-for is the standard header set by proxies/load balancers
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    const publicIP = extractPublicIP(forwarded);
    if (publicIP) return publicIP;
  }

  // x-real-ip is set by nginx and similar
  const realIP = req.headers['x-real-ip'] as string | undefined;
  if (realIP && !isPrivateIP(realIP)) return realIP;

  // cf-connecting-ip is set by Cloudflare
  const cfIP = req.headers['cf-connecting-ip'] as string | undefined;
  if (cfIP && !isPrivateIP(cfIP)) return cfIP;

  // Fall back to the socket address (req.socket preferred over deprecated req.connection)
  const socketIP = req.socket?.remoteAddress || req.ip || '127.0.0.1';
  // Strip IPv6 prefix if present
  const normalized = socketIP.replace(/^::ffff:/, '');
  return normalized;
};

// Location detection utility
export const getLocationInfo = (ip: string) => {
  if (isPrivateIP(ip)) {
    return {
      country: 'Local Development',
      city: 'Development',
      region: 'Local',
      coordinates: { lat: 37.7749, lng: -122.4194 } // San Francisco as fallback
    };
  }

  const geo = geoip.lookup(ip) as GeoIP;
  if (!geo) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      coordinates: { lat: 0, lng: 0 }
    };
  }
  
  return {
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown',
    region: geo.region || 'Unknown',
    coordinates: geo.ll ? { lat: geo.ll[0], lng: geo.ll[1] } : { lat: 0, lng: 0 }
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

      // Get the real client IP
      const clientIP = getClientIP(req);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Analytics IP Detection:', {
          'x-forwarded-for': req.headers['x-forwarded-for'],
          'x-real-ip': req.headers['x-real-ip'],
          'cf-connecting-ip': req.headers['cf-connecting-ip'],
          'socket.remoteAddress': req.socket?.remoteAddress,
          'req.ip': req.ip,
          'resolvedIP': clientIP
        });
      }
      
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
    const clientIP = getClientIP(req);

    if (process.env.NODE_ENV === 'development') {
      console.log('PageView IP Detection:', {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'socket.remoteAddress': req.socket?.remoteAddress,
        'req.ip': req.ip,
        'resolvedIP': clientIP
      });
    }

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
