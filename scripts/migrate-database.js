const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const PeerRoom = require('../src/models/PeerRoom');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

const migrations = [
  {
    version: '1.0.0',
    description: 'Initial database setup',
    up: async () => {
      console.log('📦 Running initial setup migration...');
      // This is handled by setup-database.js
    },
    down: async () => {
      console.log('🔄 Rolling back initial setup...');
      await User.deleteMany({});
      await Chat.deleteMany({});
      await PeerRoom.deleteMany({});
    }
  },
  {
    version: '1.1.0',
    description: 'Add user roles and preferences',
    up: async () => {
      console.log('📦 Adding user roles and preferences...');
      
      // Add default preferences to users who don't have them
      await User.updateMany(
        { preferences: { $exists: false } },
        {
          $set: {
            preferences: {
              theme: 'auto',
              notifications: true,
              dataSharing: false
            }
          }
        }
      );

      // Add default role to users who don't have it
      await User.updateMany(
        { role: { $exists: false } },
        {
          $set: {
            role: 'user'
          }
        }
      );

      console.log('✅ User roles and preferences added');
    },
    down: async () => {
      console.log('🔄 Rolling back user roles and preferences...');
      await User.updateMany(
        {},
        {
          $unset: {
            preferences: 1,
            role: 1
          }
        }
      );
    }
  },
  {
    version: '1.2.0',
    description: 'Add room statistics',
    up: async () => {
      console.log('📦 Adding room statistics...');
      
      // Add default statistics to rooms that don't have them
      const rooms = await PeerRoom.find({ statistics: { $exists: false } });
      
      for (const room of rooms) {
        room.statistics = {
          totalSessions: Math.floor(Math.random() * 50) + 1,
          totalParticipants: room.participants.length,
          averageSessionDuration: Math.floor(Math.random() * 60) + 15,
          satisfactionScore: (Math.random() * 2 + 3).toFixed(1)
        };
        await room.save();
      }

      console.log(`✅ Statistics added to ${rooms.length} rooms`);
    },
    down: async () => {
      console.log('🔄 Rolling back room statistics...');
      await PeerRoom.updateMany(
        {},
        {
          $unset: {
            statistics: 1
          }
        }
      );
    }
  },
  {
    version: '1.3.0',
    description: 'Add chat metadata and tags',
    up: async () => {
      console.log('📦 Adding chat metadata and tags...');
      
      // Add metadata to chats that don't have it
      const chats = await Chat.find({ metadata: { $exists: false } });
      
      for (const chat of chats) {
        chat.metadata = {
          duration: Math.floor(Math.random() * 30) + 5,
          satisfactionScore: (Math.random() * 2 + 3).toFixed(1),
          tags: ['anxiety', 'support', 'coping'].slice(0, Math.floor(Math.random() * 3) + 1)
        };
        await chat.save();
      }

      console.log(`✅ Metadata added to ${chats.length} chats`);
    },
    down: async () => {
      console.log('🔄 Rolling back chat metadata...');
      await Chat.updateMany(
        {},
        {
          $unset: {
            metadata: 1
          }
        }
      );
    }
  }
];

async function getCurrentMigrationVersion() {
  try {
    // Create a collection to track migrations if it doesn't exist
    const db = mongoose.connection.db;
    const migrationsCollection = db.collection('migrations');
    
    const latestMigration = await migrationsCollection.findOne({}, { sort: { version: -1 } });
    return latestMigration ? latestMigration.version : '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

async function setMigrationVersion(version) {
  try {
    const db = mongoose.connection.db;
    const migrationsCollection = db.collection('migrations');
    
    await migrationsCollection.insertOne({
      version,
      appliedAt: new Date()
    });
  } catch (error) {
    console.error('Failed to set migration version:', error);
  }
}

async function runMigrations(targetVersion = null) {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const currentVersion = await getCurrentMigrationVersion();
    console.log(`📈 Current migration version: ${currentVersion}`);

    // Find migrations to run
    const migrationsToRun = targetVersion
      ? migrations.filter(m => 
          compareVersions(m.version, currentVersion) > 0 && 
          compareVersions(m.version, targetVersion) <= 0
        )
      : migrations.filter(m => compareVersions(m.version, currentVersion) > 0);

    if (migrationsToRun.length === 0) {
      console.log('✅ Database is up to date');
      return;
    }

    console.log(`🚀 Running ${migrationsToRun.length} migrations...`);

    for (const migration of migrationsToRun) {
      console.log(`\n📦 Running migration ${migration.version}: ${migration.description}`);
      
      try {
        await migration.up();
        await setMigrationVersion(migration.version);
        console.log(`✅ Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('\n🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

async function rollbackMigration(targetVersion) {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const currentVersion = await getCurrentMigrationVersion();
    console.log(`📈 Current migration version: ${currentVersion}`);

    // Find migrations to rollback
    const migrationsToRollback = migrations
      .filter(m => compareVersions(m.version, currentVersion) <= 0)
      .filter(m => compareVersions(m.version, targetVersion) > 0)
      .reverse();

    if (migrationsToRollback.length === 0) {
      console.log('✅ No migrations to rollback');
      return;
    }

    console.log(`🔄 Rolling back ${migrationsToRollback.length} migrations...`);

    for (const migration of migrationsToRollback) {
      console.log(`\n📦 Rolling back migration ${migration.version}: ${migration.description}`);
      
      try {
        await migration.down();
        console.log(`✅ Migration ${migration.version} rolled back`);
      } catch (error) {
        console.error(`❌ Rollback ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('\n🎉 Rollback completed successfully!');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

function compareVersions(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--rollback')) {
    const targetVersion = args.find(arg => !arg.startsWith('--'));
    if (!targetVersion) {
      console.log('❌ Please specify target version for rollback');
      console.log('Usage: node migrate-database.js --rollback <version>');
      process.exit(1);
    }
    await rollbackMigration(targetVersion);
  } else {
    const targetVersion = args.find(arg => !arg.startsWith('--'));
    await runMigrations(targetVersion);
  }
}

// Run the migrations
if (require.main === module) {
  main();
}

module.exports = { runMigrations, rollbackMigration };
