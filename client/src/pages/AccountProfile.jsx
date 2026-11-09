import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { UserRound } from 'lucide-react';

export default function AccountProfile() {
  const { user } = useAuth();
  const fullName = user?.fullName || user?.name || 'Account';
  const role = user?.role === 'ADMIN' ? 'Admin' : user?.role || 'Account';

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white">My Profile</h2>
        <p className="mt-1 text-sm text-slate-400">Your authenticated account details.</p>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-300">
            <UserRound className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{fullName}</h3>
            <p className="text-sm text-slate-400">{role}</p>
          </div>
        </div>
        <dl className="grid gap-4 border-t border-slate-700 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Full name</dt>
            <dd className="mt-1 text-sm text-slate-200">{fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 break-all text-sm text-slate-200">{user?.email || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Role</dt>
            <dd className="mt-1 text-sm text-slate-200">{role}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
