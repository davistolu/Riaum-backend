const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

const productionSeedData = {
  // Admin user only for production
  admin: {
    name: 'System Administrator',
    email: 'admin@serene-space.com',
    password: process.env.ADMIN_PASSWORD || 'change-this-password-in-production',
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

async function seedProduction() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: productionSeedData.admin.email });
    
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists, skipping creation');
      return;
    }

    console.log('👑 Creating admin user for production...');
    
    const hashedPassword = await bcrypt.hash(productionSeedData.admin.password, 12);
    const admin = new User({
      ...productionSeedData.admin,
      password: hashedPassword,
      isActive: true,
      memberSince: new Date(),
      lastActive: new Date()
    });
    
    await admin.save();
    console.log('✅ Admin user created successfully');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Password: ${productionSeedData.admin.password}`);
    console.log('\n⚠️  IMPORTANT: Change the admin password immediately after first login!');

  } catch (error) {
    console.error('❌ Production seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding
if (require.main === module) {
  seedProduction();
}

module.exports = seedProduction;
