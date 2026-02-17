# Serene Space Backend API

A comprehensive backend API for the Serene Space mental health support platform, built with Express.js, TypeScript, and MongoDB.

## Features

- **User Management**: Registration, authentication (email/password, OAuth), anonymous users
- **AI Chat Integration**: Google Gemini AI for intelligent conversations
- **Peer Support Rooms**: Real-time peer support sessions with voice/video capabilities
- **Mood Tracking**: Comprehensive mood monitoring and analytics
- **Admin Dashboard**: Full administrative control and analytics
- **Real-time Communication**: Socket.IO for live chat and room interactions
- **Data Security**: JWT authentication, rate limiting, input validation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: Socket.IO
- **AI Integration**: Google Gemini AI
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/serene-space
   JWT_SECRET=your-super-secret-jwt-key
   GEMINI_API_KEY=your-gemini-api-key
   FRONTEND_URL=http://localhost:5173
   ```

4. Start MongoDB server

5. Run the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### Authentication Endpoints

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Anonymous Login
```
POST /api/auth/anonymous
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

### Chat Endpoints

#### Create Chat
```
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "ai",
  "roomId": "optional-room-id"
}
```

#### Send AI Message
```
POST /api/chat/ai-message
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatId": "chat-id",
  "message": "Hello, I need support",
  "userMood": 3
}
```

#### Get User Chats
```
GET /api/chat?page=1&limit=20&type=ai
Authorization: Bearer <token>
```

### Mood Tracking Endpoints

#### Log Mood
```
POST /api/mood/log
Authorization: Bearer <token>
Content-Type: application/json

{
  "mood": 4,
  "note": "Feeling better today"
}
```

#### Get Mood History
```
GET /api/mood/history?days=30
Authorization: Bearer <token>
```

#### Get Mood Analytics
```
GET /api/mood/analytics?period=month
Authorization: Bearer <token>
```

### Peer Room Endpoints

#### Create Peer Room
```
POST /api/peer-rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Anxiety Support Group",
  "description": "A safe space to discuss anxiety",
  "category": "anxiety",
  "isPrivate": false,
  "maxParticipants": 10
}
```

#### Get Public Rooms
```
GET /api/peer-rooms/public?category=anxiety&page=1&limit=20
```

#### Join Room
```
POST /api/peer-rooms/:roomId/join
Authorization: Bearer <token>
```

### Admin Endpoints

#### Get Dashboard Stats
```
GET /api/admin/dashboard/stats
Authorization: Bearer <admin-token>
```

#### Get All Users
```
GET /api/admin/users?page=1&limit=20&search=john
Authorization: Bearer <admin-token>
```

#### Get System Health
```
GET /api/admin/system/health
Authorization: Bearer <admin-token>
```

## Socket.IO Events

### Peer Room Events
- `join-room` - Join a peer room
- `leave-room` - Leave a peer room
- `room-message` - Send message to room
- `voice-call-start` - Start voice call
- `voice-call-end` - End voice call

### Live Chat Events
- `join-live-chat` - Join live chat session
- `live-chat-message` - Send live chat message

## Database Schema

### User Model
```typescript
interface IUser {
  name?: string;
  email?: string;
  password?: string;
  accountType: 'registered' | 'anonymous';
  memberSince: Date;
  isActive: boolean;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    dataSharing: boolean;
  };
  moodHistory: Array<{
    date: Date;
    mood: number;
    note?: string;
  }>;
}
```

### Chat Model
```typescript
interface IChat {
  userId: ObjectId;
  type: 'ai' | 'peer' | 'live';
  roomId?: ObjectId;
  messages: Array<{
    id: string;
    content: string;
    sender: 'user' | 'ai' | 'peer' | 'moderator';
    timestamp: Date;
    metadata?: {
      mood?: number;
      sentiment?: 'positive' | 'negative' | 'neutral';
      isSensitive?: boolean;
    };
  }>;
}
```

### PeerRoom Model
```typescript
interface IPeerRoom {
  name: string;
  description: string;
  category: string;
  isPrivate: boolean;
  maxParticipants: number;
  hostId: ObjectId;
  participants: Array<{
    userId: ObjectId;
    joinedAt: Date;
    role: 'host' | 'moderator' | 'participant';
  }>;
  isLive: boolean;
  settings: {
    allowAnonymous: boolean;
    requireApproval: boolean;
    recordingEnabled: boolean;
  };
}
```

## Security Features

- JWT authentication with expiration
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS configuration
- Helmet for security headers
- Sensitive content detection

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/serene-space |
| JWT_SECRET | JWT signing secret | - |
| JWT_EXPIRE | JWT expiration time | 7d |
| GEMINI_API_KEY | Google Gemini API key | - |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5173 |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 900000 |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | 100 |

## Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run build      # Compile TypeScript to JavaScript
npm test           # Run tests
```

## Error Handling

The API uses consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
