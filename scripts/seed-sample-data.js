const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const PeerRoom = require('../src/models/PeerRoom');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serene-space';

// Generate unique share code
const generateShareCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const sampleData = {
  // Sample users
  users: [
    {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      accountType: 'registered',
      preferences: {
        theme: 'dark',
        notifications: true,
        dataSharing: true
      },
      moodHistory: [
        { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), mood: 2, note: 'Anxious about work' },
        { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), mood: 3, note: 'Coping better' },
        { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), mood: 4, note: 'Feeling hopeful' },
      ]
    },
    {
      name: 'Jane Smith',
      email: 'jane@example.com',
      password: 'password123',
      accountType: 'registered',
      preferences: {
        theme: 'auto',
        notifications: false,
        dataSharing: false
      },
      moodHistory: [
        { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), mood: 3, note: 'Managing stress' },
        { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), mood: 4, note: 'Therapy helping' },
        { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), mood: 4, note: 'Making progress' },
        { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), mood: 5, note: 'Good day' },
        { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), mood: 4, note: 'Stable' },
      ]
    },
    {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      password: 'password123',
      accountType: 'registered',
      preferences: {
        theme: 'light',
        notifications: true,
        dataSharing: false
      },
      moodHistory: [
        { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), mood: 3, note: 'Feeling okay' },
        { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), mood: 4, note: 'Better today' },
        { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), mood: 5, note: 'Great day!' },
        { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), mood: 3, note: 'Neutral' },
        { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), mood: 4, note: 'Improving' },
        { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), mood: 4, note: 'Stable' },
        { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), mood: 5, note: 'Excellent' },
      ]
    }
  ],

  // Sample peer rooms
  peerRooms: [
    {
      name: 'Anxiety Support Circle',
      description: 'A safe space for those dealing with anxiety to share experiences and coping strategies.',
      category: 'anxiety',
      isPrivate: false,
      maxParticipants: 15,
      settings: {
        allowAnonymous: true,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false
      },
      rules: [
        'Be respectful and supportive',
        'No medical advice - share personal experiences only',
        'Maintain confidentiality',
        'Take breaks when needed'
      ]
    },
    {
      name: 'Depression Recovery Group',
      description: 'Support for those navigating depression. You\'re not alone in this journey.',
      category: 'depression',
      isPrivate: false,
      maxParticipants: 12,
      settings: {
        allowAnonymous: true,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false
      },
      rules: [
        'No toxic positivity',
        'Be gentle with yourself and others',
        'Share resources that have helped',
        'Listen more than you speak when others are struggling'
      ]
    },
    {
      name: 'Trauma Healing Space',
      description: 'A gentle, moderated space for trauma survivors to share and heal together.',
      category: 'trauma',
      isPrivate: false,
      maxParticipants: 8,
      settings: {
        allowAnonymous: true,
        requireApproval: true,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false
      },
      rules: [
        'No graphic descriptions of trauma',
        'Respect others\' boundaries and triggers',
        'Offer support, not advice',
        'Self-care comes first'
      ]
    },
    {
      name: 'Relationship Support',
      description: 'Navigate relationship challenges with peer support and understanding.',
      category: 'relationships',
      isPrivate: false,
      maxParticipants: 10,
      settings: {
        allowAnonymous: false,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false
      },
      rules: [
        'Maintain confidentiality',
        'Focus on support, not judgment',
        'Share experiences, not advice',
        'Be respectful of different perspectives'
      ]
    },
    {
      name: 'Stress Management Hub',
      description: 'Learn and share stress management techniques and coping strategies.',
      category: 'stress',
      isPrivate: false,
      maxParticipants: 20,
      settings: {
        allowAnonymous: true,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: true
      },
      rules: [
        'Share practical techniques',
        'Be encouraging and supportive',
        'Respect different coping styles',
        'Celebrate small victories'
      ]
    },
    {
      name: 'Grief and Loss Support',
      description: 'A compassionate space for those experiencing grief and loss.',
      category: 'grief',
      isPrivate: false,
      maxParticipants: 10,
      settings: {
        allowAnonymous: true,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false
      },
      rules: [
        'Be patient with the grieving process',
        'No judgment about how someone grieves',
        'Share resources for grief support',
        'Listen with compassion'
      ]
    },
    {
      name: 'Addiction Recovery Circle',
      description: 'Peer support for various addiction recovery journeys.',
      category: 'addiction',
      isPrivate: true,
      maxParticipants: 8,
      settings: {
        allowAnonymous: true,
        requireApproval: true,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: false
      },
      rules: [
        'Maintain strict confidentiality',
        'No judgment or shame',
        'Focus on recovery and hope',
        'Share experiences, not medical advice'
      ]
    },
    {
      name: 'General Wellness Hub',
      description: 'A space for general mental health discussions and wellness practices.',
      category: 'general',
      isPrivate: false,
      maxParticipants: 25,
      settings: {
        allowAnonymous: true,
        requireApproval: false,
        recordingEnabled: false,
        chatEnabled: true,
        screenShareEnabled: true
      },
      rules: [
        'Be inclusive and welcoming',
        'Share wellness practices',
        'Support each other\'s journeys',
        'Keep discussions positive and constructive'
      ]
    }
  ]
};

