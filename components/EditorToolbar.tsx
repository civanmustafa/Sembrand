
import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { Save, History, Eraser, List, ListOrdered, KeyRound, Shrink, Sun, Moon, Bookmark, MessageSquare, LogOut, LayoutDashboard, Table2, Trash2, Combine, SplitSquareVertical, ChevronLeftSquare, ChevronRightSquare, ChevronUpSquare, ChevronDownSquare, Search, ChevronUp, ChevronDown, Bold, Italic, Pilcrow, Heading1, Heading2, Heading3, Heading4, Download } from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor;
  clearAllHighlights: () => void;
  onToggleAllKeywordsHighlight: () => void;
  onRemoveEmptyLines: () => void;
  highlightedItem: string | any[] | null;
  totalWordCount: number;
  totalCharCount: number;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  onToggleToc: () => void;
  isTocVisible: boolean;
  onSaveDraft: () => void;
  onRestoreDraft: () => void;
  onExportHtml: () => void;
  saveStatus: 'idle' | 'saved';
  restoreStatus: 'idle' | 'restored';
  draftExists: boolean;
  onLogout: () => void;
  isTooltipAlwaysOn: boolean;
  setIsTooltipAlwaysOn: React.Dispatch<React.SetStateAction<boolean>>;
  onShowDashboard: () => void;
  isIdle: boolean;
}

const ToolbarButton: React.FC<{ onClick: () => void; title: string; isActive?: boolean; disabled?: boolean; children: React.ReactNode }> = ({ onClick, title, isActive = false, disabled = false, children }) => {
  const baseClasses = "p-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#1F1F1F] focus:ring-[#00778e]";
  const stateClasses = isActive
    ? 'bg-[#00778e]/10 text-[#00778e] dark:bg-[#0078d4]/20 dark:text-[#94d2bd]'
    : disabled
    ? 'text-gray-400 dark:text-gray-600 bg-transparent cursor-not-allowed'
    : 'text-gray-600 dark:text-gray-300 bg-transparent hover:bg-gray-200 dark:hover:bg-[#3C3C3C]';

  return (
    <button onClick={onClick} title={title} disabled={disabled} className={`${baseClasses} ${stateClasses}`}>
      {children}
    </button>
  );
};

const Separator: React.FC = () => <div className="border-l border-gray-300 dark:border-[#3C3C3C] h-6 mx-1"></div>;

