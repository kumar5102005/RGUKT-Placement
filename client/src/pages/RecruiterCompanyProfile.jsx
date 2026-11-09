import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Building2, MapPin, Mail, Phone, Globe, Linkedin, ExternalLink,
  CheckCircle2, Clock, XCircle, Save, Plus, AlertCircle, Loader2,
  Briefcase, Edit3, Trash2, UserPlus, Users, X
} from 'lucide-react';

const API_BASE = '/api/v1/drives';

const INDUSTRIES = [
  'IT Services', 'Software Product', 'Core Engineering', 'Banking & Finance',
  'Consulting', 'Healthcare', 'E-Commerce', 'Manufacturing',
  'Telecommunications', 'Education & Ed-Tech', 'Government & PSU',
  'Research & Development', 'Other',
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Maharashtra',
  'Delhi', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal',
  'Kerala', 'Madhya Pradesh', 'Bihar', 'Punjab', 'Haryana', 'Other',
];

function StatusBadge({ status }) {
  const map = {
    PENDING: { icon: Clock, cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Pending Verification' },
    VERIFIED: { icon: CheckCircle2, cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Verified' },
    REJECTED: { icon: XCircle, cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30', label: 'Rejected' },
  };
  const cfg = map[status] || map.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function FormField({ label, error, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

function inputClass(err) {
  return `w-full px-3 py-2.5 rounded-lg bg-slate-800 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
    err ? 'border-rose-500 focus:ring-rose-500/40' : 'border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500'
  }`;
}

export default function RecruiterCompanyProfile() {
  const { token, user } = useAuth();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [editMode, setEditMode] = useState(false);

  const [form, setForm] = useState({
    name: '', industry: '', description: '', websiteUrl: '',
    logoUrl: '', contactEmail: '', contactPhone: '', hrName: '',
    linkedinUrl: '', glassdoorUrl: '',
    location: { city: '', state: '', country: 'India' },
  });

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Recruiter Management State
  const [showAddRecruiterModal, setShowAddRecruiterModal] = useState(false);
  const [addingRecruiter, setAddingRecruiter] = useState(false);
  const [recruiterSuccess, setRecruiterSuccess] = useState('');
  const [recruiterError, setRecruiterError] = useState('');
  const [newRecruiter, setNewRecruiter] = useState({
    email: '',
    designation: 'Technical Recruiter',
    phone: '',
    canManageRecruitment: false,
  });
  const currentUserId = String(user?.id || user?._id || '');
  const canManageRecruiters = Boolean(
    company &&
    (String(company.registeredBy) === currentUserId ||
      company.recruiters?.some(
        (recruiter) =>
          String(recruiter.userId) === currentUserId &&
          recruiter.role === 'PRIMARY' &&
          recruiter.status !== 'INACTIVE'
      ))
  );

  const handleAddRecruiter = async (e) => {
    e.preventDefault();
    setAddingRecruiter(true);
    setRecruiterError('');
    setRecruiterSuccess('');
    try {
      const res = await fetch(`${API_BASE}/my/recruiters`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(newRecruiter),
      });
      const data = await res.json();
      if (res.ok) {
        setCompany(data.data.company);
        setRecruiterSuccess(`Recruiter "${data.data.recruiter.fullName}" added successfully.`);
        setNewRecruiter({
          email: '',
          designation: 'Technical Recruiter',
          phone: '',
          canManageRecruitment: false,
        });
      } else {
        setRecruiterError(data.error?.message || 'Failed to add recruiter.');
      }
    } catch {
      setRecruiterError('Network error while adding recruiter.');
    } finally {
      setAddingRecruiter(false);
    }
  };

  const handleRemoveRecruiter = async (recruiterId, recruiterName) => {
    if (!window.confirm(`Are you sure you want to remove ${recruiterName} from your recruitment team?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/my/recruiters/${recruiterId}`, {
        method: 'DELETE',
        headers: headers(),
      });
      const data = await res.json();
      if (res.ok) {
        setCompany(data.data.company);
        setRecruiterSuccess(`Recruiter ${recruiterName} removed successfully.`);
        setTimeout(() => setRecruiterSuccess(''), 4000);
      } else {
        setRecruiterError(data.error?.message || 'Failed to remove recruiter.');
      }
    } catch {
      setRecruiterError('Network error removing recruiter.');
    }
  };

  const handleToggleRecruiterStatus = async (recruiterId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`${API_BASE}/my/recruiters/${recruiterId}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompany(data.data.company);
        setRecruiterSuccess(`Recruiter marked as ${nextStatus}.`);
        setTimeout(() => setRecruiterSuccess(''), 3000);
      } else {
        setRecruiterError(data.error?.message || 'Failed to update status.');
      }
    } catch {
      setRecruiterError('Network error updating recruiter status.');
    }
  };

  const handleToggleRecruiterPermission = async (recruiter, canManageRecruitment) => {
    const recruiterId = recruiter._id || recruiter.userId;
    try {
      const res = await fetch(`${API_BASE}/my/recruiters/${recruiterId}/permissions`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ canManageRecruitment }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompany((previous) => ({
          ...previous,
          recruiters: previous.recruiters.map((entry) =>
            entry._id === recruiter._id ? data.data.recruiter : entry
          ),
        }));
        setRecruiterSuccess(`Recruitment decision permission ${canManageRecruitment ? 'granted' : 'removed'} for ${recruiter.fullName}.`);
        setTimeout(() => setRecruiterSuccess(''), 4000);
      } else {
        setRecruiterError(data.error?.message || 'Failed to update recruiter permissions.');
      }
    } catch {
      setRecruiterError('Network error updating recruiter permissions.');
    }
  };

  // Load existing company
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await fetch(`${API_BASE}/my`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          setCompany(data.data.company);
          populateForm(data.data.company);
        } else if (res.status === 404) {
          setIsRegistering(true);
          setEditMode(true);
        }
      } catch {
        setErrorMsg('Failed to load company data.');
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [headers]);

  function populateForm(c) {
    setForm({
      name: c.name || '', industry: c.industry || '', description: c.description || '',
      websiteUrl: c.websiteUrl || '', logoUrl: c.logoUrl || '',
      contactEmail: c.contactEmail || '', contactPhone: c.contactPhone || '',
      hrName: c.hrName || '', linkedinUrl: c.linkedinUrl || '', glassdoorUrl: c.glassdoorUrl || '',
      location: { city: c.location?.city || '', state: c.location?.state || '', country: c.location?.country || 'India' },
    });
  }

  function handleChange(e) {
    const { name, value } = e.target;
    if (name.startsWith('location.')) {
      const key = name.split('.')[1];
      setForm(f => ({ ...f, location: { ...f.location, [key]: value } }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.industry) e.industry = 'Please select an industry';
    if (!form.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      e.contactEmail = 'Valid contact email is required';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const valErrors = validate();
    if (Object.keys(valErrors).length > 0) { setErrors(valErrors); return; }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const method = isRegistering ? 'POST' : 'PUT';
      const url = isRegistering ? API_BASE : `${API_BASE}/my`;
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
      const data = await res.json();

      if (res.ok) {
        setCompany(data.data.company);
        setIsRegistering(false);
        setEditMode(false);
        setSuccessMsg(data.message || (isRegistering ? 'Company registered!' : 'Company updated!'));
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        const detail = data.error?.details?.map(d => d.message).join('. ') || data.error?.message || 'Failed to save.';
        setErrorMsg(detail);
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-400" />
            {isRegistering ? 'Register Your Company' : 'Company Profile'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isRegistering
              ? 'Register your company to post placement drives.'
              : 'Manage your company profile and recruiter information.'}
          </p>
        </div>
        {company && !editMode && canManageRecruiters && (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
          >
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* Verification Status Banner */}
      {company && !editMode && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Verification Status</p>
            <div className="mt-1.5"><StatusBadge status={company.verificationStatus} /></div>
            {company.verificationNotes && (
              <p className="text-xs text-slate-400 mt-2 italic">Admin note: {company.verificationNotes}</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Registered: {new Date(company.createdAt).toLocaleDateString()}</p>
            {company.verifiedAt && <p>Verified: {new Date(company.verifiedAt).toLocaleDateString()}</p>}
          </div>
        </div>
      )}

      {/* Success / Error */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{errorMsg}
        </div>
      )}

      {/* View Mode */}
      {company && !editMode && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-4">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-contain bg-slate-900 p-2 border border-slate-700" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-emerald-400" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">{company.name}</h2>
                <p className="text-sm text-emerald-400">{company.industry}</p>
                {company.location?.city && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {company.location.city}, {company.location.state}
                  </p>
                )}
              </div>
            </div>
            {company.description && <p className="text-sm text-slate-300">{company.description}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700">
              {company.contactEmail && (
                <div className="flex items-center gap-2 text-sm text-slate-300"><Mail className="w-4 h-4 text-slate-500" />{company.contactEmail}</div>
              )}
              {company.contactPhone && (
                <div className="flex items-center gap-2 text-sm text-slate-300"><Phone className="w-4 h-4 text-slate-500" />{company.contactPhone}</div>
              )}
              {company.hrName && (
                <div className="flex items-center gap-2 text-sm text-slate-300"><Briefcase className="w-4 h-4 text-slate-500" />HR: {company.hrName}</div>
              )}
              {company.websiteUrl && (
                <a href={company.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-400 hover:underline">
                  <Globe className="w-4 h-4" />Website <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {company.linkedinUrl && (
                <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-400 hover:underline">
                  <Linkedin className="w-4 h-4" />LinkedIn <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Company Recruitment Team Management */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Company Recruitment Team</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Link existing company accounts authorized to manage job postings, interview rounds, and candidate evaluations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecruiterError('');
                  setRecruiterSuccess('');
                  setShowAddRecruiterModal(true);
                }}
                hidden={!canManageRecruiters}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Recruiter</span>
              </button>
            </div>

            {recruiterSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                <span>{recruiterSuccess}</span>
                <button onClick={() => setRecruiterSuccess('')}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {recruiterError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                <span>{recruiterError}</span>
                <button onClick={() => setRecruiterError('')}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {(!company.recruiters || company.recruiters.length === 0) ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/30 rounded-lg border border-slate-800">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p>No additional recruiters registered yet.</p>
                <p className="text-slate-500 mt-1">Link a recruiter account that has already been registered.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {company.recruiters.map((r, i) => (
                  <div
                    key={r._id || r.userId || i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-slate-600 transition gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{r.fullName}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {r.designation || 'Recruiter'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            r.role === 'PRIMARY'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {r.role || 'SECONDARY'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            r.status === 'INACTIVE'
                              ? 'bg-slate-700/50 text-slate-400 border-slate-600'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {r.status || 'ACTIVE'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{r.email}</span>
                        </span>
                        {r.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{r.phone}</span>
                          </span>
                        )}
                        <span className="text-slate-500 text-[11px]">
                          Added: {new Date(r.addedAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                      {r.role !== 'PRIMARY' && (
                        <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={Boolean(r.canManageRecruitment)}
                            disabled={!canManageRecruiters || r.status === 'INACTIVE'}
                            onChange={(e) => handleToggleRecruiterPermission(r, e.target.checked)}
                            className="accent-emerald-500"
                          />
                          Can manage recruitment decisions
                        </label>
                      )}
                    </div>

                    {canManageRecruiters && r.role !== 'PRIMARY' && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleToggleRecruiterStatus(r._id || r.userId || r.email, r.status)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                          r.status === 'INACTIVE'
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {r.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecruiter(r._id || r.userId || r.email, r.fullName)}
                        title="Remove recruiter"
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form (Register or Edit) */}
      {(isRegistering || editMode) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" /> Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField label="Company Name" required error={errors.name}>
                  <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Accenture India Pvt. Ltd." className={inputClass(errors.name)} />
                </FormField>
              </div>
              <FormField label="Industry" required error={errors.industry}>
                <select name="industry" value={form.industry} onChange={handleChange} className={inputClass(errors.industry)}>
                  <option value="">Select Industry</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </FormField>
              <FormField label="Logo URL">
                <input name="logoUrl" value={form.logoUrl} onChange={handleChange} placeholder="https://..." className={inputClass()} />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Company Description">
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Brief description of your company..." className={inputClass()} />
                </FormField>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" /> Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Contact Email" required error={errors.contactEmail}>
                <input name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} placeholder="hr@company.com" className={inputClass(errors.contactEmail)} />
              </FormField>
              <FormField label="Contact Phone">
                <input name="contactPhone" value={form.contactPhone} onChange={handleChange} placeholder="+91 98765 43210" className={inputClass()} />
              </FormField>
              <FormField label="HR Manager Name">
                <input name="hrName" value={form.hrName} onChange={handleChange} placeholder="Name of HR contact" className={inputClass()} />
              </FormField>
              <FormField label="Website URL">
                <input name="websiteUrl" value={form.websiteUrl} onChange={handleChange} placeholder="https://www.company.com" className={inputClass()} />
              </FormField>
            </div>
          </div>

          {/* Location */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" /> Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="City">
                <input name="location.city" value={form.location.city} onChange={handleChange} placeholder="e.g. Hyderabad" className={inputClass()} />
              </FormField>
              <FormField label="State">
                <select name="location.state" value={form.location.state} onChange={handleChange} className={inputClass()}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Country">
                <input name="location.country" value={form.location.country} onChange={handleChange} className={inputClass()} />
              </FormField>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-emerald-400" /> Social & Additional Links
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="LinkedIn Page URL">
                <input name="linkedinUrl" value={form.linkedinUrl} onChange={handleChange} placeholder="https://linkedin.com/company/..." className={inputClass()} />
              </FormField>
              <FormField label="Glassdoor URL">
                <input name="glassdoorUrl" value={form.glassdoorUrl} onChange={handleChange} placeholder="https://glassdoor.com/..." className={inputClass()} />
              </FormField>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium text-sm transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRegistering ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
              {saving ? 'Saving...' : (isRegistering ? 'Register Company' : 'Save Changes')}
            </button>
            {!isRegistering && (
              <button
                type="button"
                onClick={() => { setEditMode(false); populateForm(company); setErrors({}); setErrorMsg(''); }}
                className="px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* Add Recruiter Modal */}
      {showAddRecruiterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Add Company Recruiter</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRecruiterModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recruiterError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{recruiterError}</span>
              </div>
            )}

            <form onSubmit={handleAddRecruiter} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Registered Recruiter Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newRecruiter.email}
                  onChange={(e) => setNewRecruiter({ ...newRecruiter, email: e.target.value })}
                  placeholder="Email used to create the recruiter account"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Designation / Job Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newRecruiter.designation}
                    onChange={(e) => setNewRecruiter({ ...newRecruiter, designation: e.target.value })}
                    placeholder="e.g. Talent Acquisition Lead"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={newRecruiter.phone}
                    onChange={(e) => setNewRecruiter({ ...newRecruiter, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-slate-400 space-y-1">
                <p>
                  Recruiters must already have an active recruiter account. They start read-only; enable decision management only for trusted company members.
                </p>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={newRecruiter.canManageRecruitment}
                  onChange={(e) => setNewRecruiter({ ...newRecruiter, canManageRecruitment: e.target.checked })}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>Allow this recruiter to manage application and placement-drive decisions.</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddRecruiterModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-700/50 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingRecruiter}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow disabled:opacity-60 transition"
                >
                  {addingRecruiter ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>{addingRecruiter ? 'Adding...' : 'Add Recruiter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
