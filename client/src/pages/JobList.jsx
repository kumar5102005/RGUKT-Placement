import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Briefcase, Search, Filter, MapPin, DollarSign, Calendar,
  Clock, CheckCircle2, ChevronRight, ChevronLeft, Loader2,
  Building2, Tag, AlertCircle, Plus, RefreshCw, Award
} from 'lucide-react';

const API_BASE = '/api/v1/jobs';

const BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME'];
const ROLE_CATEGORIES = ['Full-Time', 'Internship', 'Internship + PPO', 'Contract'];
const WORKPLACE_TYPES = ['On-site', 'Hybrid', 'Remote'];

export default function JobList() {
  const { user, token, apiFetch } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1 });

  // Filters state
  const [filters, setFilters] = useState({
    q: '',
    branch: '',
    roleCategory: '',
    workplaceType: '',
    city: '',
    minCgpa: '',
    minSalary: '',
    page: 1,
  });

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.branch) params.set('branch', filters.branch);
      if (filters.roleCategory) params.set('roleCategory', filters.roleCategory);
      if (filters.workplaceType) params.set('workplaceType', filters.workplaceType);
      if (filters.city) params.set('city', filters.city);
      if (filters.minCgpa) params.set('minCgpa', filters.minCgpa);
      if (filters.minSalary) params.set('minSalary', filters.minSalary);
      params.set('page', filters.page);
      params.set('limit', '9');

      const res = await apiFetch(`${API_BASE}?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setJobs(data.data.jobs || []);
        setPagination(data.data.pagination || { total: 0, totalPages: 1, page: 1 });
      } else {
        setError(data.error?.message || 'Failed to fetch job postings.');
      }
    } catch {
      setError('Network error. Unable to load job listings.');
    } finally {
      setLoading(false);
    }
  }, [filters, headers]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleResetFilters() {
    setFilters({
      q: '',
      branch: '',
      roleCategory: '',
      workplaceType: '',
      city: '',
      minCgpa: '',
      minSalary: '',
      page: 1,
    });
  }

  function formatDeadline(dateStr) {
    if (!dateStr) return 'No deadline';
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Ends Today';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/40 p-6 rounded-2xl border border-slate-700">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <Award className="w-3.5 h-3.5" /> Campus Recruitment Drives 2025–2026
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Explore Placement Drives &amp; Job Openings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Discover verified campus opportunities, check eligibility against cutoffs, and track deadlines.
          </p>
        </div>

        {(user?.role === 'RECRUITER' || user?.role === 'ADMIN') && (
          <div className="flex items-center gap-3">
            <Link
              to="/recruiter/jobs"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>{user?.role === 'ADMIN' ? 'Manage Job Postings' : 'Post / Manage Jobs'}</span>
            </Link>
          </div>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 space-y-4">
        {/* Main Search Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => handleFilterChange('q', e.target.value)}
              placeholder="Search by job title, company, skills (e.g. React, Java)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchJobs}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handleResetFilters}
              className="px-3 py-2.5 text-xs text-slate-400 hover:text-white transition"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-700/60">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Branch</label>
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Employment Type</label>
            <select
              value={filters.roleCategory}
              onChange={(e) => handleFilterChange('roleCategory', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Types</option>
              {ROLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Workplace</label>
            <select
              value={filters.workplaceType}
              onChange={(e) => handleFilterChange('workplaceType', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Workplaces</option>
              {WORKPLACE_TYPES.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Max Min-CGPA Cutoff</label>
            <select
              value={filters.minCgpa}
              onChange={(e) => handleFilterChange('minCgpa', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Any CGPA Cutoff</option>
              <option value="6.0">≤ 6.0 CGPA</option>
              <option value="7.0">≤ 7.0 CGPA</option>
              <option value="8.0">≤ 8.0 CGPA</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Min Salary (LPA)</label>
            <input
              type="number"
              placeholder="e.g. 6"
              value={filters.minSalary}
              onChange={(e) => handleFilterChange('minSalary', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Jobs Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-sm">Fetching verified job postings...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Job Postings Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            No active recruitment drives match your current search criteria. Try modifying your filters or clearing keywords.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => {
            const deadlineText = formatDeadline(job.applicationDeadline);
            const isEndingSoon = deadlineText.includes('day') || deadlineText === 'Ends Today';

            return (
              <div
                key={job._id}
                className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-5 flex flex-col justify-between transition group shadow-sm hover:shadow-lg hover:shadow-emerald-950/20"
              >
                <div>
                  {/* Top: Company Logo + Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {job.companyLogo ? (
                        <img
                          src={job.companyLogo}
                          alt={job.companyName}
                          className="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-slate-700 p-1.5"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400">
                          <Building2 className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-white text-base group-hover:text-emerald-400 transition leading-snug">
                          {job.title}
                        </h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{job.companyName}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pills: Workplace & Category */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/70 text-slate-300">
                      {job.roleCategory}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {job.workplaceType}
                    </span>
                    {job.locations?.[0] && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {job.locations.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Salary & Package */}
                  <div className="bg-slate-900/60 rounded-xl p-3 mb-3 flex items-center justify-between border border-slate-800">
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">Compensation</p>
                      <p className="text-sm font-semibold text-emerald-400">
                        {job.salary?.maxLpa
                          ? `${job.salary.minLpa ? job.salary.minLpa + ' - ' : ''}${job.salary.maxLpa} LPA`
                          : job.salary?.stipendPerMonth
                          ? `₹${job.salary.stipendPerMonth.toLocaleString()} / mo`
                          : 'As per standard'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">Min CGPA</p>
                      <p className="text-sm font-semibold text-slate-200">
                        {job.eligibility?.minCgpa ? `${job.eligibility.minCgpa} CGPA` : 'Open'}
                      </p>
                    </div>
                  </div>

                  {/* Eligibility snippet */}
                  <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium">Branches:</span>
                      <span className="text-slate-300 truncate">
                        {job.eligibility?.allowedBranches?.slice(0, 4).join(', ') || 'All'}
                        {(job.eligibility?.allowedBranches?.length || 0) > 4 ? ` +${job.eligibility.allowedBranches.length - 4}` : ''}
                      </span>
                    </div>

                    {job.requiredSkills?.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Skills:</span>
                        <div className="flex flex-wrap gap-1">
                          {job.requiredSkills.slice(0, 3).map((s, idx) => (
                            <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] text-emerald-400 border border-slate-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Deadline & Action */}
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock className={`w-3.5 h-3.5 ${isEndingSoon ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                    <span className={isEndingSoon ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                      {deadlineText}
                    </span>
                  </div>

                  <Link
                    to={`/jobs/${job._id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 group-hover:translate-x-0.5 transition"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400">
            Showing Page <span className="font-semibold text-white">{pagination.page}</span> of{' '}
            <span className="font-semibold text-white">{pagination.totalPages}</span> ({pagination.total} jobs total)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange('page', Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-300 px-2">{pagination.page}</span>
            <button
              onClick={() => handleFilterChange('page', Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

