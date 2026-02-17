import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// Define the extended Request interface
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    accountType: 'registered' | 'anonymous';
  };
}

// Type assertion function to safely cast Request to AuthenticatedRequest
function asAuthenticatedRequest(req: Request): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    authReq.user = {
      userId: user._id.toString(),
      accountType: user.accountType
    };

    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        authReq.user = {
          userId: user._id.toString(),
          accountType: user.accountType
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Admin middleware
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authReq = asAuthenticatedRequest(req);
  try {
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    const userId = authReq.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required.'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};

// Registered user only middleware
export const requireRegistered = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authReq = asAuthenticatedRequest(req);
  try {
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    if (authReq.user.accountType !== 'registered') {
      res.status(403).json({
        success: false,
        message: 'Registered user access required.'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Registered user authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.'
    });
  }
};
