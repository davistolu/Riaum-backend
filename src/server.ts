import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';

// Load environment variables first
dotenv.config({ path: '.env' });

// Import routes and config after environment variables are loaded
import passport from './config/passport';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import peerRoomRoutes from './routes/peerRoom';
import adminRoutes from './routes/admin';
import moodRoutes from './routes/mood';
import journalRoutes from './routes/journal';
import resourceRoutes from './routes/resources';
import notificationRoutes from './routes/notifications';
import { trackPageView } from './middleware/pageViewTracking';

// Import config
import connectDB from './config/database';

// Initialize Express app
const app: Express = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Attach io to app for use in controllers
app.set('io', io);

// Connect to database
connectDB().catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
  // Skip login endpoint from strict rate limiting in development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development' && req.path.includes('/auth/login')) {
      return false;
    }
    return false;
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(morgan('combined'));

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Apply page view tracking to authenticated routes
app.use('/api/', trackPageView);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Serene Space API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      chat: '/api/chat',
      peerRooms: '/api/peer-rooms',
      admin: '/api/admin',
      mood: '/api/mood',
      journal: '/api/journal',
      resources: '/api/resources',
      notifications: '/api/notifications'
    },
    documentation: 'https://github.com/davistolu/Riaum-backend'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Serene Space API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/peer-rooms', peerRoomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/notifications', notificationRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join peer room
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Join chat room for typing indicators
  socket.on('join-chat', (chatId: string) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  // Leave chat room
  socket.on('leave-chat', (chatId: string) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat ${chatId}`);
  });

  // Leave peer room
  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  // Typing events
  socket.on('typing', (data: { chatId: string; userId: string; userName: string }) => {
    console.log('Server received typing event:', data);
    socket.to(data.chatId).emit('user-typing', {
      chatId: data.chatId,
      userId: data.userId,
      userName: data.userName
    });
    console.log('Server broadcasted typing event to chat:', data.chatId);
  });

  socket.on('stop-typing', (data: { chatId: string; userId: string; userName: string }) => {
    console.log('Server received stop-typing event:', data);
    socket.to(data.chatId).emit('user-stop-typing', {
      chatId: data.chatId,
      userId: data.userId,
      userName: data.userName
    });
    console.log('Server broadcasted stop-typing event to chat:', data.chatId);
  });

  // Send message in peer room
  socket.on('room-message', (data: { roomId: string; message: string; userId: string }) => {
    socket.to(data.roomId).emit('room-message', {
      message: data.message,
      userId: data.userId,
      timestamp: new Date()
    });
  });

  // Live chat events
  socket.on('join-live-chat', (chatId: string) => {
    socket.join(`live-chat-${chatId}`);
    console.log(`User ${socket.id} joined live chat ${chatId}`);
  });

  socket.on('live-chat-message', (data: { chatId: string; message: string; userId: string }) => {
    socket.to(`live-chat-${data.chatId}`).emit('live-chat-message', {
      message: data.message,
      userId: data.userId,
      timestamp: new Date()
    });
  });

  // Voice call events
  socket.on('voice-call-start', (data: { roomId: string; userId: string }) => {
    socket.to(data.roomId).emit('voice-call-start', {
      userId: data.userId,
      timestamp: new Date()
    });
  });

  socket.on('voice-call-end', (data: { roomId: string; userId: string }) => {
    socket.to(data.roomId).emit('voice-call-end', {
      userId: data.userId,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error: any) => error.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  // Default error
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

console.log('Starting server...');
console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', PORT);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);

server.listen(PORT, () => {
  console.log(`🚀 Serene Space API running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🔗 Server URL: http://0.0.0.0:${PORT}`);
}).on('error', (err: any) => {
  console.error('Server startup error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
