import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthenticatedRequest } from './auth';
import session from 'express-session';

// Extend session type to include visitorSessionId
declare module 'express-session' {
  interface SessionData {
    visitorSessionId?: string;
  }
}

// Visitor message limit (2 messages as requested)
const VISITOR_MESSAGE_LIMIT = 2;

// Extend AuthenticatedRequest to include visitor info
export interface VisitorRequest extends AuthenticatedRequest {
  visitor?: {
    isVisitor: boolean;
    messageCount: number;
    remainingMessages: number;
    requiresAuth: boolean;
  };
}

// Visitor chat middleware - allows anonymous users with limited messages
export const visitorAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorReq = req as VisitorRequest;
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      // User has a token, authenticate normally
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        visitorReq.user = {
          userId: user._id.toString(),
          accountType: user.accountType
        };
        // User is authenticated, no visitor restrictions
        visitorReq.visitor = {
          isVisitor: false,
          messageCount: 0,
          remainingMessages: 0,
          requiresAuth: false
        };
        return next();
      }
    }

    // No valid token, check if visitor session exists
    const visitorSessionId = req.header('X-Visitor-Session') || req.session?.visitorSessionId;
    
    if (visitorSessionId) {
      // Find or create visitor user
      let visitorUser = await User.findOne({ 
        accountType: 'anonymous',
        isAnonymous: true,
        $or: [
          { username: visitorSessionId },
          { email: `visitor_${visitorSessionId}@temp.local` }
        ]
      });

      if (!visitorUser) {
        // Create new visitor user
        visitorUser = new User({
          accountType: 'anonymous',
          isAnonymous: true,
          username: `visitor_${visitorSessionId}`,
          email: `visitor_${visitorSessionId}@temp.local`,
          visitorMessageCount: 0
        });
        await visitorUser.save();
      }

      const messageCount = visitorUser.visitorMessageCount || 0;
      const remainingMessages = Math.max(0, VISITOR_MESSAGE_LIMIT - messageCount);
      const requiresAuth = messageCount >= VISITOR_MESSAGE_LIMIT;

      visitorReq.user = {
        userId: visitorUser._id.toString(),
        accountType: 'anonymous'
      };
      
      visitorReq.visitor = {
        isVisitor: true,
        messageCount,
        remainingMessages,
        requiresAuth
      };

      if (requiresAuth) {
        return res.status(403).json({
          success: false,
          message: 'Message limit reached. Please sign up or login to continue chatting.',
          visitor: {
            messageCount,
            remainingMessages: 0,
            limitReached: true
          },
          requiresAuth: true
        });
      }

      return next();
    }

    // No visitor session, create one
    const newVisitorSessionId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.session = req.session || {};
    req.session.visitorSessionId = newVisitorSessionId;

    const newVisitorUser = new User({
      accountType: 'anonymous',
      isAnonymous: true,
      username: newVisitorSessionId,
      email: `${newVisitorSessionId}@temp.local`,
      visitorMessageCount: 0
    });
    await newVisitorUser.save();

    visitorReq.user = {
      userId: newVisitorUser._id.toString(),
      accountType: 'anonymous'
    };
    
    visitorReq.visitor = {
      isVisitor: true,
      messageCount: 0,
      remainingMessages: VISITOR_MESSAGE_LIMIT,
      requiresAuth: false
    };

    next();
  } catch (error) {
    console.error('Visitor auth error:', error);
    
    // Fallback: create a new visitor session
    const fallbackSessionId = `visitor_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const fallbackUser = new User({
        accountType: 'anonymous',
        isAnonymous: true,
        username: fallbackSessionId,
        email: `${fallbackSessionId}@temp.local`,
        visitorMessageCount: 0
      });
      await fallbackUser.save();

      const visitorReq = req as VisitorRequest;
      visitorReq.user = {
        userId: fallbackUser._id.toString(),
        accountType: 'anonymous'
      };
      
      visitorReq.visitor = {
        isVisitor: true,
        messageCount: 0,
        remainingMessages: VISITOR_MESSAGE_LIMIT,
        requiresAuth: false
      };

      next();
    } catch (fallbackError) {
      console.error('Fallback visitor creation failed:', fallbackError);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize visitor session'
      });
    }
  }
};

// Middleware to increment visitor message count
export const incrementVisitorMessageCount = async (req: Request, res: Response, next: NextFunction) => {
  const visitorReq = req as VisitorRequest;
  
  if (!visitorReq.visitor?.isVisitor) {
    return next(); // Not a visitor, skip
  }

  try {
    await User.findByIdAndUpdate(
      visitorReq.user!.userId,
      { $inc: { visitorMessageCount: 1 } }
    );
    
    // Update visitor info for response
    visitorReq.visitor.messageCount += 1;
    visitorReq.visitor.remainingMessages = Math.max(0, VISITOR_MESSAGE_LIMIT - visitorReq.visitor.messageCount);
    visitorReq.visitor.requiresAuth = visitorReq.visitor.messageCount >= VISITOR_MESSAGE_LIMIT;
    
    next();
  } catch (error) {
    console.error('Failed to increment visitor message count:', error);
    // Continue anyway, don't block the message
    next();
  }
};
