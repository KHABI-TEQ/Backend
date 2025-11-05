import { Response, NextFunction } from "express";
import { DB } from "../..";
import { AppRequest } from '../../../types/express';
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DEFAULT_ROLES, PERMISSION_DESCRIPTIONS, PERMISSIONS } from "../../../common/constants/permissions";
import { Types } from "mongoose";


// Add this type helper at the top of your file or in a types file
type PopulatedPermission = string | Types.ObjectId | {
  _id: Types.ObjectId;
  name: string;
  [key: string]: any;
};

type PopulatedRole = {
  _id: Types.ObjectId;
  permissions: PopulatedPermission[];
  [key: string]: any;
};

// ==================== PERMISSION CONTROLLERS ====================

/**
 * Get all permissions with optional filtering
 */
export const getAllPermissions = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { category, isActive, search } = req.query;

    const filter: any = {};

    if (category) {
      filter.category = category;
    }

    if (typeof isActive === 'string') {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const permissions = await DB.Models.Permission.find(filter).sort({ category: 1, action: 1 });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Permission fetched successfully",
      data: {
        permissions,
        total: permissions.length
      },
    });

  } catch (error) {
    console.error('Error fetching permissions:', error);
    next(error);
  }
};

/**
 * Get a single permission by ID
 */
export const getPermissionById = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const permission = await DB.Models.Permission.findById(id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: permission,
    });

  } catch (error) {
    next(error)
    console.error('Error fetching permission:', error);
  }
};

/**
 * Create a new permission
 */
export const createPermission = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, resource, action, category, isActive } = req.body;

    // Validate required fields
    if (!name || !description || !resource || !action || !category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Check if permission already exists
    const existingPermission = await DB.Models.Permission.findOne({ name });

    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: 'Permission already exists',
      });
    }

    const newPermission = new (DB.Models.Permission)({
      name,
      description,
      resource,
      action,
      category,
      isActive: isActive !== undefined ? isActive : true,
    });

    await newPermission.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Permission created successfully',
      data: newPermission,
    });
  } catch (error) {
    next(error)
    console.error('Error creating permission:', error);
  }
};

/**
 * Update a permission
 */
export const updatePermission = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const permission = await DB.Models.Permission.findById(id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    if (name && name !== permission.name) {
      const existingPermission = await DB.Models.Permission.findOne({ name });
      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: 'Permission name already exists',
        });
      }
      permission.name = name;
    }

    if (description) permission.description = description;
    if (isActive !== undefined) permission.isActive = isActive;

    await permission.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Permission updated successfully',
      data: permission,
    });

  } catch (error) {
    next(error)
    console.error('Error updating permission:', error);
  }
};

/**
 * Delete a permission
 */
