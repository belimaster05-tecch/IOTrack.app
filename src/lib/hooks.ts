'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCatalogVisibility } from '@/lib/resourceVisibility';

type SharedStore<T> = {
  data: T;
  loading: boolean;
  error: any;
  initialized: boolean;
  promise: Promise<void> | null;
  listeners: Set<() => void>;
  channel: any | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
};

function createSharedStore<T>(initialData: T): SharedStore<T> {
  return {
    data: initialData,
    loading: true,
    error: null,
    initialized: false,
    promise: null,
    listeners: new Set(),
    channel: null,
    debounceTimer: null,
  };
}

function subscribeStore(store: SharedStore<any>, listener: () => void): () => void {
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}

function emitStore(store: SharedStore<any>) {
  store.listeners.forEach((listener) => listener());
}

function debounceStoreFetch(store: SharedStore<any>, fetcher: () => Promise<void>, delay = 180) {
  if (store.debounceTimer) clearTimeout(store.debounceTimer);
  store.debounceTimer = setTimeout(() => {
    store.debounceTimer = null;
    void fetcher();
  }, delay);
}

const resourcesStore = createSharedStore<any[]>([]);
const loansStore = createSharedStore<any[]>([]);
const requestsStore = createSharedStore<any[]>([]);

/** Call this whenever the authenticated user changes to prevent stale data cross-contamination. */
export function clearStoreCache() {
  resourcesStore.initialized = false;
  resourcesStore.data = [];
  loansStore.initialized = false;
  loansStore.data = [];
  requestsStore.initialized = false;
  requestsStore.data = [];
  emitStore(resourcesStore);
  emitStore(loansStore);
  emitStore(requestsStore);
}

