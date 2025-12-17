import React, { useState, useEffect, Component, ReactNode } from 'react';
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, 
  Plus, ChevronRight, History as HistoryIcon, 
  FileCheck, User as UserIcon, UploadCloud,
  Menu, X, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  Image as ImageIcon, Pin, Search, Filter, FileSpreadsheet, 
  Download, Edit3, Trash2, Loader2
} from 'lucide-react';
import { 
  Task, ProjectSummary, User, ServiceRequest, RequestStatus, 
  ViewState, RequestHistory
} from './types';
import { 
  INITIAL_USERS, RAW_CSV_DATA, LOGO_URL,
  TECHNICAL_SERVICE_TYPES, GOVERNMENT_AUTHORITIES, LOCATIONS_ORDER
} from './constants';
import ProjectCard from './components/ProjectCard';
import TaskCard from './components/TaskCard';
import Modal from './components/Modal';

// Firebase Imports (Defensive initialization)
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, 
  query, orderBy
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "dar-wa-emaar.firebaseapp.com",
  projectId: "dar-wa-emaar",
  storageBucket: "dar-wa-emaar.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const IS_FIREBASE_ENABLED = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
let db: any = null;

if (IS_FIREBASE_ENABLED) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    console.warn("Firebase initialization failed:", error);
  }
}

const STORAGE_KEYS = {
    PROJECTS: 'dar_wa_emaar_projects_v1',
    TASKS: 'dar_wa_emaar_tasks_v1'
};

// Safe storage utility with defensive try-catch to prevent crashes in restricted environments
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('Storage access blocked or failed:', e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Could not save to storage:', e);
    }
  }
};

// Error Boundary to prevent the entire app from going blank on runtime errors
// Fix: Use React.Component explicitly and make children optional to resolve property access and usage errors
class ErrorBoundary extends Component<{ children?: ReactNode }, { hasError: boolean }> {
  // Explicitly declare state and props to resolve "does not exist on type" errors in certain environments
  state: { hasError: boolean };
  props: { children?: ReactNode };

  constructor(props: { children?: ReactNode }) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    // Correctly access state through this.state
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50" dir="rtl">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">حدث خطأ غير متوقع</h1>
            <p className="text-gray-600 mb-6">نعتذر عن الإزعاج. يرجى محاولة تحديث الصفحة أو الاتصال بالدعم الفني.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-[#E95D22] text-white py-3 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    // Correctly access props through this.props
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  // --- State ---
  const [users] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [taskFilter, setTaskFilter] = useState<string>('All');

  // Task Management State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({});

  // Request Form State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequestData, setNewRequestData] = useState<Partial<ServiceRequest>>({});
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Bulk Upload State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState<Partial<ServiceRequest>[]>([]);

  // Project Image Edit State
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editProjectImageUrl, setEditProjectImageUrl] = useState('');

  // View Specific State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- Effects ---
  
  // Initialize App Data
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        const savedTasks = safeStorage.getItem(STORAGE_KEYS.TASKS);
        const savedProjects = safeStorage.getItem(STORAGE_KEYS.PROJECTS);

        if (savedTasks && savedProjects) {
            try {
              setTasks(JSON.parse(savedTasks));
              setProjects(JSON.parse(savedProjects));
              setIsLoading(false);
              return;
            } catch (e) {
              console.error('Error parsing stored data:', e);
            }
        }
        
