import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import PeerRoom, { IPeerRoom } from '../models/PeerRoom';
import User from '../models/User';
import Chat from '../models/Chat';
import { Server as SocketIOServer } from 'socket.io';
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

// Create peer room
export const createPeerRoom = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { name, description, category, isPrivate, maxParticipants, settings } = req.body;

    const shareCode = generateShareCode();
    const room = new PeerRoom({
      name,
      description,
      category,
      isPrivate: isPrivate || false,
      maxParticipants: maxParticipants || 10,
      hostId: new mongoose.Types.ObjectId(userId),
      shareCode: shareCode,
      shareableLink: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/room/${shareCode}`,
      participants: [{
        userId: new mongoose.Types.ObjectId(userId),
        joinedAt: new Date(),
        role: 'host'
      }],
      settings: {
        allowAnonymous: true,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false,
        ...settings
      },
      statistics: {
        totalParticipants: 1,
        averageDuration: 0,
        totalSessions: 0,
        satisfactionScore: 3 // Default to neutral satisfaction (middle of 1-5 range)
      }
    });

    await room.save();

    console.log('Peer room saved successfully:', room._id);
    console.log('Generated share info:', {
      shareCode: room.shareCode,
      shareableLink: room.shareableLink
    });

    // Create chat for the room
    const chat = new Chat({
      userId: new mongoose.Types.ObjectId(userId),
      type: 'peer',
      roomId: room._id,
      messages: [],
      title: `${name} - Peer Support`
    });

    await chat.save();

    res.status(201).json({
      success: true,
      message: 'Peer room created successfully',
      data: { room, chat }
    });
  } catch (error: any) {
    console.error('Create peer room error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      validationErrors: error.errors
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create peer room',
      error: error.message
    });
  }
};

// Debug endpoint to see all rooms
export const getAllRoomsDebug = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const allRooms = await PeerRoom.find({});
    console.log('All rooms in database:', allRooms.length);
    
    const publicRooms = allRooms.filter(room => !room.isPrivate && room.isActive);
    const privateRooms = allRooms.filter(room => room.isPrivate);
    const inactiveRooms = allRooms.filter(room => !room.isActive);
    
    console.log(`Debug - All: ${allRooms.length}, Public: ${publicRooms.length}, Private: ${privateRooms.length}, Inactive: ${inactiveRooms.length}`);
    
    res.status(200).json({
      success: true,
      data: {
        all: allRooms.length,
        public: publicRooms.length,
        private: privateRooms.length,
        inactive: inactiveRooms.length,
        rooms: allRooms.map(room => ({
          _id: room._id,
          name: room.name,
          isPrivate: room.isPrivate,
          isActive: room.isActive,
          category: room.category
        }))
      }
    });
  } catch (error: any) {
    console.error('Debug rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get debug rooms',
      error: error.message
    });
  }
};

// Get all public peer rooms
export const getPublicPeerRooms = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const { category, page = 1, limit = 20, search } = req.query;

    const query: any = { 
      isPrivate: false, 
      isActive: true 
    };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search as string, 'i')] } }
      ];
    }

    console.log('Public rooms query:', query);
    
    const rooms = await PeerRoom.find(query)
      .populate('hostId', 'name')
      .sort({ lastActivity: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit));

    console.log('Found rooms:', rooms.length);

    const total = await PeerRoom.countDocuments(query);
    console.log('Total rooms count:', total);

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
    console.error('Get public peer rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get peer rooms',
      error: error.message
    });
  }
};

// Get user's peer rooms
export const getUserPeerRooms = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { page = 1, limit = 20 } = req.query;

    // Find rooms where user is either host or participant
    const rooms = await PeerRoom.find({
      $or: [
        { 'participants.userId': userId },
        { hostId: userId }
      ],
      isActive: true
    })
      .populate('hostId', 'name')
      .populate('participants.userId', 'name')
      .sort({ lastActivity: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit));

    // Ensure host is in participants array for rooms they own
    for (const room of rooms) {
      const participant = room.participants.find(p => p.userId.toString() === userId);
      const isHost = room.hostId.toString() === userId;
      
      if (isHost && !participant) {
        console.log(`Host ${userId} not found in participants in getUserPeerRooms, adding them back`);
        room.participants.push({
          userId: new mongoose.Types.ObjectId(userId),
          joinedAt: new Date(),
          role: 'host',
          isMuted: false,
          isHandRaised: false
        });
        await room.save();
      }
    }

    const total = await PeerRoom.countDocuments({
      $or: [
        { 'participants.userId': userId },
        { hostId: userId }
      ],
      isActive: true
    });

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
    console.error('Get user peer rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user peer rooms',
      error: error.message
    });
  }
};

// Join peer room
export const joinPeerRoom = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Check if user is already in the room
    const existingParticipant = room.participants.find(
      p => p.userId.toString() === userId
    );

    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        message: 'User is already in the room'
      });
    }

    // Check if room is full
    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Room is full'
      });
    }

    // Check if anonymous users are allowed
    const user = await User.findById(userId);
    if (!room.settings.allowAnonymous && user?.accountType === 'anonymous') {
      return res.status(403).json({
        success: false,
        message: 'Anonymous users not allowed in this room'
      });
    }

    // Add user to room
    room.participants.push({
      userId: new mongoose.Types.ObjectId(userId),
      joinedAt: new Date(),
      role: 'participant',
      isMuted: false,
      isHandRaised: false
    });

    // Update room statistics
    room.statistics.totalParticipants += 1;
    room.lastActivity = new Date();

    await room.save();

    // Find or create the chat for this room
    let chat = await Chat.findOne({ roomId: room._id, type: 'peer' });
    if (!chat) {
      chat = new Chat({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'peer',
        roomId: room._id,
        messages: [],
        title: `${room.name} - Peer Support`
      });
      await chat.save();
    }

    console.log(`User ${userId} joined room ${roomId}. Total participants: ${room.participants.length}`);

    return res.status(200).json({
      success: true,
      message: 'Joined peer room successfully',
      data: { 
        room: {
          ...room.toJSON(),
          currentParticipants: room.participants.length
        },
        chat: {
          _id: chat._id,
          roomId: chat.roomId,
          messages: chat.messages // Include full message history
        }
      }
    });
  } catch (error: any) {
    console.error('Join peer room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join peer room',
      error: error.message
    });
  }
};

// Leave peer room
export const leavePeerRoom = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Remove user from room
    const initialParticipantCount = room.participants.length;
    room.participants = room.participants.filter(
      p => p.userId.toString() !== userId
    );

    // If host leaves and there are other participants, assign new host
    if (room.hostId.toString() === userId && room.participants.length > 0) {
      room.hostId = room.participants[0].userId;
      room.participants[0].role = 'host';
      console.log(`Host left, new host assigned: ${room.hostId}`);
    }

    // Don't deactivate room just because host leaves - host should be able to rejoin
    // Only deactivate if room has been inactive for a long time (handled elsewhere)
    console.log(`Room ${roomId} remains active after user ${userId} left. Participants: ${room.participants.length}`);

    // Update room statistics
    room.lastActivity = new Date();

    await room.save();

    console.log(`User ${userId} left room ${roomId}. Participants: ${initialParticipantCount} -> ${room.participants.length}`);

    return res.status(200).json({
      success: true,
      message: 'Left peer room successfully',
      data: {
        room: {
          ...room.toJSON(),
          currentParticipants: room.participants.length
        }
      }
    });
  } catch (error: any) {
    console.error('Leave peer room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to leave peer room',
      error: error.message
    });
  }
};

// Start live session
export const startLiveSession = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Check if user is host
    if (room.hostId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only host can start live session'
      });
    }

    room.isLive = true;
    room.startTime = new Date();
    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Live session started successfully',
      data: { room }
    });
  } catch (error: any) {
    console.error('Start live session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start live session',
      error: error.message
    });
  }
};

// End live session
export const endLiveSession = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Check if user is host
    if (room.hostId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only host can end live session'
      });
    }

    room.isLive = false;
    room.endTime = new Date();

    // Update statistics
    if (room.startTime) {
      const duration = room.endTime.getTime() - room.startTime.getTime();
      const avgDuration = (room.statistics.averageDuration * room.statistics.totalSessions + duration) / (room.statistics.totalSessions + 1);
      
      room.statistics.averageDuration = avgDuration;
      room.statistics.totalSessions += 1;
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Live session ended successfully',
      data: { room }
    });
  } catch (error: any) {
    console.error('End live session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to end live session',
      error: error.message
    });
  }
};

// Update participant role
export const updateParticipantRole = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId, participantId } = req.params;
    const { role } = req.body;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Check if user is host
    if (room.hostId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only host can update participant roles'
      });
    }

    // Update participant role
    const participant = room.participants.find(
      p => p.userId.toString() === participantId
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }

    participant.role = role;
    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Participant role updated successfully',
      data: { participant }
    });
  } catch (error: any) {
    console.error('Update participant role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update participant role',
      error: error.message
    });
  }
};

// Get room details
export const getRoomDetails = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const { roomId } = req.params;
    const userId = authReq.user!.userId;

    const room = await PeerRoom.findById(roomId)
      .populate('hostId', 'name')
      .populate('participants.userId', 'name accountType');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Ensure host is in participants array if they own the room
    const participant = room.participants.find(p => p.userId.toString() === userId);
    const isHost = room.hostId.toString() === userId;
    
    if (isHost && !participant) {
      console.log(`Host ${userId} not found in participants during getRoomDetails, adding them back`);
      room.participants.push({
        userId: new mongoose.Types.ObjectId(userId),
        joinedAt: new Date(),
        role: 'host',
        isMuted: false,
        isHandRaised: false
      });
      await room.save();
    }

    return res.status(200).json({
      success: true,
      data: { room }
    });
  } catch (error: any) {
    console.error('Get room details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get room details',
      error: error.message
    });
  }
};

// Generate shareable link for room
export const generateShareableLink = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Check if user is in the room and has appropriate permissions
    const participant = room.participants.find(
      p => p.userId.toString() === userId
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You must join the room before sharing it'
      });
    }

    // For private rooms, only hosts and moderators can generate shareable links
    if (room.isPrivate && participant.role !== 'host' && participant.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Only host or moderators can generate shareable links for private rooms'
      });
    }

    // Generate new share code if doesn't exist
    if (!room.shareCode) {
      let shareCode = generateShareCode();
      
      // Ensure uniqueness
      while (await PeerRoom.findOne({ shareCode })) {
        shareCode = generateShareCode();
      }
      
      room.shareCode = shareCode;
      room.shareableLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/room/${shareCode}`;
      await room.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Shareable link generated successfully',
      data: {
        shareCode: room.shareCode,
        shareableLink: room.shareableLink
      }
    });
  } catch (error: any) {
    console.error('Generate shareable link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate shareable link',
      error: error.message
    });
  }
};

