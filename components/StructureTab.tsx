

import React, { useEffect, useCallback, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { StructureAnalysis, CheckResult, AnalysisStatus, StructureStats } from '../types';
import { Pilcrow, Heading, AlertCircle as AlertCircleIcon, Star, LayoutTemplate, ListTree, SpellCheck, MousePointerClick, Flag, X, ShieldAlert, LayoutGrid, List } from 'lucide-react';
import { CTA_WORDS, INTERACTIVE_WORDS, WARNING_ADVICE_WORDS, TRANSITIONAL_WORDS, SLOW_WORDS, SECONDARY_COLORS } from '../constants';

// NEW: Modal component for displaying rule details.
const InfoModal: React.FC<{ item: CheckResult; onClose: () => void }> = ({ item, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white dark:bg-[#2A2A2A] rounded-lg shadow-xl w-full max-w-lg p-6 border dark:border-[#3C3C3C]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 dark:border-[#3C3C3C]">
          <h3 className="text-xl font-bold text-[#333333] dark:text-gray-100">{item.title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#3C3C3C]" aria-label="إغلاق">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="space-y-4 text-gray-600 dark:text-gray-300 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {item.description && <p>{item.description}</p>}
          {item.details && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#3C3C3C]">
              <h4 className="font-semibold text-[#333333] dark:text-gray-200 mb-2">الشروط المتاحة:</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1F1F1F] p-3 rounded-md break-words">{item.details}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// NEW: Helper function to generate a very short summary for the hover tooltip.
const getConciseSummary = (item: CheckResult): string => {
  switch (item.title) {
    case 'عدد الكلمات': return typeof item.required === 'string' && item.required.startsWith('>') ? `${item.required} كلمة` : 'يعتمد على الهدف';
    case 'العنوان الاول': return '150-200 كلمة';
    case 'عنوان مستوى ثاني الثاني': return 'أول عنوان مستوى ثاني يتضمن "أيام"/"ليالي" و 2+ عناوين مستوى ثالث تحته';
    case 'يشمل/لايشمل': return `عنوان مستوى ثاني يتضمن "يشمل" وتحته عناوين مستوى ثالث بالشروط`;
    case 'عنوان مستوى ثاني قبل السفر': return 'عنوان مستوى ثاني يتضمن "معلومات" أو "قبل السفر" | 150-180 كلمة';
    case 'عنوان مستوى ثاني سعر وحجز': return 'عنوان مستوى ثاني يتضمن "سعر" أو "حجز" | 150-180 كلمة';
    case 'قسم لمن مناسب': return 'عنوان مستوى ثاني يتضمن "مناسب" أو "مرشح" أو "يناسب"';
    case 'الفقرة التلخيصية': return '30-60 كلمة | 2-4 جمل';
    case 'الفقرة الثانية': return '30-60 كلمة | 2-3 جمل';
    case 'طول الفقرات': return '40-80 كلمة | 2-4 جمل';
    case 'قسم H2': return 'اتبع القواعد المعتمدة على عدد الكلمات';
    case 'عدد H2': return `الحالي: ${item.current} | المطلوب: ${item.required}`;
    case 'قسم H3': return '35-70 كلمة | 2-4 جمل';
    case 'قسم H4': return '20-60 كلمة | 1 فقرة';
    case 'بين H2-H3': return '1-2 فقرة (40-120 كلمة)';
    case 'الأسئلة والاجوبة': return 'عنوان مستوى ثاني يتضمن "أسئلة", "FAQs"';
    case 'فقرة الأجوبة': return `الحالي: ${item.current} | المطلوب: ${item.required}`;
    case 'عناوين مبهمة': return 'لا تستخدم كلمات الإشارة أو الضمائر في H2';
    case 'علامات الترقيم': return 'الحالي: إنتهاء خاطئ | المطلوب: يجب الانتهاء ب (. ؟ ! :)';
    case 'نهايات الفقرات': return 'لا تكرار لآخر كلمة';
    case 'عناوين H2 استفهامية': return '> 3 عناوين استفهامية';
    case 'كلمات إنتقالية': return '> 30% من الجمل';
    case 'تكرار بالفقرة': return 'لا تكرار للكلمات';
    case 'تكرار بالعنوان': return 'لا تكرار للكلمات';
    case 'طول الجمل': return '< 25 كلمة/جملة';
    case 'تمهيد خطوات': return `الحالي: ${item.current} | المطلوب: ${item.required}`;
    case 'التعداد الآلي': return 'استخدم قائمة نقطية/رقمية';
    case 'كلمات الحث': return '> 1 كلمة حث';
    case '0.02% لغة تفاعلية': return '> 0.02% تفاعلية';
    case 'كلمات لاتينية': return '< 0.5% (باستثناء الكلمة المفتاحية)';
    case 'عنوان الخاتمة': return 'آخر عنوان مستوى ثاني هو "الخاتمة"';
    case 'فقرة الخاتمة': return 'تبدأ بكلمة ختامية';
    case 'طول الخاتمة': return '50-100 كلمة';
    case 'أرقام بالخاتمة': return 'تحتوي على رقم';
    case 'قائمة الخاتمة': return 'تحتوي على قائمة';
    case 'بدايات الجمل': return 'لا تكرار لأول كلمة';
    case 'كلمات تحذيرية': return '> 1 كلمة تحذيرية';
    case 'الفراغات': return 'مسافات صحيحة';
    case 'ثنائيات مكررة': return '< 2 تكرار للعبارات الشائعة';
    case 'كلمات بطيئة': return '< 2% من إجمالي النص';
    case 'تناسق الكلمات': return 'كتابة الكلمات بنفس الطريقة دائماً';
    default: return typeof item.required === 'string' ? item.required : String(item.required);
  }
};


const ChecklistItem: React.FC<{ item: CheckResult; onClick?: () => void; isHighlighted?: boolean; onInfoClick: (item: CheckResult) => void; }> = ({ item, onClick, isHighlighted, onInfoClick }) => {
  // Cap progress between 0 and 1
  const progress = Math.max(0, Math.min(item.progress || 0, 1));
  const hasViolatingItems = item.violatingItems && item.violatingItems.length > 0;
  const conciseSummary = getConciseSummary(item);

  return (
    <div
      className={`group relative rounded-lg transition-all duration-200 cursor-pointer bg-white hover:bg-gray-50 dark:bg-[#2A2A2A] dark:hover:bg-[#3C3C3C] h-14 flex flex-col justify-between`}
      onClick={onClick}
    >
      {/* NEW: Hover Tooltip for quick summary */}
      <div className="absolute -top-9 right-1/2 translate-x-1/2 w-max max-w-xs bg-gray-900 text-white text-xs rounded-md py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 whitespace-nowrap">
        {conciseSummary}
        <div className="absolute top-full right-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
      </div>

      {/* Highlight Indicator */}
      {isHighlighted && (
        <div className="absolute top-0 right-0 w-8 h-8" aria-hidden="true">
          <div className={`absolute inset-0 ${item.status === 'fail' ? 'bg-[#810701]' : 'bg-[#00778E]'} [clip-path:polygon(0_0,100%_0,100%_100%)] rounded-tr-lg`}></div>
          <Star size={10} className="absolute top-1.5 right-1.5 text-white" fill="white" />
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-between px-4">
          <h4 className="font-bold text-sm text-gray-600 dark:text-[#8d8d8d]">{item.title}</h4>
          <div className="flex items-center gap-2">
            {hasViolatingItems && item.status === 'fail' && item.title !== 'عدد H2' ? (
              <span 
                className="text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full"
                style={{ backgroundColor: '#810701' }}
              >
                  {item.violatingItems!.length}
              </span>
            ) : item.status !== 'pass' && !hasViolatingItems ? (
              <span className={`text-xs font-bold ${item.status === 'fail' ? 'text-red-600 dark:text-red-500' : 'text-yellow-500 dark:text-yellow-400'}`}>
                {item.current}
              </span>
            ) : null}
              <button 
                  onClick={(e) => {
                      e.stopPropagation(); // Prevent card click when opening modal
                      onInfoClick(item);
                  }}
                  className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3C3C3C]/50"
                  aria-label="عرض التفاصيل"
              >
                  <AlertCircleIcon size={16} />
              </button>
          </div>
      </div>
      

      {/* Progress Bar Container */}
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
                ? '#F59E0B' // amber-500
                : '#00778e',
          }}
        ></div>
      </div>
    </div>
  );
};

const ChecklistItemList: React.FC<{ item: CheckResult; onClick?: () => void; isHighlighted?: boolean; onInfoClick: (item: CheckResult) => void; }> = ({ item, onClick, isHighlighted, onInfoClick }) => {
  const statusColor = item.status === 'fail' ? 'bg-red-500' : item.status === 'warn' ? 'bg-yellow-500' : 'bg-green-500';
  const hasViolatingItems = item.violatingItems && item.violatingItems.length > 0;
  
  return (
    <div
      onClick={onClick}
      title={getConciseSummary(item)}
      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all ${isHighlighted ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-[#3C3C3C]'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`}></span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{item.title}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {hasViolatingItems && item.status === 'fail' ? (
          <span className="text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full bg-red-600">{item.violatingItems!.length}</span>
        ) : item.status !== 'pass' && !hasViolatingItems ? (
          <span className={`text-xs font-bold ${item.status === 'fail' ? 'text-red-600 dark:text-red-500' : 'text-yellow-500 dark:text-yellow-400'}`}>
            {item.current}
          </span>
        ) : null}
        <button
          onClick={(e) => { e.stopPropagation(); onInfoClick(item); }}
          className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-[#4A4A4A]"
          aria-label="عرض التفاصيل"
        >
          <AlertCircleIcon size={16} />
        </button>
      </div>
    </div>
  );
};

interface StructureTabProps {
  analysis: StructureAnalysis;
  stats: StructureStats;
  editor: Editor | null;
  clearAllHighlights: () => void;
  applyHighlights: (highlights: { text: string; color: string }[], scrollToFirst?: boolean) => void;
  highlightedItem: string | any[] | null;
  setHighlightedItem: React.Dispatch<React.SetStateAction<string | any[] | null>>;
  highlightStyle: 'background' | 'underline';
  viewMode: 'grid' | 'list';
}

const StatDisplay: React.FC<{ icon: React.ReactNode; value: number; label: string }> = ({ icon, value, label }) => (
  <div title={label} className="flex-1 flex items-center justify-center gap-3 p-2 cursor-help">
    <div className="p-2 bg-[#00778e]/10 dark:bg-[#00778e]/20 text-[#00778e] rounded-full">
      {icon}
    </div>
    <div className="text-right">
      <div className="text-xl font-bold text-[#333333] dark:text-[#b7b7b7]">{value}</div>
    </div>
  </div>
);


const usePrevious = <T,>(value: T): T | undefined => {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
};

const specialHighlightItems: { [key: string]: string[] } = {
    'كلمات الحث': CTA_WORDS,
    '0.02% لغة تفاعلية': INTERACTIVE_WORDS,
    'كلمات تحذيرية': WARNING_ADVICE_WORDS,
    'كلمات إنتقالية': TRANSITIONAL_WORDS,
    'كلمات بطيئة': SLOW_WORDS,
};

const StructureTab: React.FC<StructureTabProps> = ({ analysis, stats, editor, clearAllHighlights, applyHighlights, highlightedItem, setHighlightedItem, highlightStyle, viewMode }) => {
    const [modalContent, setModalContent] = useState<CheckResult | null>(null);
    const prevAnalysis = usePrevious(analysis);
    const justClicked = useRef(false);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setModalContent(null);
            }
        };

        if (modalContent) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [modalContent]);

    const applyStructureHighlights = useCallback((item: CheckResult, color?: string) => {
        if (!editor) return;
        const highlightMarkType = editor.schema.marks.highlight;
        if (!highlightMarkType) return;
    
        const highlightColor = color || (
            item.status === 'warn' ? '#fda4af'
            : item.status === 'fail' ? '#fda4af'
            : '#bae6fd' // blue for info/pass with highlights
        );
    
        const { tr } = editor.state;
        tr.removeMark(0, editor.state.doc.content.size, highlightMarkType);
    
        if (item.violatingItems && item.violatingItems.length > 0) {
            item.violatingItems.forEach(violation => {
                 const highlightMark = (highlightMarkType as any).create({
                    color: highlightColor,
                    violation: item.title,
                    from: violation.from,
                    highlightStyle: highlightStyle,
                    isViolation: true,
                });
                tr.addMark(violation.sectionFrom ?? violation.from, violation.sectionTo ?? violation.to, highlightMark);
            });
        }
        
        if (tr.steps.length > 0) {
            tr.setMeta('preventAutoremoveHighlight', true);
            editor.view.dispatch(tr);
        }
    }, [editor, highlightStyle]);
    
    const applyWordListHighlights = useCallback((item: CheckResult, words: string[]) => {
        if (!editor) return;
    
        const { tr } = editor.state;
        const highlightMarkType = editor.schema.marks.highlight;
        tr.removeMark(0, editor.state.doc.content.size, highlightMarkType);
    
        const processWord = (word: string, color?: string) => {
            const searchWord = word.trim();
            if (!searchWord) return;
    
            const escapedWord = searchWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(?<!\\p{L})${escapedWord}(?!\\p{L})`, 'gu');
    
            editor.state.doc.descendants((node, pos) => {
                if (node.isText && node.text) {
                    let match;
                    while ((match = regex.exec(node.text)) !== null) {
                        const from = pos + match.index;
                        const to = from + match[0].length;
                        
                        let highlightMark;
                        if (highlightStyle === 'underline') {
                            const isAnActualViolation = item.status === 'fail' || item.status === 'warn';
                            highlightMark = (highlightMarkType as any).create({
                                violation: item.title,
                                from: from,
                                highlightStyle: 'underline',
                                isViolation: isAnActualViolation,
                            });
                        } else {
                            highlightMark = (highlightMarkType as any).create({ 
                                color: color || '#bae6fd',
                                highlightStyle: 'background'
                            });
                        }
                        tr.addMark(from, to, highlightMark);
                    }
                }
            });
        };
    
        if (highlightStyle === 'underline') {
            words.forEach(word => processWord(word));
        } else { // 'background' style
            const highlights = words.map(word => ({ text: word, color: '#bae6fd' }));
            highlights.forEach(({ text, color }) => processWord(text, color));
        }
    
        if (tr.steps.length > 0) {
            tr.setMeta('preventAutoremoveHighlight', true);
            editor.view.dispatch(tr);
        }
    }, [editor, highlightStyle]);


    const applyGroupedMultiColorHighlight = useCallback((item: CheckResult, groupKeyExtractor: (message: string) => string | null) => {
        if (!editor || !item.violatingItems) return;

        const { tr } = editor.state;
        const highlightMarkType = editor.schema.marks.highlight;
        tr.removeMark(0, editor.state.doc.content.size, highlightMarkType);

        const violationsByGroup = new Map<string, { from: number; to: number }[]>();
        item.violatingItems.forEach(violation => {
            const groupKey = groupKeyExtractor(violation.message);
            if (groupKey) {
                if (!violationsByGroup.has(groupKey)) {
                    violationsByGroup.set(groupKey, []);
                }
                violationsByGroup.get(groupKey)!.push({ from: violation.from, to: violation.to });
            }
        });

        const colors = SECONDARY_COLORS;
        let colorIndex = 0;

        violationsByGroup.forEach((locations) => {
            const color = colors[colorIndex % colors.length];
            const isViolationMark = item.status === 'fail' || item.status === 'warn';

            locations.forEach(({ from, to }) => {
                let highlightMark;
                if (highlightStyle === 'underline') {
                    highlightMark = (highlightMarkType as any).create({
                        violation: item.title,
                        from: from,
                        highlightStyle: 'underline',
                        isViolation: isViolationMark,
                    });
                } else { // background
                     highlightMark = (highlightMarkType as any).create({ 
                        color: color,
                        highlightStyle: 'background',
                        violation: item.title,
                    });
                }
                tr.addMark(from, to, highlightMark);
            });
            colorIndex++;
        });

        if (tr.steps.length > 0) {
            tr.setMeta('preventAutoremoveHighlight', true);
            editor.view.dispatch(tr);
        }
    }, [editor, highlightStyle]);


    const handleItemClick = useCallback((item: CheckResult) => {
        if (!editor) return;
    
        const isCurrentlyHighlighted = typeof highlightedItem === 'string' && highlightedItem === item.title;
    
        if (isCurrentlyHighlighted) {
            clearAllHighlights();
            return;
        }
    
        // Handle special word-list highlighting
        if (specialHighlightItems[item.title]) {
            const words = specialHighlightItems[item.title];
            applyWordListHighlights(item, words);
            justClicked.current = true;
            setHighlightedItem(item.title);
            return;
        }
        
        // Handle grouped multi-color highlighting
        const groupedHighlightChecks: { [key: string]: (msg: string) => string | null } = {
            'ثنائيات مكررة': (msg) => {
                const match = msg.match(/العبارة المكررة: (.*)/);
                return match ? match[1] : null;
            },
            'تناسق الكلمات': (msg) => {
                const match = msg.match(/تناقض: (.*)/);
                return match ? match[1] : null;
            },
        };

        if (groupedHighlightChecks[item.title]) {
            if (item.violatingItems && item.violatingItems.length > 0) {
                applyGroupedMultiColorHighlight(item, groupedHighlightChecks[item.title]);
                justClicked.current = true;
                setHighlightedItem(item.title);
                 setTimeout(() => {
                    if (!editor || editor.isDestroyed) return;
                    const firstViolation = item.violatingItems![0];
                    if (firstViolation) {
                        (editor.chain() as any)
                            .focus()
                            .setTextSelection(firstViolation.from)
                            .scrollIntoView()
                            .run();
                    }
                }, 50);
            } else {
                clearAllHighlights();
            }
            return;
        }
    
        // Determine if we should highlight this item on click
        let shouldHighlight = false;
        if (['عدد H2', 'كلمات لاتينية'].includes(item.title)) {
            // For these items, we highlight as long as there's something to show (even on warn or pass)
            shouldHighlight = !!(item.violatingItems && item.violatingItems.length > 0);
        } else {
            // For all other items, we only highlight if status is warn or fail
            shouldHighlight = (item.status === 'fail' || item.status === 'warn') && !!(item.violatingItems && item.violatingItems.length > 0);
        }
    
        if (shouldHighlight) {
            let customColor;
            if (item.title === 'عدد H2' && item.status !== 'fail') {
                // Force blue color for H2 count if it's not failing, to indicate informational highlight
                customColor = '#bae6fd';
            }
    
            applyStructureHighlights(item, customColor);
            justClicked.current = true;
            setHighlightedItem(item.title);
            
            setTimeout(() => {
                if (!editor || editor.isDestroyed) return;
                const firstViolation = item.violatingItems![0];
                if (firstViolation) {
                    (editor.chain() as any)
                        .focus()
                        .setTextSelection(firstViolation.from)
                        .scrollIntoView()
                        .run();
                }
            }, 50);
        } else {
            clearAllHighlights();
        }
    }, [editor, highlightedItem, clearAllHighlights, applyStructureHighlights, setHighlightedItem, applyGroupedMultiColorHighlight, applyWordListHighlights]);

    useEffect(() => {
        if (justClicked.current) {
            justClicked.current = false;
            return;
        }

        if (typeof highlightedItem !== 'string' || !editor || !prevAnalysis) return;

        // Handle re-highlighting for special items on content change
        if (specialHighlightItems[highlightedItem]) {
            const currentItemState = Object.values(analysis).find(item => (item as CheckResult).title === highlightedItem) as CheckResult;
            if (currentItemState) {
                const words = specialHighlightItems[highlightedItem];
                setTimeout(() => {
                    if (editor && !editor.isDestroyed) {
                        applyWordListHighlights(currentItemState, words);
                    }
                }, 0);
            }
            return;
        }


        const analysisItems = Object.values(analysis) as CheckResult[];
        const prevAnalysisItems = Object.values(prevAnalysis) as CheckResult[];

        const structureTitles = new Set(analysisItems.map(item => item.title));
        if (!structureTitles.has(highlightedItem)) return;

        const currentItemState = analysisItems.find(item => item.title === highlightedItem);
        const prevItemState = prevAnalysisItems.find(item => item.title === highlightedItem);

        if (!currentItemState || !prevItemState) {
            clearAllHighlights();
            return;
        }
    
        const currentViolations = currentItemState.violatingItems || [];
        const prevViolations = prevItemState.violatingItems || [];
        
        if (currentItemState.status === 'pass' || currentViolations.length < prevViolations.length) {
            setTimeout(() => {
                if (editor && !editor.isDestroyed) {
                    if (currentViolations.length > 0) {
                        if (currentItemState.title === 'ثنائيات مكررة') {
                            applyGroupedMultiColorHighlight(currentItemState, (msg) => {
                                const match = msg.match(/العبارة المكررة: (.*)/);
                                return match ? match[1] : null;
                            });
                        } else if (currentItemState.title === 'تناسق الكلمات') {
                             applyGroupedMultiColorHighlight(currentItemState, (msg) => {
                                const match = msg.match(/تناقض: (.*)/);
                                return match ? match[1] : null;
                            });
                        } else {
                            applyStructureHighlights(currentItemState);
                        }
                    } else {
                        clearAllHighlights();
                    }
                }
            }, 0);
        }
    }, [analysis, prevAnalysis, highlightedItem, editor, applyStructureHighlights, clearAllHighlights, applyGroupedMultiColorHighlight, applyWordListHighlights]);


    const analysisGroups = {
        'البنية الأساسية': [analysis.wordCount, analysis.summaryParagraph, analysis.secondParagraph, analysis.paragraphLength, analysis.sentenceLength, analysis.stepsIntroduction],
        'العناوين والتسلسل': [analysis.h2Structure, analysis.h2Count, analysis.h3Structure, analysis.h4Structure, analysis.betweenH2H3, analysis.faqSection, analysis.answerParagraph, analysis.ambiguousHeadings],
        'الجودة اللغوية': [analysis.punctuation, analysis.paragraphEndings, analysis.interrogativeH2, analysis.duplicateWordsInParagraph, analysis.duplicateWordsInHeading, analysis.sentenceBeginnings, analysis.arabicOnly, analysis.spacing, analysis.repeatedBigrams, analysis.wordConsistency],
        'التفاعلية والتحفيز': [analysis.ctaWords, analysis.interactiveLanguage, analysis.warningWords, analysis.automaticLists, analysis.differentTransitionalWords, analysis.slowWords],
        'الخاتمة': [analysis.lastH2IsConclusion, analysis.conclusionParagraph, analysis.conclusionWordCount, analysis.conclusionHasNumber, analysis.conclusionHasList],
    };
    
    const groupIcons: { [key: string]: React.ReactNode } = {
        'البنية الأساسية': <LayoutTemplate size={18} className="text-[#00778e]" />,
        'العناوين والتسلسل': <ListTree size={18} className="text-[#00778e]" />,
        'الجودة اللغوية': <SpellCheck size={18} className="text-[#00778e]" />,
        'التفاعلية والتحفيز': <MousePointerClick size={18} className="text-[#00778e]" />,
        'الخاتمة': <Flag size={18} className="text-[#00778e]" />,
    };

  return (
    <div className="p-2 space-y-4">
      {modalContent && <InfoModal item={modalContent} onClose={() => setModalContent(null)} />}

      <div className="p-2">
        <div className="flex bg-white dark:bg-gradient-to-r from-[#2A2A2A] via-[#222222] to-[#1F1F1F] rounded-lg border border-gray-200 dark:border-[#3C3C3C]">
          <StatDisplay icon={<AlertCircleIcon size={20} />} value={stats.violatingCriteriaCount} label="معايير مخالفة" />
          <StatDisplay icon={<ShieldAlert size={20} />} value={stats.totalErrorsCount} label="إجمالي الأخطاء" />
          <StatDisplay icon={<Pilcrow size={20} />} value={stats.paragraphCount} label="فقرة" />
          <StatDisplay icon={<Heading size={20} />} value={stats.headingCount} label="عنوان" />
        </div>
      </div>

      {Object.entries(analysisGroups).map(([groupTitle, items]) => (
        <div key={groupTitle}>
          <h3 className="flex items-center justify-center gap-3 text-lg font-bold p-2 text-[#333333] dark:text-[#C7C7C7] bg-[#F2F3F5] dark:bg-[#2A2A2A] rounded-t-md">
            {groupIcons[groupTitle]}
            <span>{groupTitle}</span>
          </h3>
          <div className="p-3 bg-white dark:bg-[#1F1F1F] border border-t-0 border-gray-200 dark:border-[#3C3C3C] rounded-b-md">
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.filter(item => item && item.current !== 'غير مطبق').map((item) => (
                        <ChecklistItem 
                        key={item.title} 
                        item={item}
                        isHighlighted={highlightedItem === item.title}
                        onClick={() => handleItemClick(item)}
                        onInfoClick={setModalContent}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-1">
                    {items.filter(item => item && item.current !== 'غير مطبق').map((item) => (
                        <ChecklistItemList
                            key={item.title}
                            item={item}
                            isHighlighted={highlightedItem === item.title}
                            onClick={() => handleItemClick(item)}
                            onInfoClick={setModalContent}
                        />
                    ))}
                </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StructureTab;