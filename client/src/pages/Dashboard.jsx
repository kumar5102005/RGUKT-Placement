import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import {
  User,
  Shield,
  Briefcase,
  CheckCircle,
  Clock,
  RefreshCw,
  LogOut,
  Users,
  FileText,
  ExternalLink,
  Building2,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function Dashboard() {
  const { user, accessToken, logout, refreshSession } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage('');
    try {
      const ok = await refreshSession();
      if (ok) {
        setRefreshMessage('✓ Access token refreshed successfully via rotation!');
      } else {
        setRefreshMessage('✗ Failed to refresh token. Session might be expired.');
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-800 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Role: {user?.role}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Status: {user?.status}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Welcome back, {user?.fullName}!</h2>
          <p className="text-sm text-slate-300 mt-1">
            {user?.email} {user?.studentId && `• RGUKT ID: ${user.studentId}`} {user?.companyName && `• ${user.companyName}`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/20 text-xs font-medium transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {refreshMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {refreshMessage}
        </div>
      )}

      {/* Role-Specific Content */}
      {user?.role === 'STUDENT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Student Placement Status</h3>
            <Link
              to="/profile"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <User className="w-3.5 h-3.5" />
              <span>Manage Student Profile</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">APPLICATION STATUS</span>
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">Active</div>
              <p className="text-xs text-slate-400">Student Profile verified for current academic year</p>
            </div>

            <Link
              to="/drives"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 rounded-xl p-5 space-y-3 transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">PLACEMENT DRIVES</span>
                  <Calendar className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white group-hover:text-emerald-400 transition">Campus Drives →</div>
                <p className="text-xs text-slate-400 mt-1">Register for campus hiring drives &amp; track Aptitude, Technical &amp; HR interview stages</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
                <span>View Scheduled Drives</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">PROFILE COMPLETION</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <Link to="/profile" className="text-2xl font-bold text-emerald-400 hover:underline">
                View & Edit →
              </Link>
              <p className="text-xs text-slate-400">Keep resume and academics updated for drive cutoffs</p>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'ADMIN' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>TPO Administration Console</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/admin/students"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Users className="w-6 h-6 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white">Student Directory &amp; Verification</h4>
                <p className="text-xs text-slate-400 mt-1">Search candidate database, verify profiles, filter by CGPA/branch/backlogs, inspect resumes.</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Access Student Directory</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              to="/admin/companies"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Building2 className="w-6 h-6 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white">Company Verification</h4>
                <p className="text-xs text-slate-400 mt-1">Review company registrations, verify recruiters, approve/reject companies, manage recruiter associations.</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Manage Companies</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              to="/admin/users"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Shield className="w-6 h-6 text-indigo-400 mb-2" />
                <h4 className="font-semibold text-white">User &amp; Account Management</h4>
                <p className="text-xs text-slate-400 mt-1">Review registrations, toggle statuses (Active, Suspended), verify roles.</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Manage Users</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              to="/recruiter/jobs"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Briefcase className="w-6 h-6 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white">Drive &amp; Job Management</h4>
                <p className="text-xs text-slate-400 mt-1">Configure recruitment drives, customizable eligibility rules, and selection round pipelines.</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Manage Drives</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              to="/drives"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Calendar className="w-6 h-6 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white">Drive Scheduling &amp; Rounds</h4>
                <p className="text-xs text-slate-400 mt-1">Schedule recruitment rounds (Aptitude, Tech, HR), monitor student registrations, and update selection progress.</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Manage Placement Drives</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </div>
      )}

      {user?.role === 'RECRUITER' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            <span>Recruiter Portal</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/company/profile"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Building2 className="w-6 h-6 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white">My Company Profile</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Register your company, manage contact info, location, and await admin verification to post drives.
                </p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Manage Company</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              to="/recruiter/jobs"
              className="bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <Briefcase className="w-6 h-6 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white">Post &amp; Manage Drives</h4>
                <p className="text-xs text-slate-400 mt-1">Create placement drives, set configurable cutoff criteria, and manage campus recruitment rounds.</p>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1 mt-4">
                <span>Manage Postings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>

            <div className="bg-slate-800/60 border border-slate-700/60 p-5 rounded-xl flex flex-col justify-between opacity-60">
              <div>
                <Users className="w-6 h-6 text-cyan-400 mb-2" />
                <h4 className="font-semibold text-white">Applicant Review</h4>
                <p className="text-xs text-slate-400 mt-1">Review and shortlist student applications for your placement drives.</p>
              </div>
              <span className="text-xs text-cyan-400 font-medium mt-4">Coming in Phase 7</span>
            </div>
          </div>

          {user?.companyName && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm text-slate-300">
              <span className="text-slate-500">Registered Company: </span>
              <span className="font-medium text-white">{user.companyName}</span>
            </div>
          )}
        </div>
      )}


    </div>
  );
}

