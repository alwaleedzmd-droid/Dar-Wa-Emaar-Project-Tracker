import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, 
  Plus, ChevronRight, History as HistoryIcon, 
  FileCheck, User as UserIcon, UploadCloud,
  Menu, X, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  Image as ImageIcon,
  Pin, Search, Filter, FileSpreadsheet, Download
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

// Firebase Imports (Keep existing config structure)
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, 
  query, orderBy, addDoc, updateDoc, doc 
} from "firebase/firestore";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // يقرأ المفتاح المخفي من فيرسل
  authDomain: "dar-wa-emaar.firebaseapp.com",
  projectId: "dar-wa-emaar",
  storageBucket: "dar-wa-emaar.firebasestorage.app",
  messagingSenderId: "916360008812",
  appId: "1:916360008812:web:58d2b6f38d723ebe37f449"
};

// تفعيل قاعدة البيانات الآن
const IS_FIREBASE_ENABLED = true;
let app;
let db: any;

if (IS_FIREBASE_ENABLED) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    console.warn("Firebase initialization failed:", error);
  }
}

const App: React.FC = () => {
  // --- State ---
  const [users] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('LOGIN');
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [taskFilter, setTaskFilter] = useState<string>('All');

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
  
  // Load CSV Data
  useEffect(() => {
    const lines = RAW_CSV_DATA.trim().split('\n');
    const parsedTasks: Task[] = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV regex to handle quotes
      const row: string[] = [];
      let current = '';
      let inQuote = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            row.push(current.trim());
            current = '';
        } else {
            current += char;
        }
      }
      row.push(current.trim());
      const cleanRow = row.map(c => c.replace(/^"|"$/g, '').trim());

      if (cleanRow.length >= 8) {
        parsedTasks.push({
          id: `task-${i}`,
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

    // Group Projects
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
  }, []);

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

  const createServiceRequestObject = (data: Partial<ServiceRequest>): ServiceRequest => {
    if (!currentUser) throw new Error("No user logged in");
    
    const isConveyance = currentUser.role === 'CONVEYANCE';
    
    return {
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
    } as ServiceRequest;
  };

const handleCreateRequest = async () => {
    if (!currentUser) return;
    
    // تجهيز بيانات الطلب
    const reqData = createServiceRequestObject(newRequestData);

    // 1. الحفظ في قاعدة البيانات (Firebase)
    if (IS_FIREBASE_ENABLED && db) {
        try {
            // نستخدم addDoc لإرسال البيانات إلى مجموعة "requests"
            await addDoc(collection(db, "requests"), reqData);
        } catch (error) {
            console.error("Error saving to Firebase:", error);
            alert("حدث خطأ أثناء الحفظ، تأكد من الاتصال بالإنترنت");
            return; 
        }
    }

    // 2. التحديث المحلي (للعرض الفوري)
    if (isBulkMode && bulkPreviewData.length > 0) {
        // في حالة الرفع الجماعي (سنكتفي بالتحديث المحلي مؤقتاً للتبسيط)
        const newRequests = bulkPreviewData.map(data => createServiceRequestObject(data));
        setServiceRequests(prev => [...newRequests, ...prev]);
        setIsBulkMode(false);
        setBulkPreviewData([]);
    } else {
        // الإضافة الفردية
        setServiceRequests(prev => [reqData, ...prev]);
    }
    
    setIsRequestModalOpen(false);
    setNewRequestData({});
  };
    if (!currentUser) return;
    
    if (isBulkMode && bulkPreviewData.length > 0) {
        // Handle Bulk Submit
        const newRequests = bulkPreviewData.map(data => createServiceRequestObject(data));
        setServiceRequests(prev => [...newRequests, ...prev]);
        setIsBulkMode(false);
        setBulkPreviewData([]);
    } else {
        // Handle Single Submit
        const req = createServiceRequestObject(newRequestData);
        setServiceRequests(prev => [req, ...prev]);
    }
    
    setIsRequestModalOpen(false);
    setNewRequestData({});
  };

  const handleDownloadTemplate = () => {
    // Check if XLSX is available
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;

    const headers = [
        ['اسم العميل', 'رقم الهوية', 'رقم القطعة', 'رقم الصك', 'المشروع', 'رقم الجوال', 'البنك', 'قيمة العقار']
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    // Adjust column widths
    const wscols = [
        {wch: 25}, // اسم العميل
        {wch: 15}, // الهوية
        {wch: 10}, // القطعة
        {wch: 15}, // الصك
        {wch: 20}, // المشروع
        {wch: 15}, // الجوال
        {wch: 15}, // البنك
        {wch: 15}  // القيمة
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "نموذج الإفراغات");
    XLSX.writeFile(wb, "نموذج_رفع_الإفراغات.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const XLSX = (window as any).XLSX;
        if (!XLSX) return;

        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Map Excel headers to State keys
        const mappedData: Partial<ServiceRequest>[] = data.map((row: any) => ({
            clientName: row['اسم العميل'],
            idNumber: row['رقم الهوية'],
            plotNumber: row['رقم القطعة'],
            deedNumber: row['رقم الصك'],
            projectName: row['المشروع'],
            mobileNumber: row['رقم الجوال'],
            bank: row['البنك'],
            propertyValue: row['قيمة العقار'],
        })).filter((item: Partial<ServiceRequest>) => item.clientName); // Simple validation

        setBulkPreviewData(mappedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleUpdateStatus = (reqId: string, newStatus: RequestStatus, note?: string) => {
    // 1. Handle Project Task Creation on Completion
    if (newStatus === 'completed') {
        const req = serviceRequests.find(r => r.id === reqId);
        if (req && req.projectName) {
            setProjects(prev => prev.map(p => {
                if (p.name === req.projectName) {
                    const newTask: Task = {
                        id: `req-${req.id}-${Date.now()}`,
                        project: p.name,
                        description: req.name,
                        reviewer: req.authority || (req.type === 'conveyance' ? 'كتابة العدل' : '-'),
                        requester: req.submittedBy,
                        notes: req.details || '',
                        location: p.location,
                        status: 'منجز',
                        date: new Date().toISOString().split('T')[0]
                    };
                    
                    const newTasks = [newTask, ...p.tasks];
                    const completed = newTasks.filter(t => t.status === 'منجز').length;
                    
                    const updatedProject = {
                        ...p,
                        tasks: newTasks,
                        totalTasks: newTasks.length,
                        completedTasks: completed,
                        progress: (completed / newTasks.length) * 100
                    };

                    // Update selected project if active
                    if (selectedProject?.name === p.name) {
                        setSelectedProject(updatedProject);
                    }
                    
                    return updatedProject;
                }
                return p;
            }));
        }
    }

    // 2. Update Request Status
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

  const handleSaveProjectImage = () => {
    if (selectedProject) {
        const updatedProjects = projects.map(p => 
            p.name === selectedProject.name ? { ...p, imageUrl: editProjectImageUrl } : p
        );
        setProjects(updatedProjects);
        setSelectedProject({ ...selectedProject, imageUrl: editProjectImageUrl });
        setIsEditProjectModalOpen(false);
    }
  };

  const handleTogglePin = (project: ProjectSummary) => {
    setProjects(prev => prev.map(p => 
        p.name === project.name ? { ...p, isPinned: !p.isPinned } : p
    ));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditProjectImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Render Functions ---

  const renderSidebar = () => {
    if (!currentUser || view === 'LOGIN') return null;

    const menuItems = [
      { id: 'DASHBOARD', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER'] },
      { id: 'REQUESTS', label: 'الطلبات', icon: FileText, roles: ['ADMIN', 'PR_MANAGER', 'PR_OFFICER', 'FINANCE'] },
      { id: 'SERVICE_ONLY', label: 'طلب خدمة', icon: Plus, roles: ['TECHNICAL', 'CONVEYANCE'] },
      { id: 'USERS', label: 'المستخدمين', icon: Users, roles: ['ADMIN'] },
    ];

    return (
      <>
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Content */}
        <div className={`
          fixed inset-y-0 right-0 z-50 w-64 bg-[#1B2B48] text-white 
          transform transition-transform duration-300 ease-in-out shadow-2xl
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 md:static md:flex flex-col h-screen
        `}>
          <div className="p-6 flex flex-col items-center border-b border-gray-700 relative">
             <button 
               onClick={() => setIsSidebarOpen(false)} 
               className="md:hidden absolute top-4 left-4 text-gray-400 hover:text-white"
             >
               <X size={20} />
             </button>
             <img src={LOGO_URL} alt="Logo" className="h-16 mb-4 bg-white rounded-lg p-1" />
             <h2 className="font-bold text-lg">دار وإعمار</h2>
             <p className="text-xs text-gray-400 mt-1">{currentUser.name}</p>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
             {menuItems.filter(item => item.roles.includes(currentUser.role)).map(item => (
               <button
                 key={item.id}
                 onClick={() => {
                   setView(item.id as ViewState);
                   setIsSidebarOpen(false);
                 }}
                 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                   view === item.id 
                   ? 'bg-[#E95D22] text-white shadow-lg shadow-[#E95D22]/30 font-medium' 
                   : 'text-gray-300 hover:bg-white/10 hover:text-white'
                 }`}
               >
                 <item.icon className="w-5 h-5" />
                 <span>{item.label}</span>
               </button>
             ))}
          </nav>

          <div className="p-4 border-t border-gray-700">
             <button 
               onClick={handleLogout}
               className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
             >
               <LogOut className="w-5 h-5" />
               <span>تسجيل خروج</span>
             </button>
          </div>
        </div>
      </>
    );
  };

  const renderDashboard = () => {
     // Apply Filter Logic
     const filteredProjects = projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              p.location.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLocation = locationFilter === 'All' || p.location === locationFilter;
        return matchesSearch && matchesLocation;
     });

     const pinnedProjects = filteredProjects.filter(p => p.isPinned);
     const otherProjects = filteredProjects.filter(p => !p.isPinned);

     return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Area with Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-[#1B2B48]">لوحة التحكم</h2>
                    <p className="text-gray-500 text-sm mt-1">نظرة عامة على جميع المشاريع والمهام</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#E95D22] transition-colors w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="بحث باسم المشروع أو الموقع..." 
                            className="w-full sm:w-64 pl-4 pr-10 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none text-sm transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative">
                        <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <select 
                            className="w-full sm:w-48 pl-4 pr-10 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none text-sm appearance-none cursor-pointer transition-all"
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                        >
                            <option value="All">جميع المواقع</option>
                            {LOCATIONS_ORDER.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Info */}
            {(searchQuery || locationFilter !== 'All') && (
                <div className="text-sm text-gray-500 mb-4 animate-in fade-in">
                    تم العثور على <span className="font-bold text-[#E95D22]">{filteredProjects.length}</span> مشروع
                    {searchQuery && <span> يطابق بحثك "{searchQuery}"</span>}
                    {locationFilter !== 'All' && <span> في {locationFilter}</span>}
                </div>
            )}
            
            {pinnedProjects.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-[#E95D22] mb-4 flex items-center gap-2">
                        <Pin className="w-5 h-5 fill-current" />
                        المشاريع المثبتة
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pinnedProjects.map((project, idx) => (
                            <ProjectCard 
                                key={`pinned-${project.name}`} 
                                project={project} 
                                onClick={(p) => { setSelectedProject(p); setView('PROJECT_DETAIL'); setTaskFilter('All'); }} 
                                onTogglePin={handleTogglePin}
                            />
                        ))}
                    </div>
                </div>
            )}

            {(pinnedProjects.length > 0 && otherProjects.length > 0) && <h3 className="text-lg font-bold text-[#1B2B48] mb-4">باقي المشاريع</h3>}

            {otherProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherProjects.map((project, idx) => (
                        <ProjectCard 
                            key={idx} 
                            project={project} 
                            onClick={(p) => { setSelectedProject(p); setView('PROJECT_DETAIL'); setTaskFilter('All'); }} 
                            onTogglePin={handleTogglePin}
                        />
                    ))}
                </div>
            ) : (
                filteredProjects.length === 0 && projects.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 border-dashed">
                        <Search className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">لا توجد مشاريع تطابق بحثك</p>
                        <button 
                            onClick={() => {setSearchQuery(''); setLocationFilter('All');}}
                            className="mt-3 text-[#E95D22] text-sm hover:underline"
                        >
                            مسح فلاتر البحث
                        </button>
                    </div>
                )
            )}
            
            {projects.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    جاري تحميل البيانات...
                </div>
            )}
        </div>
     );
  };

  const renderProjectDetail = () => {
    if (!selectedProject) return null;

    // Filter Tasks
    const filteredTasks = selectedProject.tasks.filter(t => taskFilter === 'All' || t.status === taskFilter);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-gray-500 hover:text-[#E95D22] transition-colors mb-4">
                <ArrowLeft className="w-4 h-4" />
                عودة للمشاريع
            </button>

            {/* Project Image Banner */}
            <div className="relative h-48 md:h-64 w-full rounded-2xl overflow-hidden bg-gray-100 group mb-6 border border-gray-200">
                {selectedProject.imageUrl ? (
                    <img 
                        src={selectedProject.imageUrl} 
                        alt={selectedProject.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                        <ImageIcon className="w-16 h-16 mb-2 opacity-20" />
                        <span className="text-sm opacity-40">لا توجد صورة للمشروع</span>
                    </div>
                )}
                
                {/* Edit Image Button Overlay - Only visible for ADMIN/MANAGER */}
                {['ADMIN', 'PR_MANAGER'].includes(currentUser?.role || '') && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                        <button 
                            onClick={() => {
                                setEditProjectImageUrl(selectedProject.imageUrl || '');
                                setIsEditProjectModalOpen(true);
                            }}
                            className="bg-white text-[#1B2B48] px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl hover:shadow-2xl hover:text-[#E95D22]"
                        >
                            <UploadCloud className="w-5 h-5" />
                            تغيير صورة المشروع
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-6">
                    <div>
                         <h2 className="text-3xl font-bold text-[#1B2B48]">{selectedProject.name}</h2>
                         <div className="flex items-center gap-2 text-gray-500 mt-2">
                            <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">{selectedProject.location}</span>
                         </div>
                    </div>
                    <div className="text-center bg-gray-50 p-4 rounded-xl">
                        <span className="text-gray-500 text-sm block">نسبة الإنجاز</span>
                        <span className="text-2xl font-bold text-[#E95D22]">{Math.round(selectedProject.progress)}%</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="font-bold text-[#1B2B48] mb-2 flex items-center gap-2">
                                <FileCheck className="w-4 h-4" /> ملخص المهام
                            </h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">الكلي</span>
                                    <span className="font-bold">{selectedProject.totalTasks}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-green-600">المنجز</span>
                                    <span className="font-bold text-green-600">{selectedProject.completedTasks}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#E95D22]">قيد العمل</span>
                                    <span className="font-bold text-[#E95D22]">{selectedProject.totalTasks - selectedProject.completedTasks}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-[#1B2B48]">قائمة المهام</h3>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setTaskFilter('All')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        taskFilter === 'All' ? 'bg-white text-[#E95D22] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    الكل
                                </button>
                                <button
                                    onClick={() => setTaskFilter('متابعة')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        taskFilter === 'متابعة' ? 'bg-white text-[#E95D22] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    قيد العمل
                                </button>
                                <button
                                    onClick={() => setTaskFilter('منجز')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        taskFilter === 'منجز' ? 'bg-white text-[#E95D22] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    منجز
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            {filteredTasks.length > 0 ? (
                                filteredTasks.map(task => (
                                    <TaskCard key={task.id} task={task} onEdit={() => {}} />
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    لا توجد مهام بهذه الحالة
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

             {/* Edit Image Modal */}
             <Modal
                isOpen={isEditProjectModalOpen}
                onClose={() => setIsEditProjectModalOpen(false)}
                title="تحديث صورة المشروع"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">رفع صورة من الجهاز</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors hover:border-[#E95D22]/50">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-3 text-gray-400" />
                                    <p className="text-sm text-gray-500 mb-1"><span className="font-bold text-[#E95D22]">اضغط هنا</span> لرفع صورة</p>
                                    <p className="text-xs text-gray-400">PNG, JPG (الحد الأقصى 5MB)</p>
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileChange} 
                                />
                            </label>
                        </div>
                    </div>

                    <div className="relative flex items-center">
                        <div className="flex-grow border-t border-gray-100"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">أو رابط مباشر</span>
                        <div className="flex-grow border-t border-gray-100"></div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">رابط الصورة (URL)</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#E95D22] outline-none dir-ltr text-left transition-all"
                            placeholder="https://example.com/image.jpg"
                            value={editProjectImageUrl}
                            onChange={(e) => setEditProjectImageUrl(e.target.value)}
                            dir="ltr"
                        />
                    </div>

                    {editProjectImageUrl && (
                        <div className="relative h-48 w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-inner">
                            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded z-10">معاينة</div>
                            <img 
                                src={editProjectImageUrl} 
                                alt="Preview" 
                                className="w-full h-full object-cover" 
                                onError={(e) => (e.currentTarget.style.display = 'none')} 
                            />
                        </div>
                    )}
                    <button 
                        onClick={handleSaveProjectImage}
                        className="w-full bg-[#E95D22] text-white py-3.5 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg shadow-[#E95D22]/20"
                    >
                        حفظ التغييرات
                    </button>
                </div>
            </Modal>
        </div>
    );
  };

  const renderServiceOnly = () => {
    // Determine title based on role
    const title = currentUser?.role === 'CONVEYANCE' ? 'طلبات الإفراغ العقاري' : 'الدعم الفني';
    const subTitle = currentUser?.role === 'CONVEYANCE' 
        ? 'إدارة طلبات الإفراغ ومتابعة حالتها' 
        : 'تقديم ومتابعة الطلبات الفنية للمشاريع';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#1B2B48] mb-2">{title}</h2>
                    <p className="text-gray-500">{subTitle}</p>
                </div>
                <button 
                    onClick={() => {setIsRequestModalOpen(true); setIsBulkMode(false); setBulkPreviewData([]);}}
                    className="bg-[#E95D22] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg shadow-[#E95D22]/20 flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    طلب جديد
                </button>
            </div>

            <h3 className="font-bold text-lg text-[#1B2B48] px-2">سجل طلباتي</h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-700 font-bold">
                            <tr>
                                <th className="px-6 py-4">رقم الطلب</th>
                                <th className="px-6 py-4">النوع</th>
                                <th className="px-6 py-4">التفاصيل</th>
                                <th className="px-6 py-4">المشروع</th>
                                <th className="px-6 py-4">الحالة</th>
                                <th className="px-6 py-4">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {serviceRequests
                                .filter(r => r.submittedBy === currentUser?.name)
                                .map(req => (
                                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-gray-500">#{req.id.slice(-6)}</td>
                                    <td className="px-6 py-4 font-bold text-[#1B2B48]">{req.name}</td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{req.details}</td>
                                    <td className="px-6 py-4 text-gray-600">{req.projectName || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold 
                                            ${req.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                              req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'}`}>
                                            {req.status === 'new' ? 'جديد' : 
                                             req.status === 'completed' ? 'مكتمل' :
                                             req.status === 'rejected' ? 'مرفوض' : req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500" dir="ltr">{req.date}</td>
                                </tr>
                            ))}
                            {serviceRequests.filter(r => r.submittedBy === currentUser?.name).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                        لا توجد طلبات سابقة
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal 
                isOpen={isRequestModalOpen} 
                onClose={() => setIsRequestModalOpen(false)}
                title="طلب خدمة جديد"
            >
                <div className="space-y-4">
                    
                    {/* Mode Toggle (Manual vs Bulk) */}
                    {currentUser?.role === 'CONVEYANCE' && (
                        <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                            <button 
                                onClick={() => setIsBulkMode(false)}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isBulkMode ? 'bg-white shadow-sm text-[#E95D22]' : 'text-gray-500'}`}
                            >
                                إدخال يدوي
                            </button>
                            <button 
                                onClick={() => setIsBulkMode(true)}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${isBulkMode ? 'bg-white shadow-sm text-[#E95D22]' : 'text-gray-500'}`}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                رفع ملف Excel
                            </button>
                        </div>
                    )}

                    {isBulkMode ? (
                        /* Bulk Upload Mode */
                        <div className="space-y-6 animate-in fade-in">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-bold mb-1">تعليمات الرفع:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>قم بتحميل النموذج المعتمد أولاً.</li>
                                        <li>تأكد من تعبئة جميع الحقول المطلوبة.</li>
                                        <li>صيغة الملف المدعومة: .xlsx</li>
                                    </ul>
                                </div>
                            </div>

                            <button 
                                onClick={handleDownloadTemplate}
                                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center gap-2 text-gray-600 hover:border-[#E95D22] hover:text-[#E95D22] transition-colors"
                            >
                                <Download className="w-5 h-5" />
                                تحميل نموذج الإكسل
                            </button>

                            <div className="relative">
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="block w-full text-sm text-gray-500
                                      file:mr-4 file:py-2.5 file:px-4
                                      file:rounded-xl file:border-0
                                      file:text-sm file:font-semibold
                                      file:bg-[#E95D22]/10 file:text-[#E95D22]
                                      hover:file:bg-[#E95D22]/20"
                                />
                            </div>

                            {bulkPreviewData.length > 0 && (
                                <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
                                    <table className="w-full text-xs text-right">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="p-2">العميل</th>
                                                <th className="p-2">الهوية</th>
                                                <th className="p-2">المشروع</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {bulkPreviewData.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-2">{row.clientName}</td>
                                                    <td className="p-2">{row.idNumber}</td>
                                                    <td className="p-2">{row.projectName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="pt-2">
                                <div className="text-xs text-center text-gray-400 mb-2">
                                    سيتم إنشاء {bulkPreviewData.length} طلبات
                                </div>
                                <button 
                                    onClick={handleCreateRequest}
                                    disabled={bulkPreviewData.length === 0}
                                    className="w-full bg-[#E95D22] text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#d14912] transition-colors"
                                >
                                    اعتماد الطلبات ({bulkPreviewData.length})
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Manual Entry Mode (Existing Form) */
                        <>
                            {currentUser?.role === 'TECHNICAL' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">نوع الخدمة</label>
                                        <select 
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#E95D22] outline-none"
                                            onChange={(e) => setNewRequestData({...newRequestData, serviceSubType: e.target.value})}
                                        >
                                            <option value="">اختر نوع الخدمة...</option>
                                            {TECHNICAL_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">الجهة</label>
                                        <select 
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#E95D22] outline-none"
                                            onChange={(e) => setNewRequestData({...newRequestData, authority: e.target.value})}
                                        >
                                            <option value="">اختر الجهة...</option>
                                            {GOVERNMENT_AUTHORITIES.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">وصف الخدمة / التفاصيل</label>
                                        <textarea 
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#E95D22] outline-none h-24"
                                            placeholder="اكتب تفاصيل الطلب هنا..."
                                            onChange={(e) => setNewRequestData({...newRequestData, details: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المشروع</label>
                                        <select 
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#E95D22] outline-none"
                                            onChange={(e) => setNewRequestData({...newRequestData, projectName: e.target.value})}
                                        >
                                            <option value="">اختر المشروع...</option>
                                            {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {currentUser?.role === 'CONVEYANCE' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                                onChange={(e) => setNewRequestData({...newRequestData, clientName: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                                onChange={(e) => setNewRequestData({...newRequestData, idNumber: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم القطعة</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                                onChange={(e) => setNewRequestData({...newRequestData, plotNumber: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الصك</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                                onChange={(e) => setNewRequestData({...newRequestData, deedNumber: e.target.value})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المشروع</label>
                                        <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                                            onChange={(e) => setNewRequestData({...newRequestData, projectName: e.target.value})}>
                                            <option value="">اختر المشروع...</option>
                                            {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                                onChange={(e) => setNewRequestData({...newRequestData, mobileNumber: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">البنك</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                                onChange={(e) => setNewRequestData({...newRequestData, bank: e.target.value})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">قيمة العقار</label>
                                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" 
                                            onChange={(e) => setNewRequestData({...newRequestData, propertyValue: e.target.value})} />
                                    </div>
                                </>
                            )}

                            <button 
                                onClick={handleCreateRequest}
                                className="w-full bg-[#E95D22] text-white py-3 rounded-xl font-bold mt-4 hover:bg-[#d14912] transition-colors"
                            >
                                إرسال الطلب
                            </button>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
  };

  const renderRequestsDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold text-[#1B2B48] mb-4">الطلبات الواردة</h2>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 text-gray-700 font-bold">
                        <tr>
                            <th className="px-6 py-4">رقم الطلب</th>
                            <th className="px-6 py-4">النوع</th>
                            <th className="px-6 py-4">مقدم الطلب</th>
                            <th className="px-6 py-4">المشروع</th>
                            <th className="px-6 py-4">الحالة</th>
                            <th className="px-6 py-4">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {serviceRequests.map(req => (
                            <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-gray-500">#{req.id.slice(-6)}</td>
                                <td className="px-6 py-4 font-bold text-[#1B2B48]">{req.name}</td>
                                <td className="px-6 py-4 text-gray-600">{req.submittedBy} <span className="text-xs text-gray-400 block">{req.role}</span></td>
                                <td className="px-6 py-4 text-gray-600">{req.projectName || '-'}</td>
                                <td className="px-6 py-4">
                                     <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold 
                                        ${req.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                          req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                          'bg-yellow-100 text-yellow-700'}`}>
                                        {req.status === 'new' ? 'جديد' : 
                                         req.status === 'completed' ? 'مكتمل' :
                                         req.status === 'rejected' ? 'مرفوض' : req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <button 
                                        onClick={() => setSelectedRequest(req)}
                                        className="text-[#E95D22] hover:bg-[#E95D22]/10 px-3 py-1 rounded-lg transition-colors text-xs font-bold"
                                    >
                                        عرض التفاصيل
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <Modal
            isOpen={!!selectedRequest}
            onClose={() => setSelectedRequest(null)}
            title="تفاصيل الطلب"
        >
            {selectedRequest && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 block text-xs">رقم الطلب</span>
                            <span className="font-bold text-[#1B2B48]">#{selectedRequest.id}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 block text-xs">تاريخ الطلب</span>
                            <span className="font-bold text-[#1B2B48]">{selectedRequest.date}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 block text-xs">مقدم الطلب</span>
                            <span className="font-bold text-[#1B2B48]">{selectedRequest.submittedBy}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 block text-xs">المشروع</span>
                            <span className="font-bold text-[#1B2B48]">{selectedRequest.projectName || '-'}</span>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h4 className="font-bold text-[#1B2B48] mb-2">تفاصيل الخدمة</h4>
                        <p className="text-gray-600 bg-gray-50 p-4 rounded-xl text-sm leading-relaxed">
                            {selectedRequest.details || selectedRequest.name}
                        </p>
                        {selectedRequest.type === 'conveyance' && (
                            <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-gray-600">
                                <div>العميل: {selectedRequest.clientName}</div>
                                <div>الهوية: {selectedRequest.idNumber}</div>
                                <div>رقم القطعة: {selectedRequest.plotNumber}</div>
                                <div>رقم الصك: {selectedRequest.deedNumber}</div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => handleUpdateStatus(selectedRequest.id, 'completed')}
                            className="flex-1 bg-green-500 text-white py-2.5 rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" /> قبول / إكمال
                        </button>
                        <button 
                            onClick={() => handleUpdateStatus(selectedRequest.id, 'rejected')}
                            className="flex-1 bg-red-50 text-red-500 py-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <XCircle className="w-4 h-4" /> رفض الطلب
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-[#1B2B48] p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[#E95D22]/10 blur-3xl rounded-full transform -translate-y-1/2 scale-150"></div>
                <img src={LOGO_URL} alt="Logo" className="h-24 mx-auto bg-white rounded-2xl p-2 mb-4 shadow-lg relative z-10" />
                <h2 className="text-2xl font-bold text-white relative z-10">تسجيل الدخول</h2>
                <p className="text-blue-200 text-sm mt-2 relative z-10">نظام متابعة المشاريع - دار وإعمار</p>
            </div>
            <form onSubmit={handleLogin} className="p-8 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
                    <input 
                        type="email" 
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none transition-all"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="example@dar.sa"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور</label>
                    <input 
                        type="password" 
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#E95D22] focus:ring-4 focus:ring-[#E95D22]/10 outline-none transition-all"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                    />
                </div>
                <button type="submit" className="w-full bg-[#E95D22] text-white py-3.5 rounded-xl font-bold hover:bg-[#d14912] transition-colors shadow-lg shadow-[#E95D22]/30 active:scale-[0.98]">
                    تسجيل الدخول
                </button>
                
                <div className="text-center">
                    <p className="text-xs text-gray-400">جميع الحقوق محفوظة © 2025 دار وإعمار</p>
                </div>
            </form>
        </div>
    </div>
  );

  if (view === 'LOGIN') return renderLogin();

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden" dir="rtl">
        {renderSidebar()}
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
            {/* Header for Mobile */}
            <header className="bg-white border-b border-gray-100 p-4 md:hidden flex justify-between items-center sticky top-0 z-20">
                 <div className="flex items-center gap-2">
                     <img src={LOGO_URL} className="h-8" alt="Logo" />
                     <h1 className="font-bold text-[#1B2B48]">دار وإعمار</h1>
                 </div>
                 <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600 bg-gray-50 rounded-lg"><Menu size={20} /></button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                {view === 'DASHBOARD' && renderDashboard()}
                {view === 'PROJECT_DETAIL' && renderProjectDetail()}
                {view === 'REQUESTS' && renderRequestsDashboard()}
                {view === 'SERVICE_ONLY' && renderServiceOnly()}
                {view === 'USERS' && <div className="flex flex-col items-center justify-center h-full text-gray-400"><Users className="w-16 h-16 mb-4 opacity-20" /><p>إدارة المستخدمين</p></div>}
            </main>
        </div>
    </div>
  );
};

export default App;
