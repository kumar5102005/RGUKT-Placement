import React from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import RoleBasedDashboard from './pages/RoleBasedDashboard';
import Dashboard from './pages/Dashboard.jsx';
import AdminUserManagement from './pages/AdminUserManagement.jsx';
import StudentProfile from './pages/StudentProfile.jsx';
import AdminStudentSearch from './pages/AdminStudentSearch.jsx';
import RecruiterCompanyProfile from './pages/RecruiterCompanyProfile.jsx';
import AdminCompanyManagement from './pages/AdminCompanyManagement.jsx';
import JobList from './pages/JobList.jsx';
import JobDetails from './pages/JobDetails.jsx';
import RecruiterJobManagement from './pages/RecruiterJobManagement.jsx';
import PlacementDrives from './pages/PlacementDrives.jsx';
import ApplicationTracker from './pages/ApplicationTracker.jsx';
import {
  Server,
  Database,
  ShieldCheck,
  Activity,
  Bell,
  Briefcase,
  Users,
  FileText,
  LogIn,
  UserPlus,
  LayoutDashboard,
  LogOut,
  GraduationCap,
  Building2,
  Calendar,
} from 'lucide-react';

function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
            RG
          </div>
          <div>
            <h1 className="font-semibold text-base sm:text-lg text-white leading-tight">RGUKT Ongole</h1>
            <p className="text-[11px] text-emerald-400">Placement Hub • Microservices Platform</p>
          </div>
        </Link>
        <nav className="flex items-center space-x-1 sm:space-x-3 text-xs sm:text-sm">
          <Link to="/" className="px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition">Overview</Link>
          <Link to="/services" className="px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition">Services</Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-700/60">
              <Link
                to="/dashboard"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/drives"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
              >
                <Calendar className="w-4 h-4" />
                <span>Placement Drives</span>
              </Link>

              <Link
                to="/jobs"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
              >
                <Briefcase className="w-4 h-4" />
                <span>Jobs</span>
              </Link>

              <Link
                to="/applications"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
              >
                <FileText className="w-4 h-4" />
                <span>Applications</span>
              </Link>

              {user?.role === 'STUDENT' && (
                <Link
                  to="/profile"
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>My Profile</span>
                </Link>
              )}

              {user?.role === 'RECRUITER' && (
                <>
                  <Link
                    to="/company/profile"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Company</span>
                  </Link>
                  <Link
                    to="/recruiter/jobs"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Postings</span>
                  </Link>
                </>
              )}

              {user?.role === 'ADMIN' && (
                <>
                  <Link
                    to="/recruiter/jobs"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Drives</span>
                  </Link>
                  <Link
                    to="/admin/students"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Students</span>
                  </Link>
                  <Link
                    to="/admin/companies"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-emerald-400 font-medium transition"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Companies</span>
                  </Link>
                  <Link
                    to="/admin/users"
                    className="px-2.5 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition hidden sm:inline-block"
                  >
                    Users
                  </Link>
                </>
              )}

              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Log Out"
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-700/60">
              <Link
                to="/login"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-200 hover:text-white transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function Overview() {
  const { isAuthenticated, user } = useAuth();

  const services = [
    { name: "NGINX API Gateway", port: 8080, db: "N/A", status: "Active Edge", role: "Routing, Security & Rate Limiting", icon: ShieldCheck, color: "text-blue-400" },
    { name: "Auth Service", port: 4001, db: "rgukt_auth_db", status: "Active", role: "JWT, RBAC & Refresh Rotation", icon: ShieldCheck, color: "text-emerald-400" },
    { name: "Student Service", port: 4002, db: "rgukt_student_db", status: "Operational", role: "Profiles, Academics & Resume Uploads", icon: Users, color: "text-emerald-400" },
    { name: "Company & Drive Service", port: 4003, db: "rgukt_drive_db", status: "Operational", role: "Placement Drives, Rounds & Registration", icon: Briefcase, color: "text-emerald-400" },
    { name: "Application Service", port: 4004, db: "rgukt_application_db", status: "Operational", role: "Recruitment Workflow, Interviews & Offers", icon: FileText, color: "text-emerald-400" },
    { name: "Notification Service", port: 4005, db: "rgukt_notification_db", status: "Active", role: "In-App & Email Alerts", icon: Bell, color: "text-rose-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 sm:p-8">
        <div className="max-w-3xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
            Placement Drive Management Active
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Campus Placement Drives, Multi-Stage Rounds &amp; Candidate Registration</h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6">
            Comprehensive placement drive orchestration is live: scheduling recruitment stages (Aptitude Tests, Technical Interviews, and HR Rounds), automated candidate academic eligibility verification, and student registration tracking.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
                >
                  Dashboard ({user?.role})
                </Link>
                {user?.role === 'STUDENT' && (
                  <Link
                    to="/profile"
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition"
                  >
                    Edit My Student Profile
                  </Link>
                )}
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin/students"
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition"
                  >
                    Student Directory & Verification
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition"
                >
                  Register Account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <span>Microservices Ecosystem</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <div key={svc.name} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={`w-6 h-6 ${svc.color}`} />
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                      Port: {svc.port}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white">{svc.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{svc.role}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1 text-slate-400">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span>{svc.db}</span>
                  </span>
                  <span className="text-emerald-400 font-medium">{svc.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ServicesPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Microservice Endpoints</h2>
      <p className="text-slate-400 text-sm">
        Company &amp; Drive Service endpoints managed behind NGINX Gateway at port 8080:
      </p>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 font-mono text-sm space-y-3">
        <div className="text-emerald-400 font-bold">Placement Drive Service Endpoints:</div>
        <div className="text-slate-300">• POST   /api/v1/drives/placement-drives (Create &amp; schedule drive - ADMIN)</div>
        <div className="text-slate-300">• GET    /api/v1/drives/placement-drives (List drives with filters &amp; status - Authenticated)</div>
        <div className="text-slate-300">• GET    /api/v1/drives/placement-drives/:id (Get drive specifications &amp; rounds)</div>
        <div className="text-slate-300">• PUT    /api/v1/drives/placement-drives/:id (Update drive criteria &amp; venue - ADMIN)</div>
        <div className="text-slate-300">• POST   /api/v1/drives/placement-drives/:id/rounds (Schedule Aptitude, Tech, HR rounds - ADMIN)</div>
        <div className="text-slate-300">• POST   /api/v1/drives/placement-drives/:id/register (Register student with eligibility verification - STUDENT)</div>
        <div className="text-slate-300">• GET    /api/v1/drives/placement-drives/registrations/my (Get student registered drives &amp; round status - STUDENT)</div>
        <div className="text-slate-300">• GET    /api/v1/drives/placement-drives/:id/registrations (Admin inspect registered candidates)</div>
        <div className="text-slate-300">• PATCH  /api/v1/drives/placement-drives/:id/registrations/:rid/status (Update round status - ADMIN)</div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 font-mono text-sm space-y-3">
        <div className="text-cyan-400 font-bold">Job Management Service Endpoints:</div>
        <div className="text-slate-300">• POST   /api/v1/jobs (Create job posting - RECRUITER / ADMIN)</div>
        <div className="text-slate-300">• GET    /api/v1/jobs (List &amp; filter jobs with pagination - Authenticated)</div>
        <div className="text-slate-300">• GET    /api/v1/jobs/my (Get recruiter company job postings - RECRUITER)</div>
        <div className="text-slate-300">• GET    /api/v1/jobs/:id (Get full job specifications &amp; rounds - Authenticated)</div>
        <div className="text-slate-300">• PUT    /api/v1/jobs/:id (Update job parameters - Owner RECRUITER / ADMIN)</div>
        <div className="text-slate-300">• DELETE /api/v1/jobs/:id (Remove job posting - Owner RECRUITER / ADMIN)</div>
        <div className="text-slate-300">• PATCH  /api/v1/jobs/:id/status (Toggle status ACTIVE/PAUSED/CLOSED)</div>
        <div className="text-slate-300">• POST   /api/v1/jobs/:id/check-eligibility (Evaluate candidate profile against rules)</div>
        <div className="text-slate-300">• GET    /api/v1/jobs/internal/:id (Internal microservice synchronous query)</div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 font-mono text-sm space-y-3">
        <div className="text-blue-400 font-bold">Company Service Endpoints:</div>
        <div className="text-slate-300">• POST /api/v1/drives (Register company - RECRUITER)</div>
        <div className="text-slate-300">• GET  /api/v1/drives/my (Get own company - RECRUITER)</div>
        <div className="text-slate-300">• PUT  /api/v1/drives/my (Update company profile - RECRUITER)</div>
        <div className="text-slate-300">• GET  /api/v1/drives/search (Search companies - Authenticated)</div>
        <div className="text-slate-300">• GET  /api/v1/drives (List all companies - Authenticated)</div>
        <div className="text-slate-300">• GET  /api/v1/drives/:id (Get single company - Authenticated)</div>
        <div className="text-slate-300">• PATCH /api/v1/drives/:id/verify (Verify/reject company - ADMIN)</div>
        <div className="text-slate-300">• POST /api/v1/drives/:id/recruiters (Add recruiter - ADMIN)</div>
        <div className="text-slate-300">• DELETE /api/v1/drives/:id/recruiters/:rid (Remove recruiter - ADMIN)</div>
        <div className="text-slate-300">• GET  /api/v1/drives/internal/:id (Internal service sync)</div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 font-mono text-sm space-y-3">
        <div className="text-blue-400 font-bold">Student Service Endpoints:</div>
        <div className="text-slate-300">• GET  /api/v1/students/profile (Get own student profile)</div>
        <div className="text-slate-300">• PUT  /api/v1/students/profile (Update academics, skills, projects)</div>
        <div className="text-slate-300">• POST /api/v1/students/profile/resume (Upload PDF/DOC resume document)</div>
        <div className="text-slate-300">• GET  /api/v1/students/eligibility-check (Evaluate drive cutoff criteria)</div>
        <div className="text-slate-300">• GET  /api/v1/students/search (TPO search &amp; filter candidates)</div>
        <div className="text-slate-300">• GET  /api/v1/students/:id (TPO inspect full student profile)</div>
        <div className="text-slate-300">• PATCH /api/v1/students/:id/verify (TPO verify or reject profile)</div>
        <div className="text-slate-300">• GET  /api/v1/students/internal/:id (Internal microservice sync)</div>
      </div>
    </div>
  );
}

function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Infrastructure & Data Architecture</h2>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-white text-base">Key Architecture Guardrails Maintained:</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-slate-300">
          <li><strong>Database-per-Service:</strong> Student Service connects exclusively to <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">rgukt_student_db</code>.</li>
          <li><strong>Dynamic Completion Engine:</strong> Weighted 100-point algorithm recalculates student profile completion automatically upon updates.</li>
          <li><strong>File Storage Security:</strong> Resumes validated for MIME types (`application/pdf`, MS Word) and 5MB max size limit.</li>
          <li><strong>Internal Gateway Security:</strong> Inter-service synchronization requires <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">x-service-key</code>.</li>
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/infrastructure" element={<InfrastructurePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <RoleBasedDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}>
                    <StudentProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminStudentSearch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminUserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/company/profile"
                element={
                  <ProtectedRoute allowedRoles={['RECRUITER']}>
                    <RecruiterCompanyProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/companies"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminCompanyManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'RECRUITER', 'ADMIN']}>
                    <JobList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'RECRUITER', 'ADMIN']}>
                    <JobDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/drives"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'RECRUITER']}>
                    <PlacementDrives />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applications"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'RECRUITER']}>
                    <ApplicationTracker />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recruiter/jobs"
                element={
                  <ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN']}>
                    <RecruiterJobManagement />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
            RGUKT Ongole Placement Hub • Microservices Platform
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
