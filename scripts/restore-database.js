const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const PeerRoom = require('../src/models/PeerRoom');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

async function restoreDatabase(backupFile) {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read backup file
    console.log('📖 Reading backup file...');
    const backupData = await fs.readFile(backupFile, 'utf8');
    const backup = JSON.parse(backupData);
    
    console.log(`📅 Backup from: ${backup.timestamp}`);
    console.log(`🔢 Version: ${backup.version}`);

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Chat.deleteMany({});
    await PeerRoom.deleteMany({});
    console.log('✅ Cleared existing data');

    // Restore Users
    console.log('👥 Restoring users...');
    const restoredUsers = [];
    
    for (const userData of backup.data.users) {
      // Hash passwords for restored users
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }
      
      const user = new User(userData);
      await user.save();
      restoredUsers.push(user);
    }
    
    console.log(`✅ Restored ${restoredUsers.length} users`);

    // Restore Chats
    console.log('💬 Restoring chats...');
    const restoredChats = [];
    
    for (const chatData of backup.data.chats) {
      // Convert string IDs back to ObjectIds if needed
      if (typeof chatData.userId === 'string') {
        chatData.userId = new mongoose.Types.ObjectId(chatData.userId);
      }
      if (chatData.roomId && typeof chatData.roomId === 'string') {
        chatData.roomId = new mongoose.Types.ObjectId(chatData.roomId);
      }
      
      const chat = new Chat(chatData);
      await chat.save();
      restoredChats.push(chat);
    }
    
    console.log(`✅ Restored ${restoredChats.length} chats`);

    // Restore Peer Rooms
    console.log('🏠 Restoring peer rooms...');
    const restoredRooms = [];
    
    for (const roomData of backup.data.peerRooms) {
      // Convert string IDs back to ObjectIds if needed
      if (typeof roomData.hostId === 'string') {
        roomData.hostId = new mongoose.Types.ObjectId(roomData.hostId);
      }
      
      // Convert participant IDs
      if (roomData.participants) {
        roomData.participants = roomData.participants.map(p => ({
          ...p,
          userId: new mongoose.Types.ObjectId(p.userId)
        }));
      }
      
      const room = new PeerRoom(roomData);
      await room.save();
      restoredRooms.push(room);
    }
    
    console.log(`✅ Restored ${restoredRooms.length} peer rooms`);

    console.log('\n🎉 Database restore completed successfully!');
    console.log('\n📊 Restore Summary:');
    console.log(`   - Users: ${restoredUsers.length}`);
    console.log(`   - Chats: ${restoredChats.length}`);
    console.log(`   - Peer Rooms: ${restoredRooms.length}`);
    
    if (backup.statistics) {
      console.log('\n📈 Original Statistics:');
      console.log(`   - Total Users: ${backup.statistics.totalUsers}`);
      console.log(`   - Active Users: ${backup.statistics.activeUsers}`);
      console.log(`   - Total Chats: ${backup.statistics.totalChats}`);
      console.log(`   - Archived Chats: ${backup.statistics.archivedChats}`);
      console.log(`   - Total Peer Rooms: ${backup.statistics.totalPeerRooms}`);
      console.log(`   - Live Rooms: ${backup.statistics.liveRooms}`);
    }

  } catch (error) {
    console.error('❌ Restore failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// List available backups
async function listBackups() {
  try {
    const backupDir = path.join(__dirname, '../backups');
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(file => file.startsWith('serene-space-backup-') && file.endsWith('.json'));
    
    if (backupFiles.length === 0) {
      console.log('❌ No backup files found');
      return;
    }

    console.log('📁 Available backups:');
    backupFiles.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.stat(filePath);
      console.log(`   - ${file}`);
    });

  } catch (error) {
    console.error('❌ Failed to list backups:', error);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--list') || args.includes('-l')) {
    await listBackups();
    return;
  }

  const backupFile = args.find(arg => !arg.startsWith('-'));
  
  if (!backupFile) {
    console.log('❌ Please specify a backup file');
    console.log('Usage: node restore-database.js <backup-file>');
    console.log('   or: node restore-database.js --list  (to list available backups)');
    process.exit(1);
  }

  const backupPath = path.resolve(backupFile);
  
  try {
    await fs.access(backupPath);
  } catch {
    console.log(`❌ Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  await restoreDatabase(backupPath);
}

// Run the restore
if (require.main === module) {
  main();
}

module.exports = restoreDatabase;
