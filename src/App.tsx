import { Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CrAssignmentProvider } from '@/hooks/useCrAssignment';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
// Landing page is bundled with the app shell so first visit needs no extra chunk round-trips.
import PublicLayout from '@/public/PublicLayout';
import PublicHome from '@/public/pages/Home';
const LoginPage = lazy(() => import('@/pages/LoginPage'));

const MainDashboard = lazy(() => import('@/pages/MainSuperAdmin/Dashboard'));
const FacultyPage = lazy(() => import('@/pages/Admin/Faculty'));
const WebsiteContentPage = lazy(() => import('@/pages/Admin/WebsiteContent'));
const WebsiteSettingsPage = lazy(() => import('@/pages/Admin/WebsiteSettings'));
const AdmissionsPage = lazy(() => import('@/pages/Admin/Admissions'));
const MessagesPage = lazy(() => import('@/pages/Admin/Messages'));
const StudentsPage = lazy(() => import('@/pages/MainSuperAdmin/Students'));
const ClassesPage = lazy(() => import('@/pages/MainSuperAdmin/Classes'));
const CRsPage = lazy(() => import('@/pages/MainSuperAdmin/CRs'));
const SubAdminsPage = lazy(() => import('@/pages/MainSuperAdmin/SubAdmins'));
const PrincipalsPage = lazy(() => import('@/pages/MainSuperAdmin/Principals'));
const ActivityLogsPage = lazy(() => import('@/pages/MainSuperAdmin/ActivityLogs'));
const SettingsPage = lazy(() => import('@/pages/MainSuperAdmin/Settings'));
const AdminReportsPage = lazy(() => import('@/pages/MainSuperAdmin/Reports'));
const AttendanceRecordsPage = lazy(() => import('@/pages/MainSuperAdmin/AttendanceRecords'));
const CrAccountsPage = lazy(() => import('@/pages/MainSuperAdmin/CrAccounts'));
const StudentAccountsPage = lazy(() => import('@/pages/MainSuperAdmin/StudentAccounts'));
const LoginSessionsPage = lazy(() => import('@/pages/MainSuperAdmin/LoginSessions'));
const ReportBrandingPage = lazy(() => import('@/pages/MainSuperAdmin/ReportBranding'));
const StatisticsPage = lazy(() => import('@/pages/MainSuperAdmin/Statistics'));
const ProfilePage = lazy(() => import('@/pages/Profile'));
const AnnouncementsPage = lazy(() => import('@/pages/Announcements'));
const ConcernsPage = lazy(() => import('@/pages/Concerns'));

const SubAdminDashboard = lazy(() => import('@/pages/SubAdmin/Dashboard'));

const PrincipalDashboard = lazy(() => import('@/pages/Principal/Dashboard'));

const CrDashboard = lazy(() => import('@/pages/CR/Dashboard'));
const TakeAttendance = lazy(() => import('@/pages/CR/TakeAttendance'));
const ScanAttendance = lazy(() => import('@/pages/CR/ScanAttendance'));
const AttendanceHistory = lazy(() => import('@/pages/CR/AttendanceHistory'));
const MyStudents = lazy(() => import('@/pages/CR/MyStudents'));
const Concerns = lazy(() => import('@/pages/CR/Concerns'));
const CrReports = lazy(() => import('@/pages/CR/Reports'));
const QuickReport = lazy(() => import('@/pages/CR/QuickReport'));

const StudentDashboard = lazy(() => import('@/pages/Student/Dashboard'));
const StudentAttendance = lazy(() => import('@/pages/Student/Attendance'));
const StudentRaiseQuery = lazy(() => import('@/pages/Student/RaiseQuery'));
const StudentMyQueries = lazy(() => import('@/pages/Student/MyQueries'));
const StudentProfile = lazy(() => import('@/pages/Student/Profile'));

