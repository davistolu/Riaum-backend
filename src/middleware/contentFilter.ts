import { Request, Response, NextFunction } from 'express';
import { moderateContent } from '../utils/profanityFilter';

/**
 * Middleware to automatically filter profanity in incoming messages
 */
export const filterProfanity = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if this is a message-related request
    if (req.path.includes('/message') || req.method === 'POST') {
      const body = req.body;
      
      // Filter content field if it exists
      if (body.content && typeof body.content === 'string') {
        try {
          const moderationResult = moderateContent(body.content);
          
          // Store original content for admin review
          if (moderationResult.wasCensored) {
            req.body.originalContent = moderationResult.originalContent;
            req.body.wasCensored = true;
            req.body.hasProfanity = true;
          }
          
          // Replace content with censored version
          req.body.content = moderationResult.censoredContent;
          
          console.log('Content filter applied:', {
            original: moderationResult.originalContent,
            censored: moderationResult.censoredContent,
            wasCensored: moderationResult.wasCensored
          });
        } catch (filterError) {
          console.error('Error in profanity filter:', filterError);
          // Continue with original content if filter fails
        }
      }
      
      // Filter message content in arrays (for bulk operations)
      if (body.messages && Array.isArray(body.messages)) {
        try {
          body.messages = body.messages.map((msg: any) => {
            if (msg.content && typeof msg.content === 'string') {
              const moderationResult = moderateContent(msg.content);
              
              if (moderationResult.wasCensored) {
                msg.originalContent = moderationResult.originalContent;
                msg.wasCensored = true;
                msg.hasProfanity = true;
              }
              
              msg.content = moderationResult.censoredContent;
            }
            return msg;
          });
        } catch (filterError) {
          console.error('Error in message array filtering:', filterError);
          // Continue with original messages if filter fails
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Content filter error:', error);
    // Continue even if filtering fails
    next();
  }
};

/**
 * Middleware to detect and flag potentially inappropriate content
 */
export const detectInappropriateContent = (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    let flaggedContent = false;
    const flaggedFields: string[] = [];
    
    // Check various fields for inappropriate content
    const fieldsToCheck = ['content', 'description', 'name', 'title'];
    
    fieldsToCheck.forEach(field => {
      if (body[field] && typeof body[field] === 'string') {
        const moderationResult = moderateContent(body[field]);
        if (moderationResult.hasProfanity) {
          flaggedContent = true;
          flaggedFields.push(field);
        }
      }
    });
    
    // Add flag information to request
    if (flaggedContent) {
      req.body.isFlagged = true;
      req.body.flaggedFields = flaggedFields;
      req.body.flaggedAt = new Date();
      
      console.log('Content flagged for review:', {
        fields: flaggedFields,
        userId: req.user?.userId,
        timestamp: new Date()
      });
    }
    
    next();
  } catch (error) {
    console.error('Content detection error:', error);
    next();
  }
};

export default {
  filterProfanity,
  detectInappropriateContent
};