// Join room via share code
export const joinRoomViaShareCode = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { shareCode } = req.params;

    // Find room by share code
    const room = await PeerRoom.findOne({ shareCode: shareCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Invalid share code or room not found'
      });
    }

    // Check if room is active
    if (!room.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This room is no longer active'
      });
    }

    // Check if user is already in the room
    const existingParticipant = room.participants.find(
      p => p.userId.toString() === userId
    );

    if (existingParticipant) {
      // User is already in room, return room info
      let chat = await Chat.findOne({ roomId: room._id, type: 'peer' });
      if (!chat) {
        chat = new Chat({
          userId: new mongoose.Types.ObjectId(userId),
          type: 'peer',
          roomId: room._id,
          messages: [],
          title: `${room.name} - Peer Support`
        });
        await chat.save();
      }

      return res.status(200).json({
        success: true,
        message: 'Already in room',
        data: {
          room: {
            ...room.toJSON(),
            currentParticipants: room.participants.length
          },
          chat: {
            _id: chat._id,
            roomId: chat.roomId,
            messages: chat.messages
          }
        }
      });
    }

    // Check if room is full
    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Room is full'
      });
    }

    // Check if anonymous users are allowed
    const user = await User.findById(userId);
    if (!room.settings.allowAnonymous && user?.accountType === 'anonymous') {
      return res.status(403).json({
        success: false,
        message: 'Anonymous users not allowed in this room'
      });
    }

    // Add user to room
    room.participants.push({
      userId: new mongoose.Types.ObjectId(userId),
      joinedAt: new Date(),
      role: 'participant',
      isMuted: false,
      isHandRaised: false
    });

    // Update room statistics
    room.statistics.totalParticipants += 1;
    room.lastActivity = new Date();

    await room.save();

    // Find or create the chat for this room
    let chat = await Chat.findOne({ roomId: room._id, type: 'peer' });
    if (!chat) {
      chat = new Chat({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'peer',
        roomId: room._id,
        messages: [],
        title: `${room.name} - Peer Support`
      });
      await chat.save();
    }

    console.log(`User ${userId} joined room ${room._id} via share code ${shareCode}. Total participants: ${room.participants.length}`);

    return res.status(200).json({
      success: true,
      message: 'Joined room successfully via share code',
      data: {
        room: {
          ...room.toJSON(),
          currentParticipants: room.participants.length
        },
        chat: {
          _id: chat._id,
          roomId: chat.roomId,
          messages: chat.messages
        }
      }
    });
  } catch (error: any) {
    console.error('Join room via share code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join room via share code',
      error: error.message
    });
  }
};

