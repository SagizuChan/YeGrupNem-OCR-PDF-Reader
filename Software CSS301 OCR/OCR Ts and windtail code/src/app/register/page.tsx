"use client";

export default function RegisterPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-1 text-sm text-slate-400">Sign up to continue.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="reg-username" className="label">
              Username
            </label>
            <input id="reg-username" name="reg-username" required className="input" placeholder="yourname" />
          </div>

          <div>
            <label htmlFor="reg-email" className="label">
              Email
            </label>
            <input id="reg-email" type="email" name="reg-email" required className="input" placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="reg-password" className="label">
              Password
            </label>
            <input id="reg-password" type="password" name="reg-password" required className="input" placeholder="••••••••" />
          </div>

          <div>
            <label htmlFor="reg-confirm" className="label">
              Confirm password
            </label>
            <input id="reg-confirm" type="password" name="reg-confirm" required className="input" placeholder="••••••••" />
          </div>

          <button type="submit" className="btn-primary w-full">Create account</button>
        </div>

        <div className="my-6 flex items-center gap-3 text-slate-500">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs">or</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" className="btn-secondary">Google</button>
          <button type="button" className="btn-secondary">Facebook</button>
          <button type="button" className="btn-secondary">GitHub</button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-blue-400 hover:underline">Log in</a>
        </p>
      </form>
    </div>
  );
}