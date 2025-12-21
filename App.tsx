
import React, { useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, 
  Plus, ChevronRight, ChevronLeft, History as HistoryIcon, 
  FileCheck, User as UserIcon, UploadCloud,
  Menu, X, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  ImageIcon, Pin, Search, Filter, Trash2, Loader2, 
  Send, Clock, CheckCircle2, ShieldCheck, UserPlus, Building, 
  MessageSquare, MessageCirclePlus, MapPin, FileSpreadsheet,
  ListChecks, AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown,
  Building2, SortAsc, SortDesc, Edit2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import { 
  Task, ProjectSummary, User, ServiceRequest, RequestStatus, 
  ViewState, UserRole, Comment
} from './types';
import { 
  INITIAL_USERS, RAW_CSV_DATA, DAR_LOGO,
  LOCATIONS_ORDER, TECHNICAL_SERVICE_TYPES, GOVERNMENT_AUTHORITIES
} from './constants';
import ProjectCard from './components/ProjectCard';
import TaskCard from './components/TaskCard';
import Modal from './components/Modal';

// --- Persistent Storage Keys (Remaining for Users/Requests) ---
const STORAGE_KEYS = {
    USERS: 'dar_persistent_v1_users',
    REQUESTS: 'dar_persistent_v1_requests',
    SIDEBAR_COLLAPSED: 'dar_persistent_v1_sidebar_collapsed'
};

const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch {}
  }
};

