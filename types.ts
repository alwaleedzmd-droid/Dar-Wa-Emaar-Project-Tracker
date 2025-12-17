

export interface Task {
  id: string;
  project: string;
  description: string;
  reviewer: string;
  requester: string;
  notes: string;
  location: string;
  status: 'منجز' | 'متابعة' | string;
  date: string;
}

export interface ProjectMetrics {
  unitsCount: number;         // عدد وحدات المشروع
  buildingPermitsCount: number; // عدد رخص البناء
  surveyDecisionsCount: number; // القرارات المساحية
  occupancyCertificatesCount: number; // شهادات الاشغال
  waterMetersCount: number;   // تركيب عدادات المياه
  electricityMetersCount: number; // تركيب عدادات الكهرباء
}

export interface ContactInfo {
  companyName: string;
  contactNumber: string;
  employeeName: string;
}

export interface ProjectContacts {
  consultant: ContactInfo;
  electricityContractor: ContactInfo;
  waterContractor: ContactInfo;
}

export interface ProjectSummary {
  name: string;
  location: string;
  totalTasks: number;
  completedTasks: number;
  progress: number; // 0-100
  tasks: Task[];
  metrics?: ProjectMetrics;
  contacts?: ProjectContacts;
  imageUrl?: string;
  isPinned?: boolean;
}

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'PROJECT_DETAIL' | 'USERS' | 'SERVICE_ONLY' | 'REQUESTS' | 'REPORTS';

export interface GroupedProjects {
  [location: string]: ProjectSummary[];
}

// ADMIN: مدير النظام (كامل الصلاحيات)
// PR_MANAGER: مدير علاقات عامة (كامل الصلاحيات مثل الادمن)
// PR_OFFICER: مسؤول علاقات عامة (إضافة، تعديل، طباعة، تصدير - ممنوع الحذف وممنوع إدارة المستخدمين)
// FINANCE: المالية (عرض طلبات الإفراغ فقط، موافقة/رفض/تعديل)
// TECHNICAL: القسم الفني (طلب خدمة فقط)
// CONVEYANCE: موظف الإفراغات (طلب خدمة فقط)
export type UserRole = 'ADMIN' | 'PR_MANAGER' | 'PR_OFFICER' | 'FINANCE' | 'TECHNICAL' | 'CONVEYANCE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
}

export type RequestStatus = 
  | 'new'               
  | 'pending_finance'   // بانتظار المالية
  | 'returned_to_user'  // معاد للتعديل (New)
  | 'returned_for_edit' // Legacy support
  | 'pending_pr'        // بانتظار العلاقات العامة (New)
  | 'pending_manager'   // Legacy support
  | 'pending_officer'   // Legacy support
  | 'completed'         // مكتمل
  | 'rejected';         // مرفوض

export interface RequestHistory {
  action: string;       // نوع الإجراء (إنشاء، موافقة، رفض، تعديل، إلخ)
  by: string;           // اسم المستخدم الذي قام بالإجراء
  role: string;         // مسمى وظيفي
  timestamp: string;    // وقت الإجراء
  notes?: string;       // ملاحظات إضافية (مثل سبب الرفض أو التعديل)
}

export interface ServiceRequest {
  id: string;
  name: string;
  type: string;
  details: string;
  submittedBy: string;
  role: string;
  status: RequestStatus;
  date: string;
  rejectionReason?: string; // سبب الرفض
  financeNotes?: string; // ملاحظات المالية عند الإعادة للتعديل
  
  // سجل العمليات
  history: RequestHistory[];

  // حقول خاصة بالإفراغ العقاري
  clientName?: string;
  idNumber?: string;
  plotNumber?: string;
  projectName?: string;
  deedNumber?: string;
  mobileNumber?: string;
  bank?: string;
  propertyValue?: string;

  // حقول خاصة بالقسم الفني
  serviceSubType?: string; // نوع الخدمة الفرعي
  otherServiceDetails?: string; // تفاصيل أخرى
  authority?: string; // الجهة
}