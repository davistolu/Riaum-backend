const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const PeerRoom = require('../src/models/PeerRoom');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

async function backupDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });

    console.log('📦 Creating backup...');

    // Backup Users
    console.log('👥 Backing up users...');
    const users = await User.find({})
      .select('-password') // Exclude passwords from backup
      .lean();
    
    await fs.writeFile(
      path.join(backupDir, `users-${timestamp}.json`),
      JSON.stringify(users, null, 2)
    );
    console.log(`✅ Backed up ${users.length} users`);

    // Backup Chats
    console.log('💬 Backing up chats...');
    const chats = await Chat.find({}).lean();
    
    await fs.writeFile(
      path.join(backupDir, `chats-${timestamp}.json`),
      JSON.stringify(chats, null, 2)
    );
    console.log(`✅ Backed up ${chats.length} chats`);

    // Backup Peer Rooms
    console.log('🏠 Backing up peer rooms...');
    const peerRooms = await PeerRoom.find({}).lean();
    
    await fs.writeFile(
      path.join(backupDir, `peer-rooms-${timestamp}.json`),
      JSON.stringify(peerRooms, null, 2)
    );
    console.log(`✅ Backed up ${peerRooms.length} peer rooms`);

    // Create combined backup
    const combinedBackup = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        users,
        chats,
        peerRooms
      },
      statistics: {
        totalUsers: users.length,
        totalChats: chats.length,
        totalPeerRooms: peerRooms.length,
        activeUsers: users.filter(u => u.isActive).length,
        archivedChats: chats.filter(c => c.isArchived).length,
        liveRooms: peerRooms.filter(r => r.isLive).length
      }
    };

    await fs.writeFile(
      path.join(backupDir, `serene-space-backup-${timestamp}.json`),
      JSON.stringify(combinedBackup, null, 2)
    );

    console.log('\n🎉 Backup completed successfully!');
    console.log(`📁 Backup location: ${backupDir}`);
    console.log(`📄 Files created:`);
    console.log(`   - serene-space-backup-${timestamp}.json (combined)`);
    console.log(`   - users-${timestamp}.json`);
    console.log(`   - chats-${timestamp}.json`);
    console.log(`   - peer-rooms-${timestamp}.json`);
    
    console.log('\n📊 Backup Statistics:');
    console.log(`   - Total Users: ${combinedBackup.statistics.totalUsers}`);
    console.log(`   - Active Users: ${combinedBackup.statistics.activeUsers}`);
    console.log(`   - Total Chats: ${combinedBackup.statistics.totalChats}`);
    console.log(`   - Archived Chats: ${combinedBackup.statistics.archivedChats}`);
    console.log(`   - Total Peer Rooms: ${combinedBackup.statistics.totalPeerRooms}`);
    console.log(`   - Live Rooms: ${combinedBackup.statistics.liveRooms}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the backup
if (require.main === module) {
  backupDatabase();
}

module.exports = backupDatabase;
