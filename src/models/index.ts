// Import all models to ensure they are registered with Mongoose
import User from './User';
import Resource from './Resource';
import Notification from './Notification';
import Analytics from './Analytics';

// Export all models for convenience
export { User, Resource, Notification, Analytics };

// Note: Make sure all models are registered with Mongoose
// This file should be imported in your main server file or database configuration
