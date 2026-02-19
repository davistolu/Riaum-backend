import mongoose, { Document, Schema } from 'mongoose';

export interface IResource extends Document {
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  type: 'article' | 'video' | 'link' | 'document' | 'exercise';
  url?: string;
  isPublished: boolean;
  isPublic: boolean;
  targetAudience: 'all' | 'registered' | 'anonymous';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime?: number; // in minutes
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedBy: mongoose.Types.ObjectId; // Reference to User who submitted it
  reviewedBy?: mongoose.Types.ObjectId; // Reference to Admin who reviewed it
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema<IResource>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  content: {
    type: String,
    required: function(this: IResource) {
      return this.type !== 'link';
    },
    maxlength: 10000
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  type: {
    type: String,
    enum: ['article', 'video', 'link', 'document', 'exercise'],
    required: true,
    default: 'article'
  },
  url: {
    type: String,
    validate: {
      validator: function(this: IResource, v: string) {
        if (this.type === 'link' || this.type === 'video') {
          return v && /^https?:\/\/.+/.test(v);
        }
        return true;
      },
      message: 'Valid URL is required for links and videos'
    }
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  targetAudience: {
    type: String,
    enum: ['all', 'registered', 'anonymous'],
    default: 'all'
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  estimatedReadTime: {
    type: Number,
    min: 1,
    max: 1000
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
resourceSchema.index({ category: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ isPublished: 1, isPublic: 1 });
resourceSchema.index({ targetAudience: 1 });
resourceSchema.index({ difficulty: 1 });
resourceSchema.index({ submittedBy: 1 });
resourceSchema.index({ approvalStatus: 1 });
resourceSchema.index({ createdAt: -1 });

// Text search index
resourceSchema.index({
  title: 'text',
  description: 'text',
  content: 'text',
  tags: 'text'
});

// Virtual for formatted creation date
resourceSchema.virtual('formattedCreatedAt').get(function(this: IResource) {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Pre-save middleware to auto-generate estimated read time for articles
resourceSchema.pre('save', function(this: IResource, next: Function) {
  if (this.isModified('content') && this.type === 'article' && !this.estimatedReadTime) {
    // Average reading speed: 200 words per minute
    const wordCount = this.content?.split(/\s+/).length || 0;
    this.estimatedReadTime = Math.ceil(wordCount / 200);
  }
  next();
});

export default mongoose.model<IResource>('Resource', resourceSchema);
