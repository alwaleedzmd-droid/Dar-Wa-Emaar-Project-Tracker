
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
  Building2, SortAsc, SortDesc, Edit2, CreditCard, Landmark, Hash, Phone, FileUp,
  ClipboardList, CheckCircle as CheckIcon, XCircle as CloseIcon, RefreshCw, FileDown,
  HardHat, Droplets, Zap, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import { 
  Task, ProjectSummary, User, ServiceRequest, RequestStatus, 
  ViewState, UserRole, Comment, ProjectDetails, ContractorInfo
} from './types';
import { 
  INITIAL_USERS, RAW_CSV_DATA, DAR_LOGO,
  LOCATIONS_ORDER, TECHNICAL_SERVICE_TYPES, GOVERNMENT_AUTHORITIES
} from './constants';
import ProjectCard from './components/ProjectCard';
import TaskCard from './components/TaskCard';
import Modal from './components/Modal';

const STORAGE_KEYS = {
    USERS: 'dar_persistent_v1_users',
    REQUESTS: 'dar_persistent_v1_requests',
    SIDEBAR_COLLAPSED: 'dar_persistent_v1_sidebar_collapsed',
    PROJECT_METADATA: 'dar_persistent_v1_project_metadata'
};

const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch {}
  }
};

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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [users, setUsers] = useState<User[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.REQUESTS);
    return saved ? JSON.parse(saved) : [];
  });
  const [projectMetadata, setProjectMetadata] = useState<Record<string, ProjectDetails>>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.PROJECT_METADATA);
    return saved ? JSON.parse(saved) : {};
  });

  const fetchProjects = async () => {
    setIsDbLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      const grouped: Record<string, Task[]> = {};
      data?.forEach((row: any) => {
        const task: Task = {
          id: row.id.toString(),
          project: row.client,
          description: row.title,
          reviewer: row.reviewer || '', 
          requester: row.requester || '',
          notes: row.notes || '',
          location: 'الرياض', 
          status: row.status || 'متابعة',
          date: row.date || new Date().toISOString().split('T')[0],
          comments: row.comments || []
        };
        if (!grouped[row.client]) grouped[row.client] = [];
        grouped[row.client].push(task);
      });

      const summaries: ProjectSummary[] = Object.keys(grouped).map(name => {
        const tasks = grouped[name];
        const done = tasks.filter(t => t.status === 'منجز').length;
        const metadata = projectMetadata[name] || {};
        return {
          name,
          location: metadata.location || 'الرياض',
          tasks,
          totalTasks: tasks.length,
          completedTasks: done,
          progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
          isPinned: false,
          details: metadata
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
  }, [projectMetadata]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => safeStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true');

  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }, [users]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(serviceRequests)); }, [serviceRequests]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { safeStorage.setItem(STORAGE_KEYS.PROJECT_METADATA, JSON.stringify(projectMetadata)); }, [projectMetadata]);

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<Task | null>(null);
  const [selectedRequestForComments, setSelectedRequestForComments] = useState<ServiceRequest | null>(null);
  const [selectedRequestForDetails, setSelectedRequestForDetails] = useState<ServiceRequest | null>(null);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isProjectEditModalOpen, setIsProjectEditModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isRequestCommentsModalOpen, setIsRequestCommentsModalOpen] = useState(false);
  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteTaskConfirmOpen, setIsDeleteTaskConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [newProject, setNewProject] = useState<Partial<ProjectSummary>>({ name: '', location: LOCATIONS_ORDER[0] });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({ status: 'متابعة' });
  const [newCommentText, setNewCommentText] = useState('');
  const [newRequest, setNewRequest] = useState<Partial<ServiceRequest>>({ projectName: '', type: 'technical' });

  const [tempProjectDetails, setTempProjectDetails] = useState<ProjectDetails>({});

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === loginData.email && u.password === loginData.password);
    if (user) {
      setCurrentUser(user);
      if (user.role === 'TECHNICAL' || user.role === 'CONVEYANCE') setView('SERVICE_ONLY');
      else if (user.role === 'FINANCE') setView('REQUESTS');
      else setView('DASHBOARD');
    } else alert('بيانات الدخول غير صحيحة');
  };

  const handleCreateProject = async () => {
    if (!newProject.name) return alert('يرجى إدخال اسم المشروع');
    const { error } = await supabase.from('projects').insert([{
      title: 'بداية المشروع',
      client: newProject.name,
      status: 'متابعة',
      date: new Date().toISOString().split('T')[0]
    }]);

    if (error) alert("خطأ في الحفظ: " + error.message);
    else {
      // Save location to metadata
      setProjectMetadata({
        ...projectMetadata,
        [newProject.name]: { ...projectMetadata[newProject.name], location: newProject.location }
      });
      await fetchProjects();
      setIsProjectModalOpen(false);
      setNewProject({ name: '', location: LOCATIONS_ORDER[0] });
    }
  };

  const handleUpdateProjectDetails = () => {
    if (!selectedProject) return;
    setProjectMetadata({
      ...projectMetadata,
      [selectedProject.name]: tempProjectDetails
    });
    setIsProjectEditModalOpen(false);
    alert('تم تحديث بيانات المشروع بنجاح');
  };

  const handleDeleteProject = async () => {
    if (projectToDelete) {
      const { error } = await supabase.from('projects').delete().eq('client', projectToDelete);
      if (error) alert(error.message);
      else {
        const newMetadata = { ...projectMetadata };
        delete newMetadata[projectToDelete];
        setProjectMetadata(newMetadata);
        
        await fetchProjects();
        if (selectedProject?.name === projectToDelete) setView('DASHBOARD');
        setIsDeleteConfirmOpen(false);
        setProjectToDelete(null);
      }
    }
  };

  const handleDeleteTask = async () => {
    if (taskToDelete) {
      const { error } = await supabase.from('projects').delete().eq('id', taskToDelete.id);
      if (error) alert(error.message);
      else {
        await fetchProjects();
        if (selectedProject) {
            const updated = (await supabase.from('projects').select('*').eq('client', selectedProject.name));
            if (updated.data) {
                const tasks: Task[] = updated.data.map((r: any) => ({
                    id: r.id.toString(),
                    project: r.client,
                    description: r.title,
                    reviewer: r.reviewer || '',
                    requester: r.requester || '',
                    notes: r.notes || '',
                    location: 'الرياض',
                    status: r.status,
                    date: r.date,
                    comments: r.comments || []
                }));
                const done = tasks.filter(t => t.status === 'منجز').length;
                setSelectedProject({ 
                    ...selectedProject, 
                    tasks, 
                    totalTasks: tasks.length, 
                    completedTasks: done, 
                    progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
                    details: projectMetadata[selectedProject.name] || {}
                });
            }
        }
        setIsDeleteTaskConfirmOpen(false);
        setTaskToDelete(null);
      }
    }
  };

  const handleSaveTask = async () => {
    if (!selectedProject) return;
    const taskTitle = newTaskData.description || 'عمل جديد';
    const taskStatus = newTaskData.status || 'متابعة';
    const taskReviewer = newTaskData.reviewer || '';
    const taskRequester = newTaskData.requester || '';
    const taskNotes = newTaskData.notes || '';
    const taskDate = new Date().toISOString().split('T')[0];

    const payload = { 
        title: taskTitle, 
        status: taskStatus, 
        reviewer: taskReviewer, 
        requester: taskRequester,
        notes: taskNotes,
        client: selectedProject.name,
        date: taskDate 
    };

    if (editingTask) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editingTask.id);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from('projects').insert([payload]);
      if (error) alert(error.message);
    }
    
    await fetchProjects();
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setNewTaskData({ status: 'متابعة' });
    
    const updated = (await supabase.from('projects').select('*').eq('client', selectedProject.name));
    if (updated.data) {
        const tasks: Task[] = updated.data.map((r: any) => ({
            id: r.id.toString(),
            project: r.client,
            description: r.title,
            reviewer: r.reviewer || '',
            requester: r.requester || '',
            notes: r.notes || '',
            location: 'الرياض',
            status: r.status,
            date: r.date,
            comments: r.comments || []
        }));
        const done = tasks.filter(t => t.status === 'منجز').length;
        setSelectedProject({ 
            ...selectedProject, 
            tasks, 
            totalTasks: tasks.length, 
            completedTasks: done, 
            progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
            details: projectMetadata[selectedProject.name] || {}
        });
    }
  };

  const handleAddComment = async () => {
    if (!selectedTaskForComments || !newCommentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      text: newCommentText,
      author: currentUser?.name || 'مستخدم',
      authorRole: currentUser?.role || 'PR_OFFICER',
      timestamp: new Date().toISOString()
    };
    const updatedComments = [...(selectedTaskForComments.comments || []), newComment];
    const { error } = await supabase.from('projects').update({ comments: updatedComments }).eq('id', selectedTaskForComments.id);
    if (error) alert("خطأ في إضافة التعليق: " + error.message);
    else {
      setSelectedTaskForComments({ ...selectedTaskForComments, comments: updatedComments });
      setNewCommentText('');
      await fetchProjects();
    }
  };

  const handleAddRequestComment = () => {
    if (!selectedRequestForComments || !newCommentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      text: newCommentText,
      author: currentUser?.name || 'مستخدم',
      authorRole: currentUser?.role || 'PR_OFFICER',
      timestamp: new Date().toISOString()
    };
    const updatedRequests = serviceRequests.map(req => req.id === selectedRequestForComments.id ? { ...req, comments: [...(req.comments || []), newComment] } : req);
    setServiceRequests(updatedRequests);
    setSelectedRequestForComments({ ...selectedRequestForComments, comments: [...(selectedRequestForComments.comments || []), newComment] });
    setNewCommentText('');
  };

  const handleUpdateRequestStatus = (requestId: string, newStatus: RequestStatus) => {
    const updated = serviceRequests.map(req => {
      if (req.id === requestId) {
        const historyEntry = {
          action: `تغيير الحالة إلى: ${newStatus}`,
          by: currentUser?.name || '',
          role: currentUser?.role || '',
          timestamp: new Date().toISOString()
        };
        return { ...req, status: newStatus, history: [...req.history, historyEntry] };
      }
      return req;
    });
    setServiceRequests(updated);
    setIsRequestDetailModalOpen(false);
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const req: ServiceRequest = {
        id: Date.now().toString(),
        name: currentUser?.name || '',
        projectName: newRequest.projectName || '',
        type: newRequest.type as any,
        details: newRequest.details || 'طلب إفراغ عميل',
        submittedBy: currentUser?.name || '',
        role: currentUser?.role || '',
        status: 'new',
        date: new Date().toISOString().split('T')[0],
        history: [{ action: 'تقديم طلب جديد', by: currentUser?.name || '', role: currentUser?.role || '', timestamp: new Date().toISOString() }],
        comments: [],
        ...newRequest
    };
    setServiceRequests([req, ...serviceRequests]);
    alert('تم تقديم الطلب بنجاح');
    setNewRequest({ projectName: '', type: newRequest.type });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const newReqs: ServiceRequest[] = data.map((row: any, idx) => ({
            id: (Date.now() + idx).toString(),
            name: row['اسم العميل'] || 'غير محدد',
            type: 'conveyance',
            projectName: row['المشروع'] || 'غير محدد',
            details: `طلب إفراغ من ملف إكسل`,
            submittedBy: currentUser?.name || '',
            role: currentUser?.role || '',
            status: 'new',
            date: new Date().toISOString().split('T')[0],
            clientName: row['اسم العميل'],
            idNumber: row['رقم الهوية'],
            unitNumber: row['رقم القطعة'],
            deedNumber: row['رقم الصك'],
            mobileNumber: row['رقم الجوال'],
            bank: row['البنك'],
            propertyValue: row['قيمة العقار'],
            history: [],
            comments: []
        }));

        setServiceRequests([...newReqs, ...serviceRequests]);
        alert(`تم استيراد ${newReqs.length} طلب بنجاح`);
    };
    reader.readAsBinaryString(file);
  };

  const handleExportAllProjects = () => {
    if (projects.length === 0) return alert('لا يوجد مشاريع للتصدير');

    const exportData: any[] = [];
    let counter = 1;

    projects.forEach(project => {
      project.tasks.forEach(task => {
        exportData.push({
          'م': counter++,
          'المشروع': project.name,
          'بيان الأعمال': task.description,
          'جهة المراجعة': task.reviewer,
          'الجهة طالبة الخدمة': task.requester,
          'الوصف': task.notes,
          'الموقع': project.location,
          'الملاحظات': task.status,
          'تاريخ المتابعة': task.date
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    if (!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({ RTL: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير المشاريع");
    XLSX.writeFile(workbook, `تقرير_المشاريع_دار_وإعمار_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredDashboard = useMemo(() => {
    if (currentUser?.role === 'FINANCE') return [];
    
    return projects.filter(p => 
      (locationFilter === 'All' || p.location === locationFilter) && 
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [projects, locationFilter, searchQuery, currentUser]);

  const filteredRequests = useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'FINANCE') {
      return serviceRequests.filter(req => req.type === 'conveyance');
    }

    if (['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser.role)) {
      return serviceRequests;
    }

    return serviceRequests.filter(req => req.submittedBy === currentUser.name);
  }, [serviceRequests, currentUser]);

  const Logo: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`${className} flex flex-col items-center justify-center`}><img src={DAR_LOGO} className="w-full h-full object-contain" alt="Logo" /></div>
  );

  const getStatusLabel = (status: RequestStatus) => {
    switch (status) {
        case 'new': return { text: 'جديد', color: 'bg-blue-100 text-blue-700' };
        case 'completed': return { text: 'مقبول', color: 'bg-green-100 text-green-700' };
        case 'rejected': return { text: 'مرفوض', color: 'bg-red-100 text-red-700' };
        case 'revision': return { text: 'يحتاج تعديل', color: 'bg-orange-100 text-orange-700' };
        default: return { text: 'تحت الإجراء', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const canUserManageTasks = useMemo(() => {
    return currentUser?.role === 'ADMIN' || currentUser?.role === 'PR_MANAGER' || currentUser?.role === 'PR_OFFICER';
  }, [currentUser]);

  const InfoCard = ({ icon: Icon, title, value, unit }: { icon: any, title: string, value: any, unit?: string }) => (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
      <div className="bg-[#E95D22]/10 p-4 rounded-2xl text-[#E95D22]"><Icon size={24} /></div>
      <div className="text-right">
        <p className="text-gray-400 text-sm font-bold">{title}</p>
        <p className="text-xl font-bold text-[#1B2B48]">{value || '0'}<span className="text-sm mr-1">{unit}</span></p>
      </div>
    </div>
  );

  const ContactCard = ({ icon: Icon, type, company, engineer, phone }: { icon: any, type: string, company?: string, engineer?: string, phone?: string }) => (
    <div className="bg-gray-50 p-6 rounded-[30px] border border-gray-100 space-y-4">
      <div className="flex items-center gap-3 text-[#1B2B48] font-bold border-b pb-3 border-gray-200">
        <Icon className="text-[#E95D22]" size={20} />
        <span>{type}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span className="text-gray-400">الشركة:</span><span className="font-bold">{company || '-'}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-400">المهندس:</span><span className="font-bold">{engineer || '-'}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-400">الجوال:</span><span className="font-bold text-[#E95D22]" dir="ltr">{phone || '-'}</span></div>
      </div>
    </div>
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

  const sidebarItems = [ 
    { id: 'DASHBOARD', label: 'الرئيسية', icon: LayoutDashboard, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER'] }, 
    { id: 'REQUESTS', label: 'الطلبات', icon: FileText, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE', 'TECHNICAL', 'CONVEYANCE'] }, 
    { id: 'SERVICE_ONLY', label: 'طلب جديد', icon: Plus, roles: ['TECHNICAL', 'CONVEYANCE', 'ADMIN', 'PR_MANAGER', 'PR_OFFICER'] }
  ].filter(i => i.roles.includes(currentUser?.role || ''));

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-cairo overflow-hidden" dir="rtl">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 bg-[#1B2B48] text-white flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'} ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/5 flex flex-col items-center">
          <Logo className={isSidebarCollapsed ? 'h-12 w-12' : 'h-24 w-24'} />
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {sidebarItems.map(item => (
                <button key={item.id} onClick={() => { setView(item.id as ViewState); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === item.id ? 'bg-[#E95D22] shadow-xl' : 'hover:bg-white/5 text-gray-400'} ${isSidebarCollapsed ? 'justify-center' : ''}`}><item.icon size={20} />{!isSidebarCollapsed && <span>{item.label === 'الطلبات' && (currentUser?.role === 'TECHNICAL' || currentUser?.role === 'CONVEYANCE') ? 'طلباتي' : item.label}</span>}</button>
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
              <p className="font-bold">جاري تحميل البيانات...</p>
            </div>
          ) : (
            <>
              {view === 'DASHBOARD' && currentUser?.role !== 'FINANCE' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-[#1B2B48]">الرئيسية</h2>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:flex-initial"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="بحث..." className="pr-10 pl-4 py-2 rounded-xl border w-full md:w-64 text-right font-cairo outline-none focus:ring-2 ring-orange-500/20" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                      <button 
                        onClick={handleExportAllProjects}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all"
                      >
                        <FileDown size={20} /> تصدير Excel
                      </button>
                      <button onClick={() => setIsProjectModalOpen(true)} className="bg-[#E95D22] text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:bg-opacity-90 transition-all"><Plus size={20} /> جديد</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredDashboard.map(p => <ProjectCard key={p.name} project={p} onClick={p => { setSelectedProject(p); setView('PROJECT_DETAIL'); }} onTogglePin={() => {}} />)}</div>
                </div>
              )}

              {view === 'PROJECT_DETAIL' && selectedProject && currentUser?.role !== 'FINANCE' && (
                <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                    <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-400 hover:text-[#E95D22] mb-4 transition-colors"><ArrowLeft size={16} /> العودة</button>
                    
                    <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border text-right space-y-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b pb-10">
                            <div>
                                <h2 className="text-4xl font-bold text-[#1B2B48]">{selectedProject.name}</h2>
                                <p className="text-gray-400 flex items-center gap-2 mt-2"><MapPin size={18} /> {selectedProject.location}</p>
                            </div>
                            <div className="flex gap-4">
                                <button 
                                  onClick={() => { setTempProjectDetails(selectedProject.details || {}); setIsProjectEditModalOpen(true); }}
                                  className="bg-gray-50 text-[#1B2B48] p-4 rounded-3xl hover:bg-gray-100 transition-colors border"
                                  title="تعديل بيانات المشروع"
                                >
                                  <Edit2 size={24} />
                                </button>
                                <button onClick={() => { setProjectToDelete(selectedProject.name); setIsDeleteConfirmOpen(true); }} className="bg-red-50 text-red-500 p-4 rounded-3xl hover:bg-red-100 transition-colors border border-red-100"><Trash2 size={24} /></button>
                                <div className="bg-[#1B2B48] text-white p-6 rounded-3xl text-center font-bold text-3xl shadow-xl min-w-[100px]">{Math.round(selectedProject.progress)}%</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <InfoCard icon={Building2} title="عدد الوحدات" value={selectedProject.details?.unitsCount} unit="وحدة" />
                          <InfoCard icon={Zap} title="عدادات الكهرباء" value={selectedProject.details?.electricityMetersCount} unit="عداد" />
                          <InfoCard icon={Droplets} title="عدادات المياة" value={selectedProject.details?.waterMetersCount} unit="عداد" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <ContactCard 
                            icon={Zap} 
                            type="مقاول الكهرباء" 
                            company={selectedProject.details?.electricityContractor?.company}
                            engineer={selectedProject.details?.electricityContractor?.engineer}
                            phone={selectedProject.details?.electricityContractor?.phone}
                          />
                          <ContactCard 
                            icon={Droplets} 
                            type="مقاول المياة" 
                            company={selectedProject.details?.waterContractor?.company}
                            engineer={selectedProject.details?.waterContractor?.engineer}
                            phone={selectedProject.details?.waterContractor?.phone}
                          />
                          <ContactCard 
                            icon={ShieldCheck} 
                            type="المكتب الاستشاري" 
                            company={selectedProject.details?.consultantOffice?.company}
                            engineer={selectedProject.details?.consultantOffice?.engineer}
                            phone={selectedProject.details?.consultantOffice?.phone}
                          />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-10 border-t">
                            <div className="lg:col-span-1 space-y-6">
                              <h3 className="text-xl font-bold text-[#1B2B48] flex items-center gap-2"><ListChecks className="text-[#E95D22]" /> قائمة الأعمال</h3>
                              <button onClick={() => { setEditingTask(null); setNewTaskData({ status: 'متابعة' }); setIsTaskModalOpen(true); }} className="w-full bg-[#E95D22] text-white py-5 rounded-[30px] font-bold text-lg shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                <Plus size={24} /> إضافة عمل جديد
                              </button>
                            </div>
                            <div className="lg:col-span-2 space-y-4">
                                {selectedProject.tasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        onEdit={t => { setEditingTask(t); setNewTaskData(t); setIsTaskModalOpen(true); }} 
                                        onOpenComments={t => { setSelectedTaskForComments(t); setIsCommentsModalOpen(true); }} 
                                        onDelete={t => { setTaskToDelete(t); setIsDeleteTaskConfirmOpen(true); }}
                                        canManage={canUserManageTasks}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              )}

              {view === 'SERVICE_ONLY' && (
                <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="text-center space-y-2"><h2 className="text-3xl font-bold text-[#1B2B48]">إنشاء طلب جديد</h2><p className="text-gray-400">يرجى اختيار نوع الطلب وتعبئة البيانات</p></div>
                    <form onSubmit={handleCreateRequest} className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border space-y-6 text-right">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="block text-sm font-bold text-gray-700 mb-2">نوع الطلب</label><select className="w-full p-4 bg-gray-50 rounded-2xl border outline-none focus:ring-2 ring-[#E95D22]/20 font-cairo" value={newRequest.type} onChange={e => setNewRequest({...newRequest, type: e.target.value as any})}>
                                    <option value="technical">طلب فني / حكومي</option>
                                    <option value="conveyance">طلب إفراغ / نقل ملكية</option>
                                </select></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-2">المشروع</label><select className="w-full p-4 bg-gray-50 rounded-2xl border outline-none focus:ring-2 ring-[#E95D22]/20 font-cairo" value={newRequest.projectName} onChange={e => setNewRequest({...newRequest, projectName: e.target.value})} required>
                                    <option value="">اختر المشروع...</option>
                                    {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                </select></div>
                        </div>

                        {newRequest.type === 'conveyance' ? (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3 text-blue-800"><FileUp size={24} /><span className="font-bold">رفع بيانات العملاء عبر إكسل</span></div>
                                    <label className="bg-white text-blue-600 px-6 py-2.5 rounded-2xl font-bold cursor-pointer border-2 border-dashed border-blue-200 hover:bg-blue-100 transition-colors">اختر ملف Excel<input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleExcelUpload} /></label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">اسم العميل</label><input type="text" placeholder="الاسم الكامل" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.clientName} onChange={e => setNewRequest({...newRequest, clientName: e.target.value})} /></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">رقم الهوية</label><input type="text" placeholder="رقم الهوية الوطنية" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.idNumber} onChange={e => setNewRequest({...newRequest, idNumber: e.target.value})} /></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">رقم القطعة</label><input type="text" placeholder="رقم قطعة الأرض" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.unitNumber} onChange={e => setNewRequest({...newRequest, unitNumber: e.target.value})} /></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">رقم الصك</label><input type="text" placeholder="رقم صك الملكية" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.deedNumber} onChange={e => setNewRequest({...newRequest, deedNumber: e.target.value})} /></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">رقم الجوال</label><input type="text" placeholder="05xxxxxxxx" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.mobileNumber} onChange={e => setNewRequest({...newRequest, mobileNumber: e.target.value})} /></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">البنك</label><input type="text" placeholder="اسم البنك الممول" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.bank} onChange={e => setNewRequest({...newRequest, bank: e.target.value})} /></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-2">قيمة العقار</label><input type="text" placeholder="القيمة الإجمالية" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.propertyValue} onChange={e => setNewRequest({...newRequest, propertyValue: e.target.value})} /></div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">جهة المراجعة</label><select className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.authority} onChange={e => setNewRequest({...newRequest, authority: e.target.value})}>
                                            <option value="">اختر جهة المراجعة...</option>
                                            {GOVERNMENT_AUTHORITIES.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select></div>
                                    <div><label className="block text-sm font-bold text-gray-700 mb-2">نوع الخدمة</label><select className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newRequest.serviceSubType} onChange={e => setNewRequest({...newRequest, serviceSubType: e.target.value})}>
                                            <option value="">اختر نوع الخدمة...</option>
                                            {TECHNICAL_SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select></div>
                                </div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-2">تفاصيل إضافية</label><textarea placeholder="اشرح تفاصيل طلبك هنا..." className="w-full p-4 bg-gray-50 rounded-2xl border outline-none font-cairo h-32" value={newRequest.details} onChange={e => setNewRequest({...newRequest, details: e.target.value})} required /></div>
                            </div>
                        )}
                        <button type="submit" className="w-full bg-[#1B2B48] text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-opacity-95 transition-all">تقديم الطلب الآن</button>
                    </form>
                </div>
              )}

              {view === 'REQUESTS' && (
                <div className="space-y-12 text-right">
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-[#1B2B48] flex items-center gap-3">
                        <ClipboardList className="text-[#E95D22]" /> 
                        {currentUser?.role === 'TECHNICAL' || currentUser?.role === 'CONVEYANCE' ? 'سجل طلباتي' : currentUser?.role === 'FINANCE' ? 'طلبات الإفراغ للموافقة' : 'قائمة الطلبات العامة'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {filteredRequests.length === 0 ? (
                      <div className="bg-white p-12 rounded-[40px] text-center text-gray-400 border-2 border-dashed">
                        <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="font-bold">لا يوجد طلبات في السجل حالياً</p>
                      </div>
                    ) : (
                      filteredRequests.map(req => {
                        const status = getStatusLabel(req.status);
                        return (
                          <div 
                            key={req.id} 
                            onClick={() => { setSelectedRequestForDetails(req); setIsRequestDetailModalOpen(true); }}
                            className="bg-white p-8 rounded-[35px] border-2 border-transparent hover:border-[#E95D22]/20 hover:shadow-xl transition-all cursor-pointer flex flex-col md:flex-row justify-between items-center gap-6"
                          >
                            <div className="flex items-center gap-6">
                              <div className={`p-5 rounded-3xl ${req.type === 'technical' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                {req.type === 'technical' ? <Settings size={30} /> : <FileCheck size={30} />}
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-bold text-xl text-[#1B2B48]">{req.projectName} - {req.type === 'conveyance' ? req.clientName : (req.serviceSubType || 'طلب فني')}</h4>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                    <span className="flex items-center gap-1"><UserIcon size={14} /> {req.submittedBy}</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {req.date}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                               <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectedRequestForComments(req); setIsRequestCommentsModalOpen(true); }}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${(req.comments?.length || 0) > 0 ? 'bg-[#E95D22] text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:text-[#E95D22]'}`}
                                >
                                  <MessageSquare size={18} />
                                  <span className="text-sm font-bold">{req.comments?.length || 0}</span>
                               </button>
                               <div className={`px-6 py-2 rounded-2xl text-sm font-bold shadow-sm ${status.color}`}>
                                  {status.text}
                               </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --- Modals --- */}

      <Modal isOpen={isProjectEditModalOpen} onClose={() => setIsProjectEditModalOpen(false)} title="تحديث بيانات المشروع">
        <div className="space-y-8 text-right font-cairo">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 bg-gray-50 p-6 rounded-3xl border">
             <label className="text-xs font-bold text-gray-400 pr-1">موقع المشروع</label>
             <select 
                className="w-full p-4 bg-white rounded-2xl border outline-none font-cairo" 
                value={tempProjectDetails.location || ''} 
                onChange={e => setTempProjectDetails({...tempProjectDetails, location: e.target.value})}
             >
                <option value="">اختر الموقع...</option>
                {LOCATIONS_ORDER.map(loc => <option key={loc} value={loc}>{loc}</option>)}
             </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div><label className="text-xs font-bold text-gray-400 pr-1">عدد الوحدات</label><input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none" value={tempProjectDetails.unitsCount || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, unitsCount: Number(e.target.value)})} /></div>
             <div><label className="text-xs font-bold text-gray-400 pr-1">عدد عدادات الكهرباء</label><input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none" value={tempProjectDetails.electricityMetersCount || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, electricityMetersCount: Number(e.target.value)})} /></div>
             <div><label className="text-xs font-bold text-gray-400 pr-1">عدد عدادات المياة</label><input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none" value={tempProjectDetails.waterMetersCount || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, waterMetersCount: Number(e.target.value)})} /></div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3 bg-gray-50 p-6 rounded-3xl border">
              <h4 className="font-bold text-[#1B2B48] flex items-center gap-2"><Zap size={18} className="text-[#E95D22]" /> مقاول الكهرباء</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="اسم الشركة" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.electricityContractor?.company || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, electricityContractor: { ...tempProjectDetails.electricityContractor, company: e.target.value } as ContractorInfo})} />
                <input placeholder="اسم المهندس" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.electricityContractor?.engineer || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, electricityContractor: { ...tempProjectDetails.electricityContractor, engineer: e.target.value } as ContractorInfo})} />
                <input placeholder="رقم الجوال" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.electricityContractor?.phone || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, electricityContractor: { ...tempProjectDetails.electricityContractor, phone: e.target.value } as ContractorInfo})} />
              </div>
            </div>

            <div className="space-y-3 bg-gray-50 p-6 rounded-3xl border">
              <h4 className="font-bold text-[#1B2B48] flex items-center gap-2"><Droplets size={18} className="text-[#E95D22]" /> مقاول المياة</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="اسم الشركة" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.waterContractor?.company || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, waterContractor: { ...tempProjectDetails.waterContractor, company: e.target.value } as ContractorInfo})} />
                <input placeholder="اسم المهندس" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.waterContractor?.engineer || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, waterContractor: { ...tempProjectDetails.waterContractor, engineer: e.target.value } as ContractorInfo})} />
                <input placeholder="رقم الجوال" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.waterContractor?.phone || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, waterContractor: { ...tempProjectDetails.waterContractor, phone: e.target.value } as ContractorInfo})} />
              </div>
            </div>

            <div className="space-y-3 bg-gray-50 p-6 rounded-3xl border">
              <h4 className="font-bold text-[#1B2B48] flex items-center gap-2"><ShieldCheck size={18} className="text-[#E95D22]" /> المكتب الاستشاري</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="اسم الشركة" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.consultantOffice?.company || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, consultantOffice: { ...tempProjectDetails.consultantOffice, company: e.target.value } as ContractorInfo})} />
                <input placeholder="اسم المهندس" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.consultantOffice?.engineer || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, consultantOffice: { ...tempProjectDetails.consultantOffice, engineer: e.target.value } as ContractorInfo})} />
                <input placeholder="رقم الجوال" className="p-3 rounded-xl border outline-none text-sm" value={tempProjectDetails.consultantOffice?.phone || ''} onChange={e => setTempProjectDetails({...tempProjectDetails, consultantOffice: { ...tempProjectDetails.consultantOffice, phone: e.target.value } as ContractorInfo})} />
              </div>
            </div>
          </div>

          <button onClick={handleUpdateProjectDetails} className="w-full bg-[#1B2B48] text-white py-5 rounded-3xl font-bold text-xl shadow-xl hover:bg-opacity-95 transition-all">حفظ البيانات</button>
        </div>
      </Modal>

      <Modal isOpen={isRequestDetailModalOpen} onClose={() => setIsRequestDetailModalOpen(false)} title="تفاصيل الطلب">
        {selectedRequestForDetails && (
          <div className="space-y-6 text-right font-cairo">
            <div className="bg-gray-50 p-6 rounded-3xl border space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">نوع الطلب:</span>
                    <span className="font-bold text-[#1B2B48]">{selectedRequestForDetails.type === 'technical' ? 'طلب فني' : 'إفراغ عقاري'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">المشروع:</span>
                    <span className="font-bold text-[#1B2B48]">{selectedRequestForDetails.projectName}</span>
                </div>
                {selectedRequestForDetails.type === 'conveyance' ? (
                  <>
                    <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">العميل:</span><span className="font-bold">{selectedRequestForDetails.clientName}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">البنك:</span><span className="font-bold">{selectedRequestForDetails.bank}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">الخدمة:</span><span className="font-bold">{selectedRequestForDetails.serviceSubType}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">الجهة:</span><span className="font-bold">{selectedRequestForDetails.authority}</span></div>
                  </>
                )}
                <div className="pt-4 border-t"><p className="text-sm text-gray-600 leading-relaxed">{selectedRequestForDetails.details}</p></div>
            </div>

            {((['PR_MANAGER', 'PR_OFFICER', 'ADMIN'].includes(currentUser?.role || '')) || 
               (currentUser?.role === 'FINANCE' && selectedRequestForDetails.type === 'conveyance')) && 
               selectedRequestForDetails.status === 'new' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button 
                  onClick={() => handleUpdateRequestStatus(selectedRequestForDetails.id, 'completed')}
                  className="bg-green-600 text-white p-4 rounded-2xl font-bold flex flex-col items-center gap-2 hover:bg-green-700 transition-colors shadow-lg"
                >
                  <CheckIcon /> موافقة
                </button>
                <button 
                  onClick={() => handleUpdateRequestStatus(selectedRequestForDetails.id, 'rejected')}
                  className="bg-red-600 text-white p-4 rounded-2xl font-bold flex flex-col items-center gap-2 hover:bg-red-700 transition-colors shadow-lg"
                >
                  <CloseIcon /> رفض
                </button>
                <button 
                  onClick={() => handleUpdateRequestStatus(selectedRequestForDetails.id, 'revision')}
                  className="bg-orange-500 text-white p-4 rounded-2xl font-bold flex flex-col items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg"
                >
                  <RefreshCw /> إعادة للتعديل
                </button>
              </div>
            )}
            
            <div className="space-y-3">
                <h5 className="font-bold text-gray-400 text-sm flex items-center gap-2"><HistoryIcon size={14} /> سجل التحركات</h5>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedRequestForDetails.history.map((h, i) => (
                        <div key={i} className="text-[12px] bg-white border p-3 rounded-xl">
                            <div className="flex justify-between font-bold mb-1"><span>{h.action}</span><span dir="ltr">{new Date(h.timestamp).toLocaleDateString('ar-SA')}</span></div>
                            <div className="text-gray-400">بواسطة: {h.by} ({h.role})</div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="تأكيد الحذف"><div className="text-right space-y-6"><div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center gap-4"><AlertCircle className="text-red-500" size={32} /><p className="text-red-700 font-bold">حذف مشروع "{projectToDelete}"؟</p></div><div className="flex gap-4"><button onClick={handleDeleteProject} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold">نعم، احذف</button><button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold">إلغاء</button></div></div></Modal>
      
      <Modal isOpen={isDeleteTaskConfirmOpen} onClose={() => setIsDeleteTaskConfirmOpen(false)} title="تأكيد حذف العمل">
        <div className="text-right space-y-6">
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center gap-4">
                <AlertCircle className="text-red-500" size={32} />
                <p className="text-red-700 font-bold">هل أنت متأكد من حذف هذا العمل؟ لا يمكن التراجع عن هذه الخطوة.</p>
            </div>
            <div className="flex gap-4">
                <button onClick={handleDeleteTask} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold">تأكيد الحذف</button>
                <button onClick={() => setIsDeleteTaskConfirmOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold">إلغاء</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="مشروع جديد">
        <div className="space-y-4 text-right">
          <div>
            <label className="text-xs font-bold text-gray-400 pr-1">اسم المشروع</label>
            <input 
                type="text" 
                placeholder="مثلاً: سرايا البدر" 
                className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo outline-none focus:ring-2 ring-[#E95D22]/20" 
                value={newProject.name} 
                onChange={e => setNewProject({...newProject, name: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 pr-1">موقع المشروع</label>
            <select 
                className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo outline-none focus:ring-2 ring-[#E95D22]/20" 
                value={newProject.location} 
                onChange={e => setNewProject({...newProject, location: e.target.value})}
            >
                {LOCATIONS_ORDER.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <button onClick={handleCreateProject} className="w-full bg-[#E95D22] text-white py-4 rounded-2xl font-bold mt-4 shadow-lg hover:bg-opacity-90 transition-all">حفظ المشروع</button>
        </div>
      </Modal>
      
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل العمل' : 'إضافة عمل'}>
        <div className="space-y-4 text-right font-cairo">
          <div>
            <label className="text-xs font-bold text-gray-400 pr-1">بيان الأعمال</label>
            <textarea 
              className="w-full p-4 bg-gray-50 rounded-2xl border outline-none text-right font-cairo h-20" 
              value={newTaskData.description || ''} 
              onChange={e => setNewTaskData({...newTaskData, description: e.target.value})} 
              placeholder="وصف العمل الأساسي..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 pr-1">جهة المراجعة</label>
              <select 
                className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo outline-none" 
                value={newTaskData.reviewer || ''} 
                onChange={e => setNewTaskData({...newTaskData, reviewer: e.target.value})}
              >
                <option value="">اختر جهة...</option>
                {GOVERNMENT_AUTHORITIES.map(auth => <option key={auth} value={auth}>{auth}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 pr-1">الجهة طالبة الخدمة</label>
              <input 
                type="text" 
                className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo outline-none" 
                value={newTaskData.requester || ''} 
                onChange={e => setNewTaskData({...newTaskData, requester: e.target.value})} 
                placeholder="الرئيس التنفيذي، إلخ..."
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 pr-1">الوصف</label>
            <textarea 
              className="w-full p-4 bg-gray-50 rounded-2xl border outline-none text-right font-cairo h-24" 
              value={newTaskData.notes || ''} 
              onChange={e => setNewTaskData({...newTaskData, notes: e.target.value})} 
              placeholder="ملاحظات تفصيلية حول الإجراء..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 pr-1">الحالة</label>
            <select 
              className="w-full p-4 bg-gray-50 rounded-2xl border text-right font-cairo outline-none" 
              value={newTaskData.status || 'متابعة'} 
              onChange={e => setNewTaskData({...newTaskData, status: e.target.value})}
            >
              <option value="متابعة">متابعة</option>
              <option value="منجز">منجز</option>
            </select>
          </div>

          <button onClick={handleSaveTask} className="w-full bg-[#1B2B48] text-white py-4 rounded-2xl font-bold shadow-lg mt-4 hover:bg-opacity-90 transition-all">
            حفظ العمل
          </button>
        </div>
      </Modal>

      <Modal isOpen={isCommentsModalOpen} onClose={() => setIsCommentsModalOpen(false)} title={`تعليقات المهمة`}><div className="space-y-6 text-right font-cairo flex flex-col h-[60vh]"><div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar">{selectedTaskForComments?.comments?.map(comment => (<div key={comment.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100"><div className="flex justify-between items-start mb-2"><span className="font-bold text-[#1B2B48] text-sm">{comment.author}</span><span className="text-[10px] text-gray-400">{new Date(comment.timestamp).toLocaleString('ar-SA')}</span></div><p className="text-sm text-gray-600">{comment.text}</p></div>))}</div><div className="border-t pt-4 flex gap-2"><input type="text" placeholder="اكتب تعليقك هنا..." className="flex-1 p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newCommentText} onChange={e => setNewCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} /><button onClick={handleAddComment} className="p-4 bg-[#E95D22] text-white rounded-2xl shadow-lg"><Send size={20} /></button></div></div></Modal>
      <Modal isOpen={isRequestCommentsModalOpen} onClose={() => setIsRequestCommentsModalOpen(false)} title={`التعليقات على الطلب`}><div className="space-y-6 text-right font-cairo flex flex-col h-[60vh]"><div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar">{selectedRequestForComments?.comments?.length === 0 ? (<p className="text-center text-gray-400 py-10">لا يوجد تعليقات بعد</p>) : (selectedRequestForComments?.comments?.map(comment => (<div key={comment.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100"><div className="flex justify-between items-start mb-2"><span className="font-bold text-[#1B2B48] text-sm">{comment.author}</span><span className="text-[10px] text-gray-400">{new Date(comment.timestamp).toLocaleString('ar-SA')}</span></div><p className="text-sm text-gray-600">{comment.text}</p></div>)))}</div><div className="border-t pt-4 flex gap-2"><input type="text" placeholder="اكتب تعليقك هنا..." className="flex-1 p-4 bg-gray-50 rounded-2xl border outline-none font-cairo" value={newCommentText} onChange={e => setNewCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddRequestComment()} /><button onClick={handleAddRequestComment} className="p-4 bg-[#E95D22] text-white rounded-2xl shadow-lg"><Send size={20} /></button></div></div></Modal>
    </div>
  );
};

const App: React.FC = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
