"use client";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Log in to continue.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="label">Username</label>
            <input id="username" name="username" required className="input" />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" name="password" required className="input" />
          </div>

          <button type="submit" className="btn-primary w-full">Log in</button>
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
          Don’t have an account?{" "}
          <Link className="font-medium text-blue-400 hover:underline" href="/register">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}