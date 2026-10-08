import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppRole } from '@/types';
import { Spinner } from '@/components/ui';

export function ProtectedRoute({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading || (session && !profile)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!session || !profile) return <Navigate to="/login" replace />;
  if (!profile.is_active) return <Navigate to="/login" replace />;
  if (!roles.includes(profile.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