async function seedSampleData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if sample data already exists
    const existingUsers = await User.countDocuments({ email: { $in: ['john@example.com', 'jane@example.com', 'alex@example.com'] } });
    if (existingUsers > 0) {
      console.log('ℹ️  Sample data already exists, skipping seeding');
      return;
    }

    console.log('🌱 Seeding sample data...');

    // Create sample users
    console.log('👥 Creating sample users...');
    const createdUsers = [];
    
    for (const userData of sampleData.users) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = new User({
        ...userData,
        password: hashedPassword,
        isActive: true,
        memberSince: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
        lastActive: new Date()
      });
      
      await user.save();
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.name} (${user.email})`);
    }

    // Create sample peer rooms
    console.log('🏠 Creating sample peer rooms...');
    const createdRooms = [];
    
    for (const roomData of sampleData.peerRooms) {
      const hostUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const shareCode = generateShareCode();
      
      const room = new PeerRoom({
        ...roomData,
        hostId: hostUser._id,
        shareCode: shareCode,
        shareableLink: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/room/${shareCode}`,
        participants: [{
          userId: hostUser._id,
          joinedAt: new Date(),
          role: 'host'
        }],
        isActive: true,
        isLive: Math.random() > 0.7, // 30% chance of being live
        lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Random activity within last 24 hours
        statistics: {
          totalSessions: Math.floor(Math.random() * 50) + 1,
          totalParticipants: Math.floor(Math.random() * 100) + 1,
          averageSessionDuration: Math.floor(Math.random() * 60) + 15, // 15-75 minutes
          satisfactionScore: (Math.random() * 2 + 3).toFixed(1) // 3.0-5.0
        }
      });
      
      await room.save();
      createdRooms.push(room);
      
      // Add some random participants
      const participantCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < participantCount; i++) {
        const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
        if (!room.participants.some(p => p.userId.toString() === randomUser._id.toString())) {
          room.participants.push({
            userId: randomUser._id,
            joinedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            role: Math.random() > 0.8 ? 'moderator' : 'participant'
          });
        }
      }
      
      await room.save();
      console.log(`✅ Created room: ${room.name} (${room.participants.length} participants) - Code: ${room.shareCode}`);
    }

    // Create sample chats
    console.log('💬 Creating sample chats...');
    const chatTypes = ['ai', 'peer'];
    const sampleMessages = [
      "I've been feeling really anxious lately and I don't know why.",
      "Does anyone have tips for managing panic attacks?",
      "Therapy has been helping me a lot. Has anyone tried it?",
      "I'm having a hard time sleeping. Any suggestions?",
      "Sometimes I feel like I'm the only one going through this.",
      "Breathing exercises really help me when I'm stressed.",
      "How do you deal with negative self-talk?",
      "I'm proud of myself for reaching out for help today.",
      "Does anyone else feel overwhelmed by social media?",
      "Meditation has changed my life. Highly recommend it."
    ];

    for (let i = 0; i < 15; i++) {
      const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const chatType = chatTypes[Math.floor(Math.random() * chatTypes.length)];
      const randomRoom = chatType === 'peer' ? createdRooms[Math.floor(Math.random() * createdRooms.length)] : null;
      
      const chat = new Chat({
        userId: randomUser._id,
        type: chatType,
        roomId: randomRoom?._id,
        title: chatType === 'ai' ? 'AI Support Session' : `Peer Support: ${randomRoom?.name}`,
        messageCount: Math.floor(Math.random() * 10) + 1,
        messages: [
          {
            id: 'msg-1',
            content: sampleMessages[Math.floor(Math.random() * sampleMessages.length)],
            sender: 'user',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            metadata: {
              mood: Math.floor(Math.random() * 5) + 1,
              sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
              isSensitive: Math.random() > 0.8
            }
          },
          ...(chatType === 'ai' ? [{
            id: 'msg-2',
            content: 'I hear you. It takes courage to share these feelings. You\'re not alone in this experience.',
            sender: 'ai',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            metadata: {
              mood: 4,
              sentiment: 'positive',
              isSensitive: false
            }
          }] : [])
        ],
        lastMessageAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        isArchived: Math.random() > 0.9,
        metadata: {
          duration: Math.floor(Math.random() * 30) + 5, // 5-35 minutes
          satisfactionScore: (Math.random() * 2 + 3).toFixed(1),
          tags: ['anxiety', 'support', 'coping'].slice(0, Math.floor(Math.random() * 3) + 1)
        }
      });
      
      await chat.save();
    }
    
    console.log('✅ Created sample chats');

    console.log('\n🎉 Sample data seeding completed successfully!');
    console.log('\n📊 Sample Data Summary:');
    console.log(`- Users: ${createdUsers.length}`);
    console.log(`- Peer Rooms: ${createdRooms.length}`);
    console.log(`- Sample Chats: 15`);
    console.log('\n🔑 Sample User Credentials:');
    console.log('John: john@example.com / password123');
    console.log('Jane: jane@example.com / password123');
    console.log('Alex: alex@example.com / password123');

  } catch (error) {
    console.error('❌ Sample data seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding
if (require.main === module) {
  seedSampleData();
}

module.exports = seedSampleData;
