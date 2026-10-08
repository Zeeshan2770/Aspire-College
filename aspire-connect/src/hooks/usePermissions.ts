import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { AdminPermissions } from '@/types';

/**
 * Feature flags for the signed-in user. The Super Admin always passes;
 * Administration accounts use their admin_permissions row; everyone else is
 * denied. This only decides what the UI shows — the database enforces the
 * same rules through row-level security and function checks.
 */
export function usePermissions() {
  const { profile } = useAuth();
  const [row, setRow] = useState<Partial<AdminPermissions> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'SUB_SUPER_ADMIN') {
      setRow(null);
      return;
    }
    let alive = true;
    setLoading(true);
    supabase
      .from('admin_permissions')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle()
      .then(({ data }) => alive && setRow((data as Partial<AdminPermissions>) ?? {}))
      .then(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [profile?.id, profile?.role]);

  const can = (flag: keyof AdminPermissions): boolean => {
    if (profile?.role === 'MAIN_SUPER_ADMIN') return true;
    if (profile?.role === 'SUB_SUPER_ADMIN') return Boolean(row?.[flag]);
    return false;
  };

  return { can, loading };
}
