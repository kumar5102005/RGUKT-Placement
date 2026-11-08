import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Users, Shield, AlertCircle, CheckCircle, Ban, RefreshCw } from 'lucide-react';

export default function AdminUserManagement() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (data.success && data.data?.users) {
        setUsers(data.data.users);
      } else {
        setError(data.error?.message || 'Failed to fetch users');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to auth service');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(userId, newStatus) {
    setActionMessage('');
    try {
      const res = await fetch(`/api/v1/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`✓ User status updated to ${newStatus}`);
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? { ...u, status: newStatus } : u))
        );
      } else {
        setError(data.error?.message || 'Failed to update user status');
      }
    } catch (err) {
      setError(err.message || 'Error executing status update');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>User & Account Management</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Admin console for managing accounts, reviewing student IDs, and toggling account statuses.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh List</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading user records...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No user accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Identifier / Org</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>{u.fullName}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700 text-slate-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {u.studentId || u.companyName || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : u.status === 'SUSPENDED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {u.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleStatusChange(u._id, 'SUSPENDED')}
                          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition text-[11px]"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(u._id, 'ACTIVE')}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition text-[11px]"
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

