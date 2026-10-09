/** Shown instead of a blank page when the site was built without its Supabase settings. */
export default function ConfigError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div role="alert" className="max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">This website is not configured yet</h1>
        <p className="mt-3 text-sm text-slate-600">
          The site could not find the settings it needs to connect to its database, so it cannot load.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          <strong>Administrator:</strong> add <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> to the hosting environment variables,
          then trigger a new deploy. These values are read when the site is built, so changing them without redeploying
          has no effect.
        </p>
      </div>
    </main>
  );
}