// Update room details
// Reactivate room (for hosts who want to resume their room)
export const reactivateRoom = async (req: Request, res: Response) => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;

    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Peer room not found'
      });
    }

    // Check if user is the host
    if (room.hostId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only host can reactivate room'
      });
    }

    // Reactivate room
    room.isActive = true;
    room.lastActivity = new Date();

    // Add host back to participants if not already there
    const participant = room.participants.find(p => p.userId.toString() === userId);
    if (!participant) {
      room.participants.push({
        userId: new mongoose.Types.ObjectId(userId),
        joinedAt: new Date(),
        role: 'host',
        isMuted: false,
        isHandRaised: false
      });
      console.log(`Host ${userId} added back to participants during reactivation`);
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Room reactivated successfully',
      data: { room }
    });
  } catch (error: any) {
    console.error('Reactivate room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reactivate room',
      error: error.message
    });
  }
};

// Update room details
export const updateRoom = async (req: Request, res: Response): Promise<Response<any>> => {
  const authReq = asAuthenticatedRequest(req);
  try {
    const userId = authReq.user!.userId;
    const { roomId } = req.params;
    const { name, description, category, maxParticipants, settings, rules } = req.body;

    // Find the room
    const room = await PeerRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is host, moderator, or admin
    const participant = room.participants.find(p => p.userId.toString() === userId);
    
    // Check if user is admin by fetching from database
    const user = await User.findById(userId);
    const isAdmin = user?.isAdmin || false;
    
    // Additional check: if user is the hostId but not in participants, add them back
    const isHostById = room.hostId.toString() === userId;
    if (isHostById && !participant) {
      console.log(`Host ${userId} not found in participants array, adding them back`);
      room.participants.push({
        userId: new mongoose.Types.ObjectId(userId),
        joinedAt: new Date(),
        role: 'host',
        isMuted: false,
        isHandRaised: false
      });
    }
    
    // Check permissions
    let hasPermission = isAdmin;
    
    if (!hasPermission && isHostById) {
      hasPermission = true;
    }
    
    if (!hasPermission && participant) {
      hasPermission = participant.role === 'host' || participant.role === 'moderator';
    }
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Only hosts, moderators, or admins can edit room details'
      });
    }

    // Update room fields
    if (name) room.name = name;
    if (description) room.description = description;
    if (category) room.category = category;
    if (maxParticipants) room.maxParticipants = maxParticipants;
    if (settings) room.settings = { ...room.settings, ...settings };
    if (rules) room.rules = rules;

    room.lastActivity = new Date();

    await room.save();

    console.log('Room updated successfully:', room._id);

    return res.status(200).json({
      success: true,
      message: 'Room updated successfully',
      data: { room }
    });
  } catch (error: any) {
    console.error('Update room error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update room',
      error: error.message
    });
  }
};
