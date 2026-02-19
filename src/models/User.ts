import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  accountType: 'registered' | 'anonymous';
  memberSince: Date;
  isActive: boolean;
  isAnonymous: boolean;
  isAdmin: boolean;
  profilePicture?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    dataSharing: boolean;
  };
  moodHistory: Array<{
    date: Date;
    mood: number;
    note?: string;
  }>;
  lastActive: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 30,
    unique: true,
    sparse: true,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: 6,
    select: false
  },
  accountType: {
    type: String,
    enum: ['registered', 'anonymous'],
    default: 'anonymous'
  },
  memberSince: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAnonymous: {
    type: Boolean,
    default: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  profilePicture: {
    type: String,
    default: null
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    dataSharing: {
      type: Boolean,
      default: false
    }
  },
  moodHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    mood: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    note: {
      type: String,
      maxlength: 500
    }
  }],
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ accountType: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'moodHistory.date': -1 });

// Virtual for formatted member since
userSchema.virtual('formattedMemberSince').get(function() {
  if (!this.memberSince) return 'unknown';
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.memberSince.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
});

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  console.log('User pre-save middleware triggered for:', this._id || 'new user');
  console.log('User data:', JSON.stringify({
    accountType: this.accountType,
    isAnonymous: this.isAnonymous,
    username: this.username,
    email: this.email
  }, null, 2));
  
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    next(error as Error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last active on save
userSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

export default mongoose.model<IUser>('User', userSchema);
