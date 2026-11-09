import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  User,
  GraduationCap,
  Award,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  BookOpen,
  Briefcase,
  Link as LinkIcon,
} from 'lucide-react';

const BRANCHES = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "CHEM", "MME"];
const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];

export default function StudentProfile() {
  const { accessToken, user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Profile Form State
  const [profile, setProfile] = useState({
    fullName: '',
    studentId: '',
    email: '',
    phone: '',
    gender: 'PREFER_NOT_TO_SAY',
    dateOfBirth: '',
    branch: '',
    batchYear: '',
    tenthPercentage: '',
    pucCgpa: '',
    btechCgpa: '',
    activeBacklogs: '',
    backlogHistory: '',
    semesters: [],
    technicalSkills: [],
    nonTechnicalSkills: [],
    projects: [],
    certifications: [],
    resumeUrl: '',
    resumeOriginalName: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    completionPercentage: 0,
    verificationStatus: 'PENDING',
    verificationNotes: '',
  });

  // Local helper states for adding skills/projects
  const [techSkillInput, setTechSkillInput] = useState('');
  const [softSkillInput, setSoftSkillInput] = useState('');
  const [newProject, setNewProject] = useState({ title: '', description: '', technologies: '', githubUrl: '', projectUrl: '' });
  const [newCert, setNewCert] = useState({ name: '', issuingOrganization: '', credentialUrl: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/students/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success && data.data?.profile) {
        const p = data.data.profile;
        setProfile({
          ...p,
          studentId: p.studentId || user?.studentId || '',
          branch: p.branch || '',
          batchYear: p.batchYear ?? '',
          tenthPercentage: p.tenthPercentage ?? '',
          pucCgpa: p.pucCgpa ?? '',
          btechCgpa: p.btechCgpa ?? '',
          activeBacklogs: p.activeBacklogs ?? '',
          backlogHistory: p.backlogHistory ?? '',
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.substring(0, 10) : '',
        });
      } else {
        setError(data.error?.message || 'Failed to load profile');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to Student Service');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        ...profile,
        tenthPercentage: profile.tenthPercentage === '' ? null : Number(profile.tenthPercentage),
        pucCgpa: profile.pucCgpa === '' ? null : Number(profile.pucCgpa),
        btechCgpa: profile.btechCgpa === '' ? null : Number(profile.btechCgpa),
        activeBacklogs: profile.activeBacklogs === '' ? null : Number(profile.activeBacklogs),
        backlogHistory: profile.backlogHistory === '' ? null : Number(profile.backlogHistory),
        batchYear: profile.batchYear === '' ? null : Number(profile.batchYear),
      };

      const res = await fetch('/api/v1/students/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.data?.profile) {
        setMessage('✓ Profile updated successfully!');
        setProfile((prev) => ({
          ...prev,
          ...data.data.profile,
          completionPercentage: data.data.profile.completionPercentage,
        }));
        updateUser({
          fullName: data.data.profile.fullName || user?.fullName,
          email: data.data.profile.email || user?.email,
        });
        window.dispatchEvent(new CustomEvent('placement:user-profile-updated', {
          detail: {
            fullName: data.data.profile.fullName,
            email: data.data.profile.email,
          },
        }));
      } else {
        setError(data.error?.message || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.message || 'Error saving profile updates');
    } finally {
      setSaving(false);
    }
  }

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Resume file exceeds maximum allowed size of 5 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    setUploadingResume(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/v1/students/profile/resume', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data) {
        setMessage('✓ Resume uploaded successfully!');
        setProfile((prev) => ({
          ...prev,
          resumeUrl: data.data.resumeUrl,
          resumeOriginalName: data.data.originalName,
          completionPercentage: data.data.completionPercentage,
        }));
      } else {
        setError(data.error?.message || 'Failed to upload resume document');
      }
    } catch (err) {
      setError(err.message || 'Network error during resume upload');
    } finally {
      setUploadingResume(false);
    }
  }

  // Skill Handlers
  function addTechSkill() {
    if (!techSkillInput.trim()) return;
    if (!profile.technicalSkills.includes(techSkillInput.trim())) {
      setProfile((prev) => ({
        ...prev,
        technicalSkills: [...prev.technicalSkills, techSkillInput.trim()],
      }));
    }
    setTechSkillInput('');
  }

  function removeTechSkill(skill) {
    setProfile((prev) => ({
      ...prev,
      technicalSkills: prev.technicalSkills.filter((s) => s !== skill),
    }));
  }

  function addSoftSkill() {
    if (!softSkillInput.trim()) return;
    if (!profile.nonTechnicalSkills.includes(softSkillInput.trim())) {
      setProfile((prev) => ({
        ...prev,
        nonTechnicalSkills: [...prev.nonTechnicalSkills, softSkillInput.trim()],
      }));
    }
    setSoftSkillInput('');
  }

  function removeSoftSkill(skill) {
    setProfile((prev) => ({
      ...prev,
      nonTechnicalSkills: prev.nonTechnicalSkills.filter((s) => s !== skill),
    }));
  }

  // Project Handlers
  function addProject() {
    if (!newProject.title.trim()) return;
    const projectToAdd = {
      title: newProject.title.trim(),
      description: newProject.description.trim(),
      technologies: newProject.technologies ? newProject.technologies.split(',').map((t) => t.trim()) : [],
      githubUrl: newProject.githubUrl.trim(),
      projectUrl: newProject.projectUrl.trim(),
    };
    setProfile((prev) => ({
      ...prev,
      projects: [...prev.projects, projectToAdd],
    }));
    setNewProject({ title: '', description: '', technologies: '', githubUrl: '', projectUrl: '' });
  }

  function removeProject(index) {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  }

  // Certification Handlers
  function addCert() {
    if (!newCert.name.trim()) return;
    const certToAdd = {
      name: newCert.name.trim(),
      issuingOrganization: newCert.issuingOrganization.trim(),
      credentialUrl: newCert.credentialUrl.trim(),
    };
    setProfile((prev) => ({
      ...prev,
      certifications: [...prev.certifications, certToAdd],
    }));
    setNewCert({ name: '', issuingOrganization: '', credentialUrl: '' });
  }

  function removeCert(index) {
    setProfile((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400">Loading student profile details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Profile Completion Card */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-800 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-2xl shadow-lg">
            {profile.fullName ? profile.fullName.charAt(0) : 'S'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold text-white">{profile.fullName || 'Student Profile'}</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700 text-slate-200 uppercase font-mono">
                {profile.studentId || user?.studentId || '—'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {profile.branch || 'Branch not provided'} • Batch {profile.batchYear || 'not provided'} • RGUKT Ongole
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  profile.verificationStatus === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : profile.verificationStatus === 'REJECTED'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                TPO Status: {profile.verificationStatus}
              </span>
              {profile.verificationNotes && (
                <span className="text-[11px] text-slate-400 truncate max-w-xs italic">
                  Note: {profile.verificationNotes}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Completion Indicator */}
        <div className="w-full sm:w-64 bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Profile Completion</span>
            <span className="text-emerald-400 font-bold">{profile.completionPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                profile.completionPercentage >= 80
                  ? 'bg-emerald-500'
                  : profile.completionPercentage >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${profile.completionPercentage}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {profile.completionPercentage < 80 ? 'Complete academics, skills & upload resume for eligibility' : 'Profile ready for placement applications'}
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: Personal & Identification Information */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2 border-b border-slate-700/60 pb-3">
            <User className="w-4 h-4 text-emerald-400" />
            <span>1. Personal & Identification Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Full Legal Name</label>
              <input
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">RGUKT Student ID</label>
              <input
                type="text"
                disabled
                value={profile.studentId || user?.studentId || ''}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400 font-mono cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={profile.email}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Phone Number</label>
              <input
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Gender</label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Date of Birth</label>
              <input
                type="date"
                value={profile.dateOfBirth || ''}
                onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Academic Performance & CGPA */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2 border-b border-slate-700/60 pb-3">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <span>2. Academic Records & Eligibility Credentials</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Branch / Department</label>
              <select
                value={profile.branch}
                onChange={(e) => setProfile({ ...profile, branch: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">Select branch</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Academic Batch (Passing Year)</label>
              <input
                type="number"
                min="2000"
                max="2200"
                value={profile.batchYear}
                onChange={(e) => setProfile({ ...profile, batchYear: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Current B.Tech CGPA</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={profile.btechCgpa}
                onChange={(e) => setProfile({ ...profile, btechCgpa: e.target.value })}
                placeholder="e.g. 8.45"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Active Backlogs</label>
              <input
                type="number"
                min="0"
                value={profile.activeBacklogs}
                onChange={(e) => setProfile({ ...profile, activeBacklogs: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">History of Backlogs</label>
              <input
                type="number"
                min="0"
                value={profile.backlogHistory}
                onChange={(e) => setProfile({ ...profile, backlogHistory: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">10th Class Percentage (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={profile.tenthPercentage}
                onChange={(e) => setProfile({ ...profile, tenthPercentage: e.target.value })}
                placeholder="e.g. 95.0"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">PUC CGPA (0-10)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={profile.pucCgpa}
                onChange={(e) => setProfile({ ...profile, pucCgpa: e.target.value })}
                placeholder="e.g. 9.20"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Skills (Technical & Non-Technical) */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2 border-b border-slate-700/60 pb-3">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>3. Technical & Non-Technical Skills</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Technical Skills */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-medium">Technical Skills (e.g. React, Java, Python)</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={techSkillInput}
                  onChange={(e) => setTechSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTechSkill(); } }}
                  placeholder="Type skill & press Add"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={addTechSkill}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {profile.technicalSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeTechSkill(skill)}
                      className="hover:text-rose-400 transition"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Non-Technical Skills */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-medium">Non-Technical Skills (e.g. Leadership, Problem Solving)</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={softSkillInput}
                  onChange={(e) => setSoftSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSoftSkill(); } }}
                  placeholder="Type soft skill & press Add"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={addSoftSkill}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {profile.nonTechnicalSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSoftSkill(skill)}
                      className="hover:text-rose-400 transition"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Projects & Certifications */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2 border-b border-slate-700/60 pb-3">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            <span>4. Key Projects & Certifications</span>
          </h3>

          {/* Add Project Form */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3 text-xs">
            <span className="font-semibold text-slate-300 block">Add New Project:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Project Title"
                value={newProject.title}
                onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
              <input
                type="text"
                placeholder="Technologies Used (comma separated)"
                value={newProject.technologies}
                onChange={(e) => setNewProject({ ...newProject, technologies: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
              <input
                type="url"
                placeholder="GitHub Repo URL"
                value={newProject.githubUrl}
                onChange={(e) => setNewProject({ ...newProject, githubUrl: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
              <input
                type="url"
                placeholder="Live Project URL"
                value={newProject.projectUrl}
                onChange={(e) => setNewProject({ ...newProject, projectUrl: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <textarea
              rows="2"
              placeholder="Brief Project Description"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
            ></textarea>
            <button
              type="button"
              onClick={addProject}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
            >
              Add Project
            </button>
          </div>

          {/* Project List */}
          <div className="space-y-2 pt-2">
            {profile.projects.map((proj, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-xs flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white">{proj.title}</h4>
                  <p className="text-slate-400 mt-0.5">{proj.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {proj.technologies?.map((tech, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeProject(idx)}
                  className="text-slate-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Resume Upload */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2 border-b border-slate-700/60 pb-3">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>5. Resume Document</span>
          </h3>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <div>
              <div className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Placement Resume</span>
                {profile.resumeUrl ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Uploaded
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Missing
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Accepted formats: PDF, DOC, DOCX. Maximum file size: 5 MB.
              </p>
              {profile.resumeUrl && (
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium mt-2 transition"
                >
                  <span>View Current Resume ({profile.resumeOriginalName || 'Download'})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div>
              <label className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition">
                <Upload className="w-4 h-4" />
                <span>{uploadingResume ? 'Uploading...' : 'Upload New Resume'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  onChange={handleResumeUpload}
                  disabled={uploadingResume}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Section 6: Professional Profiles */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2 border-b border-slate-700/60 pb-3">
            <LinkIcon className="w-4 h-4 text-emerald-400" />
            <span>6. Professional & Portfolio Links</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">LinkedIn Profile</label>
              <input
                type="url"
                value={profile.linkedinUrl || ''}
                onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">GitHub Profile</label>
              <input
                type="url"
                value={profile.githubUrl || ''}
                onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
                placeholder="https://github.com/username"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Portfolio / Website</label>
              <input
                type="url"
                value={profile.portfolioUrl || ''}
                onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                placeholder="https://saikumar.dev"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
