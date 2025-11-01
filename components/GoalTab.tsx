
import React from 'react';
import type { StructureAnalysis, CheckResult, AnalysisStatus } from '../types';
import { Info, ShoppingCart, GitCompare, ChevronDown, BookOpen, Map, Star, AlertCircle } from 'lucide-react';

const getConciseSummary = (item: CheckResult): string => {
  switch (item.title) {
    case 'عدد الكلمات': return typeof item.required === 'string' && item.required.startsWith('>') ? `${item.required} كلمة` : 'يعتمد على الهدف';
    case 'العنوان الاول': return '150-200 كلمة';
    case 'عنوان مستوى ثاني الثاني': return 'أول عنوان مستوى ثاني يتضمن "أيام"/"ليالي" و 2+ عناوين مستوى ثالث تحته';
    case 'يشمل/لايشمل': return `عنوان مستوى ثاني يتضمن "يشمل" وتحته عناوين مستوى ثالث بالشروط`;
    case 'عنوان مستوى ثاني قبل السفر': return 'عنوان مستوى ثاني يتضمن "معلومات" أو "قبل السفر" | 150-180 كلمة';
    case 'عنوان مستوى ثاني سعر وحجز': return 'عنوان مستوى ثاني يتضمن "سعر", "حجز", "تكاليف" | 150-180 كلمة';
    case 'عنوان مستوى ثاني المرشح': return 'عنوان مستوى ثاني يتضمن "مناسب" أو "مرشح" أو "يناسب"';
    default: return typeof item.required === 'string' ? item.required : String(item.required);
  }
};