export const deletePermission = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const permission = await DB.Models.Permission.findById(id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    // Check if permission is used in any role
    const rolesUsingPermission = await DB.Models.Role.find({
      permissions: id,
    });

    if (rolesUsingPermission.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Permission is used in ${rolesUsingPermission.length} role(s). Remove it from roles before deleting.`,
      });
    }

    await DB.Models.Permission.findByIdAndDelete(id);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Permission deleted successfully',
    });
  } catch (error) {
    next(error)
    console.error('Error deleting permission:', error);
  }
};

/**
 * Seed default permissions
 */
export const seedDefaultPermissions = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const existingCount = await DB.Models.Permission.countDocuments();

    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Permissions already exist in database',
        count: existingCount,
      });
    }
 
    const permissionsToCreate = Object.entries(PERMISSIONS).map(([key, permissionName]) => ({
      name: permissionName,
      description: PERMISSION_DESCRIPTIONS[permissionName as keyof typeof PERMISSION_DESCRIPTIONS],
      resource: permissionName.split('.')[0],
      action: permissionName.split('.')[1],
      category: permissionName.split('.')[0],
      isActive: true,
    }));
 
    const createdPermissions = await DB.Models.Permission.insertMany(permissionsToCreate);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Default permissions seeded successfully',
      count: createdPermissions.length,
      data: createdPermissions,
    });
  } catch (error) {
    next(error)
    console.error('Error seeding permissions:', error);
  }
};

// ==================== ROLE CONTROLLERS ====================

/**
 * Get all roles with optional filtering
 */
export const getAllRoles = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { isActive, search } = req.query;

    const filter: any = {};

    if (typeof isActive === 'string') {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const roles = await DB.Models.Role
      .find(filter)
      .populate('permissions')
      .sort({ level: 1 });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: roles,
      total: roles.length,
    });
  } catch (error) {
    next(error)
    console.error('Error fetching roles:', error);
  }
};

/**
 * Get a single role by ID
 */
export const getRoleById = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const role = await DB.Models.Role.findById(id).populate('permissions');

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error)
    console.error('Error fetching role:', error);
  }
};

/**
 * Create a new role
 */
export const createRole = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, permissions, level, isActive } = req.body;

    // Validate required fields
    if (!name || !description || !Array.isArray(permissions) || !level) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields or invalid format',
      });
    }

    // Check if role already exists
    const existingRole = await DB.Models.Role.findOne({ name });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role already exists',
      });
    }

    // Verify all permission IDs exist
    const permissionCount = await DB.Models.Permission.countDocuments({
      _id: { $in: permissions },
    });

    if (permissionCount !== permissions.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more permission IDs are invalid',
      });
    }

    const newRole = new (DB.Models.Role)({
      name,
      description,
      permissions,
      level,
      isActive: isActive !== undefined ? isActive : true,
    });

    await newRole.save();
    await newRole.populate('permissions');

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Role created successfully',
      data: newRole,
    });
  } catch (error) {
    next(error)
    console.error('Error creating role:', error);
  }
};

/**
 * Update a role
 */
export const updateRole = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, level, isActive } = req.body;

    const role = await DB.Models.Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    if (name && name !== role.name) {
      const existingRole = await DB.Models.Role.findOne({ name });
      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role name already exists',
        });
      }
      role.name = name;
    }

    if (description) role.description = description;
    if (level) role.level = level;
    if (isActive !== undefined) role.isActive = isActive;

    if (permissions && Array.isArray(permissions)) {
      // Verify all permission IDs exist
      const permissionCount = await DB.Models.Permission.countDocuments({
        _id: { $in: permissions },
      });

      if (permissionCount !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more permission IDs are invalid',
        });
      }

      role.permissions = permissions;
    }

    await role.save();
    await role.populate('permissions');

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Role updated successfully',
      data: role,
    });
  } catch (error) {
    next(error)
    console.error('Error updating role:', error);
  }
};

/**
 * Delete a role
 */
export const deleteRole = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const role = await DB.Models.Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // Check if role is assigned to any admin
    const adminsWithRole = await DB.Models.Admin.find({
      roles: id,
    });

    if (adminsWithRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Role is assigned to ${adminsWithRole.length} admin(s). Remove it from admins before deleting.`,
      });
    }

    await DB.Models.Role.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    next(error)
    console.error('Error deleting role:', error);
  }
};

/**
 * Seed default roles
 */
export const seedDefaultRoles = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const existingCount = await DB.Models.Role.countDocuments();

    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Roles already exist in database',
        count: existingCount,
      });
    }

    // Get all permissions to map permission names to IDs
    const allPermissions = await DB.Models.Permission.find({});
    const permissionMap = new Map(
      allPermissions.map((p) => [p.name, p._id.toString()])
    );

    const rolesToCreate = Object.values(DEFAULT_ROLES).map((roleTemplate: any) => ({
      name: roleTemplate.name,
      description: roleTemplate.description,
      level: roleTemplate.level,
      permissions: roleTemplate.permissions
        .map((permName: string) => permissionMap.get(permName))
        .filter((id: string): id is string => !!id),
      isActive: true,
    }));

    const createdRoles = await DB.Models.Role.insertMany(rolesToCreate);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Default roles seeded successfully',
      count: createdRoles.length,
      data: createdRoles,
    });
  } catch (error) {
    next(error)
    console.error('Error seeding roles:', error);
  }
};

// ==================== ADMIN ROLE ASSIGNMENT CONTROLLERS ====================

/**
 * Assign roles to an admin
 */
export const assignRolesToAdmin = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { adminId } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Roles array is required and must not be empty',
      });
    }

    const admin = await DB.Models.Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Verify all role IDs exist
    const roleCount = await DB.Models.Role.countDocuments({
      _id: { $in: roles },
    });

    if (roleCount !== roles.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more role IDs are invalid',
      });
    }

    admin.roles = roles;
    await admin.save();
    await admin.populate('roles.permissions');

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Roles assigned successfully',
      data: admin,
    });

  } catch (error) {
    next(error)
    console.error('Error assigning roles:', error);
  }
};

/**
 * Assign permissions directly to an admin
 */
export const assignPermissionsToAdmin = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { adminId } = req.params;
    const { permissions, mode = 'set' } = req.body; // mode: 'set', 'add', 'remove'

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions array is required',
      });
    }

    const admin = await DB.Models.Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Verify all permission IDs exist
    const permissionCount = await DB.Models.Permission.countDocuments({
      _id: { $in: permissions },
    });

    if (permissionCount !== permissions.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more permission IDs are invalid',
      });
    }

    if (mode === 'set') {
      admin.permissions = permissions;
    } else if (mode === 'add') {
      const existingIds = new Set(
        admin.permissions?.map((p: any) => p.toString()) || []
      );
      permissions.forEach((id: string) => {
        existingIds.add(id);
      });
      admin.permissions = Array.from(existingIds);
    } else if (mode === 'remove') {
      const permissionSet = new Set(permissions.map((p: any) => p.toString()));
      admin.permissions = (admin.permissions || []).filter(
        (p: any) => !permissionSet.has(p.toString())
      );
    }

    await admin.save();
    await admin.populate('permissions');

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Permissions assigned successfully',
      data: admin,
    });
  } catch (error) {
    next(error)
    console.error('Error assigning permissions:', error);
  }
};

/**
 * Get admin's role and permissions
 */
export const getAdminRolesAndPermissions = async (
  req: AppRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const { adminId } = req.params;

    const admin = await DB.Models.Admin.findById(adminId)
      .populate('roles')
      .populate('permissions');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Compile all unique permissions from roles and direct assignments
    const permissionSet = new Set<string>();

    // Type guard for permission documents
    const isPermissionDoc = (perm: any): perm is { _id: Types.ObjectId } => {
      return perm && typeof perm === 'object' && '_id' in perm;
    };

    // Type guard for role documents
    const isRoleDoc = (role: any): role is PopulatedRole => {
      return role && typeof role === 'object' && '_id' in role;
    };

    // Add from roles
    if (admin.roles && Array.isArray(admin.roles)) {
      for (const role of admin.roles as any[]) {
        if (isRoleDoc(role) && role.permissions && Array.isArray(role.permissions)) {
          for (const perm of role.permissions) {
            const permId = isPermissionDoc(perm) 
              ? perm._id.toString() 
              : perm?.toString() || '';
            if (permId) permissionSet.add(permId);
          }
        }
      }
    }

    // Add direct permissions
    if (admin.permissions && Array.isArray(admin.permissions)) {
      for (const perm of admin.permissions as any[]) {
        const permId = isPermissionDoc(perm)
          ? perm._id.toString()
          : perm?.toString() || '';
        if (permId) permissionSet.add(permId);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        admin: admin,
        roles: admin.roles || [],
        permissions: admin.permissions || [],
        totalUniquePermissions: permissionSet.size,
      },
    });
  } catch (error) {
    next(error);
    console.error('Error fetching admin roles and permissions:', error);
  }
};
