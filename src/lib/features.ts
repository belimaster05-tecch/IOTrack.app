export interface OrgFeatures {
  reservations: boolean;
  scan: boolean;
  reports: boolean;
  locations: boolean;
  departments: boolean;
}

export const DEFAULT_FEATURES: OrgFeatures = {
  reservations: true,
  scan: true,
  reports: true,
  locations: true,
  departments: true,
};

export function parseFeatures(raw: Record<string, unknown> | null | undefined): OrgFeatures {
  return {
    reservations: raw?.reservations !== false,
    scan: raw?.scan !== false,
    reports: raw?.reports !== false,
    locations: raw?.locations !== false,
    departments: raw?.departments !== false,
  };
}
