import { Request, Response } from 'express';
import Resource, { IResource } from '../models/Resource';
import User from '../models/User';

// Define type for populated resource (without extending IResource)
interface PopulatedResource extends Omit<IResource, 'submittedBy'> {
  submittedBy: {
    _id: string;
    name: string;
    email: string;
  };
}

// Create a new resource (admin only)
export const createResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resourceData = {
      ...req.body,
      submittedBy: (req as any).user?.userId,
      approvalStatus: 'approved', // Admin-created resources are auto-approved
      isPublished: req.body.isPublished ?? true
    };

    const resource = new Resource(resourceData);
    await resource.save();

    await resource.populate('submittedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Resource created successfully',
      data: resource
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating resource',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all resources (public endpoint)
export const getResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      type,
      difficulty,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {
      isPublished: true,
      isPublic: true
    };

    // Filter by target audience
    const user = (req as any).user;
    if (!user) {
      filter.targetAudience = { $in: ['all', 'anonymous'] };
    } else if (user.accountType === 'registered') {
      filter.targetAudience = { $in: ['all', 'registered', 'anonymous'] };
    } else {
      filter.targetAudience = { $in: ['all', 'anonymous'] };
    }

    if (category) filter.category = category;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }

    if (search) {
      filter.$text = { $search: search as string };
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const resources = await Resource.find(filter)
      .populate('submittedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum) as unknown as PopulatedResource[];

    // Transform the data to match frontend expectations
    const transformedResources = resources.map(resource => ({
      ...resource.toJSON(),
      author: resource.submittedBy ? {
        name: resource.submittedBy.name || 'Unknown',
        email: resource.submittedBy.email || ''
      } : { name: 'Unknown', email: '' }
    }));

    const total = await Resource.countDocuments(filter);

    res.json({
      success: true,
      data: {
        resources: transformedResources,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalResources: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching resources',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get resource by ID
export const getResourceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resource = await Resource.findById(id)
      .populate('submittedBy', 'name email') as unknown as PopulatedResource;

    if (!resource) {
      res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
      return;
    }

    // Check access permissions
    if (!resource.isPublished) {
      res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
      return;
    }

    if (!resource.isPublic) {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required to access this resource'
        });
        return;
      }
    }

    // Check target audience
    const user = (req as any).user;
    if (!user && resource.targetAudience === 'registered') {
      res.status(401).json({
        success: false,
        message: 'Registration required to access this resource'
      });
      return;
    }

    // Transform the data to match frontend expectations
    const transformedResource = {
      ...resource.toJSON(),
      author: resource.submittedBy ? {
        name: resource.submittedBy.name || 'Unknown',
        email: resource.submittedBy.email || ''
      } : { name: 'Unknown', email: '' }
    };

    res.json({
      success: true,
      data: transformedResource
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching resource',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update resource (admin only)
export const updateResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const resource = await Resource.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('submittedBy', 'name email');

    if (!resource) {
      res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Resource updated successfully',
      data: resource
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating resource',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete resource (admin only)
export const deleteResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resource = await Resource.findByIdAndDelete(id);

    if (!resource) {
      res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting resource',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all resources for admin (including unpublished)
export const getAllResourcesForAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      type,
      difficulty,
      tags,
      search,
      isPublished,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {};

    if (category) filter.category = category;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }
    if (isPublished !== undefined) {
      filter.isPublished = isPublished === 'true';
    }

    if (search) {
      filter.$text = { $search: search as string };
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const resources = await Resource.find(filter)
      .populate('submittedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Resource.countDocuments(filter);

    res.json({
      success: true,
      data: {
        resources,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalResources: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin resources:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching resources',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get resource categories and tags
export const getResourceMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Resource.distinct('category');
    const tags = await Resource.distinct('tags');

    res.json({
      success: true,
      data: {
        categories,
        tags,
        types: ['article', 'video', 'link', 'document', 'exercise'],
        difficulties: ['beginner', 'intermediate', 'advanced'],
        targetAudiences: ['all', 'registered', 'anonymous']
      }
    });
  } catch (error) {
    console.error('Error fetching resource metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching resource metadata',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Submit resource for approval (users)
export const submitResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resourceData = {
      ...req.body,
      submittedBy: (req as any).user?.userId,
      approvalStatus: 'pending',
      isPublished: false // User submissions are not published until approved
    };

    const resource = new Resource(resourceData);
    await resource.save();

    await resource.populate('submittedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Resource submitted for approval',
      data: resource
    });
  } catch (error) {
    console.error('Error submitting resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting resource',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get pending resources for admin approval
export const getPendingResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter for pending resources
    const filter: any = { approvalStatus: 'pending' };

    if (search) {
      filter.$text = { $search: search as string };
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const resources = await Resource.find(filter)
      .populate('submittedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Resource.countDocuments(filter);

    res.json({
      success: true,
      data: {
        resources,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalResources: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching pending resources:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending resources',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Approve or reject resource
export const reviewResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve or reject'
      });
      return;
    }

    const updateData: any = {
      approvalStatus: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: (req as any).user?.userId,
      reviewedAt: new Date(),
      isPublished: action === 'approve' // Only publish if approved
    };

    if (action === 'reject' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const resource = await Resource.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('submittedBy', 'name email reviewedBy name email');

    if (!resource) {
      res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
      return;
    }

    res.json({
      success: true,
      message: `Resource ${action}d successfully`,
      data: resource
    });
  } catch (error) {
    console.error('Error reviewing resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error reviewing resource',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user's submitted resources
export const getUserSubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      approvalStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter for user's submissions
    const filter: any = { submittedBy: (req as any).user?.userId };

    if (search) {
      filter.$text = { $search: search as string };
    }

    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const resources = await Resource.find(filter)
      .populate('submittedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Resource.countDocuments(filter);

    res.json({
      success: true,
      data: {
        resources,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalResources: total,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user submissions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
