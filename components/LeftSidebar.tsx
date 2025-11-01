import React from 'react';
import type { Editor } from '@tiptap/core';
import type { Keywords, KeywordAnalysis, AnalysisStatus, KeywordStats, DuplicateAnalysis, DuplicateStats } from '../types';
import { Copy, CheckCircle, XCircle, AlertCircle, Users, ListChecks, X, Eye, Trash2, KeyRound, Repeat, LayoutGrid, ListTree, Plus } from 'lucide-react';
import DuplicatesTab from './DuplicatesTab';
import { SECONDARY_COLORS } from '../constants';

const getProgressBarColor = (status: AnalysisStatus) => {
    switch (status) {
        case 'pass': return '#00778e';
        case 'warn': return '#F59E0B';
        case 'fail': return '#810701';
        default: return '#6B7280';
    }
};

const StatDisplay: React.FC<{ icon: React.ReactNode; value: number | string; label: string }> = ({ icon, value, label }) => (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 p-2 text-center" title={label}>
      <div className="p-2 bg-[#00778e]/10 dark:bg-[#00778e]/20 text-[#00778e] rounded-full">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold text-[#b7b7b7]">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{label}</div>
      </div>
    </div>
  );

const ModernProgressBar: React.FC<{ analysis: KeywordStats, isCompact?: boolean }> = ({ analysis, isCompact = false }) => {
    if (!analysis) return null;
    const progress = analysis.requiredCount[1] > 0 ? Math.min((analysis.count / analysis.requiredCount[1]) * 100, 100) : 0;
    const color = getProgressBarColor(analysis.status);
    const getStatusTextColor = (status: AnalysisStatus) => {
        switch (status) {
            case 'pass': return 'text-green-600 dark:text-green-500';
            case 'warn': return 'text-yellow-500 dark:text-yellow-400';
            case 'fail': return 'text-red-600 dark:text-red-500';
            default: return 'text-gray-700 dark:text-gray-300';
        }
    };
    const textColor = getStatusTextColor(analysis.status);

    return (
        <div className={isCompact ? 'space-y-1' : 'space-y-2'}>
            <div className={`flex justify-between items-center ${isCompact ? 'text-xs' : 'text-sm'}`}>
                <span className="font-semibold text-gray-600 dark:text-gray-300">المطلوب: {analysis.requiredCount[0]}-{analysis.requiredCount[1]}</span>
                <span className={`font-bold ${textColor}`}>الحالي: {analysis.count}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-[#1F1F1F] overflow-hidden">
                <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: color }}
                ></div>
            </div>
        </div>
    );
};

const ModernSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; onClick?: () => void; }> = ({ icon, title, children, onClick }) => (
    <div 
        className={`bg-white dark:bg-[#2A2A2A] rounded-xl shadow-sm border border-gray-300 dark:border-[#3C3C3C] p-4 transition-all duration-200 ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3C3C3C]' : ''}`}
        onClick={onClick}
    >
        <h3 className="flex items-center gap-2 text-md font-bold text-[#333333] dark:text-[#C7C7C7] mb-3">
            {icon}
            <span>{title}</span>
        </h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);


const RadialProgress: React.FC<{ percentage: number; color: string; status: AnalysisStatus }> = ({ percentage, color, status }) => {
    const radius = 30;
    const stroke = 5;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const count = Math.round(percentage);
    let textColor = 'text-gray-700 dark:text-gray-200';
    if (status === 'fail') textColor = 'text-red-600 dark:text-red-500';
    if (status === 'warn') textColor = 'text-yellow-500 dark:text-yellow-400';
    if (status === 'pass') textColor = 'text-green-600 dark:text-green-500';

    return (
      <div className="relative flex items-center justify-center w-20 h-20">
        <svg height="80" width="80" className="-rotate-90">
          <circle
            stroke="#e5e7eb"
            className="dark:stroke-[#3C3C3C]"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div 
          className={`absolute top-1/2 left-1/2 flex items-baseline ${textColor}`} 
          style={{ transform: 'translate(-72%, -43.5%)' }}
        >
          <span className="text-xs font-bold">%</span>
          <span className="text-lg font-bold">{count}</span>
        </div>
      </div>
    );
};

const AdvancedKeywordCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  analysis: KeywordStats;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ title, icon, analysis, children, actions, onClick }) => {
  if (!analysis) return null;
  
  const percentage = analysis.requiredCount[1] > 0 ? (analysis.count / analysis.requiredCount[1]) * 100 : 0;
  const color = getProgressBarColor(analysis.status);

  const getStatusTextColor = (status: AnalysisStatus) => {
    switch (status) {
        case 'pass': return 'text-green-600 dark:text-green-500';
        case 'warn': return 'text-yellow-500 dark:text-yellow-400';
        case 'fail': return 'text-red-600 dark:text-red-500';
        default: return 'text-gray-700 dark:text-gray-300';
    }
  };
  const textColor = getStatusTextColor(analysis.status);

  return (
    <div 
      className={`bg-white dark:bg-[#2A2A2A] rounded-xl p-4 space-y-4 transition-all duration-300 border border-gray-300 dark:border-[#3C3C3C] ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3C3C3C]' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-grow space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-[#00778e]">{icon}</span>
                <h4 className="text-md font-bold text-[#333333] dark:text-[#C7C7C7]">{title}</h4>
            </div>
             <div className="space-y-1 pr-1">
                <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-600 dark:text-gray-300">المطلوب: {analysis.requiredCount[0]}-{analysis.requiredCount[1]}</span>
                    <span className={`font-bold ${textColor}`}>الحالي: {analysis.count}</span>
                </div>
                 <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{(analysis.requiredPercentage[0] * 100).toFixed(1)}%-{(analysis.requiredPercentage[1] * 100).toFixed(1)}%</span>
                    <span className={textColor}>{(analysis.percentage * 100).toFixed(1)}%</span>
                </div>
            </div>
        </div>
        <div className="flex flex-col items-center gap-2">
            <RadialProgress percentage={percentage} color={color} status={analysis.status} />
            {actions}
        </div>
      </div>
      
      {children}
    </div>
  );
};

const KeywordInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  onHighlight: () => void;
  isHighlighted: boolean;
  onRemove?: () => void;
  className?: string;
}> = ({ value, onChange, placeholder, onHighlight, isHighlighted, onRemove, className }) => (
  <div
    className="relative group cursor-pointer w-full"
    onClick={onHighlight}
  >
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className={`w-full p-2 pr-4 text-right bg-gray-50 dark:bg-[#1F1F1F] rounded-md border border-gray-300 dark:border-[#3C3C3C] focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-base text-[#333333] dark:text-[#e0e0e0] ${isHighlighted ? 'ring-2 ring-offset-1 dark:ring-offset-[#181818] ring-[#00778e]' : ''} ${className}`}
    />
    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center">
        {onRemove && (
            <button
                onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }}
                className="p-1 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400"
                title="إزالة"
            >
                <Trash2 size={16} />
            </button>
        )}
    </div>
  </div>
);


const LeftSidebar: React.FC<{
  keywords: Keywords;
  setKeywords: React.Dispatch<React.SetStateAction<Keywords>>;
  keywordAnalysis: KeywordAnalysis;
  applyHighlights: (highlights: { text: string; color: string }[], scrollToFirst?: boolean) => void;
  clearAllHighlights: () => void;
  highlightedItem: string | any[] | null;
  setHighlightedItem: React.Dispatch<React.SetStateAction<string | any[] | null>>;
  duplicateAnalysis: DuplicateAnalysis;
  duplicateStats: DuplicateStats;
  editor: Editor | null;
  keywordViewMode: 'classic' | 'modern';
}> = ({ 
    keywords, 
    setKeywords, 
    keywordAnalysis, 
    applyHighlights, 
    clearAllHighlights, 
    highlightedItem, 
    setHighlightedItem, 
    duplicateAnalysis,
    duplicateStats,
    editor,
    keywordViewMode,
}) => {
  const [activeTab, setActiveTab] = React.useState<'keywords' | 'duplicates'>('keywords');
  const [lsiInputValue, setLsiInputValue] = React.useState('');
  const [autoDistributeText, setAutoDistributeText] = React.useState('');

  const getTabClass = (tabName: 'keywords' | 'duplicates') => {
    const isActive = activeTab === tabName;
    return `flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
      isActive
        ? 'border-[#00778e] text-[#00778e] dark:text-white'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
    }`;
  };
  
  const handleHighlightToggle = (term: string, type: 'primary' | 'company') => {
    if (!term) {
        clearAllHighlights();
        return;
    }
    
    if (highlightedItem === term) {
      clearAllHighlights();
    } else {
      let color: string;
      switch (type) {
        case 'primary':
          color = '#a7f3d0';
          break;
        case 'company':
          color = '#bae6fd';
          break;
      }
      applyHighlights([{ text: term, color: color }]);
      setHighlightedItem(term);
    }
  };

  const handleSecondaryHighlightToggle = (term: string, index: number) => {
    if (!term.trim()) {
        clearAllHighlights();
        return;
    }
    if (highlightedItem === term) {
        clearAllHighlights();
    } else {
        const color = SECONDARY_COLORS[index % SECONDARY_COLORS.length];
        applyHighlights([{ text: term, color: color }], true);
        setHighlightedItem(term);
    }
  };

  const handleToggleAllSecondariesHighlight = () => {
    const HIGHLIGHT_ID = '__ALL_SECONDARIES__';
    const activeSecondaries = keywords.secondaries.filter(s => s.trim() !== '');
    
    if (activeSecondaries.length === 0) {
        clearAllHighlights();
        return;
    }

    if (highlightedItem === HIGHLIGHT_ID) {
      clearAllHighlights();
    } else {
      const highlights = keywords.secondaries
        .map((term, index) => ({ term, index }))
        .filter(({ term }) => term.trim() !== '')
        .map(({ term, index }) => ({
            text: term,
            color: SECONDARY_COLORS[index % SECONDARY_COLORS.length],
        }));
      applyHighlights(highlights, false);
      setHighlightedItem(HIGHLIGHT_ID);
    }
  };

  const enteredSynonymsCount = keywords.secondaries.filter(s => s.trim() !== '').length;
  let totalConditions = 0;
  let violatingConditions = 0;

  if (keywords.primary.trim()) {
      const primaryChecks = keywordAnalysis.primary.checks;
      totalConditions += 1 + primaryChecks.length;
      if (keywordAnalysis.primary.status === 'fail') {
          violatingConditions++;
      }
      violatingConditions += primaryChecks.filter(c => !c.isMet).length;
  }

  if (enteredSynonymsCount > 0) {
      totalConditions += 1;
      if (keywordAnalysis.secondariesDistribution.status === 'fail') {
          violatingConditions++;
      }

      keywords.secondaries.forEach((s, i) => {
          if (s.trim()) {
              const synonymAnalysis = keywordAnalysis.secondaries[i];
              const synonymChecks = synonymAnalysis.checks;
              totalConditions += 1 + synonymChecks.length;
              if (synonymAnalysis.status === 'fail') {
                  violatingConditions++;
              }
              violatingConditions += synonymChecks.filter(c => !c.isMet).length;
          }
      });
  }

  if (keywords.company.trim()) {
      totalConditions += 1;
      if (keywordAnalysis.company.status === 'fail') {
          violatingConditions++;
      }
  }

  const handleAddSecondary = () => {
    setKeywords(k => ({ ...k, secondaries: [...k.secondaries, ''] }));
  };

  const handleRemoveSecondary = (indexToRemove: number) => {
    setKeywords(k => ({ ...k, secondaries: k.secondaries.filter((_, i) => i !== indexToRemove) }));
  };

  // LSI Handlers
    const handleLsiAdd = () => {
        if (!lsiInputValue.trim()) return;
        const newKeywords = lsiInputValue.split(/[,\n،]+/).map(k => k.trim()).filter(k => k && !keywords.lsi.includes(k));
        if (newKeywords.length > 0) {
            setKeywords(prev => ({ ...prev, lsi: [...prev.lsi, ...newKeywords] }));
        }
        setLsiInputValue('');
    };
    const handleLsiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleLsiAdd();
        }
    };
    const handleLsiPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        if (!pastedText.trim()) return;
        const newKeywords = pastedText.split(/[,\n،]+/).map(k => k.trim()).filter(k => k && !keywords.lsi.includes(k));
        if (newKeywords.length > 0) {
            setKeywords(prev => ({ ...prev, lsi: [...prev.lsi, ...newKeywords] }));
        }
        setLsiInputValue('');
    };
    const handleLsiRemove = (keywordToRemove: string) => {
        setKeywords(prev => ({ ...prev, lsi: prev.lsi.filter(k => k !== keywordToRemove) }));
    };
    const handleLsiHighlight = (kw: string) => {
        if (highlightedItem === kw) clearAllHighlights();
        else {
            applyHighlights([{ text: kw, color: '#d8b4fe' }], true);
            setHighlightedItem(kw);
        }
    };
    const handleToggleAllLsiHighlights = () => {
        if (highlightedItem === '__ALL_LSI__') {
            clearAllHighlights();
        } else {
            const lsiColors = ['#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#a7f3d0', '#99f6e4', '#a5f3fc', '#bfdbfe', '#d8b4fe'];
            const highlights = keywords.lsi.map((kw, i) => ({ text: kw, color: lsiColors[i % lsiColors.length] }));
            applyHighlights(highlights, false);
            setHighlightedItem('__ALL_LSI__');
        }
    };
    const handleClearLsi = () => {
        setKeywords(prev => ({ ...prev, lsi: [] }));
        if (highlightedItem === '__ALL_LSI__' || keywords.lsi.includes(highlightedItem as string)) {
            clearAllHighlights();
        }
    };
    
      const handleAutoDistribute = (text: string) => {
        if (!text.trim()) return;
    
        // Use a regex to split by various separators on their own lines.
        // Separators can be one or more of: - / \ = . + *
        // The 'm' flag is crucial for multiline matching of ^ and $.
        const parts = text.split(/^\s*[-/\\=.+*]+\s*$/m);
    
        const primaryAndSynonymsPart = (parts[0] || '').trim();
        const lsiPart = (parts[1] || '').trim();
        const companyPart = (parts[2] || '').trim();
    
        const primaryAndSynonymsLines = primaryAndSynonymsPart.split('\n').map(line => line.trim()).filter(Boolean);
        const newPrimary = primaryAndSynonymsLines[0] || '';
        const newSecondaries = primaryAndSynonymsLines.slice(1);
    
        const newLsi = lsiPart.split('\n').map(line => line.trim()).filter(Boolean);
    
        const companyLines = companyPart.split('\n').map(line => line.trim()).filter(Boolean);
        const newCompany = companyLines[0] || '';
    
        setKeywords({
            primary: newPrimary,
            secondaries: newSecondaries,
            lsi: newLsi,
            company: newCompany,
        });
    };

    const handlePasteAndDistribute = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        handleAutoDistribute(pastedText);
        setAutoDistributeText('');
    };


  const renderKeywordsTab = () => {
    const autoDistributeSection = (
        <div className="mb-4">
            <label htmlFor="auto-distribute" className="block text-sm font-bold text-[#333333] dark:text-[#C7C7C7] mb-2">
                التوزيع التلقائي
            </label>
            <textarea
                id="auto-distribute"
                rows={4}
                value={autoDistributeText}
                onChange={(e) => setAutoDistributeText(e.target.value)}
                onPaste={handlePasteAndDistribute}
                className="w-full p-2 bg-gray-50 dark:bg-[#1F1F1F] rounded-md border border-gray-300 dark:border-[#3C3C3C] focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-right text-sm text-[#333333] dark:text-[#e0e0e0] custom-scrollbar"
                placeholder="الصق النص هنا للتوزيع التلقائي..."
            />
        </div>
    );
    if (keywordViewMode === 'modern') {
        return (
          <div className="p-3 space-y-4">
            {autoDistributeSection}
            <ModernSection 
                icon={<KeyRound size={20} />} 
                title="الكلمة المفتاحية الأساسية"
                onClick={() => handleHighlightToggle(keywords.primary, 'primary')}
            >
                <KeywordInput 
                    value={keywords.primary}
                    onChange={(val) => setKeywords(k => ({...k, primary: val}))}
                    placeholder="أدخل الكلمة الأساسية"
                    onHighlight={() => handleHighlightToggle(keywords.primary, 'primary')}
                    isHighlighted={highlightedItem === keywords.primary}
                />
                <ModernProgressBar analysis={keywordAnalysis.primary} />
                <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-[#3C3C3C]">
                    {keywordAnalysis.primary.checks.map((check, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            {check.isMet ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                            <span className="text-gray-600 dark:text-gray-300">{check.text}</span>
                        </div>
                    ))}
                </div>
            </ModernSection>
            <ModernSection 
                icon={<ListChecks size={20} />} 
                title="الصيغ المرادفة"
                onClick={handleToggleAllSecondariesHighlight}
            >
                {keywords.secondaries.map((s, i) => (
                    <div key={i}>
                        <div className="flex items-center gap-2">
                        <KeywordInput 
                                value={s}
                                onChange={(val) => setKeywords(k => ({...k, secondaries: k.secondaries.map((kw, idx) => idx === i ? val : kw)}))}
                                placeholder={`مرادف ${i + 1}`}
                                onHighlight={() => handleSecondaryHighlightToggle(s, i)}
                                isHighlighted={highlightedItem === s}
                                onRemove={() => handleRemoveSecondary(i)}
                        />
                        </div>
                        {s.trim() && (
                            <div className="mt-2 pr-1 space-y-2">
                                <ModernProgressBar analysis={keywordAnalysis.secondaries[i]} isCompact />
                                <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-[#3C3C3C]">
                                {keywordAnalysis.secondaries[i].checks.map((check, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs">
                                        {check.isMet ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                                        <span className="text-gray-600 dark:text-gray-300">{check.text}</span>
                                    </div>
                                ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <button onClick={handleAddSecondary} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-[#00778e] dark:text-[#94d2bd] bg-gray-100 dark:bg-[#3C3C3C] rounded-md hover:bg-gray-200 dark:hover:bg-[#4A4A4A]">
                    <Plus size={16} /> إضافة مرادف
                </button>
                {enteredSynonymsCount > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-[#3C3C3C]">
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">التوزيع الإجمالي للمرادفات</h4>
                        <ModernProgressBar analysis={keywordAnalysis.secondariesDistribution} />
                    </div>
                )}
            </ModernSection>
            <ModernSection 
                icon={<Users size={20} />} 
                title="اسم الشركة"
                onClick={() => handleHighlightToggle(keywords.company, 'company')}
            >
                <KeywordInput 
                    value={keywords.company}
                    onChange={(val) => setKeywords(k => ({...k, company: val}))}
                    placeholder="أدخل اسم الشركة"
                    onHighlight={() => handleHighlightToggle(keywords.company, 'company')}
                    isHighlighted={highlightedItem === keywords.company}
                />
                <ModernProgressBar analysis={keywordAnalysis.company} />
            </ModernSection>
            <ModernSection 
                icon={<Repeat size={20} />} 
                title="كلمات LSI"
                onClick={handleToggleAllLsiHighlights}
            >
                <textarea
                    value={lsiInputValue}
                    onChange={(e) => setLsiInputValue(e.target.value)}
                    onKeyDown={handleLsiKeyDown}
                    onPaste={handleLsiPaste}
                    onClick={(e) => e.stopPropagation()}
                    rows={2}
                    className="w-full p-2 bg-gray-50 dark:bg-[#1F1F1F] rounded-md border border-gray-300 dark:border-[#3C3C3C] focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-right text-sm text-[#333333] dark:text-[#e0e0e0] custom-scrollbar"
                    placeholder="أضف كلمات (افصل بينها بـ , أو سطر جديد)"
                />
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleToggleAllLsiHighlights(); }} disabled={keywords.lsi.length === 0} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#3C3C3C] rounded-md hover:bg-gray-200 dark:hover:bg-[#4A4A4A] disabled:opacity-50 disabled:cursor-not-allowed">
                        <Eye size={14} /> <span>تمييز الكل</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleClearLsi(); }} disabled={keywords.lsi.length === 0} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Trash2 size={14} /> <span>مسح الكل</span>
                    </button>
                </div>
                {keywordAnalysis.lsi.balance.status === 'fail' && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md border border-red-200 dark:border-red-900/30 text-xs">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold mb-1">{keywordAnalysis.lsi.balance.title}: {keywordAnalysis.lsi.balance.current}</p>
                                <p>{keywordAnalysis.lsi.balance.description}</p>
                            </div>
                        </div>
                    </div>
                )}
                {keywords.lsi.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-[#3C3C3C]">
                        {keywords.lsi.map(kw => {
                            const kwAnalysis = keywordAnalysis.lsi.keywords.find(kwa => kwa.text === kw);
                            const count = kwAnalysis ? kwAnalysis.count : 0;
                            const isKwHighlighted = highlightedItem === kw;
                            return (
                                <div
                                key={kw}
                                onClick={(e) => { e.stopPropagation(); handleLsiHighlight(kw); }}
                                className={`flex items-center gap-2 bg-gray-100 dark:bg-[#3C3C3C] text-gray-700 dark:text-gray-200 text-sm rounded-full pl-1.5 pr-3 py-1 cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-[#4A4A4A] ${isKwHighlighted ? 'ring-2 ring-violet-500' : ''}`}
                                >
                                    <span className="flex-grow">{kw}</span>
                                    <div className="flex items-center flex-shrink-0 gap-1">
                                        <span className="flex items-center justify-center text-xs font-semibold bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-100 rounded-full h-5 w-5 flex-shrink-0">
                                            {count}
                                        </span>
                                        <button onClick={(e) => { e.stopPropagation(); handleLsiRemove(kw); }} className="p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50" title="حذف">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ModernSection>
          </div>
        );
    }

    return (
        <div className="p-3 space-y-4">
            {autoDistributeSection}
             <div className="px-1 pb-2">
                <div className="flex bg-white dark:bg-gradient-to-r from-[#2A2A2A] via-[#222222] to-[#1F1F1F] rounded-lg border border-gray-300 dark:border-[#3C3C3C] divide-x divide-gray-200 dark:divide-[#3C3C3C]">
                  <StatDisplay 
                    icon={<KeyRound size={18} />} 
                    value={`${keywordAnalysis.primary.count}/${keywordAnalysis.primary.requiredCount[1] || '-'}`}
                    label="الأساسية"
                  />
                  <StatDisplay 
                    icon={<ListChecks size={18} />} 
                    value={`${keywordAnalysis.secondariesDistribution.count}/${keywordAnalysis.secondariesDistribution.requiredCount[1] || '-'}`}
                    label="المرادفات"
                  />
                  <StatDisplay 
                    icon={<Users size={18} />} 
                    value={`${keywordAnalysis.company.count}/${keywordAnalysis.company.requiredCount[1] || '-'}`}
                    label="الشركة"
                  />
                  <StatDisplay 
                    icon={<Repeat size={18} />} 
                    value={`${keywordAnalysis.lsi.distribution.count}/${keywordAnalysis.lsi.distribution.requiredCount[1] || '-'}`}
                    label="LSI"
                  />
                </div>
              </div>
            <AdvancedKeywordCard
                title="الكلمة المفتاحية الأساسية"
                icon={<KeyRound size={20} />}
                analysis={keywordAnalysis.primary}
                onClick={() => handleHighlightToggle(keywords.primary, 'primary')}
            >
                <div>
                    <input
                        type="text"
                        value={keywords.primary}
                        onChange={(e) => setKeywords(k => ({...k, primary: e.target.value}))}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="أدخل الكلمة الأساسية"
                        className="w-full p-2 text-right bg-gray-50 dark:bg-[#1F1F1F] rounded-md border border-gray-300 dark:border-[#3C3C3C] focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-base text-[#333333] dark:text-[#e0e0e0]"
                    />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-3 mt-3 border-t border-gray-200 dark:border-[#3C3C3C]">
                        {keywordAnalysis.primary.checks.map((check, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                {check.isMet ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                                <span className="text-gray-600 dark:text-gray-300">{check.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </AdvancedKeywordCard>

            <AdvancedKeywordCard
                title="الصيغ المرادفة"
                icon={<ListChecks size={20} />}
                analysis={keywordAnalysis.secondariesDistribution}
                onClick={handleToggleAllSecondariesHighlight}
            >
                <div className="space-y-3 pt-3 mt-3 border-t border-gray-200 dark:border-[#3C3C3C]" onClick={(e) => e.stopPropagation()}>
                    {keywords.secondaries.map((s, i) => (
                        <div key={i} className="space-y-2">
                           <KeywordInput 
                                value={s}
                                onChange={(val) => setKeywords(k => ({...k, secondaries: k.secondaries.map((kw, idx) => idx === i ? val : kw)}))}
                                placeholder={`مرادف ${i + 1}`}
                                onHighlight={() => handleSecondaryHighlightToggle(s, i)}
                                isHighlighted={highlightedItem === s}
                                onRemove={() => handleRemoveSecondary(i)}
                           />
                           {s.trim() && keywordAnalysis.secondaries[i] && (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                  {keywordAnalysis.secondaries[i].checks.map((check, index) => (
                                      <div key={index} className="flex items-center gap-2 text-xs">
                                          {check.isMet ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                                          <span className="text-gray-600 dark:text-gray-300">{check.text}</span>
                                      </div>
                                  ))}
                              </div>
                           )}
                        </div>
                    ))}
                    <button onClick={handleAddSecondary} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-[#00778e] dark:text-[#94d2bd] bg-gray-100 dark:bg-[#3C3C3C] rounded-md hover:bg-gray-200 dark:hover:bg-[#4A4A4A]">
                        <Plus size={16} /> إضافة مرادف
                    </button>
                </div>
            </AdvancedKeywordCard>
            
            <AdvancedKeywordCard
                title="كلمات LSI"
                icon={<Repeat size={20} />}
                analysis={keywordAnalysis.lsi.distribution}
                onClick={handleToggleAllLsiHighlights}
                actions={
                    keywords.lsi.length > 0 ? (
                        <div className="flex items-center gap-1">
                             <button
                                onClick={(e) => { e.stopPropagation(); handleClearLsi(); }}
                                className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
                                title="مسح كل كلمات LSI"
                            >
                                <Trash2 size={16} className="text-red-500 dark:text-red-400" />
                            </button>
                             <button
                                onClick={(e) => { e.stopPropagation(); handleToggleAllLsiHighlights(); }}
                                className={`p-1.5 rounded-full transition-colors ${highlightedItem === '__ALL_LSI__' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-[#3C3C3C]'}`}
                                title={highlightedItem === '__ALL_LSI__' ? 'إلغاء تمييز الكل' : 'تمييز كل كلمات LSI'}
                            >
                                <Eye size={16} className={highlightedItem === '__ALL_LSI__' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} />
                            </button>
                        </div>
                    ) : undefined
                }
            >
                <div onClick={(e) => e.stopPropagation()}>
                    <textarea
                        value={lsiInputValue}
                        onChange={(e) => setLsiInputValue(e.target.value)}
                        onKeyDown={handleLsiKeyDown}
                        onPaste={handleLsiPaste}
                        rows={2}
                        className="w-full p-2 bg-gray-50 dark:bg-[#1F1F1F] rounded-md border border-gray-300 dark:border-[#3C3C3C] focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-right text-sm text-[#333333] dark:text-[#e0e0e0] custom-scrollbar"
                        placeholder="أضف كلمات (افصل بينها بـ , أو سطر جديد)"
                    />
                    
                    <div className="space-y-3 pt-3 mt-3 border-t border-gray-200 dark:border-[#3C3C3C]">
                       {keywordAnalysis.lsi.balance.status === 'fail' && (
                             <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md border border-red-200 dark:border-red-900/30 text-xs">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold mb-1">{keywordAnalysis.lsi.balance.title}: {keywordAnalysis.lsi.balance.current}</p>
                                        <p>{keywordAnalysis.lsi.balance.description}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {keywords.lsi.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {keywords.lsi.map(kw => {
                                    const kwAnalysis = keywordAnalysis.lsi.keywords.find(kwa => kwa.text === kw);
                                    const count = kwAnalysis ? kwAnalysis.count : 0;
                                    const isKwHighlighted = highlightedItem === kw;
                                    return (
                                        <div
                                          key={kw}
                                          onClick={() => handleLsiHighlight(kw)}
                                          className={`flex items-center gap-2 bg-gray-100 dark:bg-[#3C3C3C] text-gray-700 dark:text-gray-200 text-sm rounded-full pl-1.5 pr-3 py-1 cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-[#4A4A4A] ${isKwHighlighted ? 'ring-2 ring-violet-500' : ''}`}
                                        >
                                            <span className="flex-grow">{kw}</span>
                                            <div className="flex items-center flex-shrink-0 gap-1">
                                                <span className="flex items-center justify-center text-xs font-semibold bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-100 rounded-full h-5 w-5 flex-shrink-0">
                                                    {count}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); handleLsiRemove(kw); }} className="p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50" title="حذف">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </AdvancedKeywordCard>
            
             <div 
               className="bg-white dark:bg-[#2A2A2A] rounded-xl p-4 space-y-4 transition-all duration-300 border border-gray-300 dark:border-[#3C3C3C] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#3C3C3C]"
               onClick={() => handleHighlightToggle(keywords.company, 'company')}
             >
                <div className="flex items-center gap-2">
                    <span className="text-[#00778e]"><Users size={20} /></span>
                    <h4 className="text-md font-bold text-[#333333] dark:text-[#C7C7C7]">اسم الشركة</h4>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                    <KeywordInput 
                        value={keywords.company}
                        onChange={(val) => setKeywords(k => ({...k, company: val}))}
                        placeholder="أدخل اسم الشركة"
                        onHighlight={() => handleHighlightToggle(keywords.company, 'company')}
                        isHighlighted={highlightedItem === keywords.company}
                        className="bg-white dark:bg-[#2A2A2A]"
                    />
                    <ModernProgressBar analysis={keywordAnalysis.company} />
                </div>
             </div>
        </div>
    );
  };
  
  return (
    <aside className="relative z-30 basis-1/4 bg-[#F2F3F5] dark:bg-[#1F1F1F] rounded-lg shadow-lg flex flex-col h-full min-w-0">
        <div className="flex border-b border-gray-200 dark:border-[#3C3C3C]">
            <button onClick={() => setActiveTab('keywords')} className={getTabClass('keywords')}>
                <KeyRound size={16} />
                <span>الكلمات المستهدفة</span>
            </button>
            <button onClick={() => setActiveTab('duplicates')} className={getTabClass('duplicates')}>
                <Repeat size={16} />
                <span>التكرارات</span>
            </button>
        </div>

        <div className="flex-shrink-0 p-3 bg-[#F2F3F5] dark:bg-[#1F1F1F] border-b border-gray-200 dark:border-[#3C3C3C]">
             {activeTab === 'keywords' ? (
                 <div className="flex justify-end items-center">
                     <div className="flex items-center gap-4 text-xs font-bold">
                        <span title="إجمالي الشروط">الكل: {totalConditions}</span>
                        <span className="text-red-600 dark:text-red-400" title="الشروط المخالفة">المخالف: {violatingConditions}</span>
                    </div>
                </div>
             ) : (
                <div className="text-center font-bold text-[#333333] dark:text-[#C7C7C7]">
                    ملخص التكرارات
                </div>
             )}
        </div>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar">
            {activeTab === 'keywords' && renderKeywordsTab()}
            {activeTab === 'duplicates' && 
                <DuplicatesTab 
                    analysis={duplicateAnalysis}
                    stats={duplicateStats}
                    editor={editor} 
                    clearAllHighlights={clearAllHighlights}
                    applyHighlights={applyHighlights}
                    highlightedItem={highlightedItem}
                    setHighlightedItem={setHighlightedItem}
                />
            }
        </div>
    </aside>
  );
};

export default LeftSidebar;