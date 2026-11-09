import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  FileText, Briefcase, Building2, CheckCircle2, Clock,
  XCircle, AlertCircle, ChevronRight, Calendar, UserCheck,
  Award, ArrowRight, UserX, Loader2, Eye, ExternalLink,
  MessageSquare, Plus, RefreshCw, X, Shield, Filter, Search
} from 'lucide-react';

const APPLICATIONS_API = '/api/v1/applications';
const JOBS_API = '/api/v1/jobs';

const WORKFLOW_STAGES = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Selected',
  'Rejected',
];

export default function ApplicationTracker() {
  const { user, token, apiFetch } = useAuth();
  const canManageDecisions = user?.role === 'RECRUITER';

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering (Admin / Recruiter)
  const [filters, setFilters] = useState({
    stage: '',
    jobId: '',
    q: '',
  });
  const [jobsList, setJobsList] = useState([]);

  // Selected Application for detailed view / action modal
  const [selectedApp, setSelectedApp] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('stage'); // 'stage' | 'schedule' | 'evaluate' | 'offer' | 'history'

  // Stage update form
  const [stageForm, setStageForm] = useState({ stage: '', comments: '' });
  const [updatingStage, setUpdatingStage] = useState(false);

  // Interview Schedule form
  const [interviewForm, setInterviewForm] = useState({
    roundNumber: 1,
    roundName: 'Technical Interview (Round 1)',
    roundType: 'TECHNICAL',
    scheduledAt: '',
    durationMinutes: 60,
    mode: 'ONLINE',
    meetingLinkOrVenue: 'https://meet.google.com/rgukt-interview',
    interviewerPanel: 'Senior Technical Lead',
    instructions: 'Please be ready with code editor open and portfolio projects.',
    comments: '',
  });
  const [schedulingInterview, setSchedulingInterview] = useState(false);

  // Interview Evaluation form
  const [evaluationForm, setEvaluationForm] = useState({
    roundNumber: 1,
    result: 'PASSED',
    score: 85,
    feedback: 'Strong problem solving skills and solid understanding of core fundamentals.',
    advanceStage: 'Shortlisted',
  });
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);

  // Placement Offer form
  const [offerForm, setOfferForm] = useState({
    finalPlacementStatus: 'OFFERED',
    offeredPackageLpa: 8.5,
    joiningDate: '',
    offerLetterUrl: '',
    remarks: 'Selected for Full-time Software Engineer Trainee role.',
  });
  const [updatingOffer, setUpdatingOffer] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Fetch Applications
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '';
      if (user?.role === 'STUDENT') {
        endpoint = `${APPLICATIONS_API}/my`;
      } else {
        const params = new URLSearchParams();
        if (filters.stage) params.set('stage', filters.stage);
        if (filters.jobId) params.set('jobId', filters.jobId);
        if (filters.q) params.set('q', filters.q);
        endpoint = `${APPLICATIONS_API}?${params.toString()}`;
      }

      const res = await apiFetch(endpoint);
      const data = await res.json();

      if (res.ok) {
        setApplications(data.data?.applications || []);
      } else {
        setError(data.error?.message || 'Failed to load applications.');
      }
    } catch {
      setError('Network error. Unable to load application records.');
    } finally {
      setLoading(false);
    }
  }, [user, filters, headers]);

  // Fetch Jobs list for filtering
  useEffect(() => {
    if (user?.role !== 'STUDENT') {
      apiFetch(`${JOBS_API}?limit=50`)
        .then((res) => res.json())
        .then((data) => setJobsList(data.data?.jobs || []))
        .catch(() => {});
    }
  }, [user, apiFetch]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  function getStageColor(stage) {
    switch (stage) {
      case 'Applied':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Under Review':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Shortlisted':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Interview Scheduled':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Selected':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Rejected':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  }

  function handleOpenAppModal(app) {
    setSelectedApp(app);
    setStageForm({ stage: app.stage, comments: '' });
    const defaultDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setInterviewForm((prev) => ({
      ...prev,
      roundNumber: (app.interviews?.length || 0) + 1,
      scheduledAt: defaultDate,
    }));
    setActiveModalTab(canManageDecisions ? 'stage' : 'history');
  }

  // Action: Update Stage
  async function handleUpdateStage(e) {
    e.preventDefault();
    if (!selectedApp) return;
    setUpdatingStage(true);
    try {
      const res = await apiFetch(`${APPLICATIONS_API}/${selectedApp._id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify(stageForm),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Candidate stage updated to '${stageForm.stage}'`);
        setSelectedApp(data.data.application);
        fetchApplications();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.error?.message || 'Failed to update stage.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setUpdatingStage(false);
    }
  }

  // Action: Schedule Interview
  async function handleScheduleInterview(e) {
    e.preventDefault();
    if (!selectedApp) return;
    setSchedulingInterview(true);
    try {
      const payload = {
        ...interviewForm,
        interviewerPanel: interviewForm.interviewerPanel
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await apiFetch(`${APPLICATIONS_API}/${selectedApp._id}/interviews`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Round ${interviewForm.roundNumber} scheduled successfully!`);
        setSelectedApp(data.data.application);
        fetchApplications();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.error?.message || 'Failed to schedule interview.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setSchedulingInterview(false);
    }
  }

  // Action: Submit Evaluation
  async function handleSubmitEvaluation(e) {
    e.preventDefault();
    if (!selectedApp) return;
    setSubmittingEvaluation(true);
    try {
      const res = await apiFetch(
        `${APPLICATIONS_API}/${selectedApp._id}/interviews/${evaluationForm.roundNumber}/evaluation`,
        {
          method: 'PATCH',
          body: JSON.stringify(evaluationForm),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Round evaluation recorded!`);
        setSelectedApp(data.data.application);
        fetchApplications();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.error?.message || 'Failed to record evaluation.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setSubmittingEvaluation(false);
    }
  }

  // Action: Update Offer
  async function handleUpdateOffer(e) {
    e.preventDefault();
    if (!selectedApp) return;
    setUpdatingOffer(true);
    try {
      const res = await apiFetch(`${APPLICATIONS_API}/${selectedApp._id}/offer`, {
        method: 'PATCH',
        body: JSON.stringify(offerForm),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Placement offer updated!`);
        setSelectedApp(data.data.application);
        fetchApplications();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.error?.message || 'Failed to update offer.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setUpdatingOffer(false);
    }
  }

  // Calculate statistics
  const stageCounts = applications.reduce((acc, app) => {
    acc[app.stage] = (acc[app.stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/40 p-6 sm:p-8 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <Award className="w-3.5 h-3.5" /> Recruitment &amp; Application Workflow
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {user?.role === 'STUDENT'
              ? 'My Application Pipeline'
              : 'Candidate Recruitment Pipeline'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {user?.role === 'STUDENT'
              ? 'Track your campus job applications across multi-stage review rounds, interview calls, and offer status in real-time.'
              : 'Review candidate applications, shortlist profiles, schedule interview rounds, record evaluations, and issue placement offers.'}
          </p>
        </div>

        {user?.role === 'STUDENT' && (
          <Link
            to="/jobs"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20 shrink-0"
          >
            <Briefcase className="w-4 h-4" />
            <span>Apply to More Jobs</span>
          </Link>
        )}
      </div>

      {/* Stats Cards (For Recruiter / Admin) */}
      {user?.role !== 'STUDENT' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {WORKFLOW_STAGES.map((st) => (
            <div
              key={st}
              onClick={() => setFilters({ ...filters, stage: filters.stage === st ? '' : st })}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                filters.stage === st
                  ? 'bg-slate-800 border-emerald-500 shadow-md'
                  : 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="truncate">{st}</span>
                <span className={`w-2 h-2 rounded-full ${
                  st === 'Selected' ? 'bg-emerald-400' : st === 'Rejected' ? 'bg-rose-400' : 'bg-cyan-400'
                }`} />
              </div>
              <div className="text-xl font-bold text-white">{stageCounts[st] || 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar (Admin / Recruiter) */}
      {user?.role !== 'STUDENT' && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate name, ID, job..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="w-44">
            <select
              value={filters.stage}
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Stages</option>
              {WORKFLOW_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="w-56">
            <select
              value={filters.jobId}
              onChange={(e) => setFilters({ ...filters, jobId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 truncate"
            >
              <option value="">All Job Postings</option>
              {jobsList.map((j) => (
                <option key={j._id} value={j._id}>{j.companyName} - {j.title}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFilters({ stage: '', jobId: '', q: '' })}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition"
          >
            Clear
          </button>
        </div>
      )}

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-sm">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Applications Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {user?.role === 'STUDENT'
              ? 'You have not submitted applications to any campus placement opportunities yet.'
              : 'No candidate applications found matching the selected filter criteria.'}
          </p>
          {user?.role === 'STUDENT' && (
            <Link
              to="/jobs"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
            >
              <span>Explore Available Jobs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      ) : user?.role === 'STUDENT' ? (
        /* ─── Student Applications View ─────────────────────────────────── */
        <div className="space-y-6">
          {applications.map((app) => (
            <div
              key={app._id}
              className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 space-y-6 shadow-sm"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                <div>
                  <h3 className="text-xl font-bold text-white">{app.jobTitle}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-medium text-slate-300">{app.companyName}</span>
                    <span>•</span>
                    <span>Applied on {new Date(app.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {app.resumeFileName && (
                    <a
                      href={`${APPLICATIONS_API}/${app._id}/resume`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Resume
                    </a>
                  )}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStageColor(app.stage)}`}>
                    Stage: {app.stage}
                  </span>
                  {app.finalPlacementStatus && app.finalPlacementStatus !== 'PENDING' && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      app.finalPlacementStatus === 'OFFERED'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}>
                      {app.finalPlacementStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Flow Steps */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Recruitment Workflow Progress
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  {['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected'].map((step, idx) => {
                    const stepIndex = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected'].indexOf(app.stage);
                    const isPassed = stepIndex >= idx && app.stage !== 'Rejected';
                    const isCurrent = app.stage === step;

                    return (
                      <div
                        key={step}
                        className={`p-2.5 rounded-lg border transition ${
                          isCurrent
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold'
                            : isPassed
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : app.stage === 'Rejected' && idx === stepIndex
                            ? 'bg-rose-950/30 border-rose-500 text-rose-400'
                            : 'bg-slate-900/40 text-slate-600 border-slate-800'
                        }`}
                      >
                        <div className="text-[10px] text-slate-500 font-mono mb-0.5">0{idx + 1}</div>
                        <div>{step}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scheduled Interviews Box */}
              {app.interviews?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Scheduled Interview Rounds ({app.interviews.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {app.interviews.map((iv, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">Round {iv.roundNumber}: {iv.roundName}</span>
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                            iv.result === 'PASSED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : iv.result === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {iv.result !== 'PENDING' ? iv.result : iv.status}
                          </span>
                        </div>

                        <div className="text-slate-400 space-y-1">
                          <p><strong className="text-slate-300">Time:</strong> {new Date(iv.scheduledAt).toLocaleString()}</p>
                          <p><strong className="text-slate-300">Mode:</strong> {iv.mode}</p>
                          {iv.meetingLinkOrVenue && (
                            <p className="text-emerald-400 truncate">
                              <strong>Venue/Link:</strong>{' '}
                              <a href={iv.meetingLinkOrVenue} target="_blank" rel="noreferrer" className="underline">
                                {iv.meetingLinkOrVenue}
                              </a>
                            </p>
                          )}
                          {iv.instructions && <p className="italic text-slate-500">"{iv.instructions}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Offer Details if Offered */}
              {app.finalPlacementStatus === 'OFFERED' && app.offerDetails?.offeredPackageLpa > 0 && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <span>Congratulations! Official Placement Offer Extended</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Package: <strong className="text-emerald-400 text-sm">{app.offerDetails.offeredPackageLpa} LPA</strong>
                      {app.offerDetails.joiningDate && ` • Expected Joining: ${new Date(app.offerDetails.joiningDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  {app.offerDetails.offerLetterUrl && (
                    <a
                      href={app.offerDetails.offerLetterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition shrink-0"
                    >
                      Download Offer Letter
                    </a>
                  )}
                </div>
              )}

              {/* Audit History Timeline */}
              {app.history?.length > 0 && (
                <div className="pt-3 border-t border-slate-700/60">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Activity Log</p>
                  <div className="space-y-1.5 text-xs text-slate-400">
                    {app.history.slice(-3).reverse().map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-slate-500">{new Date(h.changedAt).toLocaleDateString()}:</span>
                        <span className="text-slate-300 font-medium">{h.stage}</span>
                        <span className="text-slate-500">{h.changedByRole || 'SYSTEM'}</span>
                        {h.comments && <span className="text-slate-500 truncate">- {h.comments}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ─── Recruiter / Admin Table View ─────────────────────────────── */
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Branch &amp; Academics</th>
                  <th className="py-3 px-4">Applied Job &amp; Company</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Placement Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {applications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white text-sm">{app.studentName}</p>
                      <p className="text-slate-400 font-mono text-[11px]">{app.studentId} • {app.studentEmail}</p>
                    </td>

                    <td className="py-3 px-4 space-y-0.5">
                      <p className="font-semibold text-emerald-400">{app.branch}</p>
                      <p className="text-slate-400">{app.btechCgpa} CGPA • Backlogs: {app.activeBacklogs}</p>
                    </td>

                    <td className="py-3 px-4 space-y-0.5">
                      <p className="font-semibold text-white">{app.jobTitle}</p>
                      <p className="text-slate-400">{app.companyName}</p>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${getStageColor(app.stage)}`}>
                        {app.stage}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                        app.finalPlacementStatus === 'OFFERED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : app.finalPlacementStatus === 'REJECTED'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {app.finalPlacementStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        {app.resumeFileName && (
                          <a
                            href={`${APPLICATIONS_API}/${app._id}/resume`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" /> Resume
                          </a>
                        )}
                        <button
                          onClick={() => handleOpenAppModal(app)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-semibold text-xs border border-emerald-500/30 transition inline-flex items-center gap-1"
                        >
                          {canManageDecisions ? <UserCheck className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{canManageDecisions ? 'Manage' : 'Review'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recruiter / Admin Candidate Action Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Candidate: {selectedApp.studentName}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedApp.studentId}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Applying for <strong className="text-emerald-400">{selectedApp.jobTitle}</strong> at {selectedApp.companyName}
                </p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold">
              {canManageDecisions && <button
                onClick={() => setActiveModalTab('stage')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeModalTab === 'stage' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Workflow Stage
              </button>}
              {canManageDecisions && <button
                onClick={() => setActiveModalTab('schedule')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeModalTab === 'schedule' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Schedule Interview
              </button>}
              {canManageDecisions && <button
                onClick={() => setActiveModalTab('evaluate')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeModalTab === 'evaluate' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Evaluate Round
              </button>}
              {canManageDecisions && <button
                onClick={() => setActiveModalTab('offer')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeModalTab === 'offer' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Placement Offer
              </button>}
              <button
                onClick={() => setActiveModalTab('history')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeModalTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Audit History ({selectedApp.history?.length || 0})
              </button>
            </div>

            {/* Modal Body Based on Tab */}
            {canManageDecisions && activeModalTab === 'stage' && (
              <form onSubmit={handleUpdateStage} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Select Workflow Stage *</label>
                  <select
                    value={stageForm.stage}
                    onChange={(e) => setStageForm({ ...stageForm, stage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    {WORKFLOW_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Transition Comments / Feedback</label>
                  <textarea
                    rows={3}
                    placeholder="Provide notes or reasons for this stage change..."
                    value={stageForm.comments}
                    onChange={(e) => setStageForm({ ...stageForm, comments: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updatingStage}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    {updatingStage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update Stage</span>
                  </button>
                </div>
              </form>
            )}

            {canManageDecisions && activeModalTab === 'schedule' && (
              <form onSubmit={handleScheduleInterview} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Round Number *</label>
                    <input
                      type="number"
                      min="1"
                      value={interviewForm.roundNumber}
                      onChange={(e) => setInterviewForm({ ...interviewForm, roundNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Round Type</label>
                    <select
                      value={interviewForm.roundType}
                      onChange={(e) => setInterviewForm({ ...interviewForm, roundType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="TECHNICAL">TECHNICAL</option>
                      <option value="APTITUDE">APTITUDE</option>
                      <option value="HR">HR</option>
                      <option value="CODING">CODING</option>
                      <option value="MANAGERIAL">MANAGERIAL</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-medium mb-1">Round Name *</label>
                    <input
                      type="text"
                      value={interviewForm.roundName}
                      onChange={(e) => setInterviewForm({ ...interviewForm, roundName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Scheduled Date &amp; Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={interviewForm.scheduledAt}
                      onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Mode</label>
                    <select
                      value={interviewForm.mode}
                      onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ONLINE">ONLINE</option>
                      <option value="IN_PERSON">IN_PERSON</option>
                      <option value="HYBRID">HYBRID</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-medium mb-1">Meeting Link or Campus Venue</label>
                    <input
                      type="text"
                      value={interviewForm.meetingLinkOrVenue}
                      onChange={(e) => setInterviewForm({ ...interviewForm, meetingLinkOrVenue: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={schedulingInterview}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    {schedulingInterview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm &amp; Schedule Interview</span>
                  </button>
                </div>
              </form>
            )}

            {canManageDecisions && activeModalTab === 'evaluate' && (
              <form onSubmit={handleSubmitEvaluation} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Select Interview Round</label>
                    <select
                      value={evaluationForm.roundNumber}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, roundNumber: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      {selectedApp.interviews?.map((r) => (
                        <option key={r.roundNumber} value={r.roundNumber}>
                          Round {r.roundNumber}: {r.roundName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Evaluation Result *</label>
                    <select
                      value={evaluationForm.result}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, result: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PASSED">PASSED</option>
                      <option value="FAILED">FAILED</option>
                      <option value="ON_HOLD">ON_HOLD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={evaluationForm.score}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, score: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Advance Workflow Stage To</label>
                    <select
                      value={evaluationForm.advanceStage}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, advanceStage: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      {WORKFLOW_STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Interviewer Feedback</label>
                  <textarea
                    rows={3}
                    value={evaluationForm.feedback}
                    onChange={(e) => setEvaluationForm({ ...evaluationForm, feedback: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingEvaluation}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    {submittingEvaluation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Round Evaluation</span>
                  </button>
                </div>
              </form>
            )}

            {canManageDecisions && activeModalTab === 'offer' && (
              <form onSubmit={handleUpdateOffer} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Final Placement Status *</label>
                    <select
                      value={offerForm.finalPlacementStatus}
                      onChange={(e) => setOfferForm({ ...offerForm, finalPlacementStatus: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="OFFERED">OFFERED</option>
                      <option value="ACCEPTED">ACCEPTED</option>
                      <option value="DECLINED">DECLINED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Offered CTC Package (LPA) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={offerForm.offeredPackageLpa}
                      onChange={(e) => setOfferForm({ ...offerForm, offeredPackageLpa: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Tentative Joining Date</label>
                    <input
                      type="date"
                      value={offerForm.joiningDate}
                      onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Offer Letter Document URL</label>
                    <input
                      type="text"
                      placeholder="https://storage.rguktong.ac.in/offers/..."
                      value={offerForm.offerLetterUrl}
                      onChange={(e) => setOfferForm({ ...offerForm, offerLetterUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updatingOffer}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    {updatingOffer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Issue / Update Placement Offer</span>
                  </button>
                </div>
              </form>
            )}

            {activeModalTab === 'history' && (
              <div className="space-y-3 text-xs">
                <div className="divide-y divide-slate-800">
                  {selectedApp.history?.slice().reverse().map((h, i) => (
                    <div key={i} className="py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{h.stage}</span>
                        <span className="text-slate-500">{new Date(h.changedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-400">
                        Actor: <span className="font-semibold text-slate-300">{h.changedByRole}</span>
                      </p>
                      {h.comments && <p className="text-slate-300 italic">"{h.comments}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
