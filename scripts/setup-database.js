const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Use ts-node to run TypeScript files
const { execSync } = require('child_process');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

const setupData = {
  // Admin user only
  admin: {
    name: 'System Administrator',
    email: 'admin@serene-space.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    accountType: 'registered',
    preferences: {
      theme: 'light',
      notifications: true,
      dataSharing: false
    },
    isAdmin: true,
    role: 'admin'
  }
};

async function setupDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import models using ts-node
    console.log('📋 Loading database models...');
    
    // Use ts-node to import TypeScript models directly
    const { execSync } = require('child_process');
    const { spawn } = require('child_process');
    
    // Create a simple model definition inline to avoid TypeScript compilation issues
    const UserSchema = new mongoose.Schema({
      name: String,
      email: { type: String, unique: true },
      password: String,
      accountType: { type: String, enum: ['registered', 'anonymous'] },
      preferences: {
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
        notifications: { type: Boolean, default: true },
        dataSharing: { type: Boolean, default: false }
      },
      moodHistory: [{
        date: { type: Date, default: Date.now },
        mood: { type: Number, min: 1, max: 5 },
        note: String
      }],
      isActive: { type: Boolean, default: true },
      isAdmin: { type: Boolean, default: false },
      role: { type: String, default: 'user' },
      memberSince: { type: Date, default: Date.now },
      lastActive: { type: Date, default: Date.now }
    });

    const ChatSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      type: { type: String, enum: ['ai', 'peer', 'live'], required: true },
      roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'PeerRoom' },
      title: String,
      messages: [{
        id: String,
        content: String,
        sender: { type: String, enum: ['user', 'ai', 'peer', 'moderator'] },
        timestamp: { type: Date, default: Date.now },
        metadata: {
          mood: { type: Number, min: 1, max: 5 },
          sentiment: String,
          isSensitive: { type: Boolean, default: false }
        }
      }],
      messageCount: { type: Number, default: 0 },
      lastMessageAt: { type: Date, default: Date.now },
      isArchived: { type: Boolean, default: false },
      isDeleted: { type: Boolean, default: false },
      metadata: {
        duration: Number,
        satisfactionScore: Number,
        tags: [String]
      }
    });

    const PeerRoomSchema = new mongoose.Schema({
      name: { type: String, required: true },
      description: { type: String, required: true },
      category: { type: String, required: true },
      isPrivate: { type: Boolean, default: false },
      maxParticipants: { type: Number, default: 10 },
      hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      participants: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        joinedAt: { type: Date, default: Date.now },
        role: { type: String, enum: ['host', 'moderator', 'participant'], default: 'participant' }
      }],
      isActive: { type: Boolean, default: true },
      isLive: { type: Boolean, default: false },
      settings: {
        allowAnonymous: { type: Boolean, default: true },
        requireApproval: { type: Boolean, default: false },
        recordingEnabled: { type: Boolean, default: false },
        chatEnabled: { type: Boolean, default: true },
        screenShareEnabled: { type: Boolean, default: false }
      },
      statistics: {
        totalSessions: { type: Number, default: 0 },
        totalParticipants: { type: Number, default: 0 },
        averageSessionDuration: { type: Number, default: 0 },
        satisfactionScore: { type: Number, default: 0 }
      },
      lastActivity: { type: Date, default: Date.now }
    });

    // Create models
    const User = mongoose.model('User', UserSchema);
    const Chat = mongoose.model('Chat', ChatSchema);
    const PeerRoom = mongoose.model('PeerRoom', PeerRoomSchema);

    // Ensure database and collections exist by creating indexes
    console.log('📋 Setting up database schemas and indexes...');
    
    // Indexes are now defined in the schema files, so we just need to ensure they're created
    await User.createIndexes();
    console.log('✅ User indexes created');

    await Chat.createIndexes();
    console.log('✅ Chat indexes created');

    await PeerRoom.createIndexes();
    console.log('✅ PeerRoom indexes created');

    // Check if admin already exists
    console.log('👑 Setting up admin user...');
    const existingAdmin = await User.findOne({ email: setupData.admin.email });
    
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists, skipping creation');
      console.log(`📧 Admin email: ${existingAdmin.email}`);
    } else {
      // Create admin user
      const hashedPassword = await bcrypt.hash(setupData.admin.password, 12);
      const admin = new User({
        ...setupData.admin,
        password: hashedPassword,
        isActive: true,
        memberSince: new Date(),
        lastActive: new Date()
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully');
      console.log(`📧 Email: ${admin.email}`);
      console.log(`🔑 Password: ${setupData.admin.password}`);
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📊 Setup Summary:');
    console.log('- Database schemas initialized');
    console.log('- Database indexes created');
    console.log('- Admin user configured');
    console.log('\n🔑 Admin Login Credentials:');
    console.log(`Email: ${setupData.admin.email}`);
    console.log(`Password: ${setupData.admin.password}`);
    console.log('\n⚠️  IMPORTANT: Change the admin password immediately after first login!');
    console.log('\n📝 Next Steps:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Log in as admin to manage the platform');
    console.log('3. Create sample data (optional): npm run db:seed-sample');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
