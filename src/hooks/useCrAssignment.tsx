import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { myAssignments } from '@/services/crAssignments';

export interface CrAssignmentDetail {
  id: string;
  cr_user_id: string;
  class_id: string;
  section_id: string;
  is_active: boolean;
  assigned_at: string;
  assigned_by: string | null;
  classes?: { name: string } | null;
  sections?: { name: string } | null;
}

interface CrAssignmentContextValue {
  /** All sections this CR is currently active in. */
  assignments: CrAssignmentDetail[];
  /** The section currently being worked in — this is what every CR page reads/writes against. */
  assignment: CrAssignmentDetail | null;
  loading: boolean;
  /** Switch the active section. Persists for the rest of the session. */
  selectSection: (sectionId: string) => void;
}

const CrAssignmentContext = createContext<CrAssignmentContextValue | undefined>(undefined);

const STORAGE_KEY = 'cr_selected_section_id';

export function CrAssignmentProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<CrAssignmentDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    myAssignments(profile.id).then((rows) => {
      if (cancelled) return;
      const list = (rows ?? []) as CrAssignmentDetail[];
      setAssignments(list);
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const storedStillValid = list.some((a) => a.section_id === stored);
      setSelectedId(storedStillValid ? stored : list[0]?.section_id ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile]);

  function selectSection(sectionId: string) {
    setSelectedId(sectionId);
    sessionStorage.setItem(STORAGE_KEY, sectionId);
  }

  const assignment = assignments.find((a) => a.section_id === selectedId) ?? null;

  return (
    <CrAssignmentContext.Provider value={{ assignments, assignment, loading, selectSection }}>
      {children}
    </CrAssignmentContext.Provider>
  );
}

export function useCrAssignment() {
  const ctx = useContext(CrAssignmentContext);
  if (!ctx) throw new Error('useCrAssignment must be used within a CrAssignmentProvider');
  return ctx;
}
