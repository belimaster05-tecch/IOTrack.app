'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import { DEFAULT_FEATURES, OrgFeatures, parseFeatures } from '@/lib/features';

interface FeaturesContextType {
  features: OrgFeatures;
  loading: boolean;
  updateFeature: (key: keyof OrgFeatures, value: boolean) => Promise<void>;
}

const FeaturesContext = createContext<FeaturesContextType>({
  features: DEFAULT_FEATURES,
  loading: true,
  updateFeature: async () => {},
});

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const { organizationId } = useAuth();
  const [features, setFeatures] = useState<OrgFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      setFeatures(DEFAULT_FEATURES);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('organizations')
      .select('features')
      .eq('id', organizationId)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.features) {
          setFeatures(parseFeatures(data.features as Record<string, unknown>));
        }
        setLoading(false);
      });
  }, [organizationId]);

  const updateFeature = useCallback(
    async (key: keyof OrgFeatures, value: boolean) => {
      if (!organizationId) return;
      const next = { ...features, [key]: value };
      setFeatures(next); // optimistic
      const { error } = await supabase
        .from('organizations')
        .update({ features: next })
        .eq('id', organizationId);
      if (error) {
        // revert on failure
        setFeatures(features);
        throw error;
      }
    },
    [features, organizationId]
  );

  return (
    <FeaturesContext.Provider value={{ features, loading, updateFeature }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export const useFeatures = () => useContext(FeaturesContext);
