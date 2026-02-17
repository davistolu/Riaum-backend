const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const PeerRoom = require('../src/models/PeerRoom');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

async function cleanupDatabase(options = {}) {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const {
      inactiveUsers = false,
      oldChats = false,
      emptyRooms = false,
      archivedChats = false,
      dryRun = false
    } = options;

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    // Cleanup inactive users
    if (inactiveUsers) {
      console.log('👥 Cleaning up inactive users...');
      
      const inactiveThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      const inactiveUsers = await User.find({
        lastActive: { $lt: inactiveThreshold },
        accountType: 'registered'
      });

      console.log(`Found ${inactiveUsers.length} inactive users`);

      if (!dryRun) {
        // Soft delete by setting isActive to false
        await User.updateMany(
          { lastActive: { $lt: inactiveThreshold }, accountType: 'registered' },
          { isActive: false }
        );
        console.log('✅ Inactive users deactivated');
      } else {
        console.log('🔍 Would deactivate inactive users');
      }
    }

    // Cleanup old chats
    if (oldChats) {
      console.log('💬 Cleaning up old chats...');
      
      const oldThreshold = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      const oldChats = await Chat.find({
        lastMessageAt: { $lt: oldThreshold },
        isDeleted: false
      });

      console.log(`Found ${oldChats.length} old chats`);

      if (!dryRun) {
        await Chat.updateMany(
          { lastMessageAt: { $lt: oldThreshold }, isDeleted: false },
          { isDeleted: true }
        );
        console.log('✅ Old chats marked as deleted');
      } else {
        console.log('🔍 Would mark old chats as deleted');
      }
    }

    // Cleanup archived chats
    if (archivedChats) {
      console.log('📦 Cleaning up archived chats...');
      
      const archivedThreshold = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months ago
      const oldArchivedChats = await Chat.find({
        isArchived: true,
        lastMessageAt: { $lt: archivedThreshold }
      });

      console.log(`Found ${oldArchivedChats.length} old archived chats`);

      if (!dryRun) {
        await Chat.deleteMany({
          isArchived: true,
          lastMessageAt: { $lt: archivedThreshold }
        });
        console.log('✅ Old archived chats permanently deleted');
      } else {
        console.log('🔍 Would permanently delete old archived chats');
      }
    }

    // Cleanup empty peer rooms
    if (emptyRooms) {
      console.log('🏠 Cleaning up empty peer rooms...');
      
      const emptyThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const emptyRooms = await PeerRoom.find({
        lastActivity: { $lt: emptyThreshold },
        'participants.1': { $exists: false } // Only has host
      });

      console.log(`Found ${emptyRooms.length} empty rooms`);

      if (!dryRun) {
        await PeerRoom.deleteMany({
          lastActivity: { $lt: emptyThreshold },
          'participants.1': { $exists: false }
        });
        console.log('✅ Empty rooms deleted');
      } else {
        console.log('🔍 Would delete empty rooms');
      }
    }

    // Get database statistics
    console.log('\n📊 Database Statistics:');
    
    const userStats = await User.aggregate([
      { $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        registered: { $sum: { $cond: [{ $eq: ['$accountType', 'registered'] }, 1, 0] } },
        anonymous: { $sum: { $cond: [{ $eq: ['$accountType', 'anonymous'] }, 1, 0] } }
      }}
    ]);

    const chatStats = await Chat.aggregate([
      { $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isDeleted', 0, 1] } },
        archived: { $sum: { $cond: ['$isArchived', 1, 0] } },
        ai: { $sum: { $cond: [{ $eq: ['$type', 'ai'] }, 1, 0] } },
        peer: { $sum: { $cond: [{ $eq: ['$type', 'peer'] }, 1, 0] } },
        live: { $sum: { $cond: [{ $eq: ['$type', 'live'] }, 1, 0] } }
      }}
    ]);

    const roomStats = await PeerRoom.aggregate([
      { $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        live: { $sum: { $cond: ['$isLive', 1, 0] } },
        private: { $sum: { $cond: ['$isPrivate', 1, 0] } }
      }}
    ]);

    console.log('\n👥 Users:');
    console.log(`   Total: ${userStats[0]?.total || 0}`);
    console.log(`   Active: ${userStats[0]?.active || 0}`);
    console.log(`   Registered: ${userStats[0]?.registered || 0}`);
    console.log(`   Anonymous: ${userStats[0]?.anonymous || 0}`);

    console.log('\n💬 Chats:');
    console.log(`   Total: ${chatStats[0]?.total || 0}`);
    console.log(`   Active: ${chatStats[0]?.active || 0}`);
    console.log(`   Archived: ${chatStats[0]?.archived || 0}`);
    console.log(`   AI: ${chatStats[0]?.ai || 0}`);
    console.log(`   Peer: ${chatStats[0]?.peer || 0}`);
    console.log(`   Live: ${chatStats[0]?.live || 0}`);

    console.log('\n🏠 Peer Rooms:');
    console.log(`   Total: ${roomStats[0]?.total || 0}`);
    console.log(`   Active: ${roomStats[0]?.active || 0}`);
    console.log(`   Live: ${roomStats[0]?.live || 0}`);
    console.log(`   Private: ${roomStats[0]?.private || 0}`);

    console.log('\n🎉 Cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    inactiveUsers: args.includes('--inactive-users'),
    oldChats: args.includes('--old-chats'),
    emptyRooms: args.includes('--empty-rooms'),
    archivedChats: args.includes('--archived-chats'),
    dryRun: args.includes('--dry-run')
  };

  // If no specific options provided, run all with dry run
  if (Object.values(options).every(opt => !opt)) {
    options.dryRun = true;
    options.inactiveUsers = true;
    options.oldChats = true;
    options.emptyRooms = true;
    options.archivedChats = true;
    console.log('🔍 No specific options provided, running full cleanup in dry-run mode');
  }

  await cleanupDatabase(options);
}

// Run the cleanup
if (require.main === module) {
  main();
}

module.exports = cleanupDatabase;
