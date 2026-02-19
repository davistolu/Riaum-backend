# Database Setup Guide

This guide covers the complete database setup for the Serene Space application, including initialization, seeding, backup, and maintenance.

## 🚀 Quick Start

### Prerequisites
- MongoDB 5.0 or higher
- Node.js 18 or higher
- Environment variables configured

### 1. Environment Setup

Create a `.env` file in the backend directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/serene-space

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_PASSWORD=change-this-admin-password-immediately

# AI Integration
GEMINI_API_KEY=your-gemini-api-key

# Server
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Database Initialization

#### Development Setup
```bash
cd backend
npm run db:setup
```

This will:
- Create the database and collections
- Add sample users, peer rooms, and chats
- Set up proper indexes and relationships
- Create an admin user

#### Production Setup
```bash
cd backend
npm run db:seed
```

This will:
- Create only the admin user for production
- Set up basic collections structure
- Configure security defaults

## 📊 Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String (hashed),
  accountType: 'registered' | 'anonymous',
  preferences: {
    theme: 'light' | 'dark' | 'auto',
    notifications: Boolean,
    dataSharing: Boolean
  },
  moodHistory: [{
    date: Date,
    mood: Number (1-5),
    note: String
  }],
  isActive: Boolean,
  isAdmin: Boolean,
  role: String,
  memberSince: Date,
  lastActive: Date
}
```

### Chats Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: 'ai' | 'peer' | 'live',
  roomId: ObjectId (optional),
  title: String,
  messages: [{
    id: String,
    content: String,
    sender: 'user' | 'ai' | 'peer' | 'moderator',
    timestamp: Date,
    metadata: {
      mood: Number,
      sentiment: String,
      isSensitive: Boolean
    }
  }],
  messageCount: Number,
  lastMessageAt: Date,
  isArchived: Boolean,
  isDeleted: Boolean,
  metadata: {
    duration: Number,
    satisfactionScore: Number,
    tags: [String]
  }
}
```

### PeerRooms Collection
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String,
  isPrivate: Boolean,
  maxParticipants: Number,
  hostId: ObjectId,
  participants: [{
    userId: ObjectId,
    joinedAt: Date,
    role: 'host' | 'moderator' | 'participant'
  }],
  isActive: Boolean,
  isLive: Boolean,
  settings: {
    allowAnonymous: Boolean,
    requireApproval: Boolean,
    recordingEnabled: Boolean,
    chatEnabled: Boolean,
    screenShareEnabled: Boolean
  },
  statistics: {
    totalSessions: Number,
    totalParticipants: Number,
    averageSessionDuration: Number,
    satisfactionScore: Number
  },
  lastActivity: Date
}
```

## 🛠️ Database Management Scripts

### Available Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `db:setup` | Initialize development database with sample data | `npm run db:setup` |
| `db:seed` | Create production admin user | `npm run db:seed` |
| `db:backup` | Create database backup | `npm run db:backup` |
| `db:restore` | Restore from backup | `npm run db:restore <backup-file>` |
| `db:cleanup` | Clean up old data | `npm run db:cleanup [options]` |
| `db:migrate` | Run database migrations | `npm run db:migrate` |
| `db:rollback` | Rollback migrations | `npm run db:rollback <version>` |

### Cleanup Options

```bash
# Clean all data types (dry run)
npm run db:cleanup --dry-run

# Clean specific data types
npm run db:cleanup --inactive-users --old-chats --empty-rooms

# Available options:
--inactive-users  # Deactivate users inactive for 90+ days
--old-chats        # Mark chats older than 1 year as deleted
--archived-chats   # Delete archived chats older than 6 months
--empty-rooms      # Delete rooms with only host and inactive for 30+ days
--dry-run          # Show what would be deleted without actually deleting
```

## 📦 Backup and Restore

### Creating Backups

```bash
# Create automatic backup with timestamp
npm run db:backup

