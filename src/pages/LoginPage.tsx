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
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Left — branding panel (hidden on small screens) */}
      <div className="relative isolate hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div className="bg-grid-dark absolute inset-0 -z-10" aria-hidden="true" />
        <div className="absolute -bottom-32 -right-24 -z-10 h-96 w-96 rounded-full bg-brand-500 opacity-30 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <div className="glass-dark flex h-11 w-11 items-center justify-center rounded-xl">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Aspire Group of Colleges</p>
            <p className="text-xs text-slate-300">Taunsa Sharif</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display text-h1">
            College Management<br />Portal
          </h1>
          <p className="mt-5 max-w-sm leading-relaxed text-white/75">
            Secure sign-in for the administration, the Principal, teachers and class representatives, and students of Aspire Group of Colleges.
          </p>
          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h.text} className="glass-dark flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">{h.icon}</span>
                {h.text}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/55">
          Authorised users only. Choose your portal from the menu on the college website.
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex w-full flex-1 items-center justify-center p-5 sm:p-8 lg:w-1/2">
        <div className="surface w-full max-w-md p-6 shadow-float sm:p-8">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-800 font-display text-2xl font-extrabold text-white shadow-card">
              A
            </div>
            <h1 className="font-display text-xl font-extrabold text-ink-900">College Management Portal</h1>
            <p className="text-xs text-[var(--text-2)]">Aspire Group of Colleges, Taunsa Sharif</p>
          </div>

          {mode === 'signIn' ? (
            <>
              <Link to="/" className="mb-5 inline-flex min-h-[2.5rem] items-center gap-1 text-sm font-semibold text-[var(--text-2)] hover:text-ink-900">
                <ArrowLeft size={15} /> Back to website
              </Link>
              <div className="mb-5">
                <h2 className="font-display text-2xl font-extrabold text-ink-900">{chosen ? `${chosen.label} sign in` : 'Welcome back'}</h2>
                <p className="mt-1.5 text-sm text-[var(--text-2)]">
                  {chosen ? `${chosen.blurb}.` : 'Sign in with the account your admin created for you.'}
                </p>
              </div>

              {chosen && (
                <div className="mb-6">
                  <label htmlFor="portal-role" className="mb-1.5 block text-xs font-semibold tracking-wide text-[var(--text-2)]">Signing in as</label>
                  <select
                    id="portal-role"
                    value={chosen.key}
                    onChange={(e) => setParams({ as: e.target.value })}
                    className="w-full rounded-lg border border-[#CBD5E4] bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none hover:border-[#AEBBD0] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20"
                  >
                    {PORTAL_ROLES.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {!chosen && (
              <div className="mb-6 flex rounded-xl bg-[#EEF2F9] p-1 text-sm font-semibold" role="group" aria-label="Login type">
                <button
                  type="button"
                  onClick={() => setPortal('staff')}
                  aria-pressed={portal === 'staff'}
                  className={`flex-1 rounded-lg py-2.5 transition ${portal === 'staff' ? 'bg-white text-ink-900 shadow-soft' : 'text-[var(--text-2)]'}`}
                >
                  Staff / CR Login
                </button>
                <button
                  type="button"
                  onClick={() => setPortal('student')}
                  aria-pressed={portal === 'student'}
                  className={`flex-1 rounded-lg py-2.5 transition ${portal === 'student' ? 'bg-white text-ink-900 shadow-soft' : 'text-[var(--text-2)]'}`}
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
                        className="mb-1.5 text-xs font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline"
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
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[#EEF2F9] hover:text-ink-900"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {portal === 'student' && (
                    <p className="mt-1.5 text-xs text-[var(--text-2)]">
                      Forgot your password? Ask your Main Super Admin to reset it — student passwords can't be reset by email.
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Sign In'}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-[var(--text-2)]">
                For security, you'll be signed out automatically after 15 minutes of inactivity.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setMode('signIn')}
                className="mb-5 inline-flex min-h-[2.5rem] items-center gap-1 text-sm font-semibold text-[var(--text-2)] hover:text-ink-900"
              >
                <ArrowLeft size={15} /> Back to sign in
              </button>

              {!resetSent ? (
                <>
                  <h2 className="font-display text-2xl font-extrabold text-ink-900">Reset your password</h2>
                  <p className="mt-1.5 text-sm text-[var(--text-2)]">Enter your account email and we'll send you a reset link.</p>
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
                <div className="rounded-xl border border-[#BFE3D2] bg-[#E3F4EC] p-5 text-sm text-[#0D5A3E]">
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
