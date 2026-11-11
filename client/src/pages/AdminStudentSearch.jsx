import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ExternalLink,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';

const BRANCHES = ["ALL", "CSE", "ECE", "EEE", "MECH", "CIVIL", "CHEM", "MME"];
const STATUSES = ["ALL", "PENDING", "VERIFIED", "REJECTED"];

export default function AdminStudentSearch() {
  const { accessToken } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxBacklogs, setMaxBacklogs] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoading(true);
    setDirectoryError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedBranch !== 'ALL') params.append('branch', selectedBranch);
      if (selectedStatus !== 'ALL') params.append('verificationStatus', selectedStatus);
      if (minCgpa) params.append('minCgpa', minCgpa);
      if (maxBacklogs) params.append('maxBacklogs', maxBacklogs);

      const res = await fetch(`/api/v1/students/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (data.success && data.data?.students) {
        setStudents(data.data.students);
      } else {
        setDirectoryError(data.error?.message || 'Failed to fetch student directory');
      }
    } catch (err) {
      setDirectoryError(err.message || 'Error connecting to Student Service');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(studentId, newStatus) {
    setActionMessage('');
    setVerificationError('');
    try {
      const notes = prompt(`Enter verification note for ${studentId}:`, `Status changed to ${newStatus} by TPO.`);
      const res = await fetch(`/api/v1/students/${studentId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          verificationStatus: newStatus,
          verificationNotes: notes || `Marked as ${newStatus}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage(`✓ Student ${studentId} marked as ${newStatus}`);
        setStudents((prev) =>
          prev.map((s) => (s._id === studentId ? { ...s, verificationStatus: newStatus } : s))
        );
      } else {
        setVerificationError(data.error?.message || 'Verification update failed');
      }
    } catch (err) {
      setVerificationError(err.message || 'Error executing verification update');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <GraduationCap className="w-6 h-6 text-emerald-400" />
            <span>Student Placement Directory & Verification</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Search academic records, filter by CGPA/backlogs, inspect uploaded resumes, and verify candidates.
          </p>
        </div>
        <button
          onClick={fetchStudents}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {actionMessage}
        </div>
      )}

      {directoryError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Student directory: {directoryError}</span>
        </div>
      )}

      {verificationError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Verification update failed: {verificationError}</span>
        </div>
      )}

      {/* Search & Multi-Filters Toolbar */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by Student ID (e.g. O180123), Full Name, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchStudents(); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <button
            onClick={fetchStudents}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
          >
            Apply Filters
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div>
            <label className="block text-slate-400 mb-1">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
            >
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Verification Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Min CGPA</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              placeholder="e.g. 7.5"
              value={minCgpa}
              onChange={(e) => setMinCgpa(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Max Active Backlogs</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 0"
              value={maxBacklogs}
              onChange={(e) => setMaxBacklogs(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Student Records List */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading student directory...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No student profiles match your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Branch & Batch</th>
                  <th className="py-3 px-4">Academic Record</th>
                  <th className="py-3 px-4">Resume</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {students.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{s.fullName}</div>
                      <div className="text-[11px] font-mono text-emerald-400">{s.studentId}</div>
                      <div className="text-[10px] text-slate-500">{s.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-semibold bg-slate-700 text-slate-200">
                        {s.branch || 'Not provided'}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Batch {s.batchYear ?? 'Not provided'}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono">
                      <div>
                        CGPA: <span className="font-bold text-white">{s.btechCgpa ?? 'Not provided'}</span>
                      </div>
                      <div className={s.activeBacklogs > 0 ? "text-rose-400 font-semibold" : "text-slate-400"}>
                        Backlogs: {s.activeBacklogs ?? 'Not provided'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {s.resumeUrl ? (
                        <Link
                          to={`/resume/student/${encodeURIComponent(s._id)}`}
                          state={{ fileName: s.resumeFileName || s.resumeOriginalName || 'resume.pdf' }}
                          className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-medium transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Resume</span>
                        </Link>
                      ) : (
                        <span className="text-slate-500 italic">Not Uploaded</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          s.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : s.verificationStatus === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {s.verificationStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5">
                      {s.verificationStatus !== 'VERIFIED' && (
                        <button
                          onClick={() => handleVerification(s._id, 'VERIFIED')}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition text-[11px]"
                        >
                          Verify
                        </button>
                      )}
                      {s.verificationStatus !== 'REJECTED' && (
                        <button
                          onClick={() => handleVerification(s._id, 'REJECTED')}
                          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition text-[11px]"
                        >
                          Reject
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
