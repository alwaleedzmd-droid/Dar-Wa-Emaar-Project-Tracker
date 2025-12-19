
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

// --- Safe Data Persistence Configuration ---
const STORAGE_KEYS = {
    PROJECTS: 'dar_persistent_v1_projects',
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
// This handles runtime errors and prevents the entire app from crashing.
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center" dir="rtl">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-red-100">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2 font-cairo">عذراً، حدث خطأ ما</h2>
            <p className="text-gray-600 mb-6 font-cairo">لقد واجهنا مشكلة تقنية غير متوقعة. يرجى محاولة إعادة تحميل الصفحة.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#1B2B48] text-white px-8 py-3 rounded-2xl font-bold hover:bg-opacity-90 transition-all font-cairo"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper: Parse Default CSV Data (Only called if storage is empty)
const parseDefaultProjects = (): ProjectSummary[] => {
  const lines = RAW_CSV_DATA.trim().split('\n').slice(1);
  const parsed: ProjectSummary[] = [];
  const grouped: Record<string, Task[]> = {};

  lines.forEach((line, i) => {
    const parts = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
    if (parts.length >= 7) {
      const task: Task = {
        id: `t-${i}`, project: parts[0], description: parts[1],
        reviewer: parts[2], requester: parts[3], notes: parts[4],
        location: parts[5], status: parts[6], date: parts[7] || '',
        comments: []
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
  return parsed;
};

// --- Main Application Component ---
const AppContent: React.FC = () => {
  // 1. Safe State Initialization (Lazy Initializers)
  const [users, setUsers] = useState<User[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [projects, setProjects] = useState<ProjectSummary[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.PROJECTS);
    return saved ? JSON.parse(saved) : parseDefaultProjects();
  });

  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.REQUESTS);
    return saved ? JSON.parse(saved) : [];
  });

  // 2. Persistent Auto-Saves
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }, [users]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects)); }, [projects]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(serviceRequests)); }, [serviceRequests]);

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  
  // --- UI Layout State ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return safeStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isSidebarCollapsed)); }, [isSidebarCollapsed]);

  // --- Filtering & Sorting State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [taskFilter, setTaskFilter] = useState('All');
  const [requestStatusFilter, setRequestStatusFilter] = useState('All');
  const [requestSortBy, setRequestSortBy] = useState<'date' | 'project' | 'status'>('date');
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  
  // --- Modals State ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // --- Forms State ---
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [newProject, setNewProject] = useState<Partial<ProjectSummary>>({ name: '', location: LOCATIONS_ORDER[0], tasks: [] });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Partial<User>>({ name: '', email: '', role: 'PR_OFFICER', password: '123' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({});
  const [newRequest, setNewRequest] = useState<Partial<ServiceRequest>>({ projectName: '', type: 'conveyance' });
  const [newCommentText, setNewCommentText] = useState('');

  // --- Excel Processing ---
  const [conveyanceMode, setConveyanceMode] = useState<'individual' | 'group'>('individual');
  const [pendingGroupRequests, setPendingGroupRequests] = useState<ServiceRequest[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setProjects(prev => [project, ...prev]);
    setIsProjectModalOpen(false);
    setNewProject({ name: '', location: LOCATIONS_ORDER[0], tasks: [] });
  };

  const confirmDeleteProject = (name: string) => {
    setProjectToDelete(name);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteProject = () => {
    if (projectToDelete) {
      setProjects(prev => prev.filter(p => p.name !== projectToDelete));
      if (selectedProject?.name === projectToDelete) setView('DASHBOARD');
      setIsDeleteConfirmOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleSaveUser = () => {
    if (!userData.name || !userData.email) return;
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userData } : u));
    } else {
      const user: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: userData.name || '', email: userData.email || '',
        role: (userData.role as UserRole) || 'PR_OFFICER', password: userData.password || '123'
      };
      setUsers(prev => [...prev, user]);
    }
    setIsUserModalOpen(false);
    setEditingUser(null);
    setUserData({ name: '', email: '', role: 'PR_OFFICER', password: '123' });
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
        status: newTaskData.status || 'متابعة', date: new Date().toISOString().split('T')[0],
        comments: []
      };
      updatedTasks = [task, ...updatedTasks];
    }
    const done = updatedTasks.filter(t => t.status === 'منجز').length;
    const updatedProj = { ...selectedProject, tasks: updatedTasks, totalTasks: updatedTasks.length, completedTasks: done, progress: (done / updatedTasks.length) * 100 };
    setProjects(prev => prev.map(p => p.name === selectedProject.name ? updatedProj : p));
    setSelectedProject(updatedProj);
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setNewTaskData({});
  };

  const handleAddCommentToTask = () => {
    if (!newCommentText.trim() || !editingTask || !selectedProject) return;
    const comment: Comment = { id: Date.now().toString(), text: newCommentText, author: currentUser?.name || 'مستخدم', authorRole: currentUser?.role || 'مجهول', timestamp: new Date().toISOString() };
    const updatedTask: Task = { ...editingTask, comments: [...(editingTask.comments || []), comment] };
    const updatedTasks = selectedProject.tasks.map(t => t.id === editingTask.id ? updatedTask : t);
    const updatedProj = { ...selectedProject, tasks: updatedTasks };
    setProjects(prev => prev.map(p => p.name === selectedProject.name ? updatedProj : p));
    setSelectedProject(updatedProj);
    setEditingTask(updatedTask);
    setNewCommentText('');
  };

  const handleCreateRequest = () => {
    const isConv = newRequest.type === 'conveyance';
    if (isConv && conveyanceMode === 'group') {
        if (pendingGroupRequests.length === 0) return alert('يرجى رفع ملف Excel للمجموعة أولاً');
        setServiceRequests(prev => [...pendingGroupRequests, ...prev]);
        setPendingGroupRequests([]);
        alert(`تم إرسال ${pendingGroupRequests.length} طلب بنجاح`);
        setView('REQUESTS');
        return;
    }
    if (!newRequest.projectName) return alert('يرجى اختيار المشروع');
    const req: ServiceRequest = {
      id: Math.random().toString(36).substr(2, 9),
      name: isConv ? `إفراغ: ${newRequest.clientName || 'جديد'}` : `${newRequest.serviceSubType || 'دعم فني'}`,
      type: isConv ? 'conveyance' : 'technical',
      projectName: newRequest.projectName,
      details: newRequest.details || '',
      submittedBy: currentUser?.name || '',
      role: currentUser?.role || '',
      status: (isConv && !['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '')) ? 'pending_finance' : 'new',
      date: new Date().toISOString().split('T')[0],
      history: [{ action: 'إنشاء الطلب', by: currentUser?.name || '', role: currentUser?.role || '', timestamp: new Date().toISOString() }],
      comments: [],
      ...newRequest
    } as ServiceRequest;
    setServiceRequests(prev => [req, ...prev]);
    setNewRequest({ projectName: '', type: 'conveyance' });
    alert('تم إرسال الطلب بنجاح');
    setView('REQUESTS');
  };

  // Logic to update service request status and maintain audit logs
  const updateRequestStatus = (id: string, status: RequestStatus, notes: string) => {
    const timestamp = new Date().toISOString();
    const actionText = status === 'completed' ? 'اعتماد الطلب' : status === 'rejected' ? 'رفض الطلب' : `تغيير الحالة إلى ${status}`;
    
    setServiceRequests(prev => {
      const updatedList = prev.map(req => {
        if (req.id === id) {
          const updatedReq = {
            ...req,
            status,
            history: [...req.history, {
              action: actionText,
              by: currentUser?.name || '',
              role: currentUser?.role || '',
              timestamp,
              notes
            }]
          };
          // Sync with currently open detailed view if applicable
          if (selectedRequest?.id === id) {
            setSelectedRequest(updatedReq);
          }
          return updatedReq;
        }
        return req;
      });
      return updatedList;
    });
  };

  // --- Derived Data for Requests ---
  const processedRequests = useMemo(() => {
    let filtered = serviceRequests.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.projectName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = requestStatusFilter === 'All' || r.status === requestStatusFilter;
      
      // Role-based visibility
      let isVisible = false;
      if (['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '')) isVisible = true;
      else if (currentUser?.role === 'FINANCE') isVisible = r.status === 'pending_finance';
      else if (currentUser?.role === 'CONVEYANCE' || currentUser?.role === 'TECHNICAL') isVisible = r.submittedBy === currentUser.name;

      return matchesSearch && matchesStatus && isVisible;
    });

    return filtered.sort((a, b) => {
      if (requestSortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (requestSortBy === 'project') return a.projectName.localeCompare(b.projectName);
      if (requestSortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });
  }, [serviceRequests, searchQuery, requestStatusFilter, requestSortBy, currentUser]);

  // --- UI Components ---
  const Logo: React.FC<{ className?: string, collapsed?: boolean }> = ({ className }) => (
    <div className={`${className} flex flex-col items-center justify-center`}>
      <img src={DAR_LOGO} className="w-full h-full object-contain rounded-3xl shadow-xl shadow-black/20" alt="Logo" />
    </div>
  );

  const CommentsList = ({ comments }: { comments?: Comment[] }) => (
    <div className="space-y-4 mt-6 border-t pt-6">
      <h5 className="font-bold flex items-center gap-2 text-[#1B2B48]"><MessageSquare className="w-4 h-4 text-orange-500" /> التعليقات ({comments?.length || 0})</h5>
      <div className="max-h-64 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {comments && comments.length > 0 ? comments.map((c) => (
            <div key={c.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2"><span className="font-bold text-[#1B2B48]">{c.author}</span><span className="text-gray-400">({c.authorRole})</span></div>
                <span className="text-gray-400 font-mono">{new Date(c.timestamp).toLocaleString('ar-SA')}</span>
              </div>
              <p className="text-sm text-gray-700 tracking-normal">{c.text}</p>
            </div>
        )) : <div className="text-center py-4 text-gray-400 text-xs italic">لا توجد تعليقات</div>}
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (['TECHNICAL', 'CONVEYANCE', 'FINANCE'].includes(currentUser?.role || '')) return null;
    const filtered = projects.filter(p => (locationFilter === 'All' || p.location === locationFilter) && (p.name.toLowerCase().includes(searchQuery.toLowerCase())));
    const pinned = filtered.filter(p => p.isPinned);
    const others = filtered.filter(p => !p.isPinned);
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-[#1B2B48]">لوحة التحكم العامة</h2></div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="بحث عن مشروع..." className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 text-right tracking-normal" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="px-4 py-2 rounded-xl border border-gray-200 text-right tracking-normal" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
              <option value="All">كل المدن</option>
              {LOCATIONS_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && <button onClick={() => setIsProjectModalOpen(true)} className="bg-[#E95D22] text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"><Plus size={20} /> مشروع جديد</button>}
          </div>
        </div>
        {pinned.length > 0 && <div className="space-y-4"><h3 className="flex items-center gap-2 font-bold text-orange-600"><Pin className="w-4 h-4 fill-current" /> المشاريع المثبتة</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{pinned.map(p => <ProjectCard key={p.name} project={p} onClick={p => { setSelectedProject(p); setView('PROJECT_DETAIL'); }} onTogglePin={p => setProjects(prev => prev.map(x => x.name === p.name ? {...x, isPinned: !x.isPinned} : x))} />)}</div></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{others.map(p => <ProjectCard key={p.name} project={p} onClick={p => { setSelectedProject(p); setView('PROJECT_DETAIL'); }} onTogglePin={p => setProjects(prev => prev.map(x => x.name === p.name ? {...x, isPinned: !x.isPinned} : x))} />)}</div>
      </div>
    );
  };

  const renderRequests = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-[#1B2B48]">إدارة الطلبات</h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 text-right tracking-normal appearance-none" value={requestStatusFilter} onChange={e => setRequestStatusFilter(e.target.value)}>
              <option value="All">كل الحالات</option>
              <option value="new">جديد</option>
              <option value="pending_finance">انتظار المالية</option>
              <option value="completed">منجز</option>
              <option value="rejected">مرفوض</option>
              <option value="revision">تعديل</option>
            </select>
          </div>
          <div className="relative flex-1 md:w-48">
            <SortAsc className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 text-right tracking-normal appearance-none" value={requestSortBy} onChange={e => setRequestSortBy(e.target.value as any)}>
              <option value="date">ترتيب حسب: التاريخ</option>
              <option value="project">ترتيب حسب: المشروع</option>
              <option value="status">ترتيب حسب: الحالة</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {processedRequests.length > 0 ? processedRequests.map(req => (
          <div key={req.id} onClick={() => { setSelectedRequest(req); setIsRequestDetailOpen(true); }} className="bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-lg transition-all border-r-4 border-r-[#1B2B48] hover:border-r-orange-500">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${req.type === 'conveyance' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}><Building size={24} /></div>
              <div><h4 className="font-bold text-lg">{req.name}</h4><div className="flex gap-3 text-xs text-gray-400 mt-1"><span><MapPin size={12} className="inline ml-1" />{req.projectName}</span><span><UserIcon size={12} className="inline ml-1" />{req.submittedBy}</span></div></div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400">{req.date}</span>
              <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${req.status === 'completed' ? 'bg-green-100 text-green-700' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {req.status === 'new' ? 'جديد' : req.status === 'pending_finance' ? 'انتظار المالية' : req.status === 'completed' ? 'منجز' : req.status === 'rejected' ? 'مرفوض' : 'تعديل'}
              </div>
            </div>
          </div>
        )) : <div className="bg-white p-20 rounded-[40px] border border-dashed text-center text-gray-400 font-bold">لا توجد طلبات تطابق الفلتر الحالي</div>}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إدارة المستخدمين</h2>
        <button onClick={() => { setEditingUser(null); setUserData({ name: '', email: '', role: 'PR_OFFICER', password: '123' }); setIsUserModalOpen(true); }} className="bg-[#1B2B48] text-white px-6 py-2 rounded-xl flex items-center gap-2"><UserPlus size={20} /> إضافة موظف</button>
      </div>
      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-gray-50 text-gray-500 text-sm">
            <tr><th className="p-5">الموظف</th><th className="p-5">البريد</th><th className="p-5">الدور</th><th className="p-5">الإجراءات</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-5 font-bold text-[#1B2B48]">{u.name}</td>
                <td className="p-5 text-gray-500">{u.email}</td>
                <td className="p-5"><span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">{u.role}</span></td>
                <td className="p-5">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingUser(u); setUserData(u); setIsUserModalOpen(true); }} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={16} /></button>
                    {u.id !== '1' && <button onClick={() => setUsers(prev => prev.filter(x => x.id !== u.id))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === 'LOGIN') return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-cairo" dir="rtl">
      <div className="bg-[#1B2B48] w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden border border-gray-100 text-center animate-in zoom-in-95 duration-500">
        <div className="p-12 relative overflow-hidden"><Logo className="h-48 mx-auto mb-8 relative z-10" /><h1 className="text-white text-4xl font-bold tracking-tight">تسجيل الدخول</h1><span className="text-orange-400 font-bold bg-white/5 border border-white/10 px-6 py-2 rounded-full text-lg mt-4 inline-block">العلاقات العامة</span></div>
        <form onSubmit={handleLogin} className="p-10 bg-white space-y-6 rounded-t-[50px] text-right">
          <div className="space-y-4">
            <input type="email" placeholder="البريد الإلكتروني" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal font-cairo focus:ring-2 ring-orange-500/20" value={loginData.email} onChange={e => setLoginData({...loginData, email: e.target.value})} required />
            <input type="password" placeholder="كلمة المرور" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal font-cairo focus:ring-2 ring-orange-500/20" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required />
          </div>
          <button className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xl">دخول النظام</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-cairo overflow-hidden" dir="rtl">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 bg-[#1B2B48] text-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'} ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/5 flex flex-col items-center relative">
          <Logo className={isSidebarCollapsed ? 'h-12 w-12' : 'h-24 w-24'} collapsed={isSidebarCollapsed} />
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden lg:flex absolute top-4 left-4 p-1.5 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">{isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
          {!isSidebarCollapsed && <div className="mt-4 text-center"><p className="font-bold text-sm">دار وإعمار</p><span className="text-[10px] text-orange-400 uppercase font-bold">{currentUser?.role}</span></div>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {[ 
              { id: 'DASHBOARD', label: 'الرئيسية', icon: LayoutDashboard, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER'] }, 
              { id: 'REQUESTS', label: 'الطلبات', icon: FileText, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE', 'TECHNICAL', 'CONVEYANCE'] }, 
              { id: 'SERVICE_ONLY', label: 'طلب جديد', icon: Plus, roles: ['TECHNICAL', 'CONVEYANCE', 'ADMIN', 'PR_MANAGER', 'PR_OFFICER'] },
              { id: 'USERS', label: 'الموظفين', icon: Users, roles: ['ADMIN'] }
            ].filter(i => i.roles.includes(currentUser?.role || '')).map(item => (
                <button key={item.id} onClick={() => { setView(item.id as ViewState); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group ${view === item.id ? 'bg-[#E95D22] shadow-xl shadow-orange-500/20' : 'hover:bg-white/5 text-gray-400'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                  <item.icon size={20} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
            ))}
        </nav>
        <div className="p-4 border-t border-white/5"><button onClick={() => setView('LOGIN')} className="w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all group ${isSidebarCollapsed ? 'justify-center' : ''}"><LogOut size={20} className="shrink-0" />{!isSidebarCollapsed && <span className="font-bold">خروج</span>}</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa] transition-all">
        <header className="lg:hidden p-4 bg-[#1B2B48] flex justify-between items-center sticky top-0 z-40 shadow-md">
          <Logo className="h-10 w-10" /><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white hover:bg-white/5 rounded-xl"><Menu /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 lg:p-12 text-right custom-scrollbar">
          {view === 'DASHBOARD' && renderDashboard()}
          {view === 'REQUESTS' && renderRequests()}
          {view === 'USERS' && renderUsers()}
          {view === 'SERVICE_ONLY' && (
            <div className="max-w-xl mx-auto py-4"><div className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100 space-y-6 animate-in slide-in-from-bottom-4 duration-500"><h2 className="text-2xl font-bold text-[#1B2B48] mb-8">إرسال طلب جديد</h2><div className="space-y-4 text-right"><label className="text-xs font-bold text-gray-400 pr-1">المشروع المستهدف</label><select className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo outline-none focus:ring-2 ring-orange-500/20" value={newRequest.projectName} onChange={e => setNewRequest({...newRequest, projectName: e.target.value})}><option value="">اختر المشروع...</option>{projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select><label className="text-xs font-bold text-gray-400 pr-1">نوع الخدمة</label><select className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo outline-none focus:ring-2 ring-orange-500/20" value={newRequest.type} onChange={e => setNewRequest({...newRequest, type: e.target.value as any})}><option value="conveyance">إفراغ عقاري</option><option value="technical">دعم فني</option></select><label className="text-xs font-bold text-gray-400 pr-1">تفاصيل إضافية</label><textarea placeholder="أدخل هنا كافة البيانات المتعلقة بالطلب لسرعة الإنجاز..." className="w-full p-4 bg-gray-50 rounded-2xl h-32 text-right tracking-normal leading-relaxed font-cairo outline-none focus:ring-2 ring-orange-500/20" value={newRequest.details} onChange={e => setNewRequest({...newRequest, details: e.target.value})} /><button onClick={handleCreateRequest} className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold text-lg shadow-xl shadow-orange-500/30 active:scale-95 transition-all">إرسال الطلب للمراجعة</button></div></div></div>
          )}
          {view === 'PROJECT_DETAIL' && selectedProject && (
            <div className="space-y-6 animate-in fade-in duration-500">
                <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-400 hover:text-orange-500 transition-colors mb-4"><ArrowLeft size={16} /> العودة للرئيسية</button>
                <div className="bg-white rounded-[40px] p-10 shadow-sm border text-right">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                        <div><h2 className="text-4xl font-bold text-[#1B2B48]">{selectedProject.name}</h2><div className="flex items-center gap-1.5 text-orange-500 font-bold bg-orange-50 px-3 py-1 rounded-full w-fit mt-3"><MapPin size={14} /> {selectedProject.location}</div></div>
                        <div className="flex gap-4">
                            {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && <button onClick={() => confirmDeleteProject(selectedProject.name)} className="bg-red-50 text-red-500 p-4 rounded-3xl hover:bg-red-100 transition-colors"><Trash2 size={24} /></button>}
                            <div className="bg-gray-50 p-6 rounded-3xl text-center border"><p className="text-gray-400 text-xs mb-1">الإنجاز الكلي</p><p className="text-3xl font-bold text-[#1B2B48]">{Math.round(selectedProject.progress)}%</p></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-[#1B2B48] text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden group"><ShieldCheck className="absolute -bottom-8 -left-8 w-32 h-32 opacity-10 group-hover:opacity-20 transition-all" /><h4 className="font-bold text-xl mb-6 flex items-center gap-2"><FileCheck className="text-orange-400" /> إحصائيات</h4><div className="space-y-4 text-sm"><div className="flex justify-between border-b border-white/10 pb-2"><span>العدد الكلي</span><span className="font-bold">{selectedProject.totalTasks}</span></div><div className="flex justify-between border-b border-white/10 pb-2"><span>المنجز</span><span className="font-bold text-green-400">{selectedProject.completedTasks}</span></div><div className="flex justify-between pb-2"><span>قيد العمل</span><span className="font-bold text-orange-400">{selectedProject.totalTasks - selectedProject.completedTasks}</span></div></div></div>
                            {['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '') && <button onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }} className="w-full bg-[#E95D22] text-white py-5 rounded-[30px] font-bold text-lg shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-all">إضافة عمل جديد</button>}
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                           <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-bold text-[#1B2B48]">سجل الأعمال</h3></div>
                           {selectedProject.tasks.map(task => <TaskCard key={task.id} task={task} onEdit={t => { setEditingTask(t); setNewTaskData(t); setIsTaskModalOpen(true); }} />)}
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Safe Modals Section --- */}
      
      {/* 1. Project Delete Confirmation Modal */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="تأكيد الحذف">
        <div className="text-right space-y-6">
          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center gap-4">
            <AlertCircle className="text-red-500 shrink-0" size={32} />
            <p className="text-red-700 font-bold">هل أنت متأكد من حذف مشروع "{projectToDelete}"؟</p>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">هذا الإجراء سيؤدي إلى مسح كافة المهام والطلبات والتعليقات المرتبطة بهذا المشروع بشكل نهائي. لا يمكن التراجع عن هذا العمل.</p>
          <div className="flex gap-4">
            <button onClick={handleDeleteProject} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">نعم، احذف المشروع</button>
            <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all">إلغاء</button>
          </div>
        </div>
      </Modal>

      {/* 2. User Add/Edit Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}>
        <div className="space-y-4 text-right">
          <label className="text-xs font-bold text-gray-400 pr-1">اسم الموظف</label>
          <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo outline-none focus:ring-2 ring-[#1B2B48]/20" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} />
          <label className="text-xs font-bold text-gray-400 pr-1">البريد الإلكتروني</label>
          <input type="email" className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo outline-none focus:ring-2 ring-[#1B2B48]/20" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} />
          <label className="text-xs font-bold text-gray-400 pr-1">الدور الوظيفي</label>
          <select className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo outline-none" value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as UserRole})}>
            <option value="ADMIN">مدير النظام (Admin)</option>
            <option value="PR_MANAGER">مدير علاقات عامة</option>
            <option value="PR_OFFICER">مسؤول علاقات عامة</option>
            <option value="FINANCE">المالية</option>
            <option value="TECHNICAL">القسم الفني</option>
            <option value="CONVEYANCE">موظف إفراغات</option>
          </select>
          <label className="text-xs font-bold text-gray-400 pr-1">كلمة المرور</label>
          <input type="password" placeholder="اتركها كما هي لعدم التغيير" className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo outline-none focus:ring-2 ring-[#1B2B48]/20" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} />
          <button onClick={handleSaveUser} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-opacity-90 transition-all mt-4">{editingUser ? "تحديث البيانات" : "إضافة الموظف للنظام"}</button>
        </div>
      </Modal>

      {/* 3. Task Edit/Add Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل العمل' : 'إضافة عمل'}>
        <div className="space-y-4 text-right font-cairo">
          <textarea placeholder="بيان العمل" className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-right tracking-normal font-cairo border" value={newTaskData.description || ''} onChange={e => setNewTaskData({...newTaskData, description: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="جهة المراجعة" className="p-4 bg-gray-50 rounded-2xl border text-right font-cairo tracking-normal" value={newTaskData.reviewer || ''} onChange={e => setNewTaskData({...newTaskData, reviewer: e.target.value})} />
            <select className="p-4 bg-gray-50 rounded-2xl border text-right font-cairo tracking-normal" value={newTaskData.status || 'متابعة'} onChange={e => setNewTaskData({...newTaskData, status: e.target.value})}>
              <option value="متابعة">متابعة</option>
              <option value="منجز">منجز</option>
            </select>
          </div>
          <textarea placeholder="ملاحظات وتفاصيل..." className="w-full p-4 bg-gray-50 rounded-2xl h-24 text-right tracking-normal leading-relaxed font-cairo border" value={newTaskData.notes || ''} onChange={e => setNewTaskData({...newTaskData, notes: e.target.value})} />
          <button onClick={handleSaveTask} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold shadow-lg">حفظ البيانات</button>
          {editingTask && <><CommentsList comments={editingTask.comments} /><div className="mt-4 flex gap-2"><input type="text" placeholder="أضف تعليقاً..." className="flex-1 p-3 bg-gray-50 border rounded-xl text-sm outline-none text-right tracking-normal font-cairo" value={newCommentText} onChange={e => setNewCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCommentToTask()} /><button onClick={handleAddCommentToTask} className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 shadow-sm"><Send className="w-4 h-4" /></button></div></>}
        </div>
      </Modal>

      {/* 4. Request Details Modal */}
      <Modal isOpen={isRequestDetailOpen} onClose={() => setIsRequestDetailOpen(false)} title="تفاصيل الطلب">
        {selectedRequest && (
          <div className="space-y-6 font-cairo text-right">
            <div className="bg-gray-50 p-6 rounded-3xl border text-sm space-y-4">
              <div className="flex justify-between border-b pb-2"><span>المشروع:</span><span className="font-bold">{selectedRequest.projectName}</span></div>
              <div className="flex justify-between border-b pb-2"><span>تاريخ الطلب:</span><span className="font-bold">{selectedRequest.date}</span></div>
              <div className="flex justify-between border-b pb-2"><span>مقدم الطلب:</span><span className="font-bold">{selectedRequest.submittedBy}</span></div>
              <div className="bg-white p-4 rounded-2xl border space-y-2"><p className="font-bold text-xs text-orange-500">وصف الطلب:</p><p className="leading-relaxed tracking-normal">{selectedRequest.details}</p></div>
            </div>
            {/* Actions for Admins/Managers */}
            {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && selectedRequest.status !== 'completed' && (
              <div className="flex gap-2">
                <button onClick={() => updateRequestStatus(selectedRequest.id, 'completed', "تم الاعتماد من الإدارة")} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-600/20 text-sm">اعتماد الطلب</button>
                <button onClick={() => updateRequestStatus(selectedRequest.id, 'rejected', "مرفوض من قبل الإدارة")} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-red-600/20 text-sm">رفض الطلب</button>
              </div>
            )}
            <CommentsList comments={selectedRequest.comments} />
          </div>
        )}
      </Modal>

      {/* 5. Project Add Modal */}
      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="إضافة مشروع جديد">
        <div className="space-y-4 text-right">
          <input type="text" placeholder="اسم المشروع" className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl border text-right tracking-normal font-cairo" value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})}>
            {LOCATIONS_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={handleCreateProject} className="w-full bg-[#E95D22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 mt-4">حفظ المشروع</button>
        </div>
      </Modal>
    </div>
  );
};

const App: React.FC = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