const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  editor, 
  clearAllHighlights, 
  onToggleAllKeywordsHighlight, 
  onRemoveEmptyLines, 
  highlightedItem, 
  totalWordCount, 
  totalCharCount,
  isDarkMode,
  setIsDarkMode,
  title,
  setTitle,
  onToggleToc,
  isTocVisible,
  onSaveDraft,
  onRestoreDraft,
  onExportHtml,
  saveStatus,
  restoreStatus,
  draftExists,
  onLogout,
  isTooltipAlwaysOn,
  setIsTooltipAlwaysOn,
  onShowDashboard,
  isIdle
}) => {
  const [activeState, setActiveState] = useState({
    isBold: false,
    isItalic: false,
    isH1: false,
    isH2: false,
    isH3: false,
    isH4: false,
    isParagraph: false,
    isBulletList: false,
    isOrderedList: false,
    isTableActive: false,
  });
  const [selectionCount, setSelectionCount] = useState({ words: 0, chars: 0 });
  const isAllKeywordsHighlighted = highlightedItem === '__ALL_KEYWORDS__';

  const [isFindReplaceVisible, setIsFindReplaceVisible] = useState(false);
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);

  const highlightMatches = useCallback((currentMatches: { from: number; to: number }[], currentIndex: number) => {
    if (!editor || editor.isDestroyed) return;
    const { tr } = editor.state;
    const highlightMarkType = editor.schema.marks.highlight;

    tr.removeMark(0, editor.state.doc.content.size, highlightMarkType);

    currentMatches.forEach((match, index) => {
      const color = index === currentIndex ? '#6ee7b7' : '#fef08a';
      const highlightMark = highlightMarkType.create({ color, highlightStyle: 'background' });
      tr.addMark(match.from, match.to, highlightMark);
    });

    if (tr.steps.length > 0) {
      editor.view.dispatch(tr.setMeta('preventUpdate', true));
    }
  }, [editor]);
  
  const findAndHighlight = useCallback((value: string) => {
    if (!editor || editor.isDestroyed || !value) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      const { tr } = editor.state;
      tr.removeMark(0, editor.state.doc.content.size, editor.schema.marks.highlight);
      if (tr.steps.length > 0) editor.view.dispatch(tr.setMeta('preventUpdate', true));
      return;
    }

    const newMatches: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            let index = -1;
            while ((index = node.text.indexOf(value, index + 1)) !== -1) {
                newMatches.push({ from: pos + index, to: pos + index + value.length });
            }
        }
    });
    
    setMatches(newMatches);
    setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1);
    highlightMatches(newMatches, 0);
  }, [editor, highlightMatches]);

  const goToMatch = useCallback((index: number) => {
    if (!matches.length || !editor) return;
    setCurrentMatchIndex(index);
    const match = matches[index];
    editor.chain().focus().setTextSelection(match).scrollIntoView().run();
    highlightMatches(matches, index);
  }, [editor, matches, highlightMatches]);
  
  const goToNext = useCallback(() => {
    if (!matches.length) return;
    goToMatch((currentMatchIndex + 1) % matches.length);
  }, [matches, currentMatchIndex, goToMatch]);

  const goToPrev = useCallback(() => {
     if (!matches.length) return;
    goToMatch((currentMatchIndex - 1 + matches.length) % matches.length);
  }, [matches, currentMatchIndex, goToMatch]);

  const handleReplace = useCallback(() => {
    if (matches.length === 0 || currentMatchIndex === -1 || !editor) return;
    const match = matches[currentMatchIndex];
    editor.chain().focus().setTextSelection(match).deleteSelection().insertContent(replaceValue).run();
    setTimeout(() => findAndHighlight(findValue), 50);
  }, [editor, matches, currentMatchIndex, replaceValue, findValue, findAndHighlight]);
  
  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0 || !findValue || !editor) return;
    const transaction = editor.state.tr;
    [...matches].reverse().forEach(match => {
      transaction.replaceWith(match.from, match.to, editor.schema.text(replaceValue));
    });
    editor.view.dispatch(transaction);
    setIsFindReplaceVisible(false);
    setFindValue(''); setReplaceValue(''); setMatches([]); setCurrentMatchIndex(-1);
  }, [editor, matches, findValue, replaceValue]);

  const handleToggleFindReplace = useCallback(() => {
    const willBeVisible = !isFindReplaceVisible;
    setIsFindReplaceVisible(willBeVisible);
    if (!willBeVisible) {
        setFindValue(''); setReplaceValue(''); setMatches([]); setCurrentMatchIndex(-1);
        if (editor && !editor.isDestroyed) {
            const { tr } = editor.state;
            tr.removeMark(0, editor.state.doc.content.size, editor.schema.marks.highlight);
            if (tr.steps.length > 0) editor.view.dispatch(tr.setMeta('preventUpdate', true));
        }
    } else {
      clearAllHighlights();
      setTimeout(() => findInputRef.current?.focus(), 100);
    }
  }, [isFindReplaceVisible, clearAllHighlights, editor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFindReplaceVisible) {
        event.preventDefault();
        event.stopPropagation();
        handleToggleFindReplace();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFindReplaceVisible, handleToggleFindReplace]);

  useEffect(() => {
    if (!editor) return;
    const updateToolbarState = () => {
      setActiveState({
        isBold: editor.isActive('bold'),
        isItalic: editor.isActive('italic'),
        isH1: editor.isActive('heading', { level: 1 }),
        isH2: editor.isActive('heading', { level: 2 }),
        isH3: editor.isActive('heading', { level: 3 }),
        isH4: editor.isActive('heading', { level: 4 }),
        isParagraph: editor.isActive('paragraph'),
        isBulletList: editor.isActive('bulletList'),
        isOrderedList: editor.isActive('orderedList'),
        isTableActive: editor.isActive('table'),
      });
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setSelectionCount({ words: 0, chars: 0 });
      } else {
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        const words = selectedText.trim().split(/\s+/).filter(Boolean).length;
        setSelectionCount({ words, chars: selectedText.length });
      }
    };
    editor.on('transaction', updateToolbarState);
    editor.on('selectionUpdate', updateToolbarState);
    editor.on('focus', updateToolbarState);
    editor.on('blur', () => setSelectionCount({ words: 0, chars: 0 }));
    updateToolbarState();
    return () => {
      editor.off('transaction', updateToolbarState);
      editor.off('selectionUpdate', updateToolbarState);
      editor.off('focus', updateToolbarState);
      editor.off('blur', () => setSelectionCount({ words: 0, chars: 0 }));
    };
  }, [editor]);

  if (!editor) return null;
    
  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 p-2 bg-[#F2F3F5] dark:bg-[#1F1F1F] border-b border-gray-300 dark:border-[#3C3C3C]">
      {/* --- Row 1: Title and Stats --- */}
      <div className="flex items-center gap-4 w-full">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="أدخل العنوان هنا..."
          className="flex-grow p-2 text-xl font-bold bg-transparent border-none rounded-md focus:ring-0 focus:outline-none text-[#333333] dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          aria-label="عنوان المقال"
        />
        <div className="flex-shrink-0 flex items-center gap-4">
          <div className="flex items-center gap-2" title={isIdle ? "غير نشط" : "نشط"}>
              <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${isIdle ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-gray-500 dark:text-gray-400 select-none">{isIdle ? "غير نشط" : "نشط"}</span>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-[#2A2A2A] px-3 py-1 rounded-md">
            {selectionCount.chars > 0 ? (
              <span>{selectionCount.words} كلمة / {selectionCount.chars} حرف</span>
            ) : (
              <span>{totalWordCount} كلمة / {totalCharCount} حرف</span>
            )}
          </div>
        </div>
      </div>

      {/* --- Row 2: Main Toolbar --- */}
      <div className="flex flex-wrap items-center gap-1 w-full">
        <ToolbarButton onClick={onShowDashboard} title="لوحة التحكم"><LayoutDashboard size={18} /></ToolbarButton>
        <ToolbarButton onClick={onSaveDraft} title={saveStatus === 'saved' ? 'تم الحفظ!' : 'حفظ مؤقت'} disabled={saveStatus === 'saved'}>
            <Save size={18} className={saveStatus === 'saved' ? 'text-green-500' : ''}/>
        </ToolbarButton>
        <ToolbarButton onClick={onRestoreDraft} title={restoreStatus === 'restored' ? 'تم الاسترداد!' : 'استرداد'} disabled={!draftExists || restoreStatus === 'restored'}>
            <History size={18} className={restoreStatus === 'restored' ? 'text-blue-500' : ''}/>
        </ToolbarButton>
        <ToolbarButton onClick={onExportHtml} title="تصدير كـ HTML">
            <Download size={18} />
        </ToolbarButton>
        <Separator/>
        <ToolbarButton onClick={handleToggleFindReplace} title="بحث واستبدال" isActive={isFindReplaceVisible}><Search size={18} /></ToolbarButton>
        <ToolbarButton onClick={onRemoveEmptyLines} title="إزالة الأسطر الفارغة"><Shrink size={18} /></ToolbarButton>
        <ToolbarButton onClick={onToggleToc} title={isTocVisible ? "إخفاء الفهرس" : "إنشاء فهرس"} isActive={isTocVisible}><Bookmark size={18} /></ToolbarButton>
        <Separator/>
        <ToolbarButton onClick={onToggleAllKeywordsHighlight} title="تمييز كل الكلمات المفتاحية" isActive={isAllKeywordsHighlighted}><KeyRound size={18} /></ToolbarButton>
        <ToolbarButton onClick={clearAllHighlights} title="إزالة كل التمييز"><Eraser size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => setIsTooltipAlwaysOn(!isTooltipAlwaysOn)} title={isTooltipAlwaysOn ? "إيقاف التلميحات" : "تفعيل التلميحات"} isActive={isTooltipAlwaysOn}><MessageSquare size={18} /></ToolbarButton>
        <div className="ml-auto flex items-center gap-1">
            <ToolbarButton onClick={() => setIsDarkMode(!isDarkMode)} title="تبديل الوضع">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</ToolbarButton>
            <ToolbarButton onClick={onLogout} title="تسجيل الخروج"><LogOut size={18} /></ToolbarButton>
        </div>
      </div>
      
      {/* --- Row 3: Formatting Toolbar --- */}
      <div className="flex flex-wrap items-center gap-1 w-full pt-2 mt-2 border-t border-gray-300 dark:border-[#3C3C3C]">
        <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} title="فقرة" isActive={activeState.isParagraph}><Pilcrow size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="العنوان 1" isActive={activeState.isH1}><Heading1 size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="العنوان 2" isActive={activeState.isH2}><Heading2 size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="العنوان 3" isActive={activeState.isH3}><Heading3 size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="العنوان 4" isActive={activeState.isH4}><Heading4 size={18} /></ToolbarButton>
        <Separator/>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} title="عريض" isActive={activeState.isBold}><Bold size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} title="مائل" isActive={activeState.isItalic}><Italic size={18} /></ToolbarButton>
        <Separator/>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} title="قائمة نقطية" isActive={activeState.isBulletList}><List size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} title="قائمة رقمية" isActive={activeState.isOrderedList}><ListOrdered size={18} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="إدراج جدول"><Table2 size={18} /></ToolbarButton>
      </div>

      {isFindReplaceVisible && (
        <div className="flex items-center gap-2 w-full pt-2 mt-2 border-t border-gray-300 dark:border-[#3C3C3C]">
          <div className="relative flex-1">
            <input
              ref={findInputRef}
              type="text"
              placeholder="بحث..."
              value={findValue}
              onChange={(e) => { setFindValue(e.target.value); findAndHighlight(e.target.value); }}
              onKeyDown={(e) => { 
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goToPrev() : goToNext(); }
              }}
              className="w-full pl-2 pr-20 py-1 bg-white dark:bg-[#2A2A2A] border border-gray-300 dark:border-[#3C3C3C] rounded-md focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-sm text-[#333333] dark:text-[#e0e0e0]"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              {findValue && (<span className="text-xs text-gray-500 dark:text-gray-400">{matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : 'لا يوجد'}</span>)}
              <button onClick={goToPrev} disabled={matches.length < 2} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-[#3C3C3C] disabled:opacity-50 text-[#333333] dark:text-[#8d8d8d]"><ChevronUp size={16} /></button>
              <button onClick={goToNext} disabled={matches.length < 2} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-[#3C3C3C] disabled:opacity-50 text-[#333333] dark:text-[#8d8d8d]"><ChevronDown size={16} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <input
                type="text"
                placeholder="استبدال بـ..."
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); handleReplace(); } }}
                className="flex-1 pl-2 py-1 bg-white dark:bg-[#2A2A2A] border border-gray-300 dark:border-[#3C3C3C] rounded-md focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-sm text-[#333333] dark:text-[#e0e0e0]"
            />
            <button onClick={handleReplace} disabled={matches.length === 0} className="p-1.5 px-3 text-xs font-semibold border rounded-md transition-colors text-[#333333] dark:text-[#8d8d8d] border-gray-300 dark:border-[#3C3C3C] bg-white hover:bg-gray-100 dark:bg-[#2A2A2A] dark:hover:bg-[#3C3C3C] disabled:opacity-50">استبدال</button>
            <button onClick={handleReplaceAll} disabled={matches.length === 0} className="p-1.5 px-3 text-xs font-semibold border rounded-md transition-colors text-[#333333] dark:text-[#8d8d8d] border-gray-300 dark:border-[#3C3C3C] bg-white hover:bg-gray-100 dark:bg-[#2A2A2A] dark:hover:bg-[#3C3C3C] disabled:opacity-50">الكل</button>
          </div>
        </div>
      )}

      {activeState.isTableActive && (
        <div className="flex flex-wrap items-center gap-2 w-full pt-2 mt-2 border-t border-gray-300 dark:border-[#3C3C3C]">
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-2">أدوات الجدول:</span>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="إضافة عمود قبل"><ChevronLeftSquare size={18} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="إضافة عمود بعد"><ChevronRightSquare size={18} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="حذف العمود"><Trash2 size={18} /></ToolbarButton>
            <Separator/>
            <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="إضافة صف قبل"><ChevronUpSquare size={18} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="إضافة صف بعد"><ChevronDownSquare size={18} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="حذف الصف"><Trash2 size={18} /></ToolbarButton>
            <Separator/>
            <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} disabled={!editor.can().mergeCells()} title="دمج الخلايا"><Combine size={18} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} disabled={!editor.can().splitCell()} title="تقسيم الخلية"><SplitSquareVertical size={18} /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} isActive={editor.isActive('tableHeader')} title="تبديل صف الرأس"><span className="text-sm font-bold">رأس</span></ToolbarButton>
            <Separator/>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="حذف الجدول"><Trash2 size={18} /></ToolbarButton>
        </div>
      )}
    </div>
  );
};

export default EditorToolbar;