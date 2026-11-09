import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';

const ROLE_LABELS = {
  STUDENT: 'Student',
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  COMPANY_MEMBER: 'Company Member',
};

function getInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'U';
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

export default function HeaderProfileMenu() {
  const { user, apiFetch, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [companyRole, setCompanyRole] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setCompanyRole('');

    async function loadProfile() {
      try {
        if (user?.role === 'STUDENT') {
          const response = await apiFetch('/api/v1/students/profile');
          const result = await response.json();
          if (response.ok && result.success && active) {
            setProfile(result.data?.profile || null);
          }
        } else if (user?.role === 'RECRUITER') {
          const response = await apiFetch('/api/v1/drives/my');
          const result = await response.json();
          if (response.ok && result.success && active) {
            const company = result.data?.company;
            const userId = String(user.id || user._id || user.userId || '');
            const member = company?.recruiters?.find(
              (entry) => String(entry.userId) === userId && entry.status === 'ACTIVE'
            );
            if (member?.role === 'SECONDARY') setCompanyRole('Company Member');
          }
        }
      } catch (error) {
        console.error('Unable to load account profile details:', error);
      }
    }

    if (user?.role === 'STUDENT' || user?.role === 'RECRUITER') loadProfile();
    return () => { active = false; };
  }, [apiFetch, user?.id, user?._id, user?.userId, user?.role]);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      if (user?.role === 'STUDENT' && event.detail) {
        setProfile((currentProfile) => ({ ...currentProfile, ...event.detail }));
      }
    };
    window.addEventListener('placement:user-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('placement:user-profile-updated', handleProfileUpdate);
  }, [user?.role]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const items = menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)');
        if (!items?.length) return;
        event.preventDefault();
        const currentIndex = Array.from(items).indexOf(document.activeElement);
        const nextIndex = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : event.key === 'ArrowDown'
              ? (currentIndex + 1) % items.length
              : (currentIndex <= 0 ? items.length : currentIndex) - 1;
        items[nextIndex].focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const name = profile?.fullName || user?.fullName || user?.name || 'Account';
  const email = profile?.email || user?.email || '';
  const role = companyRole || ROLE_LABELS[user?.role] || 'Account';
  const avatarUrl = profile?.profileImage || profile?.avatarUrl || profile?.photoUrl ||
    user?.profileImage || user?.avatarUrl || user?.photoUrl;
  const showAvatar = avatarUrl && !avatarFailed;
  const profilePath = user?.role === 'STUDENT'
    ? '/profile'
    : user?.role === 'RECRUITER'
      ? '/company/profile'
      : '/account';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setOpen(false);
      navigate('/login', { replace: true });
      setSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-600/20 text-xs font-bold text-emerald-300">
          {showAvatar ? (
            <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" />
          ) : (
            getInitials(name)
          )}
        </span>
        <span className="hidden min-w-0 md:block">
          <span className="block max-w-36 truncate text-xs font-semibold text-white">{name}</span>
          <span className="block text-[10px] text-slate-400">{role}</span>
        </span>
        <ChevronDown className={`hidden h-4 w-4 text-slate-400 transition md:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account options"
          className="absolute right-0 top-full z-[60] mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-3 border-b border-slate-800 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-600/20 text-sm font-bold text-emerald-300">
              {showAvatar ? (
                <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" />
              ) : (
                getInitials(name)
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{name}</span>
              <span className="block truncate text-xs text-slate-400">{email || 'Email unavailable'}</span>
              <span className="mt-1 inline-block rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                {role}
              </span>
            </span>
          </div>
          <div className="p-2">
            <Link
              to={profilePath}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              My Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:outline-none disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
