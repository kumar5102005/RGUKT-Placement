import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Building2, CheckCircle2, XCircle, Clock, Search, Filter,
  Users, MapPin, Mail, Phone, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, RefreshCw, UserPlus, Trash2, Eye, Globe
} from 'lucide-react';

const API_BASE = '/api/v1/drives';

const INDUSTRIES = [
  '', 'IT Services', 'Software Product', 'Core Engineering', 'Banking & Finance',
  'Consulting', 'Healthcare', 'E-Commerce', 'Manufacturing',
  'Telecommunications', 'Education & Ed-Tech', 'Government & PSU',
  'Research & Development', 'Other',
];

function StatusBadge({ status }) {
  const map = {
    PENDING: { cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Pending' },
    VERIFIED: { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Verified' },
    REJECTED: { cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30', label: 'Rejected' },
  };
  const cfg = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Company Detail Modal ─────────────────────────────────────────────────────
function CompanyModal({ company, onClose, onVerify, onAddRecruiter, onRemoveRecruiter, token }) {
  const [verifyForm, setVerifyForm] = useState({ status: 'VERIFIED', notes: '' });
  const [recruiterForm, setRecruiterForm] = useState({ userId: '', fullName: '', email: '', role: 'SECONDARY' });
  const [verifying, setVerifying] = useState(false);
  const [addingRecruiter, setAddingRecruiter] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [showRecruiterForm, setShowRecruiterForm] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  async function handleVerify() {
    if (!verifyForm.status) return;
    setVerifying(true);
    setActionError('');
    try {
      const res = await fetch(`${API_BASE}/${company._id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: verifyForm.status, notes: verifyForm.notes }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(data.message);
        onVerify(data.data.company);
        setShowVerifyForm(false);
        setTimeout(() => setActionMsg(''), 4000);
      } else {
        setActionError(data.error?.message || 'Verification failed.');
      }
    } catch {
      setActionError('Network error.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleAddRecruiter() {
    if (!recruiterForm.userId || !recruiterForm.fullName || !recruiterForm.email) {
      setActionError('UserId, Full Name, and Email are required.');
      return;
    }
    setAddingRecruiter(true);
    setActionError('');
    try {
      const res = await fetch(`${API_BASE}/${company._id}/recruiters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(recruiterForm),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Recruiter added successfully.');
        onAddRecruiter(data.data.company);
        setShowRecruiterForm(false);
        setRecruiterForm({ userId: '', fullName: '', email: '', role: 'SECONDARY' });
        setTimeout(() => setActionMsg(''), 4000);
      } else {
        setActionError(data.error?.message || 'Failed to add recruiter.');
      }
    } catch {
      setActionError('Network error.');
    } finally {
      setAddingRecruiter(false);
    }
  }

  async function handleRemoveRecruiter(recruiterId) {
    try {
      const res = await fetch(`${API_BASE}/${company._id}/recruiters/${recruiterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Recruiter removed.');
        onRemoveRecruiter(data.data.company);
        setTimeout(() => setActionMsg(''), 3000);
      } else {
        setActionError(data.error?.message || 'Failed to remove recruiter.');
      }
    } catch {
      setActionError('Network error.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-lg font-bold text-white">{company.name}</h2>
            <p className="text-sm text-slate-400">{company.industry}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={company.verificationStatus} />
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {actionMsg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-4 py-2 text-sm">{actionMsg}</div>}
          {actionError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-4 py-2 text-sm">{actionError}</div>}

          {/* Company Info */}
          <div className="space-y-2 text-sm">
            {company.description && <p className="text-slate-300">{company.description}</p>}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {company.contactEmail && <div className="flex items-center gap-2 text-slate-400"><Mail className="w-3.5 h-3.5" />{company.contactEmail}</div>}
              {company.contactPhone && <div className="flex items-center gap-2 text-slate-400"><Phone className="w-3.5 h-3.5" />{company.contactPhone}</div>}
              {company.hrName && <div className="flex items-center gap-2 text-slate-400"><Users className="w-3.5 h-3.5" />HR: {company.hrName}</div>}
              {company.websiteUrl && (
                <a href={company.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-400 hover:underline">
                  <Globe className="w-3.5 h-3.5" />Website
                </a>
              )}
              {company.location?.city && (
                <div className="flex items-center gap-2 text-slate-400"><MapPin className="w-3.5 h-3.5" />{company.location.city}, {company.location.state}</div>
              )}
            </div>
            {company.verificationNotes && (
              <div className="mt-2 p-3 bg-slate-800 rounded-lg text-xs text-slate-400 italic">
                Admin note: {company.verificationNotes}
              </div>
            )}
          </div>

          {/* Verification Actions */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Verification</h3>
              <button
                onClick={() => setShowVerifyForm(!showVerifyForm)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                {showVerifyForm ? 'Cancel' : 'Change Status'}
              </button>
            </div>
            {showVerifyForm && (
              <div className="space-y-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700">
                <select
                  value={verifyForm.status}
                  onChange={e => setVerifyForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="VERIFIED">Verify</option>
                  <option value="REJECTED">Reject</option>
                </select>
                <textarea
                  value={verifyForm.notes}
                  onChange={e => setVerifyForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes (max 500 chars)..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                    verifyForm.status === 'VERIFIED'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  } disabled:opacity-60`}
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : (verifyForm.status === 'VERIFIED' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
                  {verifying ? 'Saving...' : (verifyForm.status === 'VERIFIED' ? 'Verify Company' : 'Reject Company')}
                </button>
              </div>
            )}
          </div>

          {/* Recruiters */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Recruiters ({company.recruiters?.length || 0})</h3>
              <button
                onClick={() => setShowRecruiterForm(!showRecruiterForm)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />{showRecruiterForm ? 'Cancel' : 'Add Recruiter'}
              </button>
            </div>

            {showRecruiterForm && (
              <div className="space-y-2 p-4 bg-slate-800/60 rounded-xl border border-slate-700 mb-3">
                <input
                  value={recruiterForm.userId}
                  onChange={e => setRecruiterForm(f => ({ ...f, userId: e.target.value }))}
                  placeholder="User ID (from Auth Service)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <input
                  value={recruiterForm.fullName}
                  onChange={e => setRecruiterForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Recruiter Full Name"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <input
                  value={recruiterForm.email}
                  onChange={e => setRecruiterForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Recruiter Email"
                  type="email"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={recruiterForm.role}
                  onChange={e => setRecruiterForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="SECONDARY">Secondary</option>
                  <option value="PRIMARY">Primary</option>
                </select>
                <button
                  onClick={handleAddRecruiter}
                  disabled={addingRecruiter}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {addingRecruiter ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {addingRecruiter ? 'Adding...' : 'Add Recruiter'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {company.recruiters?.length === 0 && (
                <p className="text-sm text-slate-500 italic">No recruiters associated yet.</p>
              )}
              {company.recruiters?.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.fullName}</p>
                    <p className="text-xs text-slate-500">{r.email} • {r.userId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${r.role === 'PRIMARY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{r.role}</span>
                    <button
                      onClick={() => handleRemoveRecruiter(r.userId)}
                      className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                      title="Remove recruiter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminCompanyManagement() {
  const { token } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [filters, setFilters] = useState({
    q: '', industry: '', verificationStatus: '', page: 1,
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.industry) params.set('industry', filters.industry);
      if (filters.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
      params.set('page', filters.page);
      params.set('limit', '10');

      const res = await fetch(`${API_BASE}?${params.toString()}`, { headers: headers() });
      const data = await res.json();

      if (res.ok) {
        setCompanies(data.data.companies);
        setPagination(data.data.pagination);
      } else {
        setError(data.error?.message || 'Failed to load companies.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, headers]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  function handleFilterChange(key, value) {
    setFilters(f => ({ ...f, [key]: value, page: 1 }));
  }

  function handleVerify(updatedCompany) {
    setCompanies(cs => cs.map(c => c._id === updatedCompany._id ? updatedCompany : c));
    setSelectedCompany(updatedCompany);
  }

  function handleRecruiterUpdate(updatedCompany) {
    setCompanies(cs => cs.map(c => c._id === updatedCompany._id ? updatedCompany : c));
    setSelectedCompany(updatedCompany);
  }

  const statusCounts = companies.reduce((acc, c) => {
    acc[c.verificationStatus] = (acc[c.verificationStatus] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-emerald-400" />
          Company Management
        </h1>
        <p className="text-slate-400 text-sm mt-1">Verify and manage company registrations.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', count: statusCounts.PENDING || 0, icon: Clock, cls: 'text-amber-400' },
          { label: 'Verified', count: statusCounts.VERIFIED || 0, icon: CheckCircle2, cls: 'text-emerald-400' },
          { label: 'Rejected', count: statusCounts.REJECTED || 0, icon: XCircle, cls: 'text-rose-400' },
        ].map(({ label, count, icon: Icon, cls }) => (
          <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${cls}`} />
            <div>
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={filters.q}
            onChange={e => handleFilterChange('q', e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={filters.industry}
          onChange={e => handleFilterChange('industry', e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Industries</option>
          {INDUSTRIES.filter(Boolean).map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
        <select
          value={filters.verificationStatus}
          onChange={e => handleFilterChange('verificationStatus', e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button onClick={fetchCompanies} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm flex items-center gap-2 transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No companies found.</p>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60">
                <th className="text-left px-4 py-3 font-medium text-slate-300">Company</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 hidden md:table-cell">Industry</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300 hidden sm:table-cell">Location</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-300">Recruiters</th>
                <th className="text-right px-4 py-3 font-medium text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, i) => (
                <tr key={company._id} className={`border-b border-slate-800 hover:bg-slate-800/40 transition ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-200">{company.name}</p>
                    <p className="text-xs text-slate-500">{company.contactEmail}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-400">{company.industry}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-400">
                    {company.location?.city ? `${company.location.city}, ${company.location.state}` : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={company.verificationStatus} /></td>
                  <td className="px-4 py-3 text-slate-400">{company.recruiters?.length || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedCompany(company)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Total: {pagination.total} companies · Page {filters.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              disabled={filters.page <= 1}
              className="p-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-300">{filters.page} / {pagination.totalPages}</span>
            <button
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              disabled={filters.page >= pagination.totalPages}
              className="p-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          token={token}
          onClose={() => setSelectedCompany(null)}
          onVerify={handleVerify}
          onAddRecruiter={handleRecruiterUpdate}
          onRemoveRecruiter={handleRecruiterUpdate}
        />
      )}
    </div>
  );
}

