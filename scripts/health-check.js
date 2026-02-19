const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const PeerRoom = require('../src/models/PeerRoom');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

async function healthCheck() {
  try {
    console.log('🏥 Serene Space Database Health Check');
    console.log('=====================================\n');

    // Test database connection
    console.log('🔗 Testing database connection...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connection successful\n');

    // Check collections
    console.log('📊 Checking collections...');
    
    const userCount = await User.countDocuments();
    const chatCount = await Chat.countDocuments();
    const roomCount = await PeerRoom.countDocuments();
    
    console.log(`   Users: ${userCount}`);
    console.log(`   Chats: ${chatCount}`);
    console.log(`   Peer Rooms: ${roomCount}\n`);

    // Check indexes
    console.log('🔍 Checking indexes...');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const indexes = await db.collection(collection.name).listIndexes().toArray();
      console.log(`   ${collection.name}: ${indexes.length} indexes`);
    }
    console.log('');

    // Check recent activity
    console.log('📈 Recent activity (last 24 hours)...');
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: yesterday }
    });
    
    const recentChats = await Chat.countDocuments({
      lastMessageAt: { $gte: yesterday }
    });
    
    const activeRooms = await PeerRoom.countDocuments({
      lastActivity: { $gte: yesterday },
      isActive: true
    });
    
    console.log(`   Active Users: ${activeUsers}`);
    console.log(`   Recent Chats: ${recentChats}`);
    console.log(`   Active Rooms: ${activeRooms}\n`);

    // Check for issues
    console.log('⚠️  Checking for potential issues...');
    
    const issues = [];

    // Check for users without preferences
    const usersWithoutPrefs = await User.countDocuments({
      preferences: { $exists: false }
    });
    if (usersWithoutPrefs > 0) {
      issues.push(`${usersWithoutPrefs} users without preferences`);
    }

    // Check for chats without metadata
    const chatsWithoutMetadata = await Chat.countDocuments({
      metadata: { $exists: false }
    });
    if (chatsWithoutMetadata > 0) {
      issues.push(`${chatsWithoutMetadata} chats without metadata`);
    }

    // Check for rooms without statistics
    const roomsWithoutStats = await PeerRoom.countDocuments({
      statistics: { $exists: false }
    });
    if (roomsWithoutStats > 0) {
      issues.push(`${roomsWithoutStats} rooms without statistics`);
    }

    // Check for inactive rooms with participants
    const inactiveRoomsWithParticipants = await PeerRoom.countDocuments({
      isActive: true,
      lastActivity: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      'participants.1': { $exists: true }
    });
    if (inactiveRoomsWithParticipants > 0) {
      issues.push(`${inactiveRoomsWithParticipants} inactive rooms with participants`);
    }

    if (issues.length === 0) {
      console.log('   ✅ No issues found\n');
    } else {
      console.log('   ⚠️  Issues found:');
      issues.forEach(issue => console.log(`      - ${issue}`));
      console.log('');
    }

    // Performance metrics
    console.log('⚡ Performance metrics...');
    
    const dbStats = await db.stats();
    const dataSize = Math.round(dbStats.dataSize / 1024 / 1024); // MB
    const indexSize = Math.round(dbStats.indexSize / 1024 / 1024); // MB
    
    console.log(`   Data Size: ${dataSize} MB`);
    console.log(`   Index Size: ${indexSize} MB`);
    console.log(`   Storage Size: ${Math.round(dbStats.storageSize / 1024 / 1024)} MB\n`);

    // Environment check
    console.log('🌍 Environment check...');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database: ${MONGODB_URI.includes('localhost') ? 'Local' : 'Remote'}\n`);

    // Summary
    console.log('📋 Health Summary');
    console.log('================');
    console.log(`   Status: ${issues.length === 0 ? '✅ Healthy' : '⚠️  Issues detected'}`);
    console.log(`   Total Users: ${userCount}`);
    console.log(`   Total Chats: ${chatCount}`);
    console.log(`   Total Rooms: ${roomCount}`);
    console.log(`   Active Today: ${activeUsers}`);
    console.log(`   Database Size: ${dataSize} MB`);
    
    if (issues.length > 0) {
      console.log(`\n🔧 Recommended Actions:`);
      console.log('   1. Run migrations: npm run db:migrate');
      console.log('   2. Run cleanup: npm run db:cleanup --dry-run');
      console.log('   3. Review and fix specific issues');
    }

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the health check
if (require.main === module) {
  healthCheck();
}

module.exports = healthCheck;
