import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

// Import URLSearchParams for token exchange
const { URLSearchParams } = require('url');

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  } as jwt.SignOptions);
};

// Register user
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, username } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if username is already taken
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      username,
      accountType: 'registered',
      isAnonymous: false
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          memberSince: user.memberSince,
          preferences: user.preferences
        },
        token
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is admin based on environment variables
    const isAdminUser = email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD;
    if (isAdminUser) {
      user.isAdmin = true;
      await user.save();
    }

    // Generate token
    const token = generateToken(user._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          memberSince: user.memberSince,
          preferences: user.preferences,
          isAdmin: user.isAdmin
        },
        token
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Anonymous login
export const anonymousLogin = async (req: Request, res: Response) => {
  try {
    // Create anonymous user
    const user = new User({
      accountType: 'anonymous',
      isAnonymous: true
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Anonymous session created',
      data: {
        user: {
          id: user._id,
          username: user.username,
          accountType: user.accountType,
          memberSince: user.memberSince,
          preferences: user.preferences
        },
        token
      }
    });
  } catch (error: any) {
    console.error('Anonymous login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create anonymous session',
      error: error.message
    });
  }
};

// OAuth login (Google/Apple)
export const oauthLogin = async (req: Request, res: Response) => {
  try {
    const { provider, code, profile } = req.body; // Handle both code and profile flows

    let user;
    
    if (code) {
      // Access token flow (Google OAuth SDK)
      if (provider === 'google') {
        // Get user profile with access token
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${code}`
          }
        });

        const profile = await profileResponse.json();
        
        if (!profile.email) {
          return res.status(400).json({
            success: false,
            message: 'Failed to get email from Google profile'
          });
        }
        
        console.log('Google profile received:', profile);
        
        // Find or create user
        user = await User.findOne({ email: profile.email });
        
        if (!user) {
          console.log('Creating new user for email:', profile.email);
          user = new User({
            name: profile.name,
            email: profile.email,
            accountType: 'registered',
            isAnonymous: false,
            profilePicture: profile.picture
          });
        } else {
          console.log('Updating existing user for email:', profile.email);
          // Update user info if needed
          if (profile.name) user.name = profile.name;
          if (profile.picture) user.profilePicture = profile.picture;
          user.accountType = 'registered';
          user.isAnonymous = false;
        }
      }
    } else if (profile) {
      // Direct profile flow (fallback for other providers)
      user = await User.findOne({ email: profile.email });
      
      if (!user) {
        user = new User({
          name: profile.name,
          email: profile.email,
          accountType: 'registered',
          isAnonymous: false,
          profilePicture: profile.picture
        });
      } else {
        // Update user info if needed
        if (profile.name) user.name = profile.name;
        if (profile.picture) user.profilePicture = profile.picture;
      }
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create or find user account'
      });
    }

    await user.save();
    console.log('User saved to database with ID:', user._id);

    // Generate token
    const token = generateToken(user._id.toString());

    return res.status(200).json({
      success: true,
      message: `${provider} login successful`,
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          memberSince: user.memberSince,
          preferences: user.preferences,
          profilePicture: user.profilePicture
        },
        token
      }
    });
  } catch (error: any) {
    console.error('OAuth login error:', error);
    return res.status(500).json({
      success: false,
      message: 'OAuth login failed',
      error: error.message
    });
  }
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          memberSince: user.memberSince,
          preferences: user.preferences,
          profilePicture: user.profilePicture,
          moodHistory: user.moodHistory,
          lastActive: user.lastActive,
          isAdmin: user.isAdmin
        }
      }
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user data',
      error: error.message
    });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name, username, email, preferences } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (name && user.accountType === 'registered') {
      user.name = name;
    }

    if (username && user.accountType === 'registered') {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username: username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      
      user.username = username;
    }

    if (email && user.accountType === 'registered') {
      // Check if email is already taken by another user
      const existingEmailUser = await User.findOne({ 
        email: email, 
        _id: { $ne: userId } 
      });
      
      if (existingEmailUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already registered'
        });
      }
      
      user.email = email;
    }

    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          preferences: user.preferences
        }
      }
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Logout user
export const logout = async (req: Request, res: Response) => {
  try {
    // In a stateless JWT setup, logout is typically handled client-side
    // But we can add token blacklisting if needed
    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};
