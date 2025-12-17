
import React, { useState, useEffect, ReactNode } from 'react';
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, 
  Plus, ChevronRight, History as HistoryIcon, 
  FileCheck, User as UserIcon, UploadCloud,
  Menu, X, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  ImageIcon, Pin, Search, Filter, Trash2, Loader2, 
  Send, Clock, CheckCircle2, ShieldCheck, UserPlus, Building
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  Task, ProjectSummary, User, ServiceRequest, RequestStatus, 
  ViewState, UserRole
} from './types';
import { 
  INITIAL_USERS, RAW_CSV_DATA, LOGO_URL,
  LOCATIONS_ORDER, TECHNICAL_SERVICE_TYPES
} from './constants';
import ProjectCard from './components/ProjectCard';
import TaskCard from './components/TaskCard';
import Modal from './components/Modal';

const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch {}
  }
};

const STORAGE_KEYS = {
    PROJECTS: 'dar_projects_v3',
    USERS: 'dar_users_v3',
    REQUESTS: 'dar_requests_v3'
};

// Fixed ErrorBoundary to extend React.Component explicitly and correctly typed props/state to resolve the 'props' access error
class ErrorBoundary extends React.Component<{children: ReactNode}, {hasError: boolean}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-cairo" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-4">حدث خطأ في النظام</h1>
          <button onClick={() => window.location.reload()} className="bg-[#E95D22] text-white px-8 py-2 rounded-xl">تحديث الصفحة</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Data State ---
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);

  // --- UI State ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [taskFilter, setTaskFilter] = useState('All');
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false);
  
  // Forms
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [newProject, setNewProject] = useState<Partial<ProjectSummary>>({ name: '', location: LOCATIONS_ORDER[0], tasks: [] });
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', email: '', role: 'PR_OFFICER', password: '123' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({});
  const [newRequest, setNewRequest] = useState<Partial<ServiceRequest>>({ projectName: '' });
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const init = () => {
      const savedProjects = safeStorage.getItem(STORAGE_KEYS.PROJECTS);
      const savedUsers = safeStorage.getItem(STORAGE_KEYS.USERS);
      const savedRequests = safeStorage.getItem(STORAGE_KEYS.REQUESTS);

      if (savedUsers) setUsers(JSON.parse(savedUsers));
      else setUsers(INITIAL_USERS);

      if (savedRequests) setServiceRequests(JSON.parse(savedRequests));

      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      } else {
        // Load from CSV fallback
        const lines = RAW_CSV_DATA.trim().split('\n').slice(1);
        const parsed: ProjectSummary[] = [];
        const grouped: Record<string, Task[]> = {};

        lines.forEach((line, i) => {
          const parts = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
          if (parts.length >= 7) {
            const task: Task = {
              id: `t-${i}`, project: parts[0], description: parts[1],
              reviewer: parts[2], requester: parts[3], notes: parts[4],
              location: parts[5], status: parts[6], date: parts[7] || ''
            };
            if (!grouped[task.project]) grouped[task.project] = [];
            grouped[task.project].push(task);
          }
        });

        Object.keys(grouped).forEach(name => {
          const tasks = grouped[name];
          const done = tasks.filter(t => t.status === 'منجز').length;
          parsed.push({
            name, location: tasks[0].location, tasks,
            totalTasks: tasks.length, completedTasks: done,
            progress: (done / tasks.length) * 100, isPinned: false
          });
        });
        setProjects(parsed);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // --- Persistence ---
  useEffect(() => {
    if (!isLoading) {
      safeStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
      safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      safeStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(serviceRequests));
    }
  }, [projects, users, serviceRequests, isLoading]);

  // --- Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === loginData.email && u.password === loginData.password);
    if (user) {
      setCurrentUser(user);
      if (['TECHNICAL', 'CONVEYANCE'].includes(user.role)) setView('SERVICE_ONLY');
      else if (user.role === 'FINANCE') setView('REQUESTS');
      else setView('DASHBOARD');
    } else alert('بيانات الدخول غير صحيحة');
  };

  const handleCreateProject = () => {
    if (!newProject.name) return alert('يرجى إدخال اسم المشروع');
    const project: ProjectSummary = {
      name: newProject.name,
      location: newProject.location || 'الرياض',
      tasks: [], totalTasks: 0, completedTasks: 0, progress: 0,
      imageUrl: newProject.imageUrl, isPinned: false
    };
    setProjects([project, ...projects]);
    setIsProjectModalOpen(false);
    setNewProject({ name: '', location: LOCATIONS_ORDER[0], tasks: [] });
  };

  const handleDeleteProject = (name: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) {
      setProjects(projects.filter(p => p.name !== name));
      if (selectedProject?.name === name) setView('DASHBOARD');
    }
  };

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email) return;
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newUser.name, email: newUser.email,
      role: newUser.role as UserRole, password: newUser.password || '123'
    };
    setUsers([...users, user]);
    setIsUserModalOpen(false);
    setNewUser({ name: '', email: '', role: 'PR_OFFICER', password: '123' });
  };

  const handleSaveTask = () => {
    if (!selectedProject) return;
    let updatedTasks = [...selectedProject.tasks];
    if (editingTask) {
      updatedTasks = updatedTasks.map(t => t.id === editingTask.id ? { ...t, ...newTaskData } : t);
    } else {
      const task: Task = {
        id: Date.now().toString(), project: selectedProject.name,
        description: newTaskData.description || '', reviewer: newTaskData.reviewer || '',
        requester: newTaskData.requester || currentUser?.name || '',
        notes: newTaskData.notes || '', location: selectedProject.location,
        status: newTaskData.status || 'متابعة', date: new Date().toISOString().split('T')[0]
      };
      updatedTasks = [task, ...updatedTasks];
    }

    const done = updatedTasks.filter(t => t.status === 'منجز').length;
    const updatedProj = {
      ...selectedProject, tasks: updatedTasks,
      totalTasks: updatedTasks.length, completedTasks: done,
      progress: (done / updatedTasks.length) * 100
    };

    setProjects(projects.map(p => p.name === selectedProject.name ? updatedProj : p));
    setSelectedProject(updatedProj);
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setNewTaskData({});
  };

  const handleCreateRequest = () => {
    if (!newRequest.projectName) return alert('يرجى اختيار المشروع');
    const isConv = currentUser?.role === 'CONVEYANCE';
    const req: ServiceRequest = {
      id: Math.random().toString(36).substr(2, 9),
      name: isConv ? `إفراغ: ${newRequest.clientName}` : `${newRequest.serviceSubType}`,
      type: isConv ? 'conveyance' : 'technical',
      projectName: newRequest.projectName,
      details: newRequest.details || '',
      submittedBy: currentUser?.name || '',
      role: currentUser?.role || '',
      status: isConv ? 'pending_finance' : 'new',
      date: new Date().toISOString().split('T')[0],
      history: [{ action: 'إنشاء الطلب', by: currentUser?.name || '', role: currentUser?.role || '', timestamp: new Date().toISOString() }],
      ...newRequest
    } as ServiceRequest;

    setServiceRequests([req, ...serviceRequests]);
    setNewRequest({ projectName: '' });
    alert('تم إرسال الطلب بنجاح');
  };

  const updateRequestStatus = (reqId: string, status: RequestStatus, note?: string) => {
    setServiceRequests(prev => prev.map(r => {
      if (r.id === reqId) {
        const updated = {
          ...r, status,
          history: [...r.history, { action: `تغيير الحالة إلى ${status}`, by: currentUser?.name || '', role: currentUser?.role || '', timestamp: new Date().toISOString(), notes: note }]
        };
        
        // If completed, add as a task to the project
        if (status === 'completed') {
          const proj = projects.find(p => p.name === r.projectName);
          if (proj) {
            const newTask: Task = {
              id: `req-${r.id}`, project: r.projectName, description: r.name,
              reviewer: r.type === 'conveyance' ? 'كتابة العدل' : 'القسم الفني',
              requester: r.submittedBy, notes: r.details, location: proj.location,
              status: 'منجز', date: new Date().toISOString().split('T')[0]
            };
            const updatedTasks = [newTask, ...proj.tasks];
            const done = updatedTasks.filter(t => t.status === 'منجز').length;
            const updatedProj = { ...proj, tasks: updatedTasks, totalTasks: updatedTasks.length, completedTasks: done, progress: (done / updatedTasks.length) * 100 };
            setProjects(projects.map(p => p.name === r.projectName ? updatedProj : p));
          }
        }
        return updated;
      }
      return r;
    }));
    setIsRequestDetailOpen(false);
  };

  // --- Views ---
  const renderDashboard = () => {
    const filtered = projects.filter(p => 
      (locationFilter === 'All' || p.location === locationFilter) &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const pinned = filtered.filter(p => p.isPinned);
    const others = filtered.filter(p => !p.isPinned);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1B2B48]">لوحة التحكم</h2>
            <p className="text-gray-500 text-sm">متابعة حالة المشاريع والأعمال الجارية</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="بحث عن مشروع..." className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="px-4 py-2 rounded-xl border border-gray-200" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
              <option value="All">كل المدن</option>
              {LOCATIONS_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && (
              <button onClick={() => setIsProjectModalOpen(true)} className="bg-[#E95D22] text-white px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap shadow-lg shadow-orange-500/20">
                <Plus className="w-5 h-5" /> مشروع جديد
              </button>
            )}
          </div>
        </div>

        {pinned.length > 0 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-bold text-orange-600"><Pin className="w-4 h-4 fill-current" /> المشاريع المثبتة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pinned.map(p => <ProjectCard key={p.name} project={p} onClick={p => { setSelectedProject(p); setView('PROJECT_DETAIL'); }} onTogglePin={p => setProjects(projects.map(x => x.name === p.name ? {...x, isPinned: !x.isPinned} : x))} />)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {others.map(p => <ProjectCard key={p.name} project={p} onClick={p => { setSelectedProject(p); setView('PROJECT_DETAIL'); }} onTogglePin={p => setProjects(projects.map(x => x.name === p.name ? {...x, isPinned: !x.isPinned} : x))} />)}
        </div>
      </div>
    );
  };

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إدارة المستخدمين</h2>
        <button onClick={() => setIsUserModalOpen(true)} className="bg-[#1B2B48] text-white px-6 py-2 rounded-xl flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> إضافة مستخدم
        </button>
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-gray-50 text-gray-500 text-sm">
            <tr>
              <th className="p-4">الموظف</th>
              <th className="p-4">البريد</th>
              <th className="p-4">الدور</th>
              <th className="p-4">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold">{u.name}</td>
                <td className="p-4">{u.email}</td>
                <td className="p-4"><span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">{u.role}</span></td>
                <td className="p-4">
                  <button onClick={() => setUsers(users.filter(x => x.id !== u.id))} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderServiceOnly = () => {
    const isConv = currentUser?.role === 'CONVEYANCE';
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="bg-orange-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Send className="w-10 h-10 text-[#E95D22]" />
            </div>
            <h2 className="text-2xl font-bold">{isConv ? 'طلب إفراغ عقاري' : 'طلب خدمة فنية'}</h2>
            <p className="text-gray-400 mt-2">يرجى إدخال البيانات المطلوبة بدقة</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">المشروع</label>
              <select className="w-full p-4 bg-gray-50 rounded-2xl border-none" value={newRequest.projectName} onChange={e => setNewRequest({...newRequest, projectName: e.target.value})}>
                <option value="">اختر المشروع...</option>
                {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            {isConv ? (
              <>
                <input type="text" placeholder="اسم العميل" className="w-full p-4 bg-gray-50 rounded-2xl" value={newRequest.clientName || ''} onChange={e => setNewRequest({...newRequest, clientName: e.target.value})} />
                <input type="text" placeholder="رقم الهوية" className="w-full p-4 bg-gray-50 rounded-2xl" value={newRequest.idNumber || ''} onChange={e => setNewRequest({...newRequest, idNumber: e.target.value})} />
              </>
            ) : (
              <select className="w-full p-4 bg-gray-50 rounded-2xl" value={newRequest.serviceSubType || ''} onChange={e => setNewRequest({...newRequest, serviceSubType: e.target.value})}>
                <option value="">نوع الخدمة...</option>
                {TECHNICAL_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <textarea placeholder="تفاصيل إضافية..." className="w-full p-4 bg-gray-50 rounded-2xl h-32" value={newRequest.details || ''} onChange={e => setNewRequest({...newRequest, details: e.target.value})} />
            <button onClick={handleCreateRequest} className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold text-lg shadow-xl shadow-orange-500/30">إرسال الطلب</button>
          </div>
        </div>
      </div>
    );
  };

  const renderRequests = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">إدارة الطلبات الواردة</h2>
      <div className="grid grid-cols-1 gap-4">
        {serviceRequests.filter(r => {
          if (currentUser?.role === 'FINANCE') return r.status === 'pending_finance';
          if (currentUser?.role === 'PR_MANAGER' || currentUser?.role === 'ADMIN') return true;
          return r.status === 'new' || r.status === 'pending_pr';
        }).map(req => (
          <div key={req.id} onClick={() => { setSelectedRequest(req); setIsRequestDetailOpen(true); }} className="bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${req.type === 'conveyance' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {req.type === 'conveyance' ? <Building className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="font-bold">{req.name}</h4>
                <p className="text-sm text-gray-400">{req.projectName} - {req.submittedBy}</p>
              </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${req.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {req.status === 'new' ? 'جديد' : req.status === 'pending_finance' ? 'مالية' : req.status === 'completed' ? 'منجز' : 'مرفوض'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-cairo" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-[#1B2B48] p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <img src={LOGO_URL} className="h-20 mx-auto bg-white p-4 rounded-3xl mb-6 shadow-xl" />
          <h1 className="text-white text-2xl font-bold">بوابة الموظفين</h1>
          <p className="text-blue-200/50 mt-2">دار وإعمار للتطوير العقاري</p>
        </div>
        <form onSubmit={handleLogin} className="p-10 space-y-6">
          <input type="email" placeholder="البريد الإلكتروني" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20" value={loginData.email} onChange={e => setLoginData({...loginData, email: e.target.value})} required />
          <input type="password" placeholder="كلمة المرور" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required />
          <button className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform">دخول النظام</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-cairo" dir="rtl">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-72 bg-[#1B2B48] text-white flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-8 border-b border-white/5 flex flex-col items-center">
          <div className="bg-white p-3 rounded-2xl mb-4">
            <img src={LOGO_URL} className="h-10" />
          </div>
          <h2 className="font-bold">دار وإعمار</h2>
          <span className="text-[10px] text-orange-400 font-bold tracking-widest uppercase mt-1">{currentUser?.role}</span>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          {currentUser?.role !== 'TECHNICAL' && currentUser?.role !== 'CONVEYANCE' && currentUser?.role !== 'FINANCE' && (
            <button onClick={() => setView('DASHBOARD')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'DASHBOARD' ? 'bg-[#E95D22] shadow-xl shadow-orange-500/20' : 'hover:bg-white/5 text-gray-400'}`}>
              <LayoutDashboard size={20} /> لوحة التحكم
            </button>
          )}
          {['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE'].includes(currentUser?.role || '') && (
            <button onClick={() => setView('REQUESTS')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'REQUESTS' ? 'bg-[#E95D22] shadow-xl shadow-orange-500/20' : 'hover:bg-white/5 text-gray-400'}`}>
              <FileText size={20} /> الطلبات الواردة
            </button>
          )}
          {['TECHNICAL', 'CONVEYANCE'].includes(currentUser?.role || '') && (
            <button onClick={() => setView('SERVICE_ONLY')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'SERVICE_ONLY' ? 'bg-[#E95D22] shadow-xl shadow-orange-500/20' : 'hover:bg-white/5 text-gray-400'}`}>
              <Plus size={20} /> طلب خدمة
            </button>
          )}
          {currentUser?.role === 'ADMIN' && (
            <button onClick={() => setView('USERS')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'USERS' ? 'bg-[#E95D22] shadow-xl shadow-orange-500/20' : 'hover:bg-white/5 text-gray-400'}`}>
              <Users size={20} /> المستخدمين
            </button>
          )}
        </nav>
        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold">{currentUser?.name[0]}</div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button onClick={() => setView('LOGIN')} className="w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl">
            <LogOut size={20} /> تسجيل خروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa]">
        <header className="lg:hidden p-4 bg-white border-b flex justify-between items-center">
          <img src={LOGO_URL} className="h-8" />
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-gray-50 rounded-xl"><Menu /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 lg:p-12">
          {view === 'DASHBOARD' && renderDashboard()}
          {view === 'USERS' && renderUsers()}
          {view === 'SERVICE_ONLY' && renderServiceOnly()}
          {view === 'REQUESTS' && renderRequests()}
          {view === 'PROJECT_DETAIL' && selectedProject && (
            <div className="space-y-6">
              <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-500 hover:text-[#E95D22] mb-4"><ArrowLeft size={16} /> العودة للرئيسية</button>
              <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-4xl font-bold mb-2">{selectedProject.name}</h2>
                    <p className="text-orange-500 font-bold">{selectedProject.location}</p>
                  </div>
                  <div className="flex gap-4">
                    {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && (
                      <button onClick={() => handleDeleteProject(selectedProject.name)} className="bg-red-50 text-red-500 p-4 rounded-2xl hover:bg-red-100"><Trash2 size={24} /></button>
                    )}
                    <div className="bg-gray-50 p-6 rounded-3xl text-center">
                      <p className="text-gray-400 text-xs mb-1">نسبة الإنجاز</p>
                      <p className="text-3xl font-bold text-[#1B2B48]">{Math.round(selectedProject.progress)}%</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#1B2B48] text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden">
                       <ShieldCheck className="absolute -bottom-8 -left-8 w-32 h-32 opacity-10" />
                       <h4 className="font-bold text-xl mb-6">إحصائيات المهام</h4>
                       <div className="space-y-4">
                         <div className="flex justify-between border-b border-white/10 pb-2"><span>العدد الكلي</span><span className="font-bold">{selectedProject.totalTasks}</span></div>
                         <div className="flex justify-between border-b border-white/10 pb-2"><span>المنجزة</span><span className="font-bold text-green-400">{selectedProject.completedTasks}</span></div>
                         <div className="flex justify-between pb-2"><span>قيد المتابعة</span><span className="font-bold text-orange-400">{selectedProject.totalTasks - selectedProject.completedTasks}</span></div>
                       </div>
                    </div>
                    {['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '') && (
                      <button onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }} className="w-full bg-[#E95D22] text-white py-5 rounded-[30px] font-bold text-lg shadow-xl shadow-orange-500/20">إضافة عمل جديد</button>
                    )}
                  </div>
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold">بيان الأعمال</h3>
                      <div className="flex bg-gray-100 p-1 rounded-2xl">
                        {['All', 'متابعة', 'منجز'].map(s => (
                          <button key={s} onClick={() => setTaskFilter(s)} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${taskFilter === s ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>{s === 'All' ? 'الكل' : s}</button>
                        ))}
                      </div>
                    </div>
                    {selectedProject.tasks.filter(t => taskFilter === 'All' || t.status === taskFilter).map(task => (
                      <TaskCard key={task.id} task={task} onEdit={t => { setEditingTask(t); setNewTaskData(t); setIsTaskModalOpen(true); }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="إضافة مشروع جديد">
        <div className="space-y-4">
          <input type="text" placeholder="اسم المشروع" className="w-full p-4 bg-gray-50 rounded-2xl" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl" value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})}>
            {LOCATIONS_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="text" placeholder="رابط صورة المشروع (اختياري)" className="w-full p-4 bg-gray-50 rounded-2xl" value={newProject.imageUrl || ''} onChange={e => setNewProject({...newProject, imageUrl: e.target.value})} />
          <button onClick={handleCreateProject} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold">حفظ المشروع</button>
        </div>
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="إضافة موظف جديد">
        <div className="space-y-4">
          <input type="text" placeholder="اسم الموظف" className="w-full p-4 bg-gray-50 rounded-2xl" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
          <input type="email" placeholder="البريد الإلكتروني" className="w-full p-4 bg-gray-50 rounded-2xl" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
            <option value="PR_MANAGER">مدير علاقات عامة</option>
            <option value="PR_OFFICER">مسؤول علاقات عامة</option>
            <option value="FINANCE">المالية</option>
            <option value="TECHNICAL">القسم الفني</option>
            <option value="CONVEYANCE">موظف إفراغ</option>
          </select>
          <input type="password" placeholder="كلمة المرور" className="w-full p-4 bg-gray-50 rounded-2xl" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
          <button onClick={handleCreateUser} className="w-full bg-[#E95D22] text-white py-4 rounded-2xl font-bold">إضافة الموظف</button>
        </div>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل عمل' : 'إضافة عمل جديد'}>
        <div className="space-y-4">
          <textarea placeholder="بيان العمل" className="w-full p-4 bg-gray-50 rounded-2xl" value={newTaskData.description || ''} onChange={e => setNewTaskData({...newTaskData, description: e.target.value})} />
          <input type="text" placeholder="جهة المراجعة" className="w-full p-4 bg-gray-50 rounded-2xl" value={newTaskData.reviewer || ''} onChange={e => setNewTaskData({...newTaskData, reviewer: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl" value={newTaskData.status || 'متابعة'} onChange={e => setNewTaskData({...newTaskData, status: e.target.value})}>
            <option value="متابعة">متابعة</option>
            <option value="منجز">منجز</option>
          </select>
          <textarea placeholder="ملاحظات" className="w-full p-4 bg-gray-50 rounded-2xl" value={newTaskData.notes || ''} onChange={e => setNewTaskData({...newTaskData, notes: e.target.value})} />
          <button onClick={handleSaveTask} className="w-full bg-[#E95D22] text-white py-4 rounded-2xl font-bold">حفظ العمل</button>
        </div>
      </Modal>

      <Modal isOpen={isRequestDetailOpen} onClose={() => setIsRequestDetailOpen(false)} title="تفاصيل الطلب">
        {selectedRequest && (
          <div className="space-y-6 font-cairo text-right">
            <div className="bg-gray-50 p-6 rounded-3xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400 block mb-1">المشروع</span><span className="font-bold">{selectedRequest.projectName}</span></div>
                <div><span className="text-gray-400 block mb-1">تاريخ الطلب</span><span className="font-bold">{selectedRequest.date}</span></div>
                {selectedRequest.type === 'conveyance' && (
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <p className="font-bold mb-2">بيانات الإفراغ:</p>
                    <p className="text-sm">العميل: {selectedRequest.clientName}</p>
                    <p className="text-sm">الهوية: {selectedRequest.idNumber}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              {currentUser?.role === 'FINANCE' && selectedRequest.status === 'pending_finance' && (
                <>
                  <button onClick={() => updateRequestStatus(selectedRequest.id, 'new')} className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-bold">موافقة مالية</button>
                  <button onClick={() => updateRequestStatus(selectedRequest.id, 'rejected')} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold">رفض</button>
                </>
              )}
              {(['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '')) && selectedRequest.status !== 'completed' && (
                <button onClick={() => updateRequestStatus(selectedRequest.id, 'completed')} className="w-full bg-green-600 text-white py-3 rounded-2xl font-bold">اعتماد كمنجز</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