        // Fallback: Parse CSV
        const lines = RAW_CSV_DATA.trim().split('\n');
        const parsedTasks: Task[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const row: string[] = [];
          let current = '';
          let inQuote = false;
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) {
                row.push(current.trim());
                current = '';
            } else current += char;
          }
          row.push(current.trim());
          const cleanRow = row.map(c => c.replace(/^"|"$/g, '').trim());

          if (cleanRow.length >= 8) {
            parsedTasks.push({
              id: `task-${i}-${Date.now()}`,
              project: cleanRow[0],
              description: cleanRow[1],
              reviewer: cleanRow[2],
              requester: cleanRow[3],
              notes: cleanRow[4],
              location: cleanRow[5],
              status: cleanRow[6],
              date: cleanRow[7]
            });
          }
        }
        setTasks(parsedTasks);

        const grouped: Record<string, Task[]> = {};
        parsedTasks.forEach(t => {
          if (!grouped[t.project]) grouped[t.project] = [];
          grouped[t.project].push(t);
        });

        const projectSummaries: ProjectSummary[] = Object.keys(grouped).map(name => {
          const pTasks = grouped[name];
          const completed = pTasks.filter(t => t.status === 'منجز').length;
          return {
            name,
            location: pTasks[0].location,
            totalTasks: pTasks.length,
            completedTasks: completed,
            progress: pTasks.length ? (completed / pTasks.length) * 100 : 0,
            tasks: pTasks,
            isPinned: false
          };
        });
        setProjects(projectSummaries);
      } catch (error) {
        console.error("Initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Sync to Storage
  useEffect(() => {
    if (!isLoading && tasks.length > 0) {
        safeStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  }, [tasks, isLoading]);

  useEffect(() => {
    if (!isLoading && projects.length > 0) {
        safeStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }
  }, [projects, isLoading]);

  // Sync Project updates to tasks list
  const updateProjectData = (updatedProjects: ProjectSummary[]) => {
      setProjects(updatedProjects);
      const allTasks = updatedProjects.flatMap(p => p.tasks);
      setTasks(allTasks);
  };

  // Firebase Sync
  useEffect(() => {
    if (currentUser && IS_FIREBASE_ENABLED && db) {
        const q = query(collection(db, "requests"), orderBy("submittedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ServiceRequest[];
            if (reqs.length > 0) setServiceRequests(reqs);
        });
        return () => unsubscribe();
    }
  }, [currentUser]);

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      if (user.role === 'TECHNICAL' || user.role === 'CONVEYANCE') setView('SERVICE_ONLY');
      else if (user.role === 'FINANCE') setView('REQUESTS');
      else setView('DASHBOARD');
    } else {
      alert('خطأ في البريد أو كلمة المرور');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('LOGIN');
    setEmail('');
    setPassword('');
  };

  const handleSaveTask = () => {
    if (!selectedProject) return;

    let updatedTasks: Task[];
    if (editingTask) {
        updatedTasks = selectedProject.tasks.map(t => 
            t.id === editingTask.id ? { ...t, ...newTaskData } : t
        );
    } else {
        const newTask: Task = {
            id: `task-manual-${Date.now()}`,
            project: selectedProject.name,
            location: selectedProject.location,
            description: newTaskData.description || 'عمل جديد',
            reviewer: newTaskData.reviewer || '-',
            requester: newTaskData.requester || currentUser?.name || '-',
            notes: newTaskData.notes || '',
            status: newTaskData.status || 'متابعة',
            date: new Date().toISOString().split('T')[0],
            ...newTaskData
        };
        updatedTasks = [newTask, ...selectedProject.tasks];
    }

    const completed = updatedTasks.filter(t => t.status === 'منجز').length;
    const updatedProj: ProjectSummary = {
        ...selectedProject,
        tasks: updatedTasks,
        totalTasks: updatedTasks.length,
        completedTasks: completed,
        progress: updatedTasks.length ? (completed / updatedTasks.length) * 100 : 0
    };

    const updatedProjects = projects.map(p => p.name === selectedProject.name ? updatedProj : p);
    updateProjectData(updatedProjects);
    setSelectedProject(updatedProj);
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setNewTaskData({});
  };

  const handleDeleteTask = (taskId: string) => {
    if (!selectedProject || !window.confirm('هل أنت متأكد من حذف هذا العمل؟')) return;

    const updatedTasks = selectedProject.tasks.filter(t => t.id !== taskId);
    const completed = updatedTasks.filter(t => t.status === 'منجز').length;
    const updatedProj: ProjectSummary = {
        ...selectedProject,
        tasks: updatedTasks,
        totalTasks: updatedTasks.length,
        completedTasks: completed,
        progress: updatedTasks.length ? (completed / updatedTasks.length) * 100 : 0
    };

    const updatedProjects = projects.map(p => p.name === selectedProject.name ? updatedProj : p);
    updateProjectData(updatedProjects);
    setSelectedProject(updatedProj);
  };

  const handleCreateRequest = () => {
    if (!currentUser) return;
    const isConveyance = currentUser.role === 'CONVEYANCE';
    
    const createReq = (data: Partial<ServiceRequest>): ServiceRequest => ({
        id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
        name: isConveyance ? `إفراغ - ${data.clientName || 'بدون اسم'}` : data.serviceSubType || 'خدمة فنية',
        type: isConveyance ? 'conveyance' : 'technical',
        details: data.details || '',
        submittedBy: currentUser.name,
        role: currentUser.role,
        status: 'new',
        date: new Date().toISOString().split('T')[0],
        history: [{
            action: 'تم إنشاء الطلب',
            by: currentUser.name,
            role: currentUser.role,
            timestamp: new Date().toISOString()
        }],
        ...data
    } as ServiceRequest);

    if (isBulkMode && bulkPreviewData.length > 0) {
        const newRequests = bulkPreviewData.map(data => createReq(data));
        setServiceRequests(prev => [...newRequests, ...prev]);
        setIsBulkMode(false);
        setBulkPreviewData([]);
    } else {
        const req = createReq(newRequestData);
        setServiceRequests(prev => [req, ...prev]);
    }
    setIsRequestModalOpen(false);
    setNewRequestData({});
  };

  const handleUpdateStatus = (reqId: string, newStatus: RequestStatus, note?: string) => {
    if (newStatus === 'completed') {
        const req = serviceRequests.find(r => r.id === reqId);
        if (req && req.projectName) {
            const targetProj = projects.find(p => p.name === req.projectName);
            if (targetProj) {
                const newTask: Task = {
                    id: `req-${req.id}-${Date.now()}`,
                    project: targetProj.name,
                    description: req.name,
                    reviewer: req.authority || (req.type === 'conveyance' ? 'كتابة العدل' : '-'),
                    requester: req.submittedBy,
                    notes: req.details || '',
                    location: targetProj.location,
                    status: 'منجز',
                    date: new Date().toISOString().split('T')[0]
                };
                const newTasks = [newTask, ...targetProj.tasks];
                const completed = newTasks.filter(t => t.status === 'منجز').length;
                const updatedProj = {
                    ...targetProj,
                    tasks: newTasks,
                    totalTasks: newTasks.length,
                    completedTasks: completed,
                    progress: (completed / newTasks.length) * 100
                };
                updateProjectData(projects.map(p => p.name === req.projectName ? updatedProj : p));
                if (selectedProject?.name === req.projectName) setSelectedProject(updatedProj);
            }
        }
    }

    setServiceRequests(prev => prev.map(r => {
        if (r.id === reqId) {
            return {
                ...r,
                status: newStatus,
                history: [...r.history, {
                    action: `تغيير الحالة إلى ${newStatus}`,
                    by: currentUser?.name || 'Unknown',
                    role: currentUser?.role || 'Unknown',
                    timestamp: new Date().toISOString(),
                    notes: note
                }]
            };
        }
        return r;
    }));
    setSelectedRequest(null);
  };

  // --- Render Sections ---

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white" dir="rtl">
        <Loader2 className="w-12 h-12 text-[#E95D22] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">جاري تهيئة النظام...</p>
      </div>
    );
  }

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="bg-[#1B2B48] p-8 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#E95D22]/10 blur-3xl rounded-full transform -translate-y-1/2 scale-150"></div>
                  <img src={LOGO_URL} alt="Logo" className="h-24 mx-auto bg-white rounded-2xl p-2 mb-4 shadow-lg relative z-10" />
                  <h2 className="text-2xl font-bold text-white relative z-10">تسجيل الدخول</h2>
                  <p className="text-blue-200 text-sm mt-2 relative z-10">نظام متابعة المشاريع - دار وإعمار</p>
              </div>
              <form onSubmit={handleLogin} className="p-8 space-y-6">
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label><input type="email" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none transition-all" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@dar.sa" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور</label><input type="password" required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none transition-all" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></div>
                  <button type="submit" className="w-full bg-[#E95D22] text-white py-3.5 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg shadow-[#E95D22]/30 active:scale-[0.98]">تسجيل الدخول</button>
              </form>
          </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const filteredProjects = projects.filter(p => {
       const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.location.toLowerCase().includes(searchQuery.toLowerCase());
       const matchesLocation = locationFilter === 'All' || p.location === locationFilter;
       return matchesSearch && matchesLocation;
    });
    const pinnedProjects = filteredProjects.filter(p => p.isPinned);
    const otherProjects = filteredProjects.filter(p => !p.isPinned);

    return (
       <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
               <div>
                   <h2 className="text-2xl font-bold text-[#1B2B48]">لوحة التحكم</h2>
                   <p className="text-gray-500 text-sm mt-1">نظرة عامة على جميع المشاريع والمهام</p>
               </div>
               <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                   <div className="relative group">
                       <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#E95D22] transition-colors w-4 h-4" />
                       <input type="text" placeholder="بحث باسم المشروع أو الموقع..." className="w-full sm:w-64 pl-4 pr-10 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none text-sm transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                   </div>
                   <div className="relative">
                       <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                       <select className="w-full sm:w-48 pl-4 pr-10 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none text-sm appearance-none cursor-pointer transition-all" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                           <option value="All">جميع المواقع</option>
                           {LOCATIONS_ORDER.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                       </select>
                   </div>
               </div>
           </div>
           {pinnedProjects.length > 0 && (
               <div className="mb-8">
                   <h3 className="text-lg font-bold text-[#E95D22] mb-4 flex items-center gap-2"><Pin className="w-5 h-5 fill-current" />المشاريع المثبتة</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {pinnedProjects.map((project, idx) => <ProjectCard key={`pinned-${project.name}`} project={project} onClick={(p) => { setSelectedProject(p); setView('PROJECT_DETAIL'); setTaskFilter('All'); }} onTogglePin={(p) => { const up = projects.map(x => x.name === p.name ? {...x, isPinned: !x.isPinned} : x); updateProjectData(up); }} />)}
                   </div>
               </div>
           )}
           {otherProjects.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {otherProjects.map((project, idx) => <ProjectCard key={idx} project={project} onClick={(p) => { setSelectedProject(p); setView('PROJECT_DETAIL'); setTaskFilter('All'); }} onTogglePin={(p) => { const up = projects.map(x => x.name === p.name ? {...x, isPinned: !x.isPinned} : x); updateProjectData(up); }} />)}
               </div>
           ) : filteredProjects.length === 0 && projects.length > 0 && (
               <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 border-dashed">
                   <Search className="w-12 h-12 text-gray-300 mb-3" />
                   <p className="text-gray-500 font-medium">لا توجد مشاريع تطابق بحثك</p>
                   <button onClick={() => {setSearchQuery(''); setLocationFilter('All');}} className="mt-3 text-[#E95D22] text-sm hover:underline">مسح فلاتر البحث</button>
               </div>
           )}
       </div>
    );
  };

  const renderProjectDetail = () => {
    if (!selectedProject) return null;
    const filteredTasks = selectedProject.tasks.filter(t => taskFilter === 'All' || t.status === taskFilter);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-500 hover:text-[#E95D22] transition-colors mb-4"><ArrowLeft className="w-4 h-4" />عودة للمشاريع</button>
            <div className="relative h-48 md:h-64 w-full rounded-2xl overflow-hidden bg-gray-100 group mb-6 border border-gray-200">
                {selectedProject.imageUrl ? <img src={selectedProject.imageUrl} alt={selectedProject.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50"><ImageIcon className="w-16 h-16 mb-2 opacity-20" /><span className="text-sm opacity-40">لا توجد صورة للمشروع</span></div>}
                {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm"><button onClick={() => { setEditProjectImageUrl(selectedProject.imageUrl || ''); setIsEditProjectModalOpen(true); }} className="bg-white text-[#1B2B48] px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl hover:shadow-2xl hover:text-[#E95D22]"><UploadCloud className="w-5 h-5" />تغيير صورة المشروع</button></div>}
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-6">
                    <div>
                         <h2 className="text-3xl font-bold text-[#1B2B48]">{selectedProject.name}</h2>
                         <div className="flex items-center gap-2 text-gray-500 mt-2"><span className="text-sm bg-gray-100 px-3 py-1 rounded-full">{selectedProject.location}</span></div>
                    </div>
                    <div className="text-center bg-gray-50 p-4 rounded-xl"><span className="text-gray-500 text-sm block">نسبة الإنجاز</span><span className="text-2xl font-bold text-[#E95D22]">{Math.round(selectedProject.progress)}%</span></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="font-bold text-[#1B2B48] mb-2 flex items-center gap-2"><FileCheck className="w-4 h-4" /> ملخص المهام</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">الكلي</span><span className="font-bold">{selectedProject.totalTasks}</span></div>
                                <div className="flex justify-between"><span className="text-green-600">المنجز</span><span className="font-bold text-green-600">{selectedProject.completedTasks}</span></div>
                                <div className="flex justify-between"><span className="text-[#E95D22]">قيد العمل</span><span className="font-bold text-[#E95D22]">{selectedProject.totalTasks - selectedProject.completedTasks}</span></div>
                            </div>
                        </div>
                        {['ADMIN', 'PR_MANAGER', 'PR_OFFICER'].includes(currentUser?.role || '') && (
                            <button 
                                onClick={() => { setEditingTask(null); setNewTaskData({}); setIsTaskModalOpen(true); }}
                                className="w-full flex items-center justify-center gap-2 bg-[#E95D22] text-white py-3 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg shadow-[#E95D22]/20"
                            >
                                <Plus className="w-5 h-5" /> إضافة عمل جديد
                            </button>
                        )}
                    </div>
                    <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-[#1B2B48]">قائمة المهام</h3>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['All', 'متابعة', 'منجز'].map(s => <button key={s} onClick={() => setTaskFilter(s)} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${taskFilter === s ? 'bg-white text-[#E95D22] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{s === 'All' ? 'الكل' : s === 'متابعة' ? 'قيد العمل' : 'منجز'}</button>)}
                            </div>
                        </div>
                        <div className="space-y-4">
                            {filteredTasks.length > 0 ? filteredTasks.map(task => (
                                <div key={task.id} className="relative group">
                                    <TaskCard task={task} onEdit={() => { setEditingTask(task); setNewTaskData(task); setIsTaskModalOpen(true); }} />
                                    {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && (
                                        <button 
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="absolute top-4 left-14 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            title="حذف"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )) : <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">لا توجد مهام بهذه الحالة</div>}
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل العمل' : 'إضافة عمل جديد'}>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">بيان الأعمال</label><input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" value={newTaskData.description || ''} onChange={(e) => setNewTaskData({...newTaskData, description: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">جهة المراجعة</label><input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" value={newTaskData.reviewer || ''} onChange={(e) => setNewTaskData({...newTaskData, reviewer: e.target.value})} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" value={newTaskData.status || 'متابعة'} onChange={(e) => setNewTaskData({...newTaskData, status: e.target.value})}><option value="متابعة">قيد العمل</option><option value="منجز">منجز</option></select></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">الملاحظات</label><textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-24" value={newTaskData.notes || ''} onChange={(e) => setNewTaskData({...newTaskData, notes: e.target.value})} /></div>
                    <button onClick={handleSaveTask} className="w-full bg-[#E95D22] text-white py-3 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg shadow-[#E95D22]/20">حفظ التغييرات</button>
                </div>
            </Modal>
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden" dir="rtl">
        {/* Sidebar */}
        {currentUser && (
          <>
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
            <div className={`fixed inset-y-0 right-0 z-50 w-64 bg-[#1B2B48] text-white transform transition-transform duration-300 ease-in-out shadow-2xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 md:static md:flex flex-col h-screen`}>
              <div className="p-6 flex flex-col items-center border-b border-gray-700 relative">
                 <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 left-4 text-gray-400 hover:text-white"><X size={20} /></button>
                 <img src={LOGO_URL} alt="Logo" className="h-16 mb-4 bg-white rounded-lg p-1" />
                 <h2 className="font-bold text-lg">دار وإعمار</h2>
                 <p className="text-xs text-gray-400 mt-1">{currentUser.name}</p>
              </div>
              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                 {[
                   { id: 'DASHBOARD', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER'] },
                   { id: 'REQUESTS', label: 'الطلبات', icon: FileText, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE'] },
                   { id: 'SERVICE_ONLY', label: 'طلب خدمة', icon: Plus, roles: ['TECHNICAL', 'CONVEYANCE'] },
                   { id: 'USERS', label: 'المستخدمين', icon: Users, roles: ['ADMIN'] },
                 ].filter(item => item.roles.includes(currentUser.role)).map(item => (
                   <button key={item.id} onClick={() => { setView(item.id as ViewState); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${view === item.id ? 'bg-[#E95D22] text-white shadow-lg shadow-[#E95D22]/30 font-medium' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
                     <item.icon className="w-5 h-5" />
                     <span>{item.label}</span>
                   </button>
                 ))}
              </nav>
              <div className="p-4 border-t border-gray-700">
                 <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut className="w-5 h-5" /><span>تسجيل خروج</span></button>
              </div>
            </div>
          </>
        )}
        
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
            <header className="bg-white border-b border-gray-100 p-4 md:hidden flex justify-between items-center sticky top-0 z-20">
                 <div className="flex items-center gap-2"><img src={LOGO_URL} className="h-8" alt="Logo" /><h1 className="font-bold text-[#1B2B48]">دار وإعمار</h1></div>
                 <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600 bg-gray-50 rounded-lg"><Menu size={20} /></button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                {view === 'DASHBOARD' && renderDashboard()}
                {view === 'PROJECT_DETAIL' && renderProjectDetail()}
                {view === 'USERS' && <div className="flex flex-col items-center justify-center h-full text-gray-400"><Users className="w-16 h-16 mb-4 opacity-20" /><p>إدارة المستخدمين</p></div>}
                {/* Add other views as needed, currently limited to requested pages */}
            </main>
        </div>
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;