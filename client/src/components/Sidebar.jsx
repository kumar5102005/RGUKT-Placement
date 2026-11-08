import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Users,
  Building2,
  Briefcase,
  Calendar,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Sidebar() {
  const { user } = useAuth();
  const role = user?.role;

  const commonLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/applications', label: 'Applications', icon: FileText },
  ];

  const roleLinks = {
    STUDENT: [
      { to: '/jobs', label: 'Jobs', icon: Briefcase },
      { to: '/drives', label: 'Placement Drives', icon: Calendar },
      { to: '/profile', label: 'My Profile', icon: User },
    ],
    RECRUITER: [
      { to: '/recruiter/jobs', label: 'My Postings', icon: Briefcase },
      { to: '/company/profile', label: 'Company', icon: Building2 },
      { to: '/drives', label: 'Placement Drives', icon: Calendar },
    ],
    ADMIN: [
      { to: '/admin/students', label: 'Students', icon: Users },
      { to: '/admin/companies', label: 'Companies', icon: Building2 },
      { to: '/admin/users', label: 'Users', icon: User },
      { to: '/drives', label: 'Placement Drives', icon: Calendar },
    ],
  };

  const links = [...commonLinks, ...(roleLinks[role] || [])];

  return (
    <nav className="bg-slate-900 text-slate-100 w-64 flex-shrink-0 hidden lg:block border-r border-slate-800">
      <div className="p-4 flex flex-col h-full">
        <div className="mb-6 text-xl font-semibold">Placement Hub</div>
        <ul className="space-y-2 flex-1">
          {links.map((ln) => (
            <li key={ln.to}>
              <NavLink
                to={ln.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 py-2 px-3 rounded transition ${
                    isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <ln.icon className="w-4 h-4" />
                <span>{ln.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            // Placeholder logout – actual UI handled in Header
          }}
          className="mt-4 text-xs text-slate-400 hover:text-emerald-400"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}

