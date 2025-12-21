
export const RAW_CSV_DATA = `المشروع,بيان الأعمال,جهة المراجعة,الجهة طالبة الخدمة,الوصف والملاحظات,الموقع,الحالة,تاريخ المتابعة
سرايا البحر,خدمات AI,-,-,"تجربة ",القطيف,منجز,2025-12-09`;

export const LOCATIONS_ORDER = [
  'الرياض',
  'جدة',
  'المدينة المنورة',
  'المنطقة الشرقية',
  'القطيف'
];

export const TECHNICAL_SERVICE_TYPES = [
    'فرز صكوك',
    'شبكة الري',
    'الترخيص البيئي',
    'بلاغ سرقة',
    'شبكة المياة',
    'نقل ملكية عدادات الكهرباء',
    'شهادات الاشغال',
    'نزل الملكية',
    'طلب فتح خدمة الكهرباء',
    'طلب استثناء شهادات الاشغال',
    'إصدار رخص بناء',
    'تعديل بيانات المالك برخصة البناء',
    'رخص البناء',
    'التقديم على خدمات المياة',
    'قرارات مساحية',
    'تعاقدات',
    'أخرى'
];

export const GOVERNMENT_AUTHORITIES = [
    'وزارة الإسكان',
    'شركة الوطنية للإسكان',
    'أمانة منطقة الرياض',
    'الشركة السعودية للكهرباء',
    'المركز الوطني للرقابة على الالتزام البيئي',
    'شرطة العارض',
    'الهيئة الملكية للتطوير الرياض',
    'وزارة الشؤون الإسلامية',
    'بلدية شمال الرياض',
    'امانه محافظة جدة',
    'بلدية العقيق',
    'شركة الكهرباء',
    'بلدي',
    'شركة المياة الوطنية',
    'السجل العقاري',
    'امانه المنطقة الشرقية',
    'بلدية صفوى',
    'أخرى'
];

import { User } from './types';

export const INITIAL_USERS: User[] = [
  { id: '1', name: 'مدير النظام', email: 'admin@dar.sa', role: 'ADMIN', password: '123' },
  { id: '2', name: 'مدير علاقات عامة', email: 'manager@dar.sa', role: 'PR_MANAGER', password: '123' },
  { id: '3', name: 'مسؤول علاقات عامة', email: 'officer@dar.sa', role: 'PR_OFFICER', password: '123' },
  { id: '4', name: 'القسم الفني', email: 'tech@dar.sa', role: 'TECHNICAL', password: '123' },
  { id: '5', name: 'موظف الإفراغات', email: 'conveyance@dar.sa', role: 'CONVEYANCE', password: '123' },
  { id: '6', name: 'المالية', email: 'finance@dar.sa', role: 'FINANCE', password: '123' }
];

export const DAR_LOGO = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDUwMCA1MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodz0iNTAwIiByeD0iNTAiIGZpbGw9IiMxQjJCODAiLz4KPHBhdGggZD0iTTI1MCAxMDBMMTAwIDIyMFY0MDBIMjAwVjMwMEgzMDBWNDAwSDQwMFYyMjBMMjUwIDEwMFoiIGZpbGw9IiNFMzVEMjIiLz4KPHBhdGggZD0iTTI1MCAxNTBMMTUwIDIzMFYzNzBIMjMwVjI3MEgyNzBWMzcwSDM1MFYyMzBMMjUwIDEwMFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMiIvPgo8cGF0aCBkPSJNMjUwIDgwTDE1MCAxNjBWMjQwaDIwMHYtODBMMjUwIDgwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+";
export const DAR_LOGO_STABLE = DAR_LOGO;
