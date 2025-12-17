import React, { useState } from 'react';
import { FolderOpen, MapPin, CheckCircle2, Clock, Pin } from 'lucide-react';
import { ProjectSummary } from '../types';

interface ProjectCardProps {
  project: ProjectSummary;
  onClick: (project: ProjectSummary) => void;
  onTogglePin: (project: ProjectSummary) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onTogglePin }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div 
      onClick={() => onClick(project)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:border-[#E95D22]/20 transition-all duration-300 group overflow-hidden flex flex-col h-full relative"
    >
        {/* Pin Button */}
        <button
            onClick={(e) => {
                e.stopPropagation();
                onTogglePin(project);
            }}
            className={`absolute top-3 left-3 z-20 p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                project.isPinned 
                ? 'bg-[#E95D22] text-white shadow-lg' 
                : 'bg-white/50 text-gray-500 hover:bg-white hover:text-[#E95D22]'
            }`}
            title={project.isPinned ? "إلغاء التثبيت" : "تثبيت المشروع"}
        >
            <Pin className={`w-4 h-4 ${project.isPinned ? 'fill-current' : ''}`} />
        </button>

        {project.imageUrl && !imgError ? (
            <div className="h-52 w-full relative bg-gray-100">
                <img 
                    src={project.imageUrl} 
                    alt={project.name} 
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B2B48]/90 via-[#1B2B48]/20 to-transparent" />
                <div className="absolute bottom-5 right-5 text-white z-10">
                    <h3 className="font-bold text-xl leading-tight mb-2">{project.name}</h3>
                    <div className="flex items-center gap-1.5 text-gray-200 text-sm bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg w-fit">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{project.location}</span>
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-6 pb-0 flex justify-between items-start pt-12">
                <div className="flex items-center gap-4">
                    <div className="bg-[#E95D22]/10 p-3.5 rounded-2xl group-hover:bg-[#E95D22] transition-colors duration-300">
                        <FolderOpen className="w-7 h-7 text-[#E95D22] group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div>
                         <h3 className="font-bold text-[#1B2B48] text-xl leading-tight group-hover:text-[#E95D22] transition-colors">{project.name}</h3>
                         {(!project.imageUrl || imgError) && (
                            <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
                                <MapPin className="w-3 h-3" />
                                <span>{project.location}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-2 text-sm text-gray-500 mt-auto">
            <span className="font-medium">نسبة الإنجاز</span>
            <span className="font-bold text-[#E95D22]">{Math.round(project.progress)}%</span>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6 overflow-hidden">
            <div 
            className="bg-[#E95D22] h-2.5 rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
            style={{ width: `${project.progress}%` }}
            >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
            </div>
        </div>

        <div className="flex justify-between items-center text-xs border-t border-gray-50 pt-4">
            <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{project.completedTasks} منجز</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#E95D22] bg-[#E95D22]/10 px-3 py-1.5 rounded-lg font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{project.totalTasks - project.completedTasks} قيد العمل</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;