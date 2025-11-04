import { IAdminDoc, IRoleDoc, IPermissionDoc } from '../models';
import { Types } from 'mongoose';

// Helper type for permissions that can be either reference or populated
type PermissionRef = string | Types.ObjectId | IPermissionDoc;

// Extended interface for when roles are populated
export interface IPopulatedRole extends Omit<IRoleDoc, 'permissions'> {
  permissions: PermissionRef[];
}

// Updated interface with proper typing for permissions
export interface IAdminWithRole extends Omit<IAdminDoc, 'roles' | 'permissions'> {
  roles?: IPopulatedRole[];
  permissions?: PermissionRef[];
}

/**
 * Type guard to check if permission is a document
 */
function isPermissionDoc(permission: PermissionRef): permission is IPermissionDoc {
  return typeof permission === 'object' && permission !== null && '_id' in permission;
}

/**
 * Get all permission IDs from an admin user
 * Combines permissions from assigned roles and direct permissions
 */
export async function getAllPermissionsForAdmin(
  admin: IAdminWithRole
): Promise<string[]> {
  const permissionSet = new Set<string>();

  // Add permissions from all assigned roles
  if (admin.roles && Array.isArray(admin.roles)) {
    for (const role of admin.roles) {
      if (role.permissions && Array.isArray(role.permissions)) {
        for (const permission of role.permissions) {
          const permId = isPermissionDoc(permission) 
            ? permission._id?.toString() 
            : permission.toString();
          if (permId) {
            permissionSet.add(permId);
          }
        }
      }
    }
  }

  // Add direct permissions
  if (admin.permissions && Array.isArray(admin.permissions)) {
    for (const permission of admin.permissions) {
      const permId = isPermissionDoc(permission)
        ? permission._id?.toString()
        : permission.toString();
      if (permId) {
        permissionSet.add(permId);
      }
    }
  }

  return Array.from(permissionSet);
}

/**
 * Get all permission names from an admin user
 */
export async function getAllPermissionNamesForAdmin(
  admin: IAdminWithRole,
  permissionDocuments?: IPermissionDoc[]
): Promise<string[]> {
  const permissionIds = await getAllPermissionsForAdmin(admin);

  if (!permissionDocuments || permissionDocuments.length === 0) {
    return permissionIds;
  }

  const permissionMap = new Map(
    permissionDocuments.map((p) => [p._id?.toString(), p.name])
  );

  return permissionIds
    .map((id) => permissionMap.get(id))
    .filter((name): name is string => !!name);
}

/**
 * Check if admin has a specific permission
 */
export function hasPermission(
  admin: IAdminWithRole,
  requiredPermission: string,
  permissionNames?: string[]
): boolean {
  // Super admin has all permissions
  // if (admin.role === 'superAdmin') {
  //   return true;
  // }

  // If permission names are provided, check against them
  if (permissionNames && permissionNames.length > 0) {
    return permissionNames.includes(requiredPermission);
  }

  // Check direct permissions
  if (admin.permissions && Array.isArray(admin.permissions)) {
    for (const permission of admin.permissions) {
      const permName = isPermissionDoc(permission) ? permission.name : permission.toString();
      if (permName === requiredPermission) {
        return true;
      }
    }
  }

  // Check permissions from roles
  if (admin.roles && Array.isArray(admin.roles)) {
    for (const role of admin.roles) {
      if (role.permissions && Array.isArray(role.permissions)) {
        for (const permission of role.permissions) {
          const permName = isPermissionDoc(permission) ? permission.name : permission.toString();
          if (permName === requiredPermission) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if admin has any of the specified permissions
 */
export function hasAnyPermission(
  admin: IAdminWithRole,
  requiredPermissions: string[],
  permissionNames?: string[]
): boolean {
  // Super admin has all permissions
  // if (admin.role === 'superAdmin') {
  //   return true;
  // }

  for (const permission of requiredPermissions) {
    if (hasPermission(admin, permission, permissionNames)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if admin has all of the specified permissions
 */
export function hasAllPermissions(
  admin: IAdminWithRole,
  requiredPermissions: string[],
  permissionNames?: string[]
): boolean {
  // Super admin has all permissions
  // if (admin.role === 'superAdmin') {
  //   return true;
  // }

  for (const permission of requiredPermissions) {
    if (!hasPermission(admin, permission, permissionNames)) {
      return false;
    }
  }

  return true;
}

/**
 * Get admin's role level (for hierarchical checking)
 */
export function getAdminRoleLevel(admin: IAdminWithRole): number {
  // if (admin.role === 'superAdmin') {
  //   return 1;
  // }

  // if (admin.role === 'admin') {
  //   return 2;
  // }

  // If roles are assigned, get the highest level
  if (admin.roles && Array.isArray(admin.roles)) {
    const levels = admin.roles
      .map((role) => role.level || 4)
      .sort((a, b) => a - b);

    if (levels.length > 0) {
      return levels[0]; // Return the highest level (lowest number)
    }
  }

  return 4; // Default viewer level
}

/**
 * Check if admin can manage another admin (hierarchy check)
 */
export function canManageAdmin(
  managingAdmin: IAdminWithRole,
  targetAdmin: IAdminWithRole
): boolean {
  const managingLevel = getAdminRoleLevel(managingAdmin);
  const targetLevel = getAdminRoleLevel(targetAdmin);

  // Can only manage users with same or lower privilege level
  return managingLevel <= targetLevel;
}

/**
 * Get permission category from permission name
 */
export function getPermissionCategory(
  permissionName: string
): string | null {
  const parts = permissionName.split('.');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Filter permissions by category
 */
export function filterPermissionsByCategory(
  permissions: string[],
  category: string
): string[] {
  return permissions.filter(
    (perm) => getPermissionCategory(perm) === category
  );
}