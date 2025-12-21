
import React from 'react';
import { Edit3, Building2, User, Calendar, FileText, MessageSquare, Trash2 } from 'lucide-react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onOpenComments: (task: Task) => void;
  onDelete?: (task: Task) => void;
  canManage?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onOpenComments, onDelete, canManage }) => {
  const isCompleted = task.status === 'منجز';
  const commentCount = task.comments?.length || 0;

  return (
    <div className={`bg-white rounded-xl p-5 border-r-4 shadow-sm hover:shadow-md transition-shadow relative ${isCompleted ? 'border-green-500' : 'border-[#E95D22]'}`}>
      
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-[#1B2B48] text-lg ml-20">{task.description}</h4>
        <div className="flex gap-2 absolute top-4 left-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenComments(task); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
              commentCount > 0 
              ? 'bg-[#E95D22]/10 text-[#E95D22] border border-[#E95D22]/20' 
              : 'bg-gray-100 text-gray-400 hover:text-[#E95D22] hover:bg-[#E95D22]/5'
            }`}
            title="التعليقات"
          >
            <MessageSquare className="w-4 h-4" />
            {commentCount > 0 && <span className="text-xs font-bold">{commentCount}</span>}
          </button>
          
          {canManage && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                className="p-2 text-gray-400 hover:text-[#1B2B48] hover:bg-gray-100 rounded-full transition-colors"
                title="تعديل"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(task); }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="حذف العمل"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400 text-xs">جهة المراجعة:</span>
          <span className="font-medium text-[#1B2B48]">{task.reviewer || '-'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400 text-xs">الطالب:</span>
            <span className="font-medium text-[#1B2B48]">{task.requester || '-'}</span>
        </div>
      </div>
      
      {task.notes && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 mb-4 leading-relaxed flex items-start gap-2 border border-gray-100">
          <FileText className="w-4 h-4 text-[#E95D22] mt-1 shrink-0" />
          <p>{task.notes}</p>
        </div>
      )}

      <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-auto">
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-[#E95D22]/10 text-[#E95D22]'}`}>
          {task.status}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          <span dir="ltr">{task.date}</span>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
