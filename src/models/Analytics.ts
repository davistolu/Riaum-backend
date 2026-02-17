import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  timestamp: Date;
  action: 'login' | 'logout' | 'chat_start' | 'chat_message' | 'room_join' | 'room_leave' | 'page_view';
  metadata: {
    userAgent?: string;
    ip?: string;
    location?: {
      country?: string;
      city?: string;
      region?: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
    device?: {
      type: 'mobile' | 'tablet' | 'desktop';
      os?: string;
      browser?: string;
      screenResolution?: string;
    };
    chatType?: 'ai' | 'peer' | 'live';
    roomId?: mongoose.Types.ObjectId;
    messageId?: string;
    page?: string;
    referrer?: string;
    sessionDuration?: number;
  };
}

const AnalyticsSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  action: { 
    type: String, 
    enum: ['login', 'logout', 'chat_start', 'chat_message', 'room_join', 'room_leave', 'page_view'],
    required: true 
  },
  metadata: {
    userAgent: String,
    ip: String,
    location: {
      country: String,
      city: String,
      region: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    device: {
      type: { type: String, enum: ['mobile', 'tablet', 'desktop'], required: true },
      os: String,
      browser: String,
      screenResolution: String
    },
    chatType: { type: String, enum: ['ai', 'peer', 'live'] },
    roomId: { type: Schema.Types.ObjectId, ref: 'PeerRoom' },
    messageId: String,
    page: String,
    referrer: String,
    sessionDuration: Number
  }
}, {
  timestamps: true
});

// Indexes for performance
AnalyticsSchema.index({ userId: 1, timestamp: -1 });
AnalyticsSchema.index({ sessionId: 1, timestamp: -1 });
AnalyticsSchema.index({ action: 1, timestamp: -1 });
AnalyticsSchema.index({ 'metadata.location.country': 1, timestamp: -1 });
AnalyticsSchema.index({ 'metadata.device.type': 1, timestamp: -1 });
AnalyticsSchema.index({ timestamp: -1 });

export default mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