export function useResources() {
  const [resources, setResources] = useState<any[]>(resourcesStore.data);
  const [loading, setLoading] = useState(resourcesStore.loading);
  const [error, setError] = useState<any>(resourcesStore.error);

  const fetchResources = useCallback(async () => {
    if (resourcesStore.promise) return resourcesStore.promise;

    resourcesStore.loading = true;
    emitStore(resourcesStore);

    const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          categories(name, icon_name),
          locations(name),
          departments(name),
          resource_units(id, status),
          resource_condition_tags(tag_id, condition_tags(id, name, color))
        `)
        .order('name');

      if (error) throw error;
      
      const processedData = (data || []).map((resource: any) => {
          const isReusable = resource.type === 'reusable';
          const total = isReusable
            ? (resource.resource_units?.length > 0 ? resource.resource_units.length : (resource.initial_quantity || 0))
            : (resource.initial_quantity || 0);
          const available = isReusable
            ? (resource.resource_units?.length > 0
                ? resource.resource_units.filter((u: any) => u.status === 'available').length
                : (resource.initial_quantity || 0))
            : (resource.initial_quantity || 0);
            
          return {
              ...resource,
              catalog_visibility: getCatalogVisibility(resource),
              available_quantity: available,
              total_quantity: total
          };
      });

      resourcesStore.data = processedData;
      resourcesStore.error = null;
      resourcesStore.initialized = true;
    } catch (err) {
      resourcesStore.error = err;
    } finally {
      resourcesStore.loading = false;
      resourcesStore.promise = null;
      emitStore(resourcesStore);
    }
    })();

    resourcesStore.promise = request;
    return request;
  }, []);

  useEffect(() => {
    const sync = () => {
      setResources(resourcesStore.data);
      setLoading(resourcesStore.loading);
      setError(resourcesStore.error);
    };
    const unsubscribe = subscribeStore(resourcesStore, sync);
    sync();
    if (!resourcesStore.initialized && !resourcesStore.promise) {
      void fetchResources();
    }
    if (!resourcesStore.channel) {
      resourcesStore.channel = supabase
        .channel('realtime-resources')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => debounceStoreFetch(resourcesStore, fetchResources))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_units' }, () => debounceStoreFetch(resourcesStore, fetchResources))
        .subscribe();
    }
    return unsubscribe;
  }, [fetchResources]);

  return { resources, loading, error, refetchResources: fetchResources };
}

export function useLoans() {
  const [loans, setLoans] = useState<any[]>(loansStore.data);
  const [loading, setLoading] = useState(loansStore.loading);
  const [error, setError] = useState<any>(loansStore.error);

  const fetchLoans = useCallback(async () => {
    if (loansStore.promise) return loansStore.promise;

    loansStore.loading = true;
    emitStore(loansStore);

    const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          resource_units(
            id,
            serial_number,
            status,
            resource_id,
            resources(name, sku, ownership_type, locations(name))
          ),
          profiles(
            id,
            full_name,
            avatar_url,
            job_title,
            department_id,
            departments:departments!profiles_department_id_fkey(name)
          )
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      loansStore.data = Array.isArray(data) ? data : [];
      loansStore.error = null;
      loansStore.initialized = true;
    } catch (err) {
      loansStore.error = err;
      loansStore.data = [];
    } finally {
      loansStore.loading = false;
      loansStore.promise = null;
      emitStore(loansStore);
    }
    })();

    loansStore.promise = request;
    return request;
  }, []);

  useEffect(() => {
    const sync = () => {
      setLoans(loansStore.data);
      setLoading(loansStore.loading);
      setError(loansStore.error);
    };
    const unsubscribe = subscribeStore(loansStore, sync);
    sync();
    if (!loansStore.initialized && !loansStore.promise) {
      void fetchLoans();
    }
    if (!loansStore.channel) {
      loansStore.channel = supabase
        .channel('realtime-loans')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => debounceStoreFetch(loansStore, fetchLoans))
        .subscribe();
    }
    return unsubscribe;
  }, [fetchLoans]);

  return { loans, loading, error, refetchLoans: fetchLoans };
}

export function useRequests() {
  const [requests, setRequests] = useState<any[]>(requestsStore.data);
  const [loading, setLoading] = useState(requestsStore.loading);
  const [error, setError] = useState<any>(requestsStore.error);

  const fetchRequests = useCallback(async () => {
    if (requestsStore.promise) return requestsStore.promise;

    requestsStore.loading = true;
    emitStore(requestsStore);

    const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          profiles(*),
          resources(name, sku, type, initial_quantity, ownership_type, owner_name, catalog_visibility, location_id, locations(name), department_id, departments(id, leader_id))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      requestsStore.data = data || [];
      requestsStore.error = null;
      requestsStore.initialized = true;
    } catch (err) {
      requestsStore.error = err;
    } finally {
      requestsStore.loading = false;
      requestsStore.promise = null;
      emitStore(requestsStore);
    }
    })();

    requestsStore.promise = request;
    return request;
  }, []);

  useEffect(() => {
    const sync = () => {
      setRequests(requestsStore.data);
      setLoading(requestsStore.loading);
      setError(requestsStore.error);
    };
    const unsubscribe = subscribeStore(requestsStore, sync);
    sync();
    if (!requestsStore.initialized && !requestsStore.promise) {
      void fetchRequests();
    }
    if (!requestsStore.channel) {
      requestsStore.channel = supabase
        .channel('realtime-requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => debounceStoreFetch(requestsStore, fetchRequests))
        .subscribe();
    }
    return unsubscribe;
  }, [fetchRequests]);

  return { requests, loading, error, refetchRequests: fetchRequests };
}

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*, departments:departments!profiles_department_id_fkey(name)')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetchProfile: fetchProfile };
}

export function useUsers(organizationId?: string | null) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchUsers = useCallback(async () => {
    if (organizationId === undefined) return; // esperar a que se resuelva
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select(`
          *,
          departments:departments!profiles_department_id_fkey(name)
        `)
        .order('full_name');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refetchUsers: fetchUsers };
}

export function useDepartments() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*, profiles!leader_id(full_name)')
        .order('name');

      if (error) throw error;
      const baseDepartments = data || [];

      try {
        const { data: managerRows } = await supabase
          .from('department_managers')
          .select('department_id, user_id, is_primary, profiles(full_name, email)');

        const managersByDepartment = (managerRows || []).reduce<Record<string, any[]>>((acc, row: any) => {
          if (!acc[row.department_id]) acc[row.department_id] = [];
          acc[row.department_id].push(row);
          return acc;
        }, {});

        setDepartments(
          baseDepartments.map((department: any) => ({
            ...department,
            managers: managersByDepartment[department.id] || [],
          })),
        );
      } catch {
        setDepartments(
          baseDepartments.map((department: any) => ({
            ...department,
            managers: department.leader_id
              ? [
                  {
                    department_id: department.id,
                    user_id: department.leader_id,
                    is_primary: true,
                    profiles: Array.isArray(department.profiles) ? department.profiles[0] : department.profiles,
                  },
                ]
              : [],
          })),
        );
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return { departments, loading, error, refetchDepartments: fetchDepartments };
}

/** True si el usuario es encargado (líder) de algún departamento. */
export function useIsDepartmentLeader(userId: string | undefined) {
  const [isLeader, setIsLeader] = useState(false);
  useEffect(() => {
    if (!userId) {
      setIsLeader(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase
        .from('departments')
        .select('id')
        .eq('leader_id', userId)
        .limit(1),
      supabase
        .from('department_managers')
        .select('department_id')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('location_managers')
        .select('location_id')
        .eq('user_id', userId)
        .limit(1),
    ]).then(([leaders, departmentManagers, locationManagers]) => {
      if (cancelled) return;
      const hasLeadership = Array.isArray(leaders.data) && leaders.data.length > 0;
      const hasDepartmentManagement = Array.isArray(departmentManagers.data) && departmentManagers.data.length > 0;
      const hasLocationManagement = Array.isArray(locationManagers.data) && locationManagers.data.length > 0;
      setIsLeader(hasLeadership || hasDepartmentManagement || hasLocationManagement);
    }).catch(() => {
      if (!cancelled) setIsLeader(false);
    });
    return () => { cancelled = true; };
  }, [userId]);
  return isLeader;
}

export function useManagedScopes(userId: string | undefined) {
  const [managedDepartmentIds, setManagedDepartmentIds] = useState<string[]>([]);
  const [managedLocationIds, setManagedLocationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setManagedDepartmentIds([]);
      setManagedLocationIds([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const [leaderDepartments, departmentManagers, locationManagers] = await Promise.all([
          supabase.from('departments').select('id').eq('leader_id', userId),
          supabase.from('department_managers').select('department_id').eq('user_id', userId),
          supabase.from('location_managers').select('location_id').eq('user_id', userId),
        ]);

        if (cancelled) return;

        const departmentIds = new Set<string>();
        (leaderDepartments.data || []).forEach((row: any) => departmentIds.add(row.id));
        (departmentManagers.data || []).forEach((row: any) => departmentIds.add(row.department_id));

        const locationIds = new Set<string>();
        (locationManagers.data || []).forEach((row: any) => locationIds.add(row.location_id));

        setManagedDepartmentIds(Array.from(departmentIds));
        setManagedLocationIds(Array.from(locationIds));
      } catch {
        if (!cancelled) {
          setManagedDepartmentIds([]);
          setManagedLocationIds([]);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    managedDepartmentIds,
    managedLocationIds,
    isManager: managedDepartmentIds.length > 0 || managedLocationIds.length > 0,
  };
}

export function useLocations() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) throw error;
      const baseLocations = data || [];

      const departmentIds = Array.from(new Set(baseLocations.map((location: any) => location.department_id).filter(Boolean)));
      let departmentsById: Record<string, any> = {};
      if (departmentIds.length > 0) {
        const { data: departmentRows } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', departmentIds);
        departmentsById = (departmentRows || []).reduce<Record<string, any>>((acc, row: any) => {
          acc[row.id] = row;
          return acc;
        }, {});
      }

      try {
        const { data: managerRows } = await supabase
          .from('location_managers')
          .select('location_id, user_id, is_primary, profiles(full_name, email)');

        const managersByLocation = (managerRows || []).reduce<Record<string, any[]>>((acc, row: any) => {
          if (!acc[row.location_id]) acc[row.location_id] = [];
          acc[row.location_id].push(row);
          return acc;
        }, {});

        setLocations(
          baseLocations.map((location: any) => ({
            ...location,
            departments: location.department_id ? departmentsById[location.department_id] || null : null,
            managers: managersByLocation[location.id] || [],
          })),
        );
      } catch {
        setLocations(
          baseLocations.map((location: any) => ({
            ...location,
            departments: location.department_id ? departmentsById[location.department_id] || null : null,
            managers: [],
          })),
        );
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return { locations, loading, error, refetchLocations: fetchLocations };
}

export function useCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refetchCategories: fetchCategories };
}
export function useResource(id: string | undefined) {
  const [resource, setResource] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchResource = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      
      // Fetch resource details
      const { data, error: resError } = await supabase
        .from('resources')
        .select(`
          *,
          categories(name, icon_name),
          locations(name),
          resource_condition_tags(condition_tags(id, name, color))
        `)
        .eq('id', id)
        .single();

      if (resError) throw resError;

      // Fetch individual units for this resource
      const { data: unitsData, error: unitsError } = await supabase
        .from('resource_units')
        .select(`
          *,
          loans(
            *,
            profiles(full_name),
            requests(needed_from, needed_until, start_time, end_time)
          )
        `)
        .eq('resource_id', id)
        .order('serial_number');

      if (unitsError) throw unitsError;
      const isReusable = data.type === 'reusable';
      const total = isReusable ? ((unitsData || []).length > 0 ? (unitsData || []).length : (data.initial_quantity || 0)) : (data.initial_quantity || 0);
      const available = isReusable
        ? ((unitsData || []).length > 0
            ? (unitsData || []).filter((unit: any) => unit.status === 'available').length
            : (data.initial_quantity || 0))
        : (data.initial_quantity || 0);
      setResource({
        ...data,
        catalog_visibility: getCatalogVisibility(data),
        available_quantity: available,
        total_quantity: total,
      });
      setUnits(unitsData || []);

    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResource();
  }, [fetchResource]);
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`realtime-resource-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources', filter: `id=eq.${id}` }, () => fetchResource())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_units', filter: `resource_id=eq.${id}` }, () => fetchResource())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchResource())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, fetchResource]);

  return { resource, units, loading, error, refetchResource: fetchResource };
}

export function useActivityLogs(limit: number = 20) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchActivityLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  useEffect(() => {
    const ch = supabase
      .channel('realtime-activity-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => fetchActivityLogs())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchActivityLogs]);

  return { logs, loading, error, refetchActivityLogs: fetchActivityLogs };
}

export function useConditionTags() {
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('condition_tags')
      .select('id, name, color')
      .order('name');
    setTags(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { tags, loading, refetch: fetch };
}