// --- Error Boundary Component ---
/* Fix: Explicitly define Props and State interfaces for ErrorBoundary and make children optional to resolve TS errors regarding property access and missing props at usage site. */
interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center" dir="rtl">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-red-100">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2 font-cairo">عذراً، حدث خطأ ما</h2>
            <button onClick={() => window.location.reload()} className="bg-[#1B2B48] text-white px-8 py-3 rounded-2xl font-bold font-cairo">إعادة تحميل الصفحة</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  // --- Supabase Data State ---
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  // --- Local States ---
  const [users, setUsers] = useState<User[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.REQUESTS);
    return saved ? JSON.parse(saved) : [];
  });

  // --- Supabase Logic ---
  const fetchProjects = async () => {
    setIsDbLoading(true);
    try {
      // Fetch flat rows from Supabase
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      // Group tasks by "client" (Project Name)
      const grouped: Record<string, Task[]> = {};
      data?.forEach((row: any) => {
        const task: Task = {
          id: row.id.toString(),
          project: row.client,
          description: row.title,
          reviewer: '', // These fields can be extended in Supabase later
          requester: '',
          notes: '',
          location: 'الرياض', 
          status: row.status || 'متابعة',
          date: row.date || new Date().toISOString().split('T')[0],
          comments: []
        };
        if (!grouped[row.client]) grouped[row.client] = [];
        grouped[row.client].push(task);
      });

      const summaries: ProjectSummary[] = Object.keys(grouped).map(name => {
        const tasks = grouped[name];
        const done = tasks.filter(t => t.status === 'منجز').length;
        return {
          name,
          location: 'الرياض',
          tasks,
          totalTasks: tasks.length,
          completedTasks: done,
          progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
          isPinned: false
        };
      });

      setProjects(summaries);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsDbLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // --- Auth & View State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => safeStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true');

  // --- Persistence for Users/Requests ---
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }, [users]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(serviceRequests)); }, [serviceRequests]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isSidebarCollapsed)); }, [isSidebarCollapsed]);

  // --- Filtering & Modals ---
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [requestStatusFilter, setRequestStatusFilter] = useState('All');
  const [requestSortBy, setRequestSortBy] = useState<'date' | 'project' | 'status'>('date');
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [newProject, setNewProject] = useState<Partial<ProjectSummary>>({ name: '', location: LOCATIONS_ORDER[0] });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Partial<User>>({ name: '', email: '', role: 'PR_OFFICER', password: '123' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({});
  const [newRequest, setNewRequest] = useState<Partial<ServiceRequest>>({ projectName: '', type: 'conveyance' });
  const [newCommentText, setNewCommentText] = useState('');

  // --- Actions ---
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

  const handleCreateProject = async () => {
    if (!newProject.name) return alert('يرجى إدخال اسم المشروع');
    // Create an initial task row to represent the project in the flat table
    const { error } = await supabase.from('projects').insert([{
      title: 'بداية المشروع',
      client: newProject.name,
      status: 'متابعة',
      date: new Date().toISOString().split('T')[0]
    }]);

    if (error) alert("خطأ في الحفظ: " + error.message);
    else {
      await fetchProjects();
      setIsProjectModalOpen(false);
      setNewProject({ name: '', location: LOCATIONS_ORDER[0] });
    }
  };

  const confirmDeleteProject = (name: string) => {
    setProjectToDelete(name);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteProject = async () => {
    if (projectToDelete) {
      const { error } = await supabase.from('projects').delete().eq('client', projectToDelete);
      if (error) alert(error.message);
      else {
        await fetchProjects();
        if (selectedProject?.name === projectToDelete) setView('DASHBOARD');
        setIsDeleteConfirmOpen(false);
        setProjectToDelete(null);
      }
    }
  };

  const handleSaveTask = async () => {
    if (!selectedProject) return;
    const taskTitle = newTaskData.description || 'عمل جديد';
    const taskStatus = newTaskData.status || 'متابعة';
    const taskDate = new Date().toISOString().split('T')[0];

    if (editingTask) {
      const { error } = await supabase
        .from('projects')
        .update({ title: taskTitle, status: taskStatus })
        .eq('id', editingTask.id);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase
        .from('projects')
        .insert([{
          title: taskTitle,
          client: selectedProject.name,
          status: taskStatus,
          date: taskDate
        }]);
      if (error) alert(error.message);
    }
    
    await fetchProjects();
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setNewTaskData({});
    // Refresh detailed view
    const updated = projects.find(p => p.name === selectedProject.name);
    if (updated) setSelectedProject(updated);
  };

  const updateRequestStatus = async (id: string, status: RequestStatus, notes: string) => {
    // Note: Request management is currently local/localStorage in this version
    // But we implement the logic based on the UI flow
    setServiceRequests(prev => prev.map(req => {
        if (req.id === id) {
            return { ...req, status, history: [...req.history, { action: `تحديث الحالة إلى ${status}`, by: currentUser?.name || '', role: currentUser?.role || '', timestamp: new Date().toISOString(), notes }] };
        }
        return req;
    }));
  };

  // --- Filtering ---
  const filteredDashboard = useMemo(() => projects.filter(p => (locationFilter === 'All' || p.location === locationFilter) && (p.name.toLowerCase().includes(searchQuery.toLowerCase()))), [projects, locationFilter, searchQuery]);

  // --- UI Components ---
  const Logo: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`${className} flex flex-col items-center justify-center`}><img src={DAR_LOGO} className="w-full h-full object-contain" alt="Logo" /></div>
  );

  if (view === 'LOGIN') return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-cairo" dir="rtl">
      <div className="bg-[#1B2B48] w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden border border-gray-100 text-center">
        <div className="p-12 relative overflow-hidden"><Logo className="h-48 mx-auto mb-8 relative z-10" /><h1 className="text-white text-4xl font-bold">تسجيل الدخول</h1></div>
        <form onSubmit={handleLogin} className="p-10 bg-white space-y-6 rounded-t-[50px] text-right">
          <input type="email" placeholder="البريد الإلكتروني" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none text-right font-cairo" value={loginData.email} onChange={e => setLoginData({...loginData, email: e.target.value})} required />
          <input type="password" placeholder="كلمة المرور" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none text-right font-cairo" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required />
          <button className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold shadow-xl text-xl">دخول النظام</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-cairo overflow-hidden" dir="rtl">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 bg-[#1B2B48] text-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'} ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/5 flex flex-col items-center">
          <Logo className={isSidebarCollapsed ? 'h-12 w-12' : 'h-24 w-24'} />
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden lg:flex absolute top-4 left-4 p-1.5 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">{isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {[ 
              { id: 'DASHBOARD', label: 'الرئيسية', icon: LayoutDashboard, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER'] }, 
              { id: 'REQUESTS', label: 'الطلبات', icon: FileText, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE', 'TECHNICAL', 'CONVEYANCE'] }, 
              { id: 'SERVICE_ONLY', label: 'طلب جديد', icon: Plus, roles: ['TECHNICAL', 'CONVEYANCE', 'ADMIN', 'PR_MANAGER', 'PR_OFFICER'] }
            ].filter(i => i.roles.includes(currentUser?.role || '')).map(item => (
                <button key={item.id} onClick={() => { setView(item.id as ViewState); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === item.id ? 'bg-[#E95D22] shadow-xl' : 'hover:bg-white/5 text-gray-400'} ${isSidebarCollapsed ? 'justify-center' : ''}`}><item.icon size={20} />{!isSidebarCollapsed && <span>{item.label}</span>}</button>
            ))}
        </nav>
        <div className="p-4 border-t border-white/5"><button onClick={() => setView('LOGIN')} className="w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"><LogOut size={20} />{!isSidebarCollapsed && <span className="font-bold">خروج</span>}</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa] overflow-hidden">
        <header className="lg:hidden p-4 bg-[#1B2B48] flex justify-between items-center"><Logo className="h-10 w-10" /><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white"><Menu /></button></header>
        <div className="flex-1 overflow-y-auto p-6 lg:p-12 text-right custom-scrollbar">
          {isDbLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
              <Loader2 className="animate-spin w-12 h-12 text-[#E95D22]" />
              <p className="font-bold">جاري تحميل البيانات من السحابة...</p>
            </div>
          ) : (
            <>
              {view === 'DASHBOARD' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-[#1B2B48]">لوحة التحكم العامة</h2>
                    <div className="flex gap-3 w-full md:w-auto">
                      <input type="text" placeholder="بحث..." className="pr-10 pl-4 py-2 rounded-xl border w-full md:w-64 text-right font-cairo" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                      <button onClick={() => setIsProjectModalOpen(true)} className="bg-[#E95D22] text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg"><Plus size={20} /> جديد</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDashboard.map(p => <ProjectCard key={p.name} project={p} onClick={p => { setSelectedProject(p); setView('PROJECT_DETAIL'); }} onTogglePin={() => {}} />)}
                  </div>
                </div>
              )}

              {view === 'PROJECT_DETAIL' && selectedProject && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-400 hover:text-orange-500 mb-4"><ArrowLeft size={16} /> العودة</button>
                    <div className="bg-white rounded-[40px] p-10 shadow-sm border text-right">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                            <div><h2 className="text-4xl font-bold text-[#1B2B48]">{selectedProject.name}</h2></div>
                            <div className="flex gap-4">
                                <button onClick={() => confirmDeleteProject(selectedProject.name)} className="bg-red-50 text-red-500 p-4 rounded-3xl hover:bg-red-100 transition-colors"><Trash2 size={24} /></button>
                                <div className="bg-gray-50 p-6 rounded-3xl text-center border font-bold text-3xl">{Math.round(selectedProject.progress)}%</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-1 space-y-6">
                                <button onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }} className="w-full bg-[#E95D22] text-white py-5 rounded-[30px] font-bold text-lg shadow-xl hover:scale-[1.02] transition-all">إضافة عمل جديد</button>
                            </div>
                            <div className="lg:col-span-2 space-y-4">
                               {selectedProject.tasks.map(task => <TaskCard key={task.id} task={task} onEdit={t => { setEditingTask(t); setNewTaskData(t); setIsTaskModalOpen(true); }} />)}
                            </div>
                        </div>
                    </div>
                </div>
              )}

              {view === 'REQUESTS' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-[#1B2B48]">سجل الطلبات</h2>
                  <div className="grid grid-cols-1 gap-4">
                    {serviceRequests.map(req => (
                      <div key={req.id} onClick={() => { setSelectedRequest(req); setIsRequestDetailOpen(true); }} className="bg-white p-6 rounded-3xl border flex justify-between items-center cursor-pointer hover:shadow-lg transition-all">
                        <div className="flex items-center gap-4"><div className="p-4 rounded-2xl bg-blue-50 text-blue-600"><Building size={24} /></div><div><h4 className="font-bold">{req.name}</h4><p className="text-xs text-gray-400">{req.projectName}</p></div></div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${req.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{req.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --- Modals --- */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="تأكيد الحذف">
        <div className="text-right space-y-6">
          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center gap-4"><AlertCircle className="text-red-500" size={32} /><p className="text-red-700 font-bold">حذف مشروع "{projectToDelete}"؟</p></div>
          <p className="text-gray-500 text-sm">سيتم مسح كافة البيانات المرتبطة بهذا المشروع من قاعدة البيانات.</p>
          <div className="flex gap-4">
            <button onClick={handleDeleteProject} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold">نعم، احذف</button>
            <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold">إلغاء</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="مشروع جديد">
        <div className="space-y-4 text-right">
          <input type="text" placeholder="اسم المشروع" className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
          <button onClick={handleCreateProject} className="w-full bg-[#E95D22] text-white py-4 rounded-2xl font-bold mt-4 shadow-lg">حفظ المشروع</button>
        </div>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل العمل' : 'إضافة عمل'}>
        <div className="space-y-4 text-right font-cairo">
          <textarea placeholder="بيان العمل" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none text-right font-cairo" value={newTaskData.description || ''} onChange={e => setNewTaskData({...newTaskData, description: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo" value={newTaskData.status || 'متابعة'} onChange={e => setNewTaskData({...newTaskData, status: e.target.value})}>
            <option value="متابعة">متابعة</option>
            <option value="منجز">منجز</option>
          </select>
          <button onClick={handleSaveTask} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold shadow-lg">حفظ البيانات في السحابة</button>
        </div>
      </Modal>
    </div>
  );
};

/* Fix: The App component now correctly uses ErrorBoundary with children as nested content. */
const App: React.FC = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