const GoalConditionCard: React.FC<{
  item: CheckResult;
  onClick: () => void;
  isHighlighted: boolean;
}> = ({ item, onClick, isHighlighted }) => {
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const progress = Math.max(0, Math.min(item.progress || 0, 1));
  const violationCount = item.status === 'fail' ? (item.violatingItems?.length || 1) : 0;
  const conciseSummary = getConciseSummary(item);
  const cardHeightClass = "min-h-[5.5rem]";

  return (
    <div className="relative">
      <div
        className={`group relative rounded-lg transition-all duration-200 cursor-pointer bg-white hover:bg-gray-50 dark:bg-[#2A2A2A] dark:hover:bg-[#3C3C3C] ${cardHeightClass} flex flex-col justify-between p-3 pt-2 shadow-sm`}
        onClick={onClick}
      >
        <div className="absolute -top-9 right-1/2 translate-x-1/2 w-max max-w-xs bg-gray-900 text-white text-xs rounded-md py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20 whitespace-nowrap">
          {conciseSummary}
          <div className="absolute top-full right-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
        </div>
        
        {isHighlighted && (
          <div className="absolute top-0 right-0 w-8 h-8" aria-hidden="true">
            <div className={`absolute inset-0 ${item.status === 'fail' ? 'bg-[#810701]' : 'bg-[#00778E]'} [clip-path:polygon(0_0,100%_0,100%_100%)] rounded-tr-lg`}></div>
            <Star size={10} className="absolute top-1.5 right-1.5 text-white" fill="white" />
          </div>
        )}
        
        <div className="flex-1 flex items-start justify-between">
          <div className="flex-1 pr-6">
            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200">{item.title}</h4>
            <div className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                <span className="font-semibold">الحالي:</span> {item.current} / <span className="font-semibold">المطلوب:</span> {item.required}
            </div>
          </div>
          <div className="flex items-center gap-2 absolute top-2 left-2">
            {violationCount > 0 && (
              <span 
                className="text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full"
                style={{ backgroundColor: '#810701' }}
              >
                  {violationCount}
              </span>
            )}
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsInfoOpen(prev => !prev);
                }}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3C3C3C]/50"
                aria-label="عرض التفاصيل"
            >
                <AlertCircle size={16} />
            </button>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 w-full h-1.5 rounded-b-lg overflow-hidden bg-gray-200 dark:bg-[#1F1F1F]"
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${item.status === 'fail' ? 100 : progress * 100}%`,
              backgroundColor:
                item.status === 'fail'
                  ? '#810701' 
                  : item.status === 'warn'
                  ? '#F59E0B'
                  : '#00778e',
            }}
          ></div>
        </div>
      </div>

      {isInfoOpen && (
        <div className="absolute z-10 w-full mt-1 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
          {item.description || "لا يوجد وصف إضافي."}
        </div>
      )}
    </div>
  );
};


const goalOptions = [
  { value: 'اكاديمية', label: 'اكاديمية', icon: <Info size={18} /> },
  { value: 'البيع', label: 'بيع خدمة', icon: <ShoppingCart size={18} /> },
  { value: 'مدونة', label: 'مدونة', icon: <BookOpen size={18} /> },
  { value: 'برنامج سياحي', label: 'برنامج سياحي', icon: <Map size={18} /> },
  { value: 'مقارنة', label: 'مقارنة', icon: <GitCompare size={18} /> },
];

interface GoalTabProps {
  structureAnalysis: StructureAnalysis;
  highlightedItem: string | any[] | null;
  onHighlightStructureItem: (item: CheckResult) => void;
  aiGoal: string;
  setAiGoal: React.Dispatch<React.SetStateAction<string>>;
}

const GoalTab: React.FC<GoalTabProps> = ({
  structureAnalysis,
  highlightedItem,
  onHighlightStructureItem,
  aiGoal,
  setAiGoal,
}) => {
  const [isGoalOpen, setIsGoalOpen] = React.useState(false);
  const selectedGoal = goalOptions.find(opt => opt.value === aiGoal) || goalOptions[0];
  
  const touristProgramChecks = [
      structureAnalysis.firstTitle,
      structureAnalysis.secondTitle,
      structureAnalysis.includesExcludes,
      structureAnalysis.preTravelH2,
      structureAnalysis.pricingH2,
      structureAnalysis.whoIsItForH2,
  ].filter(check => check && check.current !== 'غير مطبق');

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-[#2A2A2A] rounded-xl shadow-sm border dark:border-[#3C3C3C] p-4 space-y-4 transition-all duration-300 border-gray-200 dark:border-transparent">
        <div>
            <label htmlFor="ai-goal-button" className="block text-sm font-semibold text-[#333333] dark:text-[#C7C7C7] mb-2">
                الهدف
            </label>
            <div className="relative">
                <button
                    id="ai-goal-button"
                    type="button"
                    className="relative w-full cursor-pointer rounded-md border border-gray-300 dark:border-[#3C3C3C] bg-white dark:bg-[#1F1F1F] py-2 pl-3 pr-10 text-right shadow-sm focus:border-[#00778e] focus:outline-none focus:ring-1 focus:ring-[#00778e] sm:text-sm"
                    aria-haspopup="listbox"
                    aria-expanded={isGoalOpen}
                    onClick={() => setIsGoalOpen(!isGoalOpen)}
                >
                    <span className="flex items-center gap-3">
                        <span className="text-[#00778e] dark:text-[#66b2ff]">{selectedGoal.icon}</span>
                        <span className="block truncate text-[#333333] dark:text-[#e0e0e0]">{selectedGoal.label}</span>
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pr-2">
                    <ChevronDown className={`h-5 w-5 text-gray-400 transform transition-transform ${isGoalOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </span>
                </button>

                {isGoalOpen && (
                    <ul
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-[#3C3C3C] py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                    tabIndex={-1}
                    role="listbox"
                    aria-labelledby="ai-goal-button"
                    >
                    {goalOptions.map((option) => (
                        <li
                        key={option.value}
                        className="group relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A]"
                        role="option"
                        aria-selected={option.value === aiGoal}
                        onClick={() => {
                            setAiGoal(option.value);
                            setIsGoalOpen(false);
                        }}
                        >
                        <div className="flex items-center gap-3">
                            <span className="text-[#00778e] dark:text-[#66b2ff] group-hover:text-[#005f73] dark:group-hover:text-[#94d2bd]">{option.icon}</span>
                            <span className={`block truncate ${option.value === aiGoal ? 'font-semibold' : 'font-normal'}`}>{option.label}</span>
                        </div>
                        </li>
                    ))}
                    </ul>
                )}
            </div>
        </div>

        {aiGoal === 'برنامج سياحي' && touristProgramChecks.length > 0 && (
            <div className="space-y-3 border-t border-gray-200 dark:border-[#3C3C3C] pt-4">
                {touristProgramChecks.map(check => (
                    <GoalConditionCard
                        key={check.title}
                        item={check}
                        onClick={() => onHighlightStructureItem(check)}
                        isHighlighted={highlightedItem === check.title}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default GoalTab;
