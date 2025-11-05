// permissionUtils.ts file
import { IAdminDoc, IRoleDoc, IPermissionDoc } from '../models';
import { Types } from 'mongoose';

// Helper type for permissions that can be either reference or populated
type PermissionRef = string | Types.ObjectId | IPermissionDoc;

// Helper type for roles that can be either reference or populated
type RoleRef = string | Types.ObjectId | IRoleDoc;

// Extended interface for when roles are populated
export interface IPopulatedRole extends Omit<IRoleDoc, 'permissions'> {
  permissions: PermissionRef[];
}

// Updated interface with proper typing for permissions
export interface IAdminWithRole extends Omit<IAdminDoc, 'roles' | 'permissions'> {
  roles?: (RoleRef | IPopulatedRole)[];
  permissions?: PermissionRef[];
}

/**
 * Type guard to check if permission is a document
 */
function isPermissionDoc(permission: PermissionRef): permission is IPermissionDoc {
  return typeof permission === 'object' && permission !== null && '_id' in permission;
}

/**
 * Type guard to check if role is a populated document
 */
function isRoleDoc(role: RoleRef | IPopulatedRole): role is IRoleDoc | IPopulatedRole {
  return typeof role === 'object' && role !== null && '_id' in role;
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
      if (isRoleDoc(role) && role.permissions && Array.isArray(role.permissions)) {
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
  const permissionSet = new Set<string>();

  // Collect permission names from roles
  if (admin.roles && Array.isArray(admin.roles)) {
    for (const role of admin.roles) {
      if (isRoleDoc(role) && role.permissions && Array.isArray(role.permissions)) {
        for (const permission of role.permissions) {
          if (isPermissionDoc(permission) && permission.name) {
            permissionSet.add(permission.name);
          }
        }
      }
    }
  }

  // Collect permission names from direct permissions
  if (admin.permissions && Array.isArray(admin.permissions)) {
    for (const permission of admin.permissions) {
      if (isPermissionDoc(permission) && permission.name) {
        permissionSet.add(permission.name);
      }
    }
  }

  // If we have collected permission names, return them
  if (permissionSet.size > 0) {
    return Array.from(permissionSet);
  }

  // Fallback: if permissions are not populated, return IDs
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
  // Check if admin has super admin level (level 1)
  if (getAdminRoleLevel(admin) === 1) {
    return true;
  }

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
      if (isRoleDoc(role) && role.permissions && Array.isArray(role.permissions)) {
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
  // Super admin (level 1) has all permissions
  if (getAdminRoleLevel(admin) === 1) {
    return true;
  }

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
  // Super admin (level 1) has all permissions
  if (getAdminRoleLevel(admin) === 1) {
    return true;
  }

  for (const permission of requiredPermissions) {
    if (!hasPermission(admin, permission, permissionNames)) {
      return false;
    }
  }

  return true;
}

/**
 * Get admin's role level (for hierarchical checking)
 * Returns the highest privilege level (lowest number) from all assigned roles
 */
export function getAdminRoleLevel(admin: IAdminWithRole): number {
  // If no roles assigned, return default viewer level
  if (!admin.roles || !Array.isArray(admin.roles) || admin.roles.length === 0) {
    return 4; // Default viewer level
  }

  const levels: number[] = [];

  // Collect all role levels
  for (const role of admin.roles) {
    if (isRoleDoc(role)) {
      // Role is populated
      if (typeof role.level === 'number') {
        levels.push(role.level);
      }
    }
  }

  // If we found any levels, return the highest privilege (lowest number)
  if (levels.length > 0) {
    return Math.min(...levels);
  }

  // Fallback to viewer level if no valid levels found
  return 4;
}

/**
 * Check if admin has a specific role level
 */
export function hasRoleLevel(admin: IAdminWithRole, level: number): boolean {
  return getAdminRoleLevel(admin) === level;
}

/**
 * Check if admin has at least a specific role level (or higher privilege)
 */
export function hasMinimumRoleLevel(admin: IAdminWithRole, maxLevel: number): boolean {
  return getAdminRoleLevel(admin) <= maxLevel;
}

/**
 * Check if admin is super admin (level 1)
 */
export function isSuperAdmin(admin: IAdminWithRole): boolean {
  return getAdminRoleLevel(admin) === 1;
}

/**
 * Check if admin is admin level (level 2) or higher
 */
export function isAdmin(admin: IAdminWithRole): boolean {
  return getAdminRoleLevel(admin) <= 2;
}

/**
 * Check if admin is manager level (level 3) or higher
 */
export function isManager(admin: IAdminWithRole): boolean {
  return getAdminRoleLevel(admin) <= 3;
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

  // Can only manage users with same or lower privilege level (higher number)
  return managingLevel <= targetLevel;
}

/**
 * Get all role names for an admin
 */
export function getAdminRoleNames(admin: IAdminWithRole): string[] {
  const roleNames: string[] = [];

  if (admin.roles && Array.isArray(admin.roles)) {
    for (const role of admin.roles) {
      if (isRoleDoc(role) && role.name) {
        roleNames.push(role.name);
      }
    }
  }

  return roleNames;
}

/**
 * Check if admin has a specific role by name
 */
export function hasRole(admin: IAdminWithRole, roleName: string): boolean {
  const roleNames = getAdminRoleNames(admin);
  return roleNames.includes(roleName);
}

/**
 * Check if admin has any of the specified roles
 */
export function hasAnyRole(admin: IAdminWithRole, roleNames: string[]): boolean {
  const adminRoleNames = getAdminRoleNames(admin);
  return roleNames.some((name) => adminRoleNames.includes(name));
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