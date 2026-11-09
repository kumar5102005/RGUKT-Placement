import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Calendar, Building2, Clock, CheckCircle2, XCircle, AlertCircle,
  Plus, Users, Award, MapPin, ChevronRight, Loader2, ShieldCheck,
  Check, Edit3, Trash2, ExternalLink, RefreshCw, X, FileText,
  UserCheck, UserX, HelpCircle, ArrowRight
} from 'lucide-react';

const DRIVES_API = '/api/v1/drives/placement-drives';
const COMPANIES_API = '/api/v1/drives';
const STUDENT_API = '/api/v1/students/profile';

const ALL_BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME'];
const DRIVE_STATUSES = [
  'UPCOMING',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];
const ROUND_TYPES = ['APTITUDE', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'CODING_TEST', 'OTHER'];

export default function PlacementDrives() {
  const { user, token, apiFetch } = useAuth();

  const [activeTab, setActiveTab] = useState('all-drives'); // 'all-drives' | 'my-registrations'
  const [drives, setDrives] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savingDrive, setSavingDrive] = useState(false);
  const [modalError, setModalError] = useState('');

  // Candidate Management Modal (Admin)
  const [selectedDriveForCandidates, setSelectedDriveForCandidates] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Drive Form State (Admin)
  const [driveForm, setDriveForm] = useState({
    title: '',
    companyId: '',
    academicYear: '2025-2026',
    batchYear: '2026',
    venue: 'RGUKT Ongole Campus & Virtual',
    minCgpa: '6.5',
    allowedBranches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'],
    maxActiveBacklogs: '0',
    maxHistoryBacklogs: '2',
    registrationDeadline: '',
    rounds: [],
  });

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Fetch all Drives
  const fetchDrives = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(DRIVES_API, { headers: headers() });
      const data = await res.json();
      if (res.ok) {
        setDrives(data.data?.drives || []);
      } else {
        setError(data.error?.message || 'Failed to load drives.');
      }
    } catch {
      setError('Network error. Unable to load placement drives.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Fetch Student's own registrations
  const fetchMyRegistrations = useCallback(async () => {
    if (user?.role !== 'STUDENT') return;
    try {
      const res = await fetch(`${DRIVES_API}/registrations/my`, { headers: headers() });
      const data = await res.json();
      if (res.ok) {
        setMyRegistrations(data.data?.registrations || []);
      }
    } catch {
      // Non-blocking
    }
  }, [user, headers]);

  // Fetch Student Profile (for automated eligibility check during registration)
  const fetchStudentProfile = useCallback(async () => {
    if (user?.role !== 'STUDENT') return;
    try {
      const res = await fetch(STUDENT_API, { headers: headers() });
      const data = await res.json();
      if (res.ok) {
        setStudentProfile(data.data?.profile || null);
      }
    } catch {
      // Non-blocking
    }
  }, [user, headers]);

  // Fetch verified Companies for the Admin selector
  const fetchCompanies = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    try {
      const res = await fetch(`${COMPANIES_API}?limit=50`, { headers: headers() });
      const data = await res.json();
      if (res.ok) {
        setCompanies(data.data?.companies || []);
      }
    } catch {
      // Non-blocking
    }
  }, [user, headers]);

  useEffect(() => {
    fetchDrives();
    fetchMyRegistrations();
    fetchStudentProfile();
    fetchCompanies();
  }, [fetchDrives, fetchMyRegistrations, fetchStudentProfile, fetchCompanies]);

  function handleBranchToggle(branch) {
    setDriveForm((prev) => {
      const exists = prev.allowedBranches.includes(branch);
      return {
        ...prev,
        allowedBranches: exists
          ? prev.allowedBranches.filter((b) => b !== branch)
          : [...prev.allowedBranches, branch],
      };
    });
  }

  function updateRound(index, field, value) {
    setDriveForm((previous) => ({
      ...previous,
      rounds: previous.rounds.map((round, roundIndex) =>
        roundIndex === index ? { ...round, [field]: value } : round
      ),
    }));
  }

  function addRound() {
    setDriveForm((previous) => ({
      ...previous,
      rounds: [
        ...previous.rounds,
        {
          roundNumber: previous.rounds.length + 1,
          roundType: 'OTHER',
          name: '',
          description: '',
          mode: 'ONLINE',
          scheduledDate: '',
          durationMinutes: '',
          venueOrLink: '',
          qualificationCriteria: '',
          status: 'PLANNED',
        },
      ],
    }));
  }

  function moveRound(index, direction) {
    setDriveForm((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.rounds.length) return previous;
      const rounds = [...previous.rounds];
      [rounds[index], rounds[target]] = [rounds[target], rounds[index]];
      return {
        ...previous,
        rounds: rounds.map((round, roundIndex) => ({ ...round, roundNumber: roundIndex + 1 })),
      };
    });
  }

  function removeRound(index) {
    setDriveForm((previous) => ({
      ...previous,
      rounds: previous.rounds
        .filter((_, roundIndex) => roundIndex !== index)
        .map((round, roundIndex) => ({ ...round, roundNumber: roundIndex + 1 })),
    }));
  }

  // Open Create Modal
  function handleOpenCreateModal() {
    const defaultDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setDriveForm({
      title: '',
      companyId: companies[0]?._id || '',
      academicYear: '2025-2026',
      batchYear: '2026',
      venue: 'RGUKT Ongole Campus & Virtual',
      minCgpa: '6.5',
      allowedBranches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'],
      maxActiveBacklogs: '0',
      maxHistoryBacklogs: '2',
      registrationDeadline: defaultDeadline,
      rounds: [],
    });
    setModalError('');
    setIsCreateModalOpen(true);
  }

  // Save Placement Drive (Admin)
  async function handleSaveDrive(e) {
    e.preventDefault();
    setSavingDrive(true);
    setModalError('');

    try {
      const payload = {
        title: driveForm.title,
        companyId: driveForm.companyId,
        academicYear: driveForm.academicYear,
        batchYear: parseInt(driveForm.batchYear) || 2026,
        venue: driveForm.venue,
        eligibilityCriteria: {
          minCgpa: parseFloat(driveForm.minCgpa) || 6.5,
          allowedBranches: driveForm.allowedBranches,
          maxActiveBacklogs: parseInt(driveForm.maxActiveBacklogs) || 0,
          maxHistoryBacklogs: parseInt(driveForm.maxHistoryBacklogs) || 2,
        },
        registrationWindow: {
          openDate: new Date(),
          closeDate: new Date(driveForm.registrationDeadline),
        },
        recruitmentRounds: driveForm.rounds.map((round, index) => ({
          ...round,
          roundNumber: index + 1,
          durationMinutes: round.durationMinutes ? Number(round.durationMinutes) : null,
          scheduledDate: round.scheduledDate || null,
        })),
        driveStatus: 'REGISTRATION_OPEN',
      };

      const res = await fetch(DRIVES_API, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Placement drive scheduled successfully!');
        setIsCreateModalOpen(false);
        fetchDrives();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setModalError(data.error?.message || 'Failed to schedule drive.');
      }
    } catch {
      setModalError('Network error. Please try again.');
    } finally {
      setSavingDrive(false);
    }
  }

  // Student Registers for Drive
  async function handleRegisterForDrive(drive) {
    if (!studentProfile) {
      alert('Please complete your Student Profile under My Profile before registering for drives.');
      return;
    }

    if (!window.confirm(`Confirm registration for "${drive.title}"? Your academic records will be verified against drive cutoffs.`)) {
      return;
    }

    try {
      const res = await fetch(`${DRIVES_API}/${drive._id}/register`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`Successfully registered for ${drive.title}!`);
        fetchDrives();
        fetchMyRegistrations();
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        const details = data.error?.details?.join('\n• ') || data.error?.message || 'Ineligible to register.';
        alert(`Registration Ineligible:\n\n• ${details}`);
      }
    } catch {
      alert('Network error while registering for drive.');
    }
  }

  // Admin Candidate Roster Modal
  async function handleOpenCandidatesModal(drive) {
    setSelectedDriveForCandidates(drive);
    setLoadingCandidates(true);
    try {
      const res = await fetch(`${DRIVES_API}/${drive._id}/registrations`, { headers: headers() });
      const data = await res.json();
      if (res.ok) {
        setCandidates(data.data?.registrations || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function handleUpdateCandidateRound(registrationId, roundNumber, newStatus) {
    try {
      const res = await fetch(`${DRIVES_API}/${selectedDriveForCandidates._id}/registrations/${registrationId}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          roundNumber,
          roundStatus: newStatus,
        }),
      });
      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => {
            if (c._id === registrationId) {
              const updatedRounds = c.roundProgress.map((r) =>
                r.roundNumber === roundNumber ? { ...r, status: newStatus } : r
              );
              return { ...c, roundProgress: updatedRounds };
            }
            return c;
          })
        );
      }
    } catch {
      // Non-blocking
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/40 p-6 sm:p-8 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <Award className="w-3.5 h-3.5" /> University Placement Cell
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Campus Placement Drives &amp; Selection Rounds</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Register for university hiring drives, track multi-stage interview rounds (Aptitude, Technical &amp; HR), and monitor real-time qualification statuses.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Placement Drive</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('all-drives')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'all-drives'
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
            }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Active Placement Drives ({drives.length})</span>
        </button>

        {user?.role === 'STUDENT' && (
          <button
            onClick={() => setActiveTab('my-registrations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'my-registrations'
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>My Registered Drives ({myRegistrations.length})</span>
          </button>
        )}
      </div>

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

      {/* Tab 1: All Active Drives */}
      {activeTab === 'all-drives' && (
        <div className="space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
              <p className="text-sm">Fetching scheduled drives...</p>
            </div>
          ) : drives.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">No Active Placement Drives</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                No recruitment drives are currently scheduled. When the TPO cell announces new drives, they will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drives.map((drive) => {
                const isRegistered = myRegistrations.some((r) => r.driveId?._id === drive._id || r.driveId === drive._id);
                const isExpired = new Date(drive.registrationWindow?.closeDate).getTime() < Date.now();

                return (
                  <div
                    key={drive._id}
                    className="bg-slate-800/60 border border-slate-700/80 hover:border-emerald-500/40 rounded-2xl p-6 flex flex-col justify-between transition shadow-sm space-y-4"
                  >
                    <div>
                      {/* Top Bar: Company Logo & Title */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {drive.companyLogo ? (
                            <img
                              src={drive.companyLogo}
                              alt={drive.companyName}
                              className="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-slate-700 p-1.5"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400">
                              <Building2 className="w-6 h-6" />
                            </div>
                          )}

                          <div>
                            <h3 className="font-bold text-white text-base leading-snug">{drive.title}</h3>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>{drive.companyName}</span>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono text-emerald-400">{drive.driveCode}</span>
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${drive.driveStatus === 'REGISTRATION_OPEN'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                          }`}>
                          {drive.driveStatus?.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Recruitment Rounds Timeline Badges */}
                      <div className="mt-4 pt-3 border-t border-slate-700/60">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Scheduled Recruitment Stages ({drive.recruitmentRounds?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {drive.recruitmentRounds?.map((round, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-slate-300"
                            >
                              <span className="w-4 h-4 rounded-full bg-emerald-600/30 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                                {round.roundNumber}
                              </span>
                              <span>{round.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Eligibility & Cutoff Info Box */}
                      <div className="mt-4 bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-500 block">Min B.Tech Cutoff:</span>
                          <span className="font-semibold text-white">{drive.eligibilityCriteria?.minCgpa ?? 6.5} CGPA</span>
                        </div>

                        <div>
                          <span className="text-slate-500 block">Max Backlogs:</span>
                          <span className="font-semibold text-white">{drive.eligibilityCriteria?.maxActiveBacklogs ?? 0}</span>
                        </div>

                        <div className="col-span-2">
                          <span className="text-slate-500 block mb-0.5">Eligible Branches:</span>
                          <span className="text-slate-300 font-medium">
                            {drive.eligibilityCriteria?.allowedBranches?.join(', ') || 'All Branches'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Deadline: {new Date(drive.registrationWindow?.closeDate).toLocaleDateString()}</span>
                      </div>

                      {user?.role === 'STUDENT' ? (
                        isRegistered ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                            <Check className="w-4 h-4" /> Registered
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegisterForDrive(drive)}
                            disabled={isExpired || drive.driveStatus !== 'REGISTRATION_OPEN'}
                            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow-md shadow-emerald-600/20"
                          >
                            <span>{isExpired ? 'Closed' : 'Register for Drive'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : drive.canViewCandidates ? (
                        <button
                          onClick={() => handleOpenCandidatesModal(drive)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Candidates ({drive.registeredStudentsCount || 0})</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Student My Registered Drives */}
      {activeTab === 'my-registrations' && user?.role === 'STUDENT' && (
        <div className="space-y-5">
          {myRegistrations.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">No Active Registrations</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                You haven't registered for any placement drives yet. Switch to the Active Drives tab to explore open opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myRegistrations.map((reg) => (
                <div
                  key={reg._id}
                  className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-700/60">
                    <div>
                      <h3 className="text-lg font-bold text-white">{reg.driveTitle}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{reg.companyName}</span>
                        <span>•</span>
                        <span>Registered on {new Date(reg.registeredAt).toLocaleDateString()}</span>
                      </p>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
                      Registration Status: {reg.status}
                    </span>
                  </div>

                  {/* Multi-Round Progress Tracker */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Recruitment Selection Pipeline
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {reg.roundProgress?.map((round, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border transition ${round.status === 'CLEARED'
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : round.status === 'ELIMINATED'
                                ? 'bg-rose-950/20 border-rose-500/30'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-300">
                              Round {round.roundNumber}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${round.status === 'CLEARED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : round.status === 'ELIMINATED'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                              {round.status}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-white">{round.roundName}</p>
                          {round.remarks && (
                            <p className="text-[11px] text-slate-400 mt-1 italic">"{round.remarks}"</p>
                          )}
                        </div>
                      ))}
                      {(!reg.roundProgress || reg.roundProgress.length === 0) && (
                        <p className="text-xs text-slate-500">No recruitment rounds were configured for this drive.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Schedule Drive Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Schedule Campus Placement Drive</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
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

            <form onSubmit={handleSaveDrive} className="space-y-6 text-sm">
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">1. Drive Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Drive Title *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. TCS Digital Campus Recruitment 2026"
                      value={driveForm.title}
                      onChange={(e) => setDriveForm({ ...driveForm, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Associated Company *</label>
                    <select
                      required
                      value={driveForm.companyId}
                      onChange={(e) => setDriveForm({ ...driveForm, companyId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Company</option>
                      {companies.map((c) => (
                        <option key={c._id} value={c._id}>{c.name} ({c.industry})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Graduation Batch Year</label>
                    <input
                      type="number"
                      value={driveForm.batchYear}
                      onChange={(e) => setDriveForm({ ...driveForm, batchYear: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Eligibility Cutoffs */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">2. Academic Eligibility Cutoffs</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Minimum B.Tech CGPA</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={driveForm.minCgpa}
                      onChange={(e) => setDriveForm({ ...driveForm, minCgpa: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Max Active Backlogs</label>
                    <input
                      type="number"
                      min="0"
                      value={driveForm.maxActiveBacklogs}
                      onChange={(e) => setDriveForm({ ...driveForm, maxActiveBacklogs: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Allowed Branches</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_BRANCHES.map((b) => {
                      const selected = driveForm.allowedBranches.includes(b);
                      return (
                        <button
                          type="button"
                          key={b}
                          onClick={() => handleBranchToggle(b)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selected
                              ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recruitment Rounds */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">3. Recruitment Rounds</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Rounds are optional. Add and order any number of selection stages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addRound}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Round
                  </button>
                </div>
                {driveForm.rounds.map((round, index) => (
                  <div key={index} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Round {index + 1}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={index === 0} onClick={() => moveRound(index, -1)} className="text-xs text-slate-300 disabled:opacity-30">Up</button>
                        <button type="button" disabled={index === driveForm.rounds.length - 1} onClick={() => moveRound(index, 1)} className="text-xs text-slate-300 disabled:opacity-30">Down</button>
                        <button type="button" onClick={() => removeRound(index)} className="text-xs text-rose-400">Remove</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-[11px] text-slate-400">
                        Round name *
                        <input required minLength={2} value={round.name} onChange={(e) => updateRound(index, 'name', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs" />
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Round type *
                        <select required value={round.roundType} onChange={(e) => updateRound(index, 'roundType', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs">
                          {ROUND_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Mode
                        <select value={round.mode} onChange={(e) => updateRound(index, 'mode', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs">
                          <option value="ONLINE">Online</option>
                          <option value="IN_PERSON">Offline</option>
                          <option value="HYBRID">Hybrid</option>
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Date and time
                        <input type="datetime-local" value={round.scheduledDate || ''} onChange={(e) => updateRound(index, 'scheduledDate', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs" />
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Duration (minutes)
                        <input type="number" min="1" value={round.durationMinutes} onChange={(e) => updateRound(index, 'durationMinutes', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs" />
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Status
                        <select value={round.status} onChange={(e) => updateRound(index, 'status', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs">
                          {['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-400 sm:col-span-2">
                        Meeting link or venue
                        <input value={round.venueOrLink} onChange={(e) => updateRound(index, 'venueOrLink', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs" />
                      </label>
                      <label className="text-[11px] text-slate-400 sm:col-span-2">
                        Description
                        <textarea rows={2} value={round.description} onChange={(e) => updateRound(index, 'description', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs" />
                      </label>
                      <label className="text-[11px] text-slate-400 sm:col-span-2">
                        Qualification criteria
                        <textarea rows={2} value={round.qualificationCriteria} onChange={(e) => updateRound(index, 'qualificationCriteria', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Deadline */}
              <div className="space-y-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">4. Registration Deadline</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Registration Close Date *</label>
                  <input
                    required
                    type="datetime-local"
                    value={driveForm.registrationDeadline}
                    onChange={(e) => setDriveForm({ ...driveForm, registrationDeadline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDrive}
                  className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {savingDrive && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Publish Placement Drive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Registered Candidates Modal */}
      {selectedDriveForCandidates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>Registered Candidates: {selectedDriveForCandidates.title}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total Applicants: {candidates.length} students
                </p>
              </div>
              <button
                onClick={() => setSelectedDriveForCandidates(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingCandidates ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
                <p className="text-xs">Loading candidate roster...</p>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-sm">No students have registered for this drive yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Branch &amp; CGPA</th>
                      <th className="py-2.5 px-3">Backlogs</th>
                      <th className="py-2.5 px-3">Resume</th>
                      {selectedDriveForCandidates.recruitmentRounds?.map((round) => (
                        <th key={round.roundNumber} className="py-2.5 px-3">
                          Round {round.roundNumber}: {round.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {candidates.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-white">{c.studentName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{c.studentId}</p>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-medium text-emerald-400">{c.branch}</span> • {c.btechCgpa} CGPA
                        </td>

                        <td className="py-2.5 px-3">
                          {c.activeBacklogs}
                        </td>

                        <td className="py-2.5 px-3">
                          {c.resumeFileName ? (
                            <a
                              href={`${DRIVES_API}/${selectedDriveForCandidates._id}/registrations/${c._id}/resume`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <FileText className="w-3.5 h-3.5" /> View
                            </a>
                          ) : <span className="text-slate-500">Not uploaded</span>}
                        </td>

                        {(selectedDriveForCandidates.recruitmentRounds || []).map((driveRound) => {
                          const roundNum = driveRound.roundNumber;
                          const round = c.roundProgress?.find((r) => r.roundNumber === roundNum);
                          const roundStatus = round?.status || 'PENDING';

                          return (
                            <td key={roundNum} className="py-2.5 px-3">
                              {selectedDriveForCandidates.canManageRecruitment ? (
                                <select
                                  value={roundStatus}
                                  onChange={(e) => handleUpdateCandidateRound(c._id, roundNum, e.target.value)}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold border ${roundStatus === 'CLEARED'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                      : roundStatus === 'ELIMINATED'
                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                        : 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="CLEARED">CLEARED</option>
                                  <option value="ELIMINATED">ELIMINATED</option>
                                  <option value="ABSENT">ABSENT</option>
                                </select>
                              ) : (
                                <span className="text-slate-300">{roundStatus}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
