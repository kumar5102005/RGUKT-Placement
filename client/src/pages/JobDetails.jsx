import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Briefcase, MapPin, DollarSign, Calendar, Clock, CheckCircle2,
  XCircle, AlertCircle, Building2, Tag, ChevronLeft, Award,
  Users, Check, ExternalLink, Loader2, ArrowRight, ShieldCheck,
  Edit3, Trash2
} from 'lucide-react';

const API_BASE = '/api/v1/jobs';
const STUDENT_API_BASE = '/api/v1/students';
const APPLICATIONS_API = '/api/v1/applications';

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token, apiFetch } = useAuth();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Eligibility evaluation state
  const [evaluating, setEvaluating] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [rawStudentData, setRawStudentData] = useState(null);

  // Application submission state
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Fetch Job Details
  const fetchJobDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/${id}`);
      const data = await res.json();

      if (res.ok) {
        setJob(data.data.job);
      } else {
        setError(data.error?.message || 'Failed to load job details.');
      }
    } catch {
      setError('Network error. Unable to load job details.');
    } finally {
      setLoading(false);
    }
  }, [id, headers]);

  // Fetch Student Profile & Evaluate Eligibility
  const evaluateStudent = useCallback(async () => {
    if (user?.role !== 'STUDENT') return;
    setEvaluating(true);
    try {
      // 1. Fetch own student profile
      const studentRes = await apiFetch(`${STUDENT_API_BASE}/profile`);
      if (!studentRes.ok) return;
      const studentJson = await studentRes.json();
      const student = studentJson.data?.student;

      if (!student) return;
      setRawStudentData(student);

      // 2. Check if already applied
      apiFetch(`${APPLICATIONS_API}/my`)
        .then((res) => res.json())
        .then((data) => {
          const applied = data.data?.applications?.some((a) => a.jobId === id || a.jobId?._id === id);
          if (applied) setHasApplied(true);
        })
        .catch(() => { });

      // 3. Run eligibility check endpoint
      const checkRes = await apiFetch(`${API_BASE}/${id}/check-eligibility`, {
        method: 'POST',
        body: JSON.stringify({
          studentData: {
            btechCgpa: student.academics?.btechCgpa || 0,
            branch: student.branch || '',
            batchYear: student.batchYear || 0,
            activeBacklogs: student.academics?.activeBacklogs || 0,
            totalBacklogsHistory: student.academics?.totalBacklogsHistory || 0,
            tenthPercentage: student.academics?.tenthPercentage || 0,
            pucCgpa: student.academics?.pucCgpa || 0,
            skills: student.skills?.map((s) => s.name) || [],
          },
        }),
      });

      const checkJson = await checkRes.json();
      if (checkRes.ok) {
        setEligibilityResult(checkJson.data?.evaluation);
      }
    } catch {
      // Non-blocking error
    } finally {
      setEvaluating(false);
    }
  }, [id, user, headers]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  useEffect(() => {
    if (job) {
      evaluateStudent();
    }
  }, [job, evaluateStudent]);

  async function handleApplyForJob() {
    if (!rawStudentData) {
      alert('Please fill out your Student Profile first.');
      return;
    }
    setApplying(true);
    try {
      const payload = {
        jobId: job._id,
        jobTitle: job.title,
        companyId: job.companyId,
        companyName: job.companyName,
        studentData: {
          studentId: rawStudentData.studentId || user?.studentId || '',
          studentName: rawStudentData.personalInfo?.fullName || user?.fullName || 'Candidate',
          branch: rawStudentData.branch || 'CSE',
          btechCgpa: rawStudentData.academics?.btechCgpa || 0,
          activeBacklogs: rawStudentData.academics?.activeBacklogs || 0,
          batchYear: rawStudentData.batchYear || 2026,
          resumeUrl: rawStudentData.resumeUrl || '',
          skills: rawStudentData.skills?.map((s) => s.name) || [],
        },
        coverLetter,
        eligibilityRules: job.eligibility || {},
        applicationDeadline: job.applicationDeadline,
      };

      const res = await fetch(APPLICATIONS_API, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setHasApplied(true);
        setApplicationSuccess('Your application has been successfully submitted to ' + job.companyName + '!');
      } else {
        alert(data.error?.message || 'Failed to submit application.');
      }
    } catch {
      alert('Network error submitting application.');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
        <p className="text-sm">Loading job specifications...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-slate-800/60 border border-slate-700 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Job Posting Not Found</h2>
        <p className="text-slate-400 text-sm">{error || 'This job opening does not exist or has been removed.'}</p>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Job Listings
        </Link>
      </div>
    );
  }

  const isExpired = new Date(job.applicationDeadline).getTime() < Date.now();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back to All Jobs
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {job.companyLogo ? (
              <img
                src={job.companyLogo}
                alt={job.companyName}
                className="w-16 h-16 rounded-2xl object-contain bg-slate-900 border border-slate-700 p-2 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 shrink-0">
                <Building2 className="w-8 h-8" />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{job.title}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${job.status === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}>
                  {job.status}
                </span>
              </div>

              <p className="text-base font-medium text-emerald-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>{job.companyName}</span>
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {job.locations?.join(', ') || 'Ongole'}
                </span>
                <span>•</span>
                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                  {job.roleCategory}
                </span>
                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                  {job.workplaceType}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Posted {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Package & Deadline Box */}
          <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 sm:w-64 space-y-3 shrink-0">
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Salary Package</p>
              <p className="text-lg font-bold text-emerald-400">
                {job.salary?.maxLpa
                  ? `${job.salary.minLpa ? job.salary.minLpa + ' - ' : ''}${job.salary.maxLpa} LPA`
                  : job.salary?.stipendPerMonth
                    ? `₹${job.salary.stipendPerMonth.toLocaleString()} / mo`
                    : 'Undisclosed'}
              </p>
              {job.salary?.breakup && (
                <p className="text-[11px] text-slate-400 mt-0.5">{job.salary.breakup}</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Application Deadline</p>
              <p className={`text-sm font-semibold flex items-center gap-1.5 mt-0.5 ${isExpired ? 'text-rose-400' : 'text-amber-400'
                }`}>
                <Clock className="w-3.5 h-3.5" />
                {new Date(job.applicationDeadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Student Real-Time Eligibility Card */}
      {user?.role === 'STUDENT' && (
        <div className={`p-6 rounded-2xl border transition ${evaluating
          ? 'bg-slate-800/60 border-slate-700'
          : eligibilityResult?.isEligible
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-rose-950/20 border-rose-500/30'
          }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              {evaluating ? (
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              ) : eligibilityResult?.isEligible ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
              )}
              <div>
                <h3 className="text-base font-semibold text-white">
                  {evaluating
                    ? 'Auditing Academic Eligibility...'
                    : eligibilityResult?.isEligible
                      ? 'You Are Eligible for This Placement Drive!'
                      : 'You Currently Do Not Meet One or More Eligibility Criteria'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated verification based on your B.Tech records, active backlogs, and academic batch.
                </p>
              </div>
            </div>

            {eligibilityResult && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${eligibilityResult.isEligible
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                {eligibilityResult.isEligible ? 'Eligible' : 'Ineligible'}
              </span>
            )}
          </div>

          {/* Breakdown checklist */}
          {eligibilityResult?.criteriaBreakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-700/60 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">CGPA Check</span>
                <span className={`font-semibold flex items-center gap-1 ${eligibilityResult.criteriaBreakdown.cgpa?.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                  {eligibilityResult.criteriaBreakdown.cgpa?.passed ? '✓' : '✗'}{' '}
                  {eligibilityResult.criteriaBreakdown.cgpa?.actual} / {eligibilityResult.criteriaBreakdown.cgpa?.required} Min
                </span>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Branch Check</span>
                <span className={`font-semibold flex items-center gap-1 ${eligibilityResult.criteriaBreakdown.branch?.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                  {eligibilityResult.criteriaBreakdown.branch?.passed ? '✓' : '✗'}{' '}
                  {eligibilityResult.criteriaBreakdown.branch?.actual || 'N/A'}
                </span>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Active Backlogs</span>
                <span className={`font-semibold flex items-center gap-1 ${eligibilityResult.criteriaBreakdown.activeBacklogs?.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                  {eligibilityResult.criteriaBreakdown.activeBacklogs?.passed ? '✓' : '✗'}{' '}
                  {eligibilityResult.criteriaBreakdown.activeBacklogs?.actual} (Max {eligibilityResult.criteriaBreakdown.activeBacklogs?.requiredMax})
                </span>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Graduation Batch</span>
                <span className={`font-semibold flex items-center gap-1 ${eligibilityResult.criteriaBreakdown.batchYear?.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                  {eligibilityResult.criteriaBreakdown.batchYear?.passed ? '✓' : '✗'}{' '}
                  {eligibilityResult.criteriaBreakdown.batchYear?.actual || 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Reason notes */}
          {eligibilityResult?.reasons?.length > 0 && (
            <div className="mt-3 p-3 bg-rose-500/10 rounded-lg border border-rose-500/20 text-xs text-rose-300 space-y-1">
              <p className="font-semibold">Cutoff Discrepancies:</p>
              {eligibilityResult.reasons.map((r, idx) => (
                <p key={idx} className="flex items-center gap-1.5">
                  <span>•</span> {r}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid: Details & Eligibility Specification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Description, Responsibilities, Skills */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Description */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-400" /> Job Overview
            </h3>
            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {job.description}
            </p>
          </div>

          {/* Key Responsibilities */}
          {job.responsibilities?.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" /> Key Responsibilities
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {job.responsibilities.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills Required */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-400" /> Technical Competencies
            </h3>

            {job.requiredSkills?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mandatory Skills</p>
                <div className="flex flex-wrap gap-2">
                  {job.requiredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.preferredSkills?.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Good to Have Skills</p>
                <div className="flex flex-wrap gap-2">
                  {job.preferredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selection Rounds Timeline */}
          {job.selectionRounds?.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" /> Selection Process &amp; Rounds
              </h3>
              <div className="space-y-3">
                {job.selectionRounds.map((round, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-sm shrink-0">
                      {round.roundNumber || idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm">{round.name}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {round.mode}
                        </span>
                      </div>
                      {round.description && (
                        <p className="text-xs text-slate-400 mt-1">{round.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Configurable Eligibility Rules */}
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 pb-3 border-b border-slate-700">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Configured Eligibility
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Min B.Tech CGPA</span>
                <span className="font-semibold text-white">{job.eligibility?.minCgpa || 6.0} CGPA</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Max Active Backlogs</span>
                <span className="font-semibold text-white">{job.eligibility?.maxActiveBacklogs ?? 0}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Max Backlogs History</span>
                <span className="font-semibold text-white">{job.eligibility?.maxHistoryBacklogs ?? 2}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Min 10th Percentage</span>
                <span className="font-semibold text-white">{job.eligibility?.minTenthPercentage || 60}%</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Min 12th / PUC CGPA</span>
                <span className="font-semibold text-white">{job.eligibility?.minTwelfthPucCgpa || 6.0}</span>
              </div>

              <div className="py-1.5 border-b border-slate-800">
                <span className="text-slate-400 block mb-1">Eligible Batches</span>
                <span className="font-semibold text-emerald-400">
                  {job.eligibility?.eligibleBatchYears?.join(', ') || '2025, 2026'}
                </span>
              </div>

              <div className="py-1.5">
                <span className="text-slate-400 block mb-1.5">Eligible Engineering Branches</span>
                <div className="flex flex-wrap gap-1.5">
                  {job.eligibility?.allowedBranches?.map((branch) => (
                    <span
                      key={branch}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-medium text-slate-300"
                    >
                      {branch}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h4 className="font-semibold text-white text-sm">Application Action</h4>

            {user?.role === 'STUDENT' ? (
              <div className="space-y-3">
                {applicationSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{applicationSuccess}</span>
                  </div>
                )}

                {hasApplied ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>Application Submitted (Active)</span>
                    </div>
                    <Link
                      to="/applications"
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
                    >
                      <span>Track Status in Pipeline</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleApplyForJob}
                      disabled={isExpired || job.status !== 'ACTIVE' || !eligibilityResult?.isEligible || applying}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      {applying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Briefcase className="w-4 h-4" />
                      )}
                      <span>
                        {applying
                          ? 'Submitting...'
                          : isExpired
                            ? 'Application Period Closed'
                            : !eligibilityResult?.isEligible
                              ? 'Ineligible to Apply'
                              : 'Apply for this Opportunity'}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">
                      Applications are processed through the Campus Placement Recruitment Workflow.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/recruiter/jobs"
                  className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs flex items-center justify-center gap-2 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Manage in Recruiter Console</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

