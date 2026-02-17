import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'ai' | 'peer' | 'live';
  roomId?: mongoose.Types.ObjectId;
  messages: Array<{
    id: string;
    content: string;
    sender: 'user' | 'ai' | 'peer' | 'moderator';
    timestamp: Date;
    isEdited: boolean;
    editedAt?: Date;
    isFlagged?: boolean;
    moderationStatus?: 'pending' | 'approved' | 'rejected' | 'deleted';
    moderationReason?: string;
    isDeleted?: boolean;
    replyTo?: {
      id: string;
      sender: string;
      text: string;
    };
    metadata?: {
      mood?: number;
      sentiment?: 'positive' | 'negative' | 'neutral';
      isSensitive?: boolean;
      senderName?: string;
      senderId?: string;
      isAnonymous?: boolean;
    };
  }>;
  title?: string;
  isArchived: boolean;
  isDeleted: boolean;
  tags: string[];
  summary?: string;
  aiModel?: string;
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['ai', 'peer', 'live'],
    required: true
  },
  roomId: {
    type: Schema.Types.ObjectId,
    ref: 'PeerRoom'
  },
  messages: [{
    id: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000
    },
    sender: {
      type: String,
      enum: ['user', 'ai', 'peer', 'moderator'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    isFlagged: {
      type: Boolean,
      default: false
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'deleted'],
      default: 'pending'
    },
    moderationReason: {
      type: String
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    replyTo: {
      id: {
        type: String
      },
      sender: {
        type: String
      },
      text: {
        type: String
      }
    },
    metadata: {
      mood: {
        type: Number,
        min: 1,
        max: 5
      },
      sentiment: {
        type: String,
        enum: ['positive', 'negative', 'neutral']
      },
      isSensitive: {
        type: Boolean,
        default: false
      },
      senderName: {
        type: String
      },
      senderId: {
        type: String
      },
      isAnonymous: {
        type: Boolean
      }
    }
  }],
  title: {
    type: String,
    maxlength: 200,
    trim: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  tags: [{
    type: String,
    maxlength: 50,
    trim: true
  }],
  summary: {
    type: String,
    maxlength: 1000
  },
  aiModel: {
    type: String,
    default: 'gemini-2.5-flash-lite'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
chatSchema.index({ userId: 1, type: 1 });
chatSchema.index({ userId: 1, lastMessageAt: -1 });
chatSchema.index({ roomId: 1 });
chatSchema.index({ tags: 1 });
chatSchema.index({ userId: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ lastMessageAt: -1 });

// Virtual for message count
chatSchema.virtual('messageCountVirtual').get(function() {
  return this.messages.length;
});

// Pre-save middleware to update message count and last message
chatSchema.pre('save', function(next) {
  this.messageCount = this.messages.length;
  if (this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

// Auto-generate title from first message if not provided
chatSchema.pre('save', function(next) {
  if (!this.title && this.messages.length > 0 && this.messages[0].sender === 'user') {
    const firstMessage = this.messages[0].content;
    this.title = firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;
  }
  next();
});

export default mongoose.model<IChat>('Chat', chatSchema);
