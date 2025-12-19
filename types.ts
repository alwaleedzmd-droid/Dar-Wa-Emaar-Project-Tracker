
export interface Comment {
  id: string;
  text: string;
  author: string;
  authorRole: string;
  timestamp: string;
}

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
  comments?: Comment[];
}

export interface ProjectSummary {
  name: string;
  location: string;
  totalTasks: number;
  completedTasks: number;
  progress: number; // 0-100
  tasks: Task[];
  imageUrl?: string;
  isPinned?: boolean;
}

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'PROJECT_DETAIL' | 'USERS' | 'SERVICE_ONLY' | 'REQUESTS';

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
  | 'pending_finance'   
  | 'pending_pr'        
  | 'completed'         
  | 'rejected'
  | 'revision';         

export interface RequestHistory {
  action: string;
  by: string;
  role: string;
  timestamp: string;
  notes?: string;
}

export interface ServiceRequest {
  id: string;
  name: string;
  type: 'technical' | 'conveyance';
  details: string;
  submittedBy: string;
  role: string;
  status: RequestStatus;
  date: string;
  history: RequestHistory[];
  projectName: string;
  comments?: Comment[];
  // Conveyance fields
  clientName?: string;
  mobileNumber?: string;
  idNumber?: string;
  deedNumber?: string;
  propertyValue?: string;
  unitNumber?: string;
  bank?: string;
  // Technical fields
  serviceSubType?: string;
  authority?: string;
}

export interface ProjectMetrics {
  unitsCount: number;
  buildingPermitsCount: number;
  surveyDecisionsCount: number;
  occupancyCertificatesCount: number;
  waterMetersCount: number;
  electricityMetersCount: number;
}

export interface ProjectContacts {
  prManager?: string;
  prOfficer?: string;
  technicalLead?: string;
  [key: string]: string | undefined;
}
