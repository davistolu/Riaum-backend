import mongoose, { Document, Schema } from 'mongoose';

export interface IJournal extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  mood: 'good' | 'neutral' | 'bad';
  date: Date;
  tags?: string[];
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const journalSchema = new Schema<IJournal>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  mood: {
    type: String,
    enum: ['good', 'neutral', 'bad'],
    required: true,
    default: 'neutral'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  isPrivate: {
    type: Boolean,
    required: true,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
journalSchema.index({ userId: 1, date: -1 });
journalSchema.index({ userId: 1, mood: 1 });
journalSchema.index({ date: -1 });

// Virtual for formatted date
journalSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Pre-save middleware to ensure date is set to start of day
journalSchema.pre('save', function(next) {
  if (this.isNew) {
    const date = new Date(this.date);
    date.setHours(0, 0, 0, 0);
    this.date = date;
  }
  next();
});

export default mongoose.model<IJournal>('Journal', journalSchema);
