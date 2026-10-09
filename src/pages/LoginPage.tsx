import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, GraduationCap, ClipboardCheck, MessageSquareWarning, FileBarChart, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Label, Spinner } from '@/components/ui';
import { CreditBox } from '@/components/CreditBox';
import { supabase } from '@/lib/supabase';
import { resolveStudentLoginEmail } from '@/services/studentAuth';
import { PORTAL_ROLES, portalFromKey, portalHomeForRole } from '@/lib/portalRoles';

const HIGHLIGHTS = [
  { icon: <ClipboardCheck size={18} />, text: 'Admissions, students and classes in one place' },
  { icon: <MessageSquareWarning size={18} />, text: 'Attendance and student concerns through CR Connect' },
  { icon: <FileBarChart size={18} />, text: 'Reports for the administration and the Principal' },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Arriving from the website's Portal Login menu selects a specific role (?as=...).
  const chosen = portalFromKey(params.get('as'));
  const [tab, setPortal] = useState<'staff' | 'student'>('staff');
  const portal: 'staff' | 'student' = chosen ? chosen.kind : tab;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<'signIn' | 'forgot'>('signIn');

  // Switching role starts with a clean form (staff use an email, students a Student ID).
  useEffect(() => {
    setEmail('');
    setPassword('');
    setMode('signIn');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.key]);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const loginEmail = portal === 'student' ? resolveStudentLoginEmail(email) : email;
    const { error } = await signIn(loginEmail, password);
    if (error) {
      // Never confirms or denies whether a given username/email exists —
      // same message either way.
      toast.error(portal === 'student' ? 'Incorrect Student ID or password.' : error);
      setLoading(false);
      return;
    }

    // Fetch the freshly-authenticated user's profile to determine the
    // actual role from the database — never from client-side selection.
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user!.id)
      .single();

    setLoading(false);

    if (profileErr || !profile) {
      toast.error('No profile found for this account. Contact the Main Super Admin.');
      return;
    }
    if (!profile.is_active) {
      toast.error('Your account has been deactivated. Contact the Main Super Admin.');
      await supabase.auth.signOut();
      return;
    }

    // If a specific portal was chosen, the account's real role (from the database) must match it.
    if (chosen && profile.role !== chosen.role) {
      await supabase.auth.signOut();
      toast.error(`This account is not a ${chosen.label} account. Please choose the correct portal from the menu.`);
      return;
    }

    toast.success('Welcome back!');
    navigate(portalHomeForRole(profile.role));
  }

  async function handleResetRequest(e: FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '/login',
    });
    setResetSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left — branding panel (hidden on small screens) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Aspire Group of Colleges</p>
            <p className="text-xs text-slate-300">Taunsa Sharif</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">
            College Management<br />Portal
          </h1>
          <p className="mt-4 max-w-sm text-sm text-slate-300">
            Secure sign-in for the administration, the Principal, teachers and class representatives, and students of Aspire Group of Colleges.
          </p>
          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h.text} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">{h.icon}</span>
                {h.text}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-400">
          Authorised users only. Choose your portal from the menu on the college website.
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-extrabold text-white shadow-card">
              A
            </div>
            <h1 className="text-xl font-extrabold text-ink-900">College Management Portal</h1>
            <p className="text-xs text-slate-400">Aspire Group of Colleges, Taunsa Sharif</p>
          </div>

          {mode === 'signIn' ? (
            <>
              <Link to="/" className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
                <ArrowLeft size={15} /> Back to website
              </Link>
              <div className="mb-5">
                <h2 className="text-2xl font-extrabold text-ink-900">{chosen ? `${chosen.label} sign in` : 'Welcome back'}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {chosen ? `${chosen.blurb}.` : 'Sign in with the account your admin created for you.'}
                </p>
              </div>

              {chosen && (
                <div className="mb-6">
                  <label htmlFor="portal-role" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Signing in as</label>
                  <select
                    id="portal-role"
                    value={chosen.key}
                    onChange={(e) => setParams({ as: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  >
                    {PORTAL_ROLES.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {!chosen && (
              <div className="mb-6 flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setPortal('staff')}
                  className={`flex-1 rounded-lg py-2 transition ${portal === 'staff' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500'}`}
                >
                  Staff / CR Login
                </button>
                <button
                  type="button"
                  onClick={() => setPortal('student')}
                  className={`flex-1 rounded-lg py-2 transition ${portal === 'student' ? 'bg-white text-ink-900 shadow-soft' : 'text-slate-500'}`}
                >
                  Student Login
                </button>
              </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{portal === 'student' ? 'Student ID / Username' : 'Email'}</Label>
                  <Input
                    type={portal === 'student' ? 'text' : 'email'}
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={portal === 'student' ? 'STU-26-0001280' : 'name@example.com'}
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>Password</Label>
                    {portal === 'staff' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setResetEmail(email); setResetSent(false); }}
                        className="mb-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {portal === 'student' && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      Forgot your password? Ask your Main Super Admin to reset it — student passwords can't be reset by email.
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Sign In'}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-400">
                For security, you'll be signed out automatically after 15 minutes of inactivity.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setMode('signIn')}
                className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft size={15} /> Back to sign in
              </button>

              {!resetSent ? (
                <>
                  <h2 className="text-xl font-extrabold text-ink-900">Reset your password</h2>
                  <p className="mt-1 text-sm text-slate-500">Enter your account email and we'll send you a reset link.</p>
                  <form onSubmit={handleResetRequest} className="mt-5 space-y-4">
                    <div>
                      <Label>Email</Label>
                      <Input type="email" required autoFocus value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="name@example.com" />
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={resetSending}>
                      {resetSending ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Send Reset Link'}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                  If an account exists for <span className="font-semibold">{resetEmail}</span>, a password reset link has been sent. Check your inbox (and spam folder).
                </div>
              )}
            </>
          )}

          <CreditBox className="mt-10" />
        </div>
      </div>
    </div>
  );
}
