// authorizationMiddleware.ts file
import { Request, Response, NextFunction } from 'express';
import { IAdminDoc } from '../models';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getAllPermissionNamesForAdmin,
  canManageAdmin,
  getAdminRoleLevel,
} from '../utils/permissionUtils';
 
/**
 * Extend Express Request to include admin user
 */
declare global {
  namespace Express {
    interface Request {
      admin?: IAdminDoc & { permissions?: any[]; roles?: any[] };
      permissionNames?: string[];
    }
  }
}

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get permission names if not already loaded
      if (!req.permissionNames) {
        req.permissionNames = await getAllPermissionNamesForAdmin(req.admin);
      }

      if (!hasPermission(req.admin, requiredPermission, req.permissionNames)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          requiredPermission,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
};

/**
 * Middleware to check if user has any of the required permissions
 */
export const requireAnyPermission = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get permission names if not already loaded
      if (!req.permissionNames) {
        req.permissionNames = await getAllPermissionNamesForAdmin(req.admin);
      }

      if (!hasAnyPermission(req.admin, permissions, req.permissionNames)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          requiredPermissions: permissions,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
};

/**
 * Middleware to check if user has all of the required permissions
 */
export const requireAllPermissions = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get permission names if not already loaded
      if (!req.permissionNames) {
        req.permissionNames = await getAllPermissionNamesForAdmin(req.admin);
      }

      if (!hasAllPermissions(req.admin, permissions, req.permissionNames)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          requiredPermissions: permissions,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
};

/**
 * Middleware to check if user has admin-level access (level 1-2)
 * Checks based on role levels rather than role names
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const roleLevel = getAdminRoleLevel(req.admin);
    
    // Admin level access: level 1 (Super Admin) or level 2 (Admin)
    if (roleLevel > 2) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin check failed',
    });
  }
};

/**
 * Middleware to check if user has super admin access (level 1)
 * Checks based on role level rather than role name
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const roleLevel = getAdminRoleLevel(req.admin);
    
    // Super admin access: level 1 only
    if (roleLevel !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required',
      });
    }

    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Super admin check failed',
    });
  }
};

/**
 * Middleware to check if user has manager-level access or higher (level 1-3)
 */
export const requireManager = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const roleLevel = getAdminRoleLevel(req.admin);
    
    // Manager level access: level 1, 2, or 3
    if (roleLevel > 3) {
      return res.status(403).json({
        success: false,
        message: 'Manager access required',
      });
    }

    next();
  } catch (error) {
    console.error('Manager check error:', error);
    res.status(500).json({
      success: false,
      message: 'Manager check failed',
    });
  }
};

/**
 * Middleware to check minimum required role level
 */
export const requireRoleLevel = (maxLevel: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const roleLevel = getAdminRoleLevel(req.admin);
      
      if (roleLevel > maxLevel) {
        return res.status(403).json({
          success: false,
          message: `Insufficient access level. Required level ${maxLevel} or higher`,
          requiredLevel: maxLevel,
          currentLevel: roleLevel,
        });
      }

      next();
    } catch (error) {
      console.error('Role level check error:', error);
      res.status(500).json({
        success: false,
        message: 'Role level check failed',
      });
    }
  };
};

/**
 * Middleware to check if admin can manage target resource
 * Checks hierarchical access based on admin role levels
 */
export const canManageResource = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // This middleware should be used in conjunction with ID-based resource checks
    // Store admin info for later checks
    res.locals.currentAdmin = req.admin;

    next();
  } catch (error) {
    console.error('Resource management check error:', error);
    res.status(500).json({
      success: false,
      message: 'Resource check failed',
    });
  }
};

/**
 * Middleware to load and cache permissions for the authenticated user
 */
export const loadAdminPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.admin && !req.permissionNames) {
      req.permissionNames = await getAllPermissionNamesForAdmin(req.admin);
    }
    next();
  } catch (error) {
    console.error('Error loading permissions:', error);
    // Continue without cached permissions (will be fetched when needed)
    next();
  }
};