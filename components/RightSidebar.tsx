import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';
import StructureTab from './StructureTab';
import GoalTab from './GoalTab';
import type { FullAnalysis, Keywords, CheckResult } from '../types';
import { Bot, Loader2, LayoutTemplate, Target, Edit3, FileText, KeyRound, ListChecks, Copy, Check } from 'lucide-react';

interface AITabProps {
  onAnalyze: (prompt: string, options: any) => void;
  result: string;
  isLoading: boolean;
  aiGoal: string;
}

const AITab: React.FC<AITabProps> = ({ onAnalyze, result, isLoading, aiGoal }) => {
  const [prompt, setPrompt] = useState('');
  const [analysisOptions, setAnalysisOptions] = useState({
    manualCommand: true,
    targetKeywords: false,
    structureCriteria: false,
    keywordCriteria: false,
    goalCriteria: false,
    editorText: true,
  });
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  type AnalysisOptionKey = keyof typeof analysisOptions;

  const handleOptionChange = (option: AnalysisOptionKey) => {
    setAnalysisOptions(prev => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  const handleAnalyze = () => {
    onAnalyze(prompt, analysisOptions);
  };
  
  const handleCopy = () => {
    if (!result || isLoading) return;
    navigator.clipboard.writeText(result);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const optionsConfig: { key: AnalysisOptionKey; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: 'manualCommand', label: 'الأمر اليدوي', icon: <Edit3 size={18} /> },
    { key: 'editorText', label: 'نص المحرر', icon: <FileText size={18} /> },
    { key: 'targetKeywords', label: 'الكلمات المستهدفة', icon: <KeyRound size={18} /> },
    { key: 'structureCriteria', label: 'معايير الهيكل', icon: <LayoutTemplate size={18} /> },
    { key: 'keywordCriteria', label: 'معايير الكلمات', icon: <ListChecks size={18} /> },
    { key: 'goalCriteria', label: 'معايير الهدف', icon: <Target size={18} />, disabled: aiGoal !== 'برنامج سياحي' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div>
        <label htmlFor="ai-prompt" className="block text-sm font-bold text-[#333333] dark:text-[#C7C7C7] mb-2">
          الأمر للذكاء الاصطناعي
        </label>
        <textarea
          id="ai-prompt"
          rows={5}
          className="w-full p-3 min-h-[120px] text-base border border-gray-300 rounded-lg shadow-sm focus:ring-[#00778e] focus:border-[#00778e] bg-white dark:bg-[#2A2A2A] dark:border-[#3C3C3C] dark:text-[#e0e0e0] custom-scrollbar"
          placeholder="مثال: أعد كتابة الفقرة التالية بأسلوب أكثر إقناعاً..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
      </div>
      
      <div>
          <label className="block text-sm font-bold text-[#333333] dark:text-[#C7C7C7] mb-2">
            إرفاق سياق
          </label>
          <div className="space-y-2">
            {optionsConfig.map(({key, label, icon, disabled}) => (
                // FIX: Wrapped 'key' with String() in template literals to prevent runtime error from implicit symbol-to-string conversion.
                <label key={key} htmlFor={`option-${String(key)}`} className={`flex items-center p-2.5 rounded-lg border transition-all duration-200 ${
                    disabled ? 'cursor-not-allowed bg-gray-50 dark:bg-[#2A2A2A]/50 text-gray-400 dark:text-gray-600' : 'cursor-pointer'
                  } ${
                    analysisOptions[key]
                      ? 'bg-teal-50 dark:bg-[#00778e]/20 border-[#00778e]/50 dark:border-[#00778e]'
                      : 'bg-white dark:bg-[#2A2A2A] border-gray-200 dark:border-[#3C3C3C] hover:border-gray-300 dark:hover:border-[#4A4A4A]'
                  }`}>
                    <div className={`ml-3 ${analysisOptions[key] ? 'text-[#00778e]' : 'text-gray-400 dark:text-gray-500'}`}>{icon}</div>
                    <span className={`flex-grow text-sm font-medium ${analysisOptions[key] ? 'text-[#005f73] dark:text-teal-200' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
                    <input
                        id={`option-${String(key)}`}
                        type="checkbox"
                        checked={analysisOptions[key]}
                        onChange={() => handleOptionChange(key)}
                        disabled={isLoading || disabled}
                        className="h-4 w-4 rounded border-gray-300 text-[#00778e] focus:ring-[#00778e] disabled:opacity-50"
                    />
                </label>
            ))}
          </div>
      </div>
      
      <button
        onClick={handleAnalyze}
        disabled={isLoading || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-white bg-[#00778e] rounded-lg hover:bg-[#005f73] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed dark:disabled:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00778e] dark:focus:ring-offset-[#1F1F1F]"
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>جاري التحليل...</span>
          </>
        ) : (
          <>
            <Bot size={20} />
            <span>تحليل ذكي</span>
          </>
        )}
      </button>

      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-[#3C3C3C]">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-[#333333] dark:text-[#C7C7C7]">
                النتيجة
            </h3>
            {result && !isLoading && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3C3C3C] transition-colors"
                title={copyStatus === 'copied' ? 'تم النسخ!' : 'نسخ النتيجة'}
              >
                {copyStatus === 'copied' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            )}
        </div>
        <div 
          className="relative p-3 min-h-[200px] bg-white dark:bg-[#1F1F1F] border border-gray-200 dark:border-[#3C3C3C] rounded-lg text-gray-700 dark:text-gray-300 overflow-y-auto custom-scrollbar"
        >
          {isLoading ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 space-y-2">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">يفكر الذكاء الاصطناعي...</p>
             </div>
          ) : result ? (
             <p className="whitespace-pre-wrap text-sm leading-relaxed">{result}</p>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 space-y-2">
                <Bot size={28} />
                <p className="text-sm text-center">ستظهر نتائج التحليل الذكي هنا.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface RightSidebarProps {
  analysisResults: FullAnalysis;
  editor: Editor | null;
  clearAllHighlights: () => void;
  applyHighlights: (highlights: { text: string; color: string }[], scrollToFirst?: boolean) => void;
  highlightedItem: string | any[] | null;
  setHighlightedItem: React.Dispatch<React.SetStateAction<string | any[] | null>>;
  onAiAnalyze: (prompt: string, options: any) => void;
  aiResult: string;
  isAiLoading: boolean;
  keywords: Keywords;
  aiGoal: string;
  highlightStyle: 'background' | 'underline';
  setAiGoal: React.Dispatch<React.SetStateAction<string>>;
  onHighlightStructureItem: (item: CheckResult) => void;
  structureViewMode: 'grid' | 'list';
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
  analysisResults, 
  editor, 
  clearAllHighlights, 
  applyHighlights, 
  highlightedItem, 
  setHighlightedItem,
  onAiAnalyze,
  aiResult,
  isAiLoading,
  keywords,
  aiGoal,
  highlightStyle,
  setAiGoal,
  onHighlightStructureItem,
  structureViewMode,
}) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'goal' | 'ai'>('goal');

  const getTabClass = (tabName: 'structure' | 'goal' | 'ai') => {
    const isActive = activeTab === tabName;
    return `flex-1 flex items-center justify-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 ${
      isActive
        ? 'border-[#00778e] text-[#00778e] dark:text-white'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
    }`;
  };

  return (
    <aside className="basis-1/4 relative z-30 bg-[#F2F3F5] dark:bg-[#1F1F1F] rounded-lg shadow-lg flex flex-col h-full min-w-0">
      <div className="flex border-b border-gray-200 dark:border-[#3C3C3C]">
        <button onClick={() => setActiveTab('structure')} className={getTabClass('structure')} title="الهيكل والمحتوى">
          <LayoutTemplate size={16} />
          <span>الهيكل والمحتوى</span>
        </button>
        <button onClick={() => setActiveTab('goal')} className={getTabClass('goal')} title="الهدف والمعايير">
          <Target size={16} />
          <span>الهدف والمعايير</span>
        </button>
        <button onClick={() => setActiveTab('ai')} className={getTabClass('ai')} title="التحليل الذكي">
          <Bot size={16} />
          <span>التحليل الذكي</span>
        </button>
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {activeTab === 'structure' && (
            <StructureTab 
                analysis={analysisResults.structureAnalysis}
                stats={analysisResults.structureStats}
                editor={editor} 
                clearAllHighlights={clearAllHighlights}
                highlightedItem={highlightedItem}
                setHighlightedItem={setHighlightedItem}
                applyHighlights={applyHighlights}
                highlightStyle={highlightStyle}
                viewMode={structureViewMode}
            />
        )}
        {activeTab === 'goal' && (
            <GoalTab
                structureAnalysis={analysisResults.structureAnalysis}
                highlightedItem={highlightedItem}
                onHighlightStructureItem={onHighlightStructureItem}
                aiGoal={aiGoal}
                setAiGoal={setAiGoal}
            />
        )}
        {activeTab === 'ai' && (
          <AITab 
            onAnalyze={onAiAnalyze}
            result={aiResult}
            isLoading={isAiLoading}
            aiGoal={aiGoal}
          />
        )}
      </div>
    </aside>
  );
};

export default RightSidebar;