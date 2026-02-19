import mongoose, { Document, Schema } from 'mongoose';

export interface IPeerRoom extends Document {
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  maxParticipants: number;
  currentParticipants: number;
  hostId: mongoose.Types.ObjectId;
  participants: Array<{
    userId: mongoose.Types.ObjectId;
    joinedAt: Date;
    role: 'host' | 'moderator' | 'participant';
    isMuted: boolean;
    isHandRaised: boolean;
  }>;
  isActive: boolean;
  isLive: boolean;
  startTime?: Date;
  endTime?: Date;
  schedule?: {
    isRecurring: boolean;
    daysOfWeek: number[];
    time: string;
  };
  tags: string[];
  rules: string[];
  settings: {
    allowAnonymous: boolean;
    requireApproval: boolean;
    recordingEnabled: boolean;
    chatEnabled: boolean;
    screenShareEnabled: boolean;
  };
  statistics: {
    totalParticipants: number;
    averageDuration: number;
    totalSessions: number;
    satisfactionScore: number;
  };
  lastActivity: Date;
  shareableLink?: string;
  shareCode?: string;
}

const peerRoomSchema = new Schema<IPeerRoom>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['anxiety', 'depression', 'trauma', 'relationships', 'stress', 'grief', 'addiction', 'general', 'mindfulness']
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  maxParticipants: {
    type: Number,
    default: 10,
    min: 2,
    max: 50
  },
  currentParticipants: {
    type: Number,
    default: 0,
    min: 0
  },
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['host', 'moderator', 'participant'],
      default: 'participant'
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    isHandRaised: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isLive: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  schedule: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }],
    time: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    }
  },
  tags: [{
    type: String,
    maxlength: 50,
    trim: true
  }],
  rules: [{
    type: String,
    maxlength: 200
  }],
  settings: {
    allowAnonymous: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    recordingEnabled: {
      type: Boolean,
      default: false
    },
    chatEnabled: {
      type: Boolean,
      default: true
    },
    screenShareEnabled: {
      type: Boolean,
      default: false
    }
  },
  statistics: {
    totalParticipants: {
      type: Number,
      default: 0,
      min: 0
    },
    averageDuration: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSessions: {
      type: Number,
      default: 0,
      min: 0
    },
    satisfactionScore: {
      type: Number,
      default: 0,
      min: 1,
      max: 5
    }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  shareableLink: {
    type: String,
    unique: true,
    sparse: true
  },
  shareCode: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
peerRoomSchema.index({ category: 1, isActive: 1 });
peerRoomSchema.index({ isLive: 1, lastActivity: -1 });
peerRoomSchema.index({ tags: 1 });
peerRoomSchema.index({ 'participants.userId': 1 });
peerRoomSchema.index({ isPrivate: 1 });
peerRoomSchema.index({ hostId: 1 });
peerRoomSchema.index({ isActive: 1 });
peerRoomSchema.index({ isLive: 1 });
peerRoomSchema.index({ lastActivity: -1 });
peerRoomSchema.index({ shareCode: 1 });

// Virtual for participant count
peerRoomSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual for isFull
peerRoomSchema.virtual('isFull').get(function() {
  return this.participants.length >= this.maxParticipants;
});

// Pre-save middleware to update currentParticipants
peerRoomSchema.pre('save', function(next) {
  this.currentParticipants = this.participants.length;
  this.lastActivity = new Date();
  next();
});

export default mongoose.model<IPeerRoom>('PeerRoom', peerRoomSchema);
