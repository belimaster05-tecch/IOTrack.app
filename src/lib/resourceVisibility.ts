export type CatalogVisibility = 'public' | 'restricted' | 'internal';

export function getCatalogVisibility(
  resource: { catalog_visibility?: string | null; ownership_type?: string | null }
): CatalogVisibility {
  const v = resource?.catalog_visibility;
  if (v === 'public' || v === 'restricted' || v === 'internal') return v;

  // personal → restricted (the assigned user + editors can see it; not everyone)
  // area     → restricted (department-level, controlled by editors)
  if (resource?.ownership_type === 'personal') return 'restricted';
  if (resource?.ownership_type === 'area') return 'restricted';
  return 'public';
}

/**
 * Determines whether a resource should appear in the catalog for a given user.
 *
 * @param resource     The resource row (must include owner_user_id).
 * @param canSeeAll    True for admin, owner, approver, and inventory managers —
 *                     they see every visibility tier including internal.
 * @param userId       The current user's UUID (used to check personal assignments).
 */
export function isVisibleInCatalog(
  resource: {
    catalog_visibility?: string | null;
    ownership_type?: string | null;
    owner_user_id?: string | null;
  },
  canSeeAll: boolean,
  userId?: string | null
): boolean {
  const visibility = getCatalogVisibility(resource);

  // Editors (admin / approver / manager) see everything.
  if (canSeeAll) return true;

  // Regular employees:
  if (visibility === 'public') return true;

  if (visibility === 'restricted') {
    // Only the specifically assigned user sees their own resource.
    return !!(userId && resource.owner_user_id && resource.owner_user_id === userId);
  }

  // 'internal' → never visible to regular employees.
  return false;
}
