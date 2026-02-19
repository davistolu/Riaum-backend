import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Chat, { IChat } from '../models/Chat';
import User from '../models/User';
import PeerRoom from '../models/PeerRoom';
import getGeminiService from '../services/gemini';
import { AuthenticatedRequest } from '../middleware/auth';

// Type assertion function to safely cast Request to AuthenticatedRequest
function asAuthenticatedRequest(req: Request): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

// Create new chat
export const createChat = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { type, roomId } = req.body;

    const chat = new Chat({
      userId,
      type: type || 'ai',
      roomId: roomId || undefined,
      messages: []
    });

    await chat.save();

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: { chat }
    });
  } catch (error: any) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat',
      error: error.message
    });
  }
};

// Send message to AI chat
// Line 38
export const sendAIMessage = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { chatId, message, userMood } = req.body;

    // Find chat
    const chat = await Chat.findOne({ _id: chatId, userId, type: { $in: ['ai', 'live'] } });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Add user message
    const userMessageId = uuidv4();
    const userMessage = {
      id: userMessageId,
      content: message,
      sender: 'user' as const,
      timestamp: new Date(),
      isEdited: false,
      metadata: {
        mood: userMood
      }
    };

    chat.messages.push(userMessage);

    // Get conversation history for context (last 10 messages)
    const conversationHistory = chat.messages.slice(-10).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      content: msg.content
    }));

    // Generate AI response
    const aiResponse = await getGeminiService().generateResponse(
      message,
      conversationHistory,
      userMood
    );

    // Add AI response
    const aiMessageId = uuidv4();
    const aiMessage = {
      id: aiMessageId,
      content: aiResponse.text,
      sender: 'ai' as const,
      timestamp: new Date(),
      isEdited: false,
      metadata: {
        sentiment: aiResponse.sentiment,
        isSensitive: aiResponse.isSensitive
      }
    };

    chat.messages.push(aiMessage);

    // Update user mood if suggested
    if (aiResponse.suggestedMood && userMood !== aiResponse.suggestedMood) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          moodHistory: {
            date: new Date(),
            mood: aiResponse.suggestedMood
          }
        }
      });
    }

    await chat.save();

    // Check for sensitive content and flag if necessary
    if (aiResponse.isSensitive) {
      console.warn(`Sensitive content detected in chat ${chatId} by user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        userMessage,
        aiMessage,
        sentiment: aiResponse.sentiment,
        isSensitive: aiResponse.isSensitive,
        suggestedMood: aiResponse.suggestedMood
      }
    });
  } catch (error: any) {
    console.error('Send AI message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Get user chats
export const getUserChats = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { type, page = 1, limit = 20 } = req.query;

    const query: any = { userId, isDeleted: false };
    if (type) {
      query.type = type;
    }

    const chats = await Chat.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit))
      .populate('roomId', 'name category');

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
    console.error('Get user chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chats',
      error: error.message
    });
  }
};

// Get chat by ID
export const getChatById = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { chatId } = req.params;

    // First try to find chat by userId (for AI, live, and personal chats)
    let chat = await Chat.findOne({ _id: chatId, userId, isDeleted: false, type: { $in: ['ai', 'live'] } })
      .populate('roomId', 'name category participants');

    // If not found and it's a peer chat, check if user is a participant in the room
    if (!chat) {
      chat = await Chat.findOne({ _id: chatId, type: 'peer', isDeleted: false })
        .populate('roomId', 'name category participants');

      if (chat && chat.roomId) {
        // Check if user is a participant in the peer room
        const room = await PeerRoom.findById(chat.roomId);
        if (!room || !room.participants.some(p => p.userId.toString() === userId)) {
          return res.status(404).json({
            success: false,
            message: 'Chat not found or access denied'
          });
        }
      } else if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: { chat }
    });
  } catch (error: any) {
    console.error('Get chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat',
      error: error.message
    });
  }
};

// Update message
export const updateMessage = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { chatId, messageId } = req.params;
    const { content } = req.body;

    const chat = await Chat.findOne({ _id: chatId, userId });
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

    // Only allow editing user messages
    if (message.sender !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit non-user messages'
      });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();

    await chat.save();

    return res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: { message }
    });
  } catch (error: any) {
    console.error('Update message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update message',
      error: error.message
    });
  }
};

// Delete chat
export const deleteChat = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { chatId } = req.params;

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId },
      { isDeleted: true },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete chat',
      error: error.message
    });
  }
};

// Archive chat
export const archiveChat = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { chatId } = req.params;

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId },
      { isArchived: true },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat archived successfully'
    });
  } catch (error: any) {
    console.error('Archive chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to archive chat',
      error: error.message
    });
  }
};

// Send message to peer room
export const sendPeerMessage = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    console.log('=== sendPeerMessage START ===');
    const userId = authReq.user!.userId;
    const { chatId, content, replyTo } = req.body;
    
    console.log('Received message payload:', { chatId, content, replyTo }); // Debug log

    console.log('Step 1: Finding chat...');
    // Find chat
    const chat = await Chat.findOne({ _id: chatId, type: 'peer' });
    if (!chat) {
      console.log('Step 1 FAILED: Chat not found');
      return res.status(404).json({
        success: false,
        message: 'Peer chat not found'
      });
    }
    console.log('Step 1 SUCCESS: Chat found');

    console.log('Step 2: Finding user...');
    // Get user info for sender details
    const user = await User.findById(userId);
    if (!user) {
      console.log('Step 2 FAILED: User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    console.log('Step 2 SUCCESS: User found');

    console.log('Step 3: Moderating content...');
    // Moderate content for profanity (TEMPORARILY DISABLED FOR DEBUGGING)
    let moderationResult;
    try {
      // moderationResult = moderateContent(content);
      // TEMPORARY: Disable moderation to test
      moderationResult = {
        censoredContent: content,
        wasCensored: false,
        hasProfanity: false,
        originalContent: undefined
      };
      console.log('Step 3 SUCCESS: Content moderation DISABLED - content:', content);
    } catch (moderationError) {
      console.log('Step 3 FAILED: Error in content moderation:', moderationError);
      // Fallback to no moderation if it fails
      moderationResult = {
        censoredContent: content,
        wasCensored: false,
        hasProfanity: false,
        originalContent: undefined
      };
    }

    console.log('Step 4: Creating message...');
    // Create new message with censored content
    const newMessage: any = {
      id: uuidv4(),
      content: moderationResult.censoredContent,
      originalContent: moderationResult.wasCensored ? moderationResult.originalContent : undefined,
      sender: 'peer',
      timestamp: new Date(),
      isEdited: moderationResult.wasCensored,
      isFlagged: moderationResult.hasProfanity,
      moderationStatus: moderationResult.hasProfanity ? 'flagged' : 'approved',
      metadata: {
        senderName: user.username || user.name || 'Anonymous',
        senderId: userId,
        isAnonymous: user.accountType === 'anonymous',
        wasCensored: moderationResult.wasCensored
      }
    };

    // Add reply information if present
    if (replyTo) {
      newMessage.replyTo = replyTo;
      console.log('Added replyTo to message:', replyTo); // Debug log
    }
    console.log('Step 4 SUCCESS: Message created');

    console.log('Step 5: Saving message to chat...');
    // Add message to chat
    chat.messages.push(newMessage);
    chat.lastMessageAt = new Date();
    await chat.save();
    console.log('Step 5 SUCCESS: Message saved to chat');

    console.log('Step 6: Updating room activity...');
    // Update room activity
    if (chat.roomId) {
      await PeerRoom.findByIdAndUpdate(chat.roomId, {
        lastActivity: new Date()
      });
    }
    console.log('Step 6 SUCCESS: Room activity updated');

    console.log('Step 7: Emitting real-time message...');
    // Emit real-time message to room participants
    const io = req.app.get('io');
    if (io && chat.roomId) {
      io.to(chat.roomId.toString()).emit('new-peer-message', {
        chatId: chat._id,
        roomId: chat.roomId,
        message: newMessage,
        sender: {
          id: userId,
          name: user.name || 'Anonymous',
          isAnonymous: user.accountType === 'anonymous'
        }
      });
    }
    console.log('Step 7 SUCCESS: Real-time message emitted');

    console.log(`User ${userId} sent message to peer chat ${chatId}`);

    console.log('Step 8: Sending response...');
    return res.status(200).json({
      success: true,
      message: moderationResult.wasCensored ? 'Message sent (content was censored)' : 'Message sent successfully',
      data: { 
        message: newMessage,
        moderation: {
          wasCensored: moderationResult.wasCensored,
          hasProfanity: moderationResult.hasProfanity,
          originalContent: moderationResult.originalContent
        },
        chat: {
          _id: chat._id,
          lastMessageAt: chat.lastMessageAt
        }
      }
    });
  } catch (error: any) {
    console.error('=== sendPeerMessage ERROR ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Get chat by room ID
export const getChatByRoomId = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const chat = await Chat.findOne({ roomId, type: 'peer' })
      .populate('roomId', 'name category participants');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found for this room'
      });
    }

    return res.status(200).json({
      success: true,
      data: { chat }
    });
  } catch (error: any) {
    console.error('Get chat by room ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat',
      error: error.message
    });
  }
};

// Generate chat summary
export const generateChatSummary = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const summary = await getGeminiService().generateSummary(chat.messages);

    chat.summary = summary;
    await chat.save();

    return res.status(200).json({
      success: true,
      message: 'Summary generated successfully',
      data: { summary }
    });
  } catch (error: any) {
    console.error('Generate summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate summary',
      error: error.message
    });
  }
};

// Export chat data
export const exportChatData = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { format = 'json' } = req.query;

    const chats = await Chat.find({ userId, isDeleted: false })
      .select('messages type title createdAt updatedAt')
      .sort({ createdAt: -1 });

    const exportData = {
      userId,
      exportDate: new Date(),
      totalChats: chats.length,
      chats: chats.map(chat => ({
        id: chat._id,
        type: chat.type,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
        messages: chat.messages.map(msg => ({
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp,
          isEdited: msg.isEdited
        }))
      }))
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="serene-space-chat-export-${Date.now()}.json"`);
      res.status(200).json(exportData);
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format'
      });
    }
  } catch (error: any) {
    console.error('Export chat data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export chat data',
      error: error.message
    });
  }
};
