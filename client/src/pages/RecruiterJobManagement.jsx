import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Briefcase, Plus, Edit3, Trash2, CheckCircle2, XCircle,
  Clock, AlertCircle, Loader2, Building2, Eye, Calendar,
  DollarSign, MapPin, Tag, RefreshCw, X, ChevronUp, ChevronDown
} from 'lucide-react';

const API_BASE = '/api/v1/jobs';
const COMPANY_API_BASE = '/api/v1/drives';

const ALL_BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME'];
const ROLE_CATEGORIES = ['Full-Time', 'Internship', 'Internship + PPO', 'Contract'];
const WORKPLACE_TYPES = ['On-site', 'Hybrid', 'Remote'];
const ROUND_STATUSES = ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function RecruiterJobManagement() {
  const { user, token } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    roleCategory: 'Full-Time',
    workplaceType: 'On-site',
    locations: 'Ongole, Hyderabad',
    description: '',
    responsibilities: '',
    requirements: '',
    requiredSkills: 'Java, SQL, Data Structures',
    preferredSkills: 'Docker, Spring Boot',
    salaryMinLpa: '6.5',
    salaryMaxLpa: '10.0',
    stipendPerMonth: '0',
    salaryBreakup: 'Base 8.5 LPA + Performance Bonus',
    minCgpa: '7.0',
    allowedBranches: ['CSE', 'ECE', 'EEE'],
    eligibleBatchYears: '2025, 2026',
    maxActiveBacklogs: '0',
    maxHistoryBacklogs: '2',
    minTenthPercentage: '60',
    minTwelfthPucCgpa: '6.0',
    selectionRounds: [
      { roundNumber: 1, name: 'Online Aptitude & Coding Test', mode: 'Online' },
      { roundNumber: 2, name: 'Technical Interview', mode: 'Online' },
      { roundNumber: 3, name: 'HR Interview', mode: 'In-Person' },
    ],
    applicationDeadline: '',
    driveDate: '',
    status: 'ACTIVE',
    companyId: '',
  });

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Load Recruiter's or Admin's Jobs
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = user?.role === 'ADMIN' ? `${API_BASE}?limit=50` : `${API_BASE}/my`;
      const res = await fetch(endpoint, { headers: headers() });
      const data = await res.json();

      if (res.ok) {
        setJobs(data.data?.jobs || []);
      } else {
        setError(data.error?.message || 'Failed to load job postings.');
      }
    } catch {
      setError('Network error. Unable to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [user, headers]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  function resetForm() {
    // Default deadline to 14 days from now
    const defaultDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const deadlineStr = defaultDeadline.toISOString().slice(0, 16);

    setFormData({
      title: '',
      roleCategory: 'Full-Time',
      workplaceType: 'On-site',
      locations: 'Ongole, Hyderabad',
      description: '',
      responsibilities: '',
      requirements: '',
      requiredSkills: 'Java, React, SQL',
      preferredSkills: 'Docker, AWS',
      salaryMinLpa: '6.0',
      salaryMaxLpa: '10.0',
      stipendPerMonth: '0',
      salaryBreakup: '',
      minCgpa: '7.0',
      allowedBranches: ['CSE', 'ECE', 'EEE'],
      eligibleBatchYears: '2025, 2026',
      maxActiveBacklogs: '0',
      maxHistoryBacklogs: '2',
      minTenthPercentage: '60',
      minTwelfthPucCgpa: '6.0',
      selectionRounds: [
        { roundNumber: 1, name: 'Online Aptitude & Coding Test', mode: 'Online' },
        { roundNumber: 2, name: 'Technical Interview', mode: 'Online' },
        { roundNumber: 3, name: 'HR Interview', mode: 'In-Person' },
      ],
      applicationDeadline: deadlineStr,
      driveDate: '',
      status: 'ACTIVE',
      companyId: '',
    });
    setEditingJobId(null);
    setModalError('');
  }

  function handleOpenCreate() {
    resetForm();
    setIsModalOpen(true);
  }

  function handleOpenEdit(job) {
    setEditingJobId(job._id);
    setModalError('');
    setFormData({
      title: job.title || '',
      roleCategory: job.roleCategory || 'Full-Time',
      workplaceType: job.workplaceType || 'On-site',
      locations: job.locations?.join(', ') || '',
      description: job.description || '',
      responsibilities: job.responsibilities?.join('\n') || '',
      requirements: job.requirements?.join('\n') || '',
      requiredSkills: job.requiredSkills?.join(', ') || '',
      preferredSkills: job.preferredSkills?.join(', ') || '',
      salaryMinLpa: String(job.salary?.minLpa ?? ''),
      salaryMaxLpa: String(job.salary?.maxLpa ?? ''),
      stipendPerMonth: String(job.salary?.stipendPerMonth ?? '0'),
      salaryBreakup: job.salary?.breakup || '',
      minCgpa: String(job.eligibility?.minCgpa ?? '6.0'),
      allowedBranches: job.eligibility?.allowedBranches || ALL_BRANCHES,
      eligibleBatchYears: job.eligibility?.eligibleBatchYears?.join(', ') || '2025, 2026',
      maxActiveBacklogs: String(job.eligibility?.maxActiveBacklogs ?? '0'),
      maxHistoryBacklogs: String(job.eligibility?.maxHistoryBacklogs ?? '2'),
      minTenthPercentage: String(job.eligibility?.minTenthPercentage ?? '60'),
      minTwelfthPucCgpa: String(job.eligibility?.minTwelfthPucCgpa ?? '6.0'),
      selectionRounds: job.selectionRounds?.length ? [...job.selectionRounds]
        .sort((a, b) => a.roundNumber - b.roundNumber)
        .map((round, index) => ({
          ...round,
          roundNumber: index + 1,
          scheduledDate: toLocalDateTime(round.scheduledDate),
        })) : [
        { roundNumber: 1, name: 'Technical Assessment', mode: 'Online' },
      ],
      applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().slice(0, 16) : '',
      driveDate: job.driveDate ? new Date(job.driveDate).toISOString().slice(0, 16) : '',
      status: job.status || 'ACTIVE',
      companyId: job.companyId || '',
    });
    setIsModalOpen(true);
  }

  function handleBranchToggle(branch) {
    setFormData((prev) => {
      const exists = prev.allowedBranches.includes(branch);
      const newBranches = exists
        ? prev.allowedBranches.filter((b) => b !== branch)
        : [...prev.allowedBranches, branch];
      return { ...prev, allowedBranches: newBranches };
    });
  }

  function updateRound(index, field, value) {
    setFormData((prev) => ({
      ...prev,
      selectionRounds: prev.selectionRounds.map((round, roundIndex) =>
        roundIndex === index ? { ...round, [field]: value } : round
      ),
    }));
  }

  function addRound() {
    setFormData((prev) => ({
      ...prev,
      selectionRounds: [
        ...prev.selectionRounds,
        {
          roundNumber: prev.selectionRounds.length + 1,
          name: '',
          description: '',
          mode: 'Online',
          scheduledDate: '',
          durationMinutes: '',
          venueOrLink: '',
          status: 'PLANNED',
        },
      ],
    }));
  }

  function moveRound(index, offset) {
    setFormData((prev) => {
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= prev.selectionRounds.length) return prev;
      const selectionRounds = [...prev.selectionRounds];
      [selectionRounds[index], selectionRounds[targetIndex]] = [
        selectionRounds[targetIndex],
        selectionRounds[index],
      ];
      return {
        ...prev,
        selectionRounds: selectionRounds.map((round, roundIndex) => ({
          ...round,
          roundNumber: roundIndex + 1,
        })),
      };
    });
  }

  function removeRound(index) {
    setFormData((prev) => ({
      ...prev,
      selectionRounds: prev.selectionRounds
        .filter((_, roundIndex) => roundIndex !== index)
        .map((round, roundIndex) => ({ ...round, roundNumber: roundIndex + 1 })),
    }));
  }

  async function handleSaveJob(e) {
    e.preventDefault();
    setSaving(true);
    setModalError('');

    try {
      const payload = {
        title: formData.title,
        roleCategory: formData.roleCategory,
        workplaceType: formData.workplaceType,
        locations: formData.locations.split(',').map((s) => s.trim()).filter(Boolean),
        description: formData.description,
        responsibilities: formData.responsibilities.split('\n').map((s) => s.trim()).filter(Boolean),
        requirements: formData.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
        requiredSkills: formData.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean),
        preferredSkills: formData.preferredSkills.split(',').map((s) => s.trim()).filter(Boolean),
        salary: {
          minLpa: parseFloat(formData.salaryMinLpa) || 0,
          maxLpa: parseFloat(formData.salaryMaxLpa) || 0,
          stipendPerMonth: parseFloat(formData.stipendPerMonth) || 0,
          currency: 'INR',
          breakup: formData.salaryBreakup,
        },
        eligibility: {
          minCgpa: parseFloat(formData.minCgpa) || 0,
          allowedBranches: formData.allowedBranches,
          eligibleBatchYears: formData.eligibleBatchYears.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)),
          maxActiveBacklogs: parseInt(formData.maxActiveBacklogs) || 0,
          maxHistoryBacklogs: parseInt(formData.maxHistoryBacklogs) || 0,
          minTenthPercentage: parseFloat(formData.minTenthPercentage) || 0,
          minTwelfthPucCgpa: parseFloat(formData.minTwelfthPucCgpa) || 0,
        },
        selectionRounds: formData.selectionRounds.map((round, index) => ({
          ...round,
          roundNumber: index + 1,
          scheduledDate: round.scheduledDate || null,
          durationMinutes: round.durationMinutes === '' ? null : Number(round.durationMinutes),
        })),
        applicationDeadline: formData.applicationDeadline,
        driveDate: formData.driveDate || null,
        status: formData.status,
      };

      if (user?.role === 'ADMIN' && formData.companyId) {
        payload.companyId = formData.companyId;
      }

      const url = editingJobId ? `${API_BASE}/${editingJobId}` : API_BASE;
      const method = editingJobId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: headers(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(editingJobId ? 'Job posting updated successfully!' : 'Job posting created successfully!');
        setIsModalOpen(false);
        fetchJobs();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setModalError(data.error?.message || 'Failed to save job posting.');
      }
    } catch {
      setModalError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(jobId, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/${jobId}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setJobs((prev) => prev.map((j) => (j._id === jobId ? { ...j, status: newStatus } : j)));
      }
    } catch {
      // Non-blocking
    }
  }

  async function handleDeleteJob(jobId) {
    if (!window.confirm('Are you sure you want to delete this job posting? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/${jobId}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j._id !== jobId));
        setSuccessMsg('Job posting deleted.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setError('Failed to delete job posting.');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-emerald-400" />
            <span>Campus Job Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {user?.role === 'ADMIN'
              ? 'Administrator console: Manage university-wide placement drives and eligibility criteria.'
              : 'Recruiter portal: Post new campus openings, set cutoff rules, and manage active drives.'}
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Job Posting</span>
        </button>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Job Postings Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-sm">Loading job records...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Job Postings Yet</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            You haven't posted any campus recruitment drives yet. Click the button above to publish your first opportunity.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
          >
            Create Job Posting
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3.5 px-4">Job Title &amp; Company</th>
                  <th className="py-3.5 px-4">Type &amp; Workplace</th>
                  <th className="py-3.5 px-4">Compensation</th>
                  <th className="py-3.5 px-4">Eligibility Cutoffs</th>
                  <th className="py-3.5 px-4">Deadline</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-sm">{job.title}</div>
                      <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>{job.companyName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[11px] font-medium">
                        {job.roleCategory}
                      </span>
                      <div className="text-slate-400">{job.workplaceType}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-emerald-400">
                        {job.salary?.maxLpa ? `${job.salary.maxLpa} LPA` : 'Standard'}
                      </div>
                      {job.salary?.minLpa > 0 && (
                        <div className="text-slate-500">Min: {job.salary.minLpa} LPA</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div><span className="text-slate-500">Min CGPA:</span> <strong className="text-white">{job.eligibility?.minCgpa ?? 6.0}</strong></div>
                      <div><span className="text-slate-500">Max Backlogs:</span> <strong className="text-white">{job.eligibility?.maxActiveBacklogs ?? 0}</strong></div>
                      <div className="text-slate-400 truncate max-w-[150px]">
                        {job.eligibility?.allowedBranches?.join(', ')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(job.applicationDeadline).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={job.status}
                        onChange={(e) => handleToggleStatus(job._id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-semibold focus:outline-none border ${
                          job.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : job.status === 'CLOSED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PAUSED">PAUSED</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <Link
                        to={`/jobs/${job._id}`}
                        className="inline-flex items-center p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                        title="View Public Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={() => handleOpenEdit(job)}
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition"
                        title="Edit Job"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteJob(job._id)}
                        className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition"
                        title="Delete Job"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                <span>{editingJobId ? 'Edit Job Posting' : 'Create New Campus Placement Opening'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveJob} className="space-y-6 text-sm">
              {/* Basic Information */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">1. Basic Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Job Title *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Software Engineer - Trainee"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Role Category</label>
                    <select
                      value={formData.roleCategory}
                      onChange={(e) => setFormData({ ...formData, roleCategory: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      {ROLE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Workplace Type</label>
                    <select
                      value={formData.workplaceType}
                      onChange={(e) => setFormData({ ...formData, workplaceType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      {WORKPLACE_TYPES.map((wpt) => (
                        <option key={wpt} value={wpt}>{wpt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Locations (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Ongole, Hyderabad, Bangalore"
                      value={formData.locations}
                      onChange={(e) => setFormData({ ...formData, locations: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Job Description *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide overview of the role, team, and day-to-day work..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Mandatory Technical Skills</label>
                    <input
                      type="text"
                      placeholder="e.g. Java, Python, SQL, React"
                      value={formData.requiredSkills}
                      onChange={(e) => setFormData({ ...formData, requiredSkills: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Preferred Skills</label>
                    <input
                      type="text"
                      placeholder="e.g. Docker, Kubernetes, AWS"
                      value={formData.preferredSkills}
                      onChange={(e) => setFormData({ ...formData, preferredSkills: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Compensation Details */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">2. Salary &amp; Compensation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min LPA</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.salaryMinLpa}
                      onChange={(e) => setFormData({ ...formData, salaryMinLpa: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Max LPA</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.salaryMaxLpa}
                      onChange={(e) => setFormData({ ...formData, salaryMaxLpa: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Stipend / Month (₹)</label>
                    <input
                      type="number"
                      value={formData.stipendPerMonth}
                      onChange={(e) => setFormData({ ...formData, stipendPerMonth: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Salary Breakup / Retention Bonus Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Fixed: 7 LPA, Joining Bonus: 1 LPA, Performance: 2 LPA"
                    value={formData.salaryBreakup}
                    onChange={(e) => setFormData({ ...formData, salaryBreakup: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Configurable Eligibility Rules */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">3. Configurable Eligibility Rules</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min B.Tech CGPA Cutoff</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={formData.minCgpa}
                      onChange={(e) => setFormData({ ...formData, minCgpa: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Max Active Backlogs Allowed</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxActiveBacklogs}
                      onChange={(e) => setFormData({ ...formData, maxActiveBacklogs: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Eligible Graduation Batches</label>
                    <input
                      type="text"
                      placeholder="e.g. 2025, 2026"
                      value={formData.eligibleBatchYears}
                      onChange={(e) => setFormData({ ...formData, eligibleBatchYears: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Max Historical Backlogs</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.maxHistoryBacklogs}
                      onChange={(e) => setFormData({ ...formData, maxHistoryBacklogs: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min 10th Percentage</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.minTenthPercentage}
                      onChange={(e) => setFormData({ ...formData, minTenthPercentage: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min PUC CGPA</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={formData.minTwelfthPucCgpa}
                      onChange={(e) => setFormData({ ...formData, minTwelfthPucCgpa: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Branches checkboxes */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Allowed Engineering Branches</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_BRANCHES.map((branch) => {
                      const isSelected = formData.allowedBranches.includes(branch);
                      return (
                        <button
                          type="button"
                          key={branch}
                          onClick={() => handleBranchToggle(branch)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            isSelected
                              ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {branch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recruitment Rounds */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    4. Recruitment Rounds
                  </h4>
                  <button
                    type="button"
                    onClick={addRound}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add round
                  </button>
                </div>

                {formData.selectionRounds.length === 0 && (
                  <p className="text-xs text-slate-400">No rounds added. Add a round to show candidates the selection process.</p>
                )}

                <div className="space-y-3">
                  {formData.selectionRounds.map((round, index) => (
                    <div key={`${round.roundNumber}-${index}`} className="space-y-3 p-3 rounded-lg bg-slate-900/70 border border-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-200">Round {index + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveRound(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move round ${index + 1} up`}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRound(index, 1)}
                            disabled={index === formData.selectionRounds.length - 1}
                            aria-label={`Move round ${index + 1} down`}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRound(index)}
                            aria-label={`Remove round ${index + 1}`}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <input
                          required
                          type="text"
                          value={round.name || ''}
                          onChange={(e) => updateRound(index, 'name', e.target.value)}
                          placeholder="Round name"
                          aria-label={`Round ${index + 1} name`}
                          className="sm:col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <select
                          value={round.mode || 'Online'}
                          onChange={(e) => updateRound(index, 'mode', e.target.value)}
                          aria-label={`Round ${index + 1} mode`}
                          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        >
                          <option value="Online">Online</option>
                          <option value="In-Person">In-Person</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                        <select
                          value={round.status || 'PLANNED'}
                          onChange={(e) => updateRound(index, 'status', e.target.value)}
                          aria-label={`Round ${index + 1} status`}
                          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        >
                          {ROUND_STATUSES.map((status) => (
                            <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                          ))}
                        </select>
                        <input
                          type="datetime-local"
                          value={round.scheduledDate || ''}
                          onChange={(e) => updateRound(index, 'scheduledDate', e.target.value)}
                          aria-label={`Round ${index + 1} schedule`}
                          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        />
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={round.durationMinutes ?? ''}
                          onChange={(e) => updateRound(index, 'durationMinutes', e.target.value)}
                          placeholder="Duration (minutes)"
                          aria-label={`Round ${index + 1} duration in minutes`}
                          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        />
                        <input
                          type="text"
                          value={round.venueOrLink || ''}
                          onChange={(e) => updateRound(index, 'venueOrLink', e.target.value)}
                          placeholder="Venue or meeting link"
                          aria-label={`Round ${index + 1} venue or meeting link`}
                          className="lg:col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={round.description || ''}
                        onChange={(e) => updateRound(index, 'description', e.target.value)}
                        placeholder="Instructions or round details"
                        aria-label={`Round ${index + 1} description`}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Deadlines and Status */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">5. Timelines &amp; Publishing Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Application Deadline *</label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.applicationDeadline}
                      onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Publishing Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ACTIVE">ACTIVE (Published to Students)</option>
                      <option value="DRAFT">DRAFT (Hidden from Students)</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingJobId ? 'Save Changes' : 'Publish Job Opening'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
