
import React, { useState, useEffect, ReactNode, useRef } from 'react';
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, 
  Plus, ChevronRight, ChevronLeft, History as HistoryIcon, 
  FileCheck, User as UserIcon, UploadCloud,
  Menu, X, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  ImageIcon, Pin, Search, Filter, Trash2, Loader2, 
  Send, Clock, CheckCircle2, ShieldCheck, UserPlus, Building, 
  MessageSquare, MessageCirclePlus, MapPin, FileSpreadsheet,
  ListChecks, AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown,
  Building2
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

// Simplified Robust Logo Component
const Logo: React.FC<{ className?: string, collapsed?: boolean }> = ({ className, collapsed }) => {
  return (
    <div className={`${className} flex flex-col items-center justify-center transition-all duration-500`}>
      <img 
        src={DAR_LOGO} 
        className="w-full h-full object-contain rounded-3xl shadow-xl shadow-black/20" 
        alt="Dar Wa Emaar Logo" 
      />
      {!collapsed && className?.includes('h-48') && (
        <div className="mt-4">
           {/* Placeholder for optional text under the main login logo */}
        </div>
      )}
    </div>
  );
};

const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch {}
  }
};

const STORAGE_KEYS = {
    PROJECTS: 'dar_projects_v5',
    USERS: 'dar_users_v5',
    REQUESTS: 'dar_requests_v5',
    SIDEBAR_COLLAPSED: 'dar_sidebar_collapsed_v1'
};

class ErrorBoundary extends React.Component<{children?: ReactNode}, {hasError: boolean}> {
  public state: { hasError: boolean };
  public props: { children?: ReactNode };

