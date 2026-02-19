// Test anonymous user creation directly
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://durojaiyetoluwani24_db_user:XinP2Cr0QSrAVWiS@serene.vx1iahn.mongodb.net/?appName=serene');

// Test 1: Create user exactly like OAuth (should work)
const testRegisteredUser = async () => {
  try {
    const User = mongoose.model('User');
    const user = new User({
      accountType: 'registered',
      isAnonymous: false,
      email: 'test@example.com',
      name: 'Test User'
    });
    await user.save();
    console.log('✅ Registered user created successfully');
  } catch (error) {
    console.error('❌ Registered user failed:', error.message);
  }
};

// Test 2: Create user exactly like anonymous (might fail)
const testAnonymousUser = async () => {
  try {
    const User = mongoose.model('User');
    const user = new User({
      accountType: 'anonymous',
      isAnonymous: true
    });
    await user.save();
    console.log('✅ Anonymous user created successfully');
  } catch (error) {
    console.error('❌ Anonymous user failed:', error.message);
    console.error('Full error:', error);
  }
};

// Test 3: Check existing users
const checkExistingUsers = async () => {
  try {
    const User = mongoose.model('User');
    const users = await User.find({});
    console.log(`📊 Total users in database: ${users.length}`);
    console.log('User types:', users.map(u => ({ id: u._id, type: u.accountType, anonymous: u.isAnonymous })));
  } catch (error) {
    console.error('❌ Failed to check users:', error.message);
  }
};

async function runTests() {
  console.log('🧪 Starting tests...\n');
  
  await checkExistingUsers();
  console.log('\n');
  
  await testRegisteredUser();
  console.log('\n');
  
  await testAnonymousUser();
  console.log('\n');
  
  await checkExistingUsers();
  
  process.exit(0);
}

runTests().catch(console.error);
