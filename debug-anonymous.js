// Debug script to test anonymous user creation
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://durojaiyetoluwani24_db_user:XinP2Cr0QSrAVWiS@serene.vx1iahn.mongodb.net/?appName=serene', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Simple User schema for testing
const UserSchema = new mongoose.Schema({
  accountType: { type: String, enum: ['registered', 'anonymous'], default: 'anonymous' },
  isAnonymous: { type: Boolean, default: true },
  memberSince: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    notifications: { type: Boolean, default: true },
    dataSharing: { type: Boolean, default: false }
  },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function testAnonymousUser() {
  try {
    console.log('Testing anonymous user creation...');
    
    const user = new User({
      accountType: 'anonymous',
      isAnonymous: true
    });
    
    console.log('User object created:', JSON.stringify(user, null, 2));
    
    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser._id);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating anonymous user:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    process.exit(1);
  }
}

testAnonymousUser();