  constructor(props: {children?: ReactNode}) {
    super(props);
    this.props = props;
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return safeStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });
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
  const [newRequest, setNewRequest] = useState<Partial<ServiceRequest>>({ projectName: '', type: 'conveyance' });
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  
  // New State for submission modes
  const [conveyanceMode, setConveyanceMode] = useState<'individual' | 'group'>('individual');
  const [pendingGroupRequests, setPendingGroupRequests] = useState<ServiceRequest[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Commenting UI State
  const [newCommentText, setNewCommentText] = useState('');

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
      safeStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isSidebarCollapsed));
    }
  }, [projects, users, serviceRequests, isLoading, isSidebarCollapsed]);

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
        status: newTaskData.status || 'متابعة', date: new Date().toISOString().split('T')[0],
        comments: []
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

  const handleAddCommentToTask = () => {
    if (!newCommentText.trim() || !editingTask || !selectedProject) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      text: newCommentText,
      author: currentUser?.name || 'مستخدم',
      authorRole: currentUser?.role || 'مجهول',
      timestamp: new Date().toISOString()
    };

    const updatedTask: Task = {
      ...editingTask,
      comments: [...(editingTask.comments || []), comment]
    };

    const updatedTasks = selectedProject.tasks.map(t => t.id === editingTask.id ? updatedTask : t);
    const updatedProj = { ...selectedProject, tasks: updatedTasks };

    setProjects(projects.map(p => p.name === selectedProject.name ? updatedProj : p));
    setSelectedProject(updatedProj);
    setEditingTask(updatedTask);
    setNewCommentText('');
  };

  const handleAddCommentToRequest = () => {
    if (!newCommentText.trim() || !selectedRequest) return;

    const comment: Comment = {
      id: Date.now().toString(),
      text: newCommentText,
      author: currentUser?.name || 'مستخدم',
      authorRole: currentUser?.role || 'مجهول',
      timestamp: new Date().toISOString()
    };

    setServiceRequests(prev => prev.map(r => 
      r.id === selectedRequest.id 
      ? { ...r, comments: [...(r.comments || []), comment] } 
      : r
    ));
    
    setSelectedRequest(prev => prev ? { ...prev, comments: [...(prev.comments || []), comment] } : null);
    setNewCommentText('');
  };

  const handleCreateRequest = () => {
    const isConv = newRequest.type === 'conveyance';
    
    // Check if we have group requests to send
    if (isConv && conveyanceMode === 'group') {
        if (pendingGroupRequests.length === 0) {
            alert('يرجى رفع ملف Excel للمجموعة أولاً');
            return;
        }
        setServiceRequests(prev => [...pendingGroupRequests, ...prev]);
        setPendingGroupRequests([]);
        alert(`تم إرسال ${pendingGroupRequests.length} طلب إفراغ بنجاح`);
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

    setServiceRequests([req, ...serviceRequests]);
    setNewRequest({ projectName: '', type: 'conveyance' });
    alert('تم إرسال الطلب بنجاح');
    setView('REQUESTS');
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'array' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            if (data.length === 0) {
                alert('الملف فارغ أو لا يحتوي على بيانات صالحة');
                return;
            }

            const newRequests: ServiceRequest[] = data.map((row: any) => {
                const clientName = row['اسم العميل'] || row['العميل'] || 'بدون اسم';
                const projectName = row['المشروع'] || newRequest.projectName || '';
                
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    name: `إفراغ: ${clientName}`,
                    type: 'conveyance',
                    projectName: projectName,
                    details: `طلب مجموعة من ملف Excel. رقم القطعة: ${row['رقم القطعة'] || row['القطعة'] || '-'}`,
                    submittedBy: currentUser?.name || '',
                    role: currentUser?.role || '',
                    status: (['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '')) ? 'new' : 'pending_finance',
                    date: new Date().toISOString().split('T')[0],
                    history: [{ action: 'استيراد من ملف Excel (قيد التأكيد)', by: currentUser?.name || '', role: currentUser?.role || '', timestamp: new Date().toISOString() }],
                    comments: [],
                    clientName: clientName,
                    mobileNumber: row['رقم الجوال'] || row['الجوال'] || '',
                    idNumber: row['رقم الهوية'] || row['الهوية'] || '',
                    unitNumber: row['رقم القطعة'] || row['القطعة'] || '',
                    deedNumber: row['رقم الصك'] || row['الصك'] || '',
                    bank: row['البنك'] || row['بنك'] || '',
                    propertyValue: row['قيمة العقار'] || row['القيمة'] || ''
                } as ServiceRequest;
            });

            setPendingGroupRequests(newRequests);
            alert(`تم استيراد بيانات ${newRequests.length} عميل. يرجى مراجعة الجدول ثم الضغط على "إرسال كافة الطلبات"`);
        } catch (error) {
            console.error('Excel processing error:', error);
            alert('حدث خطأ أثناء معالجة الملف. يرجى التأكد من الصيغة الصحيحة.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateRequestStatus = (reqId: string, status: RequestStatus, note?: string) => {
    setServiceRequests(prev => prev.map(r => {
      if (r.id === reqId) {
        let finalComments = [...(r.comments || [])];
        
        // If there's a note (e.g. from the comment box), add it as a formal comment too
        if (note && note.trim()) {
           finalComments.push({
             id: Date.now().toString() + Math.random(),
             text: note,
             author: currentUser?.name || 'مستخدم',
             authorRole: currentUser?.role || 'مجهول',
             timestamp: new Date().toISOString()
           });
        }

        const statusAr = status === 'completed' ? 'منجز' : status === 'rejected' ? 'مرفوض' : status === 'revision' ? 'إعادة للتعديل' : status === 'new' ? 'معتمد' : status;

        const updated = {
          ...r, 
          status,
          comments: finalComments,
          history: [...r.history, { 
            action: `تغيير الحالة إلى ${statusAr}`, 
            by: currentUser?.name || '', 
            role: currentUser?.role || '', 
            timestamp: new Date().toISOString(), 
            notes: note 
          }]
        };
        
        if (status === 'completed') {
          const proj = projects.find(p => p.name === r.projectName);
          if (proj) {
            const newTask: Task = {
              id: `req-${r.id}`, project: r.projectName, description: r.name,
              reviewer: r.authority || (r.type === 'conveyance' ? 'كتابة العدل' : 'القسم الفني'),
              requester: r.submittedBy, notes: r.details, location: proj.location,
              status: 'منجز', date: new Date().toISOString().split('T')[0],
              comments: finalComments
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
    setNewCommentText('');
    setIsRequestDetailOpen(false);
  };

  // --- Sub-components for Commenting ---
  const CommentsList = ({ comments }: { comments?: Comment[] }) => (
    <div className="space-y-4 mt-6 border-t pt-6">
      <h5 className="font-bold flex items-center gap-2 text-[#1B2B48]">
        <MessageSquare className="w-4 h-4 text-orange-500" />
        التعليقات والمناقشات ({comments?.length || 0})
      </h5>
      <div className="max-h-64 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {comments && comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">
                    {comment.author[0]}
                  </div>
                  <span className="font-bold text-xs">{comment.author}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-200/50 px-1.5 rounded-full uppercase">{comment.authorRole}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                  {new Date(comment.timestamp).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed tracking-normal">{comment.text}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-400 text-xs italic">لا توجد تعليقات حتى الآن</div>
        )}
      </div>
    </div>
  );

  const CommentInput = ({ onAdd }: { onAdd: () => void }) => (
    <div className="mt-4 flex gap-2">
      <input 
        type="text" 
        placeholder="أضف تعليقاً..." 
        className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ring-orange-500/10 outline-none text-right tracking-normal font-cairo"
        value={newCommentText}
        onChange={e => setNewCommentText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
      />
      <button 
        onClick={onAdd}
        className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors shadow-sm"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );

  // --- Views ---
  const renderDashboard = () => {
    // Basic protection for roles that shouldn't see the dashboard
    if (['TECHNICAL', 'CONVEYANCE', 'FINANCE'].includes(currentUser?.role || '')) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
          <ShieldCheck className="w-16 h-16 text-orange-500 opacity-20" />
          <h3 className="text-xl font-bold text-[#1B2B48]">غير مصرح بالوصول</h3>
          <p className="text-gray-400">لا تملك صلاحيات كافية لمشاهدة لوحة التحكم العامة.</p>
        </div>
      );
    }

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
              <input type="text" placeholder="بحث عن مشروع..." className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 text-right tracking-normal" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="px-4 py-2 rounded-xl border border-gray-200 text-right tracking-normal" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
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
    const isConv = newRequest.type === 'conveyance';
    
    return (
      <div className="max-w-xl mx-auto py-4">
        <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-bold text-[#1B2B48]">طلب خدمة جديد</h2>
            <button className="text-gray-300 hover:text-gray-500 transition-colors" onClick={() => setView('REQUESTS')}><X size={24} /></button>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400 block pr-1 text-right">نوع الطلب</label>
              <select 
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 text-[#1B2B48] font-bold outline-none focus:ring-2 ring-orange-500/20 disabled:opacity-50 text-right tracking-normal"
                value={newRequest.type}
                disabled={(currentUser?.role === 'CONVEYANCE' || currentUser?.role === 'TECHNICAL') && pendingGroupRequests.length === 0}
                onChange={e => setNewRequest({...newRequest, type: e.target.value as any, authority: '', serviceSubType: ''})}
              >
                <option value="conveyance">إفراغ عقاري</option>
                <option value="technical">دعم فني</option>
              </select>
            </div>

            {isConv && (
              <div className="flex p-1 bg-gray-100 rounded-2xl">
                <button 
                  onClick={() => { setConveyanceMode('individual'); setPendingGroupRequests([]); }}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${conveyanceMode === 'individual' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}
                >
                  طلب فردي
                </button>
                <button 
                  onClick={() => setConveyanceMode('group')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${conveyanceMode === 'group' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}
                >
                  مجموعة (ملف Excel)
                </button>
              </div>
            )}

            {isConv && conveyanceMode === 'group' ? (
              <div className="space-y-6 text-right">
                {pendingGroupRequests.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-orange-200 rounded-3xl bg-orange-50/30">
                    <FileSpreadsheet className="w-16 h-16 text-orange-500 mx-auto mb-4 opacity-50" />
                    <p className="font-bold text-orange-600 mb-2 text-center">استيراد من ملف Excel</p>
                    <p className="text-xs text-orange-400 mb-6 px-6 leading-relaxed text-center">يرجى التأكد من أن الملف يحتوي على أعمدة واضحة لبيانات العملاء (اسم العميل، رقم الجوال، رقم الهوية، رقم القطعة، إلخ)</p>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".xlsx, .xls" 
                        onChange={handleExcelUpload}
                        className="hidden" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 mx-auto block"
                    >
                        اختر الملف للبدء
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-[#1B2B48] flex items-center gap-2">
                            <ListChecks className="text-orange-500" />
                            بيانات العملاء المستوردة ({pendingGroupRequests.length})
                        </h3>
                        <button 
                            onClick={() => setPendingGroupRequests([])}
                            className="text-red-500 text-xs font-bold hover:underline"
                        >
                            إلغاء الكل
                        </button>
                    </div>
                    <div className="max-h-64 overflow-auto border border-gray-100 rounded-2xl shadow-inner bg-gray-50 custom-scrollbar">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-white sticky top-0 shadow-sm">
                                <tr>
                                    <th className="p-3 border-b">اسم العميل</th>
                                    <th className="p-3 border-b">رقم الجوال</th>
                                    <th className="p-3 border-b">رقم القطعة</th>
                                    <th className="p-3 border-b">البنك</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingGroupRequests.map((req, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                                        <td className="p-3 font-bold">{req.clientName}</td>
                                        <td className="p-3 text-gray-500">{req.mobileNumber}</td>
                                        <td className="p-3 text-gray-500">{req.unitNumber}</td>
                                        <td className="p-3 text-gray-500">{req.bank}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-2xl flex items-start gap-3 border border-orange-100">
                        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                        <p className="text-[10px] text-orange-700 leading-relaxed text-right">
                            ملاحظة: سيتم إرسال كافة الطلبات أعلاه مباشرة إلى قائمة الانتظار للمراجعة. يرجى التأكد من دقة البيانات قبل المتابعة.
                        </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {isConv ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">اسم العميل</label>
                      <input type="text" placeholder="اسم العميل" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal" value={newRequest.clientName || ''} onChange={e => setNewRequest({...newRequest, clientName: e.target.value})} />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">رقم الجوال</label>
                      <input type="text" placeholder="05xxxxxxxx" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.mobileNumber || ''} onChange={e => setNewRequest({...newRequest, mobileNumber: e.target.value})} />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">رقم الهوية</label>
                      <input type="text" placeholder="10xxxxxxxx" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.idNumber || ''} onChange={e => setNewRequest({...newRequest, idNumber: e.target.value})} />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">المشروع</label>
                      <select className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.projectName} onChange={e => setNewRequest({...newRequest, projectName: e.target.value})}>
                        <option value="">اختر المشروع...</option>
                        {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">رقم القطعة</label>
                      <input type="text" placeholder="رقم القطعة" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.unitNumber || ''} onChange={e => setNewRequest({...newRequest, unitNumber: e.target.value})} />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">رقم الصك</label>
                      <input type="text" placeholder="اختياري" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.deedNumber || ''} onChange={e => setNewRequest({...newRequest, deedNumber: e.target.value})} />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">البنك</label>
                      <input type="text" placeholder="البنك الممول" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.bank || ''} onChange={e => setNewRequest({...newRequest, bank: e.target.value})} />
                    </div>
                    <div className="col-span-2 space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">قيمة العقار</label>
                      <input type="text" placeholder="القيمة الإجمالية" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none text-right tracking-normal" value={newRequest.propertyValue || ''} onChange={e => setNewRequest({...newRequest, propertyValue: e.target.value})} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">نوع الخدمة</label>
                      <select className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal" value={newRequest.serviceSubType || ''} onChange={e => setNewRequest({...newRequest, serviceSubType: e.target.value})}>
                        <option value="">اختر نوع الخدمة...</option>
                        {TECHNICAL_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">وصف الخدمة</label>
                      <textarea placeholder="أدخل تفاصيل الطلب هنا..." className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 h-28 outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal leading-relaxed" value={newRequest.details || ''} onChange={e => setNewRequest({...newRequest, details: e.target.value})} />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">المشروع</label>
                      <select className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal" value={newRequest.projectName} onChange={e => setNewRequest({...newRequest, projectName: e.target.value})}>
                        <option value="">اختر المشروع...</option>
                        {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs font-bold text-gray-400 pr-1">الجهة</label>
                      <select className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal" value={newRequest.authority || ''} onChange={e => setNewRequest({...newRequest, authority: e.target.value})}>
                        <option value="">اختر الجهة المستهدفة...</option>
                        {GOVERNMENT_AUTHORITIES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {(conveyanceMode === 'individual' || !isConv || pendingGroupRequests.length > 0) && (
              <button 
                onClick={handleCreateRequest} 
                className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold text-lg shadow-xl shadow-orange-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all mt-4"
              >
                <Send className="w-5 h-5" />
                {isConv && conveyanceMode === 'group' ? 'إرسال كافة الطلبات' : 'إرسال الطلب'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRequests = () => {
    // Highly specific filtering based on user roles
    const filteredRequests = serviceRequests.filter(r => {
      // Admins and PR Managers/Officers see everything
      if (['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '')) return true;
      
      // Finance only sees requests pending their approval
      if (currentUser?.role === 'FINANCE') return r.status === 'pending_finance';
      
      // Conveyance and Technical roles ONLY see requests they submitted
      if (currentUser?.role === 'CONVEYANCE' || currentUser?.role === 'TECHNICAL') {
        return r.submittedBy === currentUser.name;
      }
      
      return false;
    });

    const isRestrictedRole = ['CONVEYANCE', 'TECHNICAL', 'FINANCE'].includes(currentUser?.role || '');

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {isRestrictedRole ? 'متابعة طلباتي' : 'إدارة الطلبات الواردة'}
          </h2>
          {isRestrictedRole && (
            <button 
              onClick={() => {
                setNewRequest({ projectName: '', type: currentUser?.role === 'CONVEYANCE' ? 'conveyance' : 'technical' });
                setView('SERVICE_ONLY');
              }}
              className="bg-[#E95D22] text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/20"
            >
              <Plus className="w-4 h-4" /> طلب جديد
            </button>
          )}
        </div>

        {filteredRequests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredRequests.map(req => (
              <div key={req.id} onClick={() => { setSelectedRequest(req); setIsRequestDetailOpen(true); }} className="bg-white p-6 rounded-3xl border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center gap-4 text-right">
                  <div className={`p-4 rounded-2xl transition-colors ${req.type === 'conveyance' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {req.type === 'conveyance' ? <Building className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold">{req.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {req.projectName}</span>
                      <span className="flex items-center gap-1"><UserIcon size={12} /> {req.submittedBy}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {(req.comments?.length || 0) > 0 && (
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <MessageSquare size={14} />
                      <span>{req.comments?.length}</span>
                    </div>
                  )}
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                    req.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    req.status === 'revision' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {req.status === 'new' ? 'جديد' : 
                     req.status === 'pending_finance' ? 'انتظار المالية' : 
                     req.status === 'completed' ? 'منجز' : 
                     req.status === 'rejected' ? 'مرفوض' : 
                     req.status === 'revision' ? 'إعادة للتعديل' : 'قيد المراجعة'}
                  </div>
                </div>
                <div className="absolute inset-y-0 right-0 w-1 bg-orange-500 transform translate-x-full group-hover:translate-x-0 transition-transform"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-16 rounded-[40px] border border-dashed border-gray-200 text-center space-y-4">
            <ListChecks className="w-16 h-16 text-gray-200 mx-auto" />
            <p className="text-gray-400 font-bold">لا توجد طلبات لعرضها حالياً</p>
          </div>
        )}
      </div>
    );
  };

  if (view === 'LOGIN') return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-cairo" dir="rtl">
      <div className="bg-[#1B2B48] w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden border border-gray-100 transition-all duration-500 hover:shadow-orange-500/10 text-center">
        <div className="p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-16 -mb-16 blur-3xl opacity-50"></div>
          
          <Logo className="h-48 mx-auto mb-8 relative z-10" />
          
          <div className="relative z-10 space-y-4">
            <h1 className="text-white text-4xl font-bold tracking-tight">تسجيل الدخول</h1>
            <div className="flex flex-col items-center gap-2">
              <span className="text-orange-400 font-bold bg-white/5 border border-white/10 px-6 py-2 rounded-full text-lg">العلاقات العامة</span>
              <p className="text-blue-200/60 text-sm font-medium">دار وإعمار للتطوير العقاري</p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleLogin} className="p-10 bg-white space-y-6 rounded-t-[50px] text-right">
          <div className="space-y-4 text-right">
            <div className="relative">
              <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="email" 
                placeholder="البريد الإلكتروني" 
                className="w-full pr-12 pl-4 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 transition-all border border-gray-100 focus:border-orange-200 text-right tracking-normal" 
                value={loginData.email} 
                onChange={e => setLoginData({...loginData, email: e.target.value})} 
                required 
              />
            </div>
            <div className="relative">
              <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="password" 
                placeholder="كلمة المرور" 
                className="w-full pr-12 pl-4 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 transition-all border border-gray-100 focus:border-orange-200 text-right tracking-normal" 
                value={loginData.password} 
                onChange={e => setLoginData({...loginData, password: e.target.value})} 
                required 
              />
            </div>
          </div>
          
          <button className="w-full bg-[#E95D22] text-white py-5 rounded-3xl font-bold shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-xl">
            دخول النظام
          </button>
          
          <p className="text-center text-gray-400 text-xs mt-4">
            جميع الحقوق محفوظة © {new Date().getFullYear()} دار وإعمار للتطوير العقاري
          </p>
        </form>
      </div>
    </div>
  );

  const sidebarMenuItems = [
    { id: 'DASHBOARD', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER'] },
    { id: 'REQUESTS', label: 'قائمة الطلبات', icon: FileText, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE', 'TECHNICAL', 'CONVEYANCE'] },
    { id: 'SERVICE_ONLY', label: 'طلب خدمة', icon: Plus, roles: ['TECHNICAL', 'CONVEYANCE', 'ADMIN', 'PR_MANAGER', 'PR_OFFICER'] },
    { id: 'USERS', label: 'المستخدمين', icon: Users, roles: ['ADMIN'] },
  ].filter(item => item.roles.includes(currentUser?.role || ''));

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-cairo overflow-hidden" dir="rtl">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 bg-[#1B2B48] text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl 
          ${isSidebarCollapsed ? 'w-20' : 'w-72'} 
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 border-b border-white/5 flex flex-col items-center relative overflow-hidden min-h-[160px] justify-center text-center">
          <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'scale-75' : 'scale-100'} mb-2`}>
             <Logo className={`${isSidebarCollapsed ? 'h-12 w-12' : 'h-24 w-24'}`} collapsed={isSidebarCollapsed} />
          </div>
          {!isSidebarCollapsed && (
            <div className="text-center animate-in fade-in slide-in-from-top-2 duration-300">
              <h2 className="font-bold text-sm">دار وإعمار</h2>
              <span className="text-[10px] text-orange-400 font-bold tracking-widest uppercase mt-1 px-3 py-1 bg-white/5 rounded-full block mx-auto w-fit border border-white/5">
                {currentUser?.role === 'ADMIN' ? 'المدير العام' : 
                 currentUser?.role === 'PR_MANAGER' ? 'مدير العلاقات' : 
                 currentUser?.role === 'PR_OFFICER' ? 'مسؤول علاقات' : 
                 currentUser?.role === 'FINANCE' ? 'المالية' : 
                 currentUser?.role === 'TECHNICAL' ? 'القسم الفني' : 'إفراغات'}
              </span>
            </div>
          )}
          
          {/* Toggle Button */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex absolute top-4 left-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {sidebarMenuItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => { setView(item.id as ViewState); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group
                ${view === item.id ? 'bg-[#E95D22] shadow-xl shadow-orange-500/20' : 'hover:bg-white/5 text-gray-400'}
                ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? item.label : ''}
            >
              <item.icon size={20} className="shrink-0" /> 
              {!isSidebarCollapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
              {isSidebarCollapsed && (
                <div className="absolute right-full mr-2 px-3 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#16253d]">
          <div className={`flex items-center gap-3 p-3 bg-white/5 rounded-2xl mb-4 overflow-hidden border border-white/5 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-orange-400 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-orange-500/10">{currentUser?.name[0]}</div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden text-right">
                <p className="text-sm font-bold truncate text-white">{currentUser?.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{currentUser?.email}</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setView('LOGIN')} 
            className={`w-full flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all group relative
              ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? 'تسجيل خروج' : ''}
          >
            <LogOut size={20} className="shrink-0" /> 
            {!isSidebarCollapsed && <span className="font-bold">تسجيل خروج</span>}
            {isSidebarCollapsed && (
               <div className="absolute right-full mr-2 px-3 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                تسجيل خروج
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa] transition-all duration-300">
        <header className="lg:hidden p-4 bg-[#1B2B48] flex justify-between items-center sticky top-0 z-40 shadow-sm">
          <Logo className="h-10 w-10" />
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors"><Menu /></button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-12 custom-scrollbar text-right">
          {view === 'DASHBOARD' && renderDashboard()}
          {view === 'USERS' && renderUsers()}
          {view === 'SERVICE_ONLY' && renderServiceOnly()}
          {view === 'REQUESTS' && renderRequests()}
          {view === 'PROJECT_DETAIL' && selectedProject && (
            <div className="space-y-6">
              <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-500 hover:text-[#E95D22] mb-4 group transition-colors">
                <div className="bg-gray-100 p-2 rounded-full group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                  <ArrowLeft size={16} /> 
                </div>
                العودة للرئيسية
              </button>
              <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 text-right">
                <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6 text-right">
                  <div>
                    <h2 className="text-4xl font-bold mb-2 text-[#1B2B48]">{selectedProject.name}</h2>
                    <div className="flex items-center gap-1.5 text-orange-500 font-bold bg-orange-50 px-3 py-1 rounded-full w-fit">
                      <MapPin className="w-4 h-4" />
                      {selectedProject.location}
                    </div>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && (
                      <button onClick={() => handleDeleteProject(selectedProject.name)} className="bg-red-50 text-red-500 p-4 rounded-3xl hover:bg-red-100 transition-colors shrink-0"><Trash2 size={24} /></button>
                    )}
                    <div className="bg-gray-50 p-6 rounded-3xl text-center shadow-inner flex-1 md:flex-none min-w-[120px] border border-gray-100">
                      <p className="text-gray-400 text-xs mb-1 text-center">نسبة الإنجاز</p>
                      <p className="text-3xl font-bold text-[#1B2B48] text-center">{Math.round(selectedProject.progress)}%</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-1 space-y-6 text-right">
                    <div className="bg-[#1B2B48] text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden group">
                       <ShieldCheck className="absolute -bottom-8 -left-8 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity" />
                       <h4 className="font-bold text-xl mb-6 flex items-center gap-2">
                         <FileCheck className="text-orange-400" />
                         إحصائيات المهام
                       </h4>
                       <div className="space-y-4">
                         <div className="flex justify-between border-b border-white/10 pb-2"><span>العدد الكلي</span><span className="font-bold">{selectedProject.totalTasks}</span></div>
                         <div className="flex justify-between border-b border-white/10 pb-2"><span>المنجزة</span><span className="font-bold text-green-400">{selectedProject.completedTasks}</span></div>
                         <div className="flex justify-between pb-2"><span>قيد المتابعة</span><span className="font-bold text-orange-400">{selectedProject.totalTasks - selectedProject.completedTasks}</span></div>
                       </div>
                    </div>
                    {['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '') && (
                      <button onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }} className="w-full bg-[#E95D22] text-white py-5 rounded-[30px] font-bold text-lg shadow-xl shadow-orange-500/20 hover:scale-[1.02] transition-transform active:scale-95">إضافة عمل جديد</button>
                    )}
                  </div>
                  <div className="lg:col-span-2 space-y-4 text-right">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                      <h3 className="text-2xl font-bold text-[#1B2B48]">بيان الأعمال</h3>
                      <div className="flex bg-gray-100 p-1 rounded-2xl w-full sm:w-auto">
                        {['All', 'متابعة', 'منجز'].map(s => (
                          <button key={s} onClick={() => setTaskFilter(s)} className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-bold transition-all ${taskFilter === s ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>{s === 'All' ? 'الكل' : s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4 text-right">
                      {selectedProject.tasks.filter(t => taskFilter === 'All' || t.status === taskFilter).length > 0 ? (
                        selectedProject.tasks.filter(t => taskFilter === 'All' || t.status === taskFilter).map(task => (
                          <TaskCard key={task.id} task={task} onEdit={t => { setEditingTask(t); setNewTaskData(t); setIsTaskModalOpen(true); }} />
                        ))
                      ) : (
                        <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center">
                          <p className="text-gray-400 text-center">لا توجد أعمال لعرضها</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="إضافة مشروع جديد">
        <div className="space-y-4 text-right">
          <input type="text" placeholder="اسم المشروع" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal font-cairo" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal font-cairo" value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})}>
            {LOCATIONS_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="text" placeholder="رابط صورة المشروع (اختياري)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal font-cairo" value={newProject.imageUrl || ''} onChange={e => setNewProject({...newProject, imageUrl: e.target.value})} />
          <button onClick={handleCreateProject} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#1B2B48]/20 hover:bg-opacity-90 transition-colors">حفظ المشروع</button>
        </div>
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="إضافة موظف جديد">
        <div className="space-y-4 text-right">
          <input type="text" placeholder="اسم الموظف" className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-right tracking-normal font-cairo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
          <input type="email" placeholder="البريد الإلكتروني" className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-right tracking-normal font-cairo" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-right tracking-normal font-cairo" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
            <option value="PR_MANAGER">مدير علاقات عامة</option>
            <option value="PR_OFFICER">مسؤول علاقات عامة</option>
            <option value="FINANCE">المالية</option>
            <option value="TECHNICAL">القسم الفني</option>
            <option value="CONVEYANCE">موظف إفراغ</option>
          </select>
          <input type="password" placeholder="كلمة المرور" className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-right tracking-normal font-cairo" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
          <button onClick={handleCreateUser} className="w-full bg-[#E95D22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors">إضافة الموظف</button>
        </div>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل عمل' : 'إضافة عمل جديد'}>
        <div className="space-y-4 text-right">
          <textarea placeholder="بيان العمل" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal leading-relaxed font-cairo" value={newTaskData.description || ''} onChange={e => setNewTaskData({...newTaskData, description: e.target.value})} />
          <input type="text" placeholder="جهة المراجعة" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal font-cairo" value={newTaskData.reviewer || ''} onChange={e => setNewTaskData({...newTaskData, reviewer: e.target.value})} />
          <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal font-cairo" value={newTaskData.status || 'متابعة'} onChange={e => setNewTaskData({...newTaskData, status: e.target.value})}>
            <option value="متابعة">متابعة</option>
            <option value="منجز">منجز</option>
          </select>
          <textarea placeholder="ملاحظات" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-orange-500/20 text-right tracking-normal leading-relaxed font-cairo" value={newTaskData.notes || ''} onChange={e => setNewTaskData({...newTaskData, notes: e.target.value})} />
          
          <button onClick={handleSaveTask} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#1B2B48]/20 hover:bg-opacity-90 transition-colors">حفظ البيانات الأساسية</button>

          {editingTask && (
            <>
              <CommentsList comments={editingTask.comments} />
              <CommentInput onAdd={handleAddCommentToTask} />
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={isRequestDetailOpen} onClose={() => setIsRequestDetailOpen(false)} title="تفاصيل الطلب">
        {selectedRequest && (
          <div className="space-y-6 font-cairo text-right">
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-right">
              <div className="grid grid-cols-2 gap-4 text-sm text-right">
                <div className="text-right"><span className="text-gray-400 block mb-1">المشروع</span><span className="font-bold">{selectedRequest.projectName}</span></div>
                <div className="text-right"><span className="text-gray-400 block mb-1">تاريخ الطلب</span><span className="font-bold">{selectedRequest.date}</span></div>
                {selectedRequest.type === 'conveyance' ? (
                  <div className="col-span-2 border-t pt-4 mt-2 border-gray-200 text-right">
                    <p className="font-bold mb-2 text-[#1B2B48] text-right">بيانات الإفراغ:</p>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-right">
                      <p className="flex justify-between mb-2"><span>اسم العميل:</span> <span className="font-bold">{selectedRequest.clientName}</span></p>
                      <p className="flex justify-between mb-2"><span>رقم الجوال:</span> <span className="font-bold">{selectedRequest.mobileNumber || '-'}</span></p>
                      <p className="flex justify-between mb-2"><span>رقم الهوية:</span> <span className="font-bold">{selectedRequest.idNumber}</span></p>
                      <p className="flex justify-between mb-2"><span>رقم القطعة:</span> <span className="font-bold">{selectedRequest.unitNumber || '-'}</span></p>
                      <p className="flex justify-between mb-2"><span>رقم الصك:</span> <span className="font-bold">{selectedRequest.deedNumber || '-'}</span></p>
                      <p className="flex justify-between mb-2"><span>البنك:</span> <span className="font-bold">{selectedRequest.bank || '-'}</span></p>
                      <p className="flex justify-between"><span>قيمة العقار:</span> <span className="font-bold">{selectedRequest.propertyValue || '-'}</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-2 border-t pt-4 mt-2 border-gray-200 text-right">
                    <p className="font-bold mb-2 text-[#1B2B48] text-right">بيانات الخدمة الفنية:</p>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-right">
                      <p className="flex justify-between mb-2"><span>نوع الخدمة:</span> <span className="font-bold">{selectedRequest.serviceSubType}</span></p>
                      <p className="flex justify-between mb-2"><span>الجهة المستهدفة:</span> <span className="font-bold">{selectedRequest.authority || '-'}</span></p>
                    </div>
                  </div>
                )}
                {selectedRequest.details && (
                  <div className="col-span-2 mt-2 text-right">
                    <span className="text-gray-400 block mb-1">الوصف والتفاصيل:</span>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 text-sm leading-relaxed text-gray-700 shadow-sm text-right tracking-normal">
                      {selectedRequest.details}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* Comment input box (should be used for notes before taking action) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 pr-1 text-right block">ملاحظة أو تعليق (اختياري عند اتخاذ إجراء)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="أدخل تعليقك هنا قبل اتخاذ الإجراء..." 
                    className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 ring-orange-500/10 outline-none text-right tracking-normal font-cairo"
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                  />
                  <button onClick={handleAddCommentToRequest} className="p-4 bg-gray-100 text-gray-400 rounded-2xl hover:bg-orange-500 hover:text-white transition-all"><MessageSquare size={20} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* FINANCE ACTIONS */}
                {currentUser?.role === 'FINANCE' && selectedRequest.status === 'pending_finance' && (
                  <>
                    <button onClick={() => updateRequestStatus(selectedRequest.id, 'new', newCommentText)} className="col-span-1 bg-green-500 text-white py-4 rounded-2xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 text-sm"><ThumbsUp size={18} /> موافقة</button>
                    <button onClick={() => updateRequestStatus(selectedRequest.id, 'rejected', newCommentText)} className="col-span-1 bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 text-sm"><ThumbsDown size={18} /> رفض</button>
                  </>
                )}

                {/* PR MANAGER / ADMIN ACTIONS */}
                {(['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '')) && (selectedRequest.status === 'new' || selectedRequest.status === 'pending_pr' || selectedRequest.status === 'revision') && (
                  <>
                    <button 
                      onClick={() => updateRequestStatus(selectedRequest.id, 'completed', newCommentText)} 
                      className="bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 text-sm"
                    >
                      <CheckCircle2 size={18} /> قبول واكتمال
                    </button>
                    <button 
                      onClick={() => updateRequestStatus(selectedRequest.id, 'rejected', newCommentText)} 
                      className="bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 text-sm"
                    >
                      <XCircle size={18} /> رفض الطلب
                    </button>
                    <button 
                      onClick={() => updateRequestStatus(selectedRequest.id, 'revision', newCommentText)} 
                      className="bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 text-sm"
                    >
                      <RotateCcw size={18} /> إعادة للتعديل
                    </button>
                  </>
                )}

                {/* PR OFFICER BASIC ACTION */}
                {currentUser?.role === 'PR_OFFICER' && selectedRequest.status !== 'completed' && (
                  <button onClick={() => updateRequestStatus(selectedRequest.id, 'completed', newCommentText)} className="col-span-2 bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 text-sm">اعتماد كمنجز</button>
                )}
              </div>

              <CommentsList comments={selectedRequest.comments} />
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