# Backup files are stored in: backend/backups/
# Format: serene-space-backup-YYYY-MM-DDTHH-MM-SS-SSSZ.json
```

### Restoring Backups

```bash
# List available backups
node scripts/restore-database.js --list

# Restore from specific backup
npm run db:restore ../backups/serene-space-backup-2024-01-15T10-30-00-000Z.json
```

### Backup Contents

Each backup includes:
- All users (excluding passwords)
- All chats and messages
- All peer rooms and settings
- Database statistics
- Backup timestamp and version

## 🔄 Database Migrations

### Migration System

The database uses a version-controlled migration system to handle schema changes:

```bash
# Run all pending migrations
npm run db:migrate

# Run specific migration
npm run db:migrate 1.2.0

# Rollback to specific version
npm run db:rollback 1.1.0
```

### Available Migrations

| Version | Description | Changes |
|---------|-------------|---------|
| 1.0.0 | Initial setup | Base schema creation |
| 1.1.0 | User enhancements | Added roles and preferences |
| 1.2.0 | Room statistics | Added room analytics |
| 1.3.0 | Chat metadata | Added chat tags and metadata |

## 🔧 Maintenance Tasks

### Regular Maintenance

#### Daily
- Monitor database performance
- Check error logs
- Verify backup completion

#### Weekly
- Review user activity
- Clean up temporary data
- Update statistics

#### Monthly
- Run full cleanup script
- Review database size
- Optimize indexes
- Test backup restoration

### Performance Optimization

#### Indexes
The database automatically creates indexes for:
- User email lookups
- Chat user relationships
- Room participant lookups
- Timestamp-based queries

#### Query Optimization
- Use lean queries for read operations
- Implement pagination for large datasets
- Cache frequently accessed data
- Use aggregation for complex analytics

## 🔒 Security Considerations

### Data Protection
- Passwords are hashed with bcrypt (12 rounds)
- Sensitive data is marked in metadata
- User data can be anonymized on request
- Regular backups for disaster recovery

### Access Control
- Admin users have elevated privileges
- Role-based access to features
- API rate limiting prevents abuse
- Input validation prevents injection

### Privacy Compliance
- Users can export their data
- Data deletion requests are honored
- Anonymous accounts have minimal data collection
- GDPR-compliant data handling

## 🚨 Troubleshooting

### Common Issues

#### Connection Errors
```bash
# Check MongoDB connection
mongosh "mongodb://localhost:27017/serene-space"

# Verify environment variables
echo $MONGODB_URI
```

#### Migration Failures
```bash
# Check current migration version
node scripts/migrate-database.js --dry-run

# Force rollback to safe version
npm run db:rollback 1.0.0
```

#### Backup Issues
```bash
# Check backup directory permissions
ls -la backend/backups/

# Test backup creation manually
node scripts/backup-database.js
```

### Performance Issues

#### Slow Queries
```javascript
// Enable query logging in MongoDB
db.setProfilingLevel(2);

// Check slow queries
db.system.profile.find().sort({ts: -1}).limit(5);
```

#### Memory Usage
```javascript
// Check database stats
db.stats();

// Check collection sizes
db.users.stats();
db.chats.stats();
db.peerRooms.stats();
```

## 📈 Monitoring

### Key Metrics to Monitor

#### Database Health
- Connection count
- Query response times
- Error rates
- Disk usage

#### Application Metrics
- Active users
- Chat volume
- Room utilization
- AI response times

#### Alerts
- Database connection failures
- High error rates
- Disk space warnings
- Performance degradation

### Monitoring Tools

#### MongoDB Compass
- Visual database management
- Query performance analysis
- Real-time monitoring

#### Custom Scripts
```bash
# Database health check
node scripts/health-check.js

# Performance report
node scripts/performance-report.js
```

## 📞 Support

For database-related issues:

1. Check the troubleshooting section above
2. Review error logs in the application
3. Verify MongoDB service status
4. Test with a fresh database setup
5. Contact the development team with specific error details

Remember to always backup your database before making significant changes!
