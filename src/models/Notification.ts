import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isGlobal: boolean; // If true, shows to all users
  targetAudience?: 'all' | 'registered' | 'anonymous' | 'premium';
  targetUsers?: mongoose.Types.ObjectId[]; // Specific users if not global
  isActive: boolean;
  expiresAt?: Date;
  createdBy: mongoose.Types.ObjectId; // Admin who created it
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'announcement'],
    required: true,
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    required: true,
    default: 'medium'
  },
  isGlobal: {
    type: Boolean,
    required: true,
    default: true
  },
  targetAudience: {
    type: String,
    enum: ['all', 'registered', 'anonymous', 'premium'],
    default: 'all'
  },
  targetUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
notificationSchema.index({ isActive: 1, isGlobal: 1 });
notificationSchema.index({ targetAudience: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ createdBy: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function(this: INotification) {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

// Pre-find middleware to filter out expired and inactive notifications
notificationSchema.pre(/^find/, function(this: any, next: Function) {
  this.find({
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  next();
});

export default mongoose.model<INotification>('Notification', notificationSchema);