// Public college website (lazy-loaded so portal users and visitors only download what they use)
const PublicAbout = lazy(() => import('@/public/pages/About'));
const PublicAcademics = lazy(() => import('@/public/pages/Academics'));
const PublicFaculty = lazy(() => import('@/public/pages/Faculty'));
const PublicAdmissions = lazy(() => import('@/public/pages/Admissions'));
const PublicApply = lazy(() => import('@/public/pages/Apply'));
const PublicStudentLife = lazy(() => import('@/public/pages/StudentLife'));
const PublicNews = lazy(() => import('@/public/pages/News'));
const PublicNewsDetail = lazy(() => import('@/public/pages/NewsDetail'));
const PublicGallery = lazy(() => import('@/public/pages/Gallery'));
const PublicGalleryAlbum = lazy(() => import('@/public/pages/GalleryAlbum'));
const PublicAsk = lazy(() => import('@/public/pages/AskQuestion'));
const PublicTrackApp = lazy(() => import('@/public/pages/TrackApplication'));
const PublicTrack = lazy(() => import('@/public/pages/TrackQuery'));
const PublicContact = lazy(() => import('@/public/pages/Contact'));

export default function App() {
  const { session, profile, loading } = useAuth();
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname}>
    <Suspense fallback={<div className="flex h-screen items-center justify-center gap-2.5 bg-[var(--bg)] text-sm font-medium text-[var(--text-2)]" role="status"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#DCE4F0] border-t-brand-600" aria-hidden="true" />Loading…</div>}>
    <Routes>
      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicHome />} />
        <Route path="/home" element={<PublicHome />} />
        <Route path="/about" element={<PublicAbout />} />
        <Route path="/academics" element={<PublicAcademics />} />
        <Route path="/faculty" element={<PublicFaculty />} />
        <Route path="/admissions" element={<PublicAdmissions />} />
        <Route path="/admissions/apply" element={<PublicApply />} />
        <Route path="/student-life" element={<PublicStudentLife />} />
        <Route path="/news" element={<PublicNews />} />
        <Route path="/news/:id" element={<PublicNewsDetail />} />
        <Route path="/gallery" element={<PublicGallery />} />
        <Route path="/gallery/:id" element={<PublicGalleryAlbum />} />
        <Route path="/ask" element={<PublicAsk />} />
        <Route path="/admissions/status" element={<PublicTrackApp />} />
        <Route path="/ask/track" element={<PublicTrack />} />
        <Route path="/contact" element={<PublicContact />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />

      {/* Main Super Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><MainDashboard /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN']}><StudentsPage /></ProtectedRoute>} />
      <Route path="/admin/faculty" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN', 'PRINCIPAL']}><FacultyPage /></ProtectedRoute>} />
      <Route path="/admin/website" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN', 'PRINCIPAL']}><WebsiteContentPage /></ProtectedRoute>} />
      <Route path="/admin/website-settings" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><WebsiteSettingsPage /></ProtectedRoute>} />
      <Route path="/admin/admissions" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN', 'PRINCIPAL']}><AdmissionsPage /></ProtectedRoute>} />
      <Route path="/admin/messages" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN', 'PRINCIPAL']}><MessagesPage /></ProtectedRoute>} />
      <Route path="/admin/classes" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN']}><ClassesPage /></ProtectedRoute>} />
      <Route path="/admin/crs" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN']}><CRsPage /></ProtectedRoute>} />
      <Route path="/admin/cr-accounts" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><CrAccountsPage /></ProtectedRoute>} />
      <Route path="/admin/student-accounts" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><StudentAccountsPage /></ProtectedRoute>} />
      <Route path="/admin/login-sessions" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><LoginSessionsPage /></ProtectedRoute>} />
      <Route path="/admin/sub-admins" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><SubAdminsPage /></ProtectedRoute>} />
      <Route path="/admin/principals" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><PrincipalsPage /></ProtectedRoute>} />
      {/* Logs are Main Super Admin only — Sub Super Admins and Principals never see them. */}
      <Route path="/admin/logs" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><ActivityLogsPage /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN']}><SettingsPage /></ProtectedRoute>} />
      {/* Reports & Statistics follow the reporting hierarchy: everyone who outranks someone can report on them. */}
      <Route path="/admin/attendance" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'PRINCIPAL', 'SUB_SUPER_ADMIN']}><AttendanceRecordsPage /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'PRINCIPAL', 'SUB_SUPER_ADMIN']}><AdminReportsPage /></ProtectedRoute>} />
      <Route path="/admin/statistics" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'PRINCIPAL', 'SUB_SUPER_ADMIN']}><StatisticsPage /></ProtectedRoute>} />
      <Route path="/admin/report-branding" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'SUB_SUPER_ADMIN']}><ReportBrandingPage /></ProtectedRoute>} />

      {/* Profile — every authenticated role */}
      <Route path="/profile" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'PRINCIPAL', 'SUB_SUPER_ADMIN', 'CR']}><ProfilePage /></ProtectedRoute>} />

      {/* Announcements — every authenticated role (inbox for all; compose/sent only where the hierarchy allows it) */}
      <Route path="/announcements" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'PRINCIPAL', 'SUB_SUPER_ADMIN', 'CR']}><AnnouncementsPage /></ProtectedRoute>} />

      {/* Concerns — every authenticated role (raise/view own always; manage where permitted) */}
      <Route path="/concerns" element={<ProtectedRoute roles={['MAIN_SUPER_ADMIN', 'PRINCIPAL', 'SUB_SUPER_ADMIN', 'CR']}><ConcernsPage /></ProtectedRoute>} />

      {/* Principal — read-only oversight, no management, no logs */}
      <Route path="/principal" element={<ProtectedRoute roles={['PRINCIPAL']}><PrincipalDashboard /></ProtectedRoute>} />

      {/* Sub Super Admin */}
      <Route path="/sub-admin" element={<ProtectedRoute roles={['SUB_SUPER_ADMIN']}><SubAdminDashboard /></ProtectedRoute>} />

      {/* Class Representative */}
      <Route
        element={
          <ProtectedRoute roles={['CR']}>
            <CrAssignmentProvider>
              <Outlet />
            </CrAssignmentProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/cr" element={<CrDashboard />} />
        <Route path="/cr/attendance/take" element={<TakeAttendance />} />
        <Route path="/cr/attendance/scan" element={<ScanAttendance />} />
        <Route path="/cr/attendance/history" element={<AttendanceHistory />} />
        <Route path="/cr/students" element={<MyStudents />} />
        <Route path="/cr/concerns" element={<Concerns />} />
        <Route path="/cr/quick-report" element={<QuickReport />} />
        <Route path="/cr/reports" element={<CrReports />} />
      </Route>

      {/* Student Portal — completely separate navigation from every administrative role */}
      <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute roles={['STUDENT']}><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/raise-query" element={<ProtectedRoute roles={['STUDENT']}><StudentRaiseQuery /></ProtectedRoute>} />
      <Route path="/student/queries" element={<ProtectedRoute roles={['STUDENT']}><StudentMyQueries /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute roles={['STUDENT']}><StudentProfile /></ProtectedRoute>} />

      {/* Role-based redirect to the signed-in user's own dashboard (previously served at "/") */}
      <Route
        path="/dashboard"
        element={
          loading ? null : !session || !profile ? (
            <Navigate to="/login" replace />
          ) : profile.role === 'MAIN_SUPER_ADMIN' ? (
            <Navigate to="/admin" replace />
          ) : profile.role === 'PRINCIPAL' ? (
            <Navigate to="/principal" replace />
          ) : profile.role === 'SUB_SUPER_ADMIN' ? (
            <Navigate to="/sub-admin" replace />
          ) : profile.role === 'STUDENT' ? (
            <Navigate to="/student" replace />
          ) : (
            <Navigate to="/cr" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
