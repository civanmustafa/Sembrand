

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { ArrowUp, Key } from 'lucide-react';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import EditorToolbar from './components/EditorToolbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { useContentAnalysis, callGeminiAnalysis } from './hooks/useContentAnalysis';
import { recordLogin, recordTimeSpentOnArticle, recordArticleSave, ArticleActivity, getActivityData, saveUserPreference } from './hooks/useUserActivity';
import type { Keywords, FullAnalysis, CheckResult, StructureAnalysis } from './types';
import { INITIAL_CONTENT, SECONDARY_COLORS } from './constants';

const USERS = [
  { username: 'Admin1', password: 'Admin1' },
  { username: 'Nagham1234', password: 'Nagham1234' },
  { username: 'Sam1234', password: 'Sam1234' },
  { username: 'Essa1234', password: 'Essa1234' },
];

const INITIAL_KEYWORDS: Keywords = {
  primary: '',
  secondaries: ['', '', '', ''],
  company: '',
  lsi: [],
};

const getInitialContent = () => {
  try {
    const savedContent = localStorage.getItem('editor-draft-content');
    if (savedContent) {
      return JSON.parse(savedContent);
    }
  } catch (error) {
    console.error("Failed to parse saved content from localStorage:", error);
    localStorage.removeItem('editor-draft-content');
  }
  return INITIAL_CONTENT;
};

const ViolationHighlight = Highlight.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            color: {
                default: this.options.color,
                parseHTML: element => {
                    return element.style.backgroundColor;
                },
                renderHTML: attributes => {
                    if (!attributes.color || attributes.highlightStyle === 'underline') {
                        return {};
                    }
                    
                    return {
                        style: `background-color: ${attributes.color}; color: #1e293b;`,
                    };
                },
            },
            violation: {
                default: null,
                parseHTML: element => element.getAttribute('data-violation'),
                renderHTML: attributes => {
                    if (!attributes.violation) return {};
                    return { 'data-violation': attributes.violation };
                },
            },
            from: {
                default: null,
                parseHTML: element => element.getAttribute('data-from'),
                renderHTML: attributes => {
                    if (attributes.from === null) return {};
                    return { 'data-from': attributes.from };
                },
            },
            isViolation: {
                default: false,
                parseHTML: element => element.getAttribute('data-is-violation') === 'true',
                renderHTML: attributes => {
                    if (!attributes.isViolation) return {};
                    return { 'data-is-violation': 'true' };
                },
            },
            highlightStyle: {
                default: 'background',
                parseHTML: element => element.getAttribute('data-highlight-style'),
                renderHTML: attributes => {
                    const htmlAttrs: { [key: string]: any } = {};
                    if (attributes.highlightStyle) {
                        htmlAttrs['data-highlight-style'] = attributes.highlightStyle;
                    }
            
                    if (attributes.highlightStyle === 'underline') {
                        const hexColor = attributes.color || (attributes.isViolation ? '#ef4444' : '#3b82f6');
                        const encodedColor = encodeURIComponent(hexColor);
                        
                        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 4'><path fill='none' stroke='${encodedColor}' d='M0 2 Q 3 0, 6 2 Q 9 4, 12 2' stroke-width='2'/></svg>`;
                        const dataUri = `url("data:image/svg+xml,${svg}")`;

                        htmlAttrs.style = `text-decoration: none; background-image: ${dataUri}; background-repeat: repeat-x; background-position: 0 100%; background-size: 12px 4px; padding-bottom: 3px; background-color: transparent; color: inherit;`;
                    }
                    
                    return htmlAttrs;
                },
            },
        };
    },
});

const MANUAL_DRAFT_KEY = 'editor-manual-draft-content';
const MANUAL_DRAFT_TITLE_KEY = 'editor-manual-draft-title';
const MANUAL_DRAFT_KEYWORDS_KEY = 'editor-manual-draft-keywords';

const VIOLATION_PRIORITY: { [key: string]: number } = {
  'قسم H2': 1,
  'بين H2-H3': 2,
  'قسم H3': 3,
  'قسم H4': 4,
  'طول الفقرات': 5,
  'طول الجمل': 6,
  'تكرار بالفقرة': 7,
  'تكرار بالعنوان': 8,
  'بدايات الجمل': 9,
  'نهايات الفقرات': 10,
  'ثنائيات مكررة': 11,
  'علامات الترقيم': 12,
  'الفراغات': 13,
  'كلمات لاتينية': 14,
  'الفقرة التلخيصية': 15,
  'الفقرة الثانية': 16,
};
const DEFAULT_PRIORITY = 99;

const getWordCount = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

const App: React.FC = () => {
  const [title, setTitle] = useState<string>(() => {
    try {
      const savedTitle = localStorage.getItem('editor-draft-title');
      return savedTitle || '';
    } catch (error) {
      console.error("Could not load title from localStorage:", error);
      return '';
    }
  });
  const [editorState, setEditorState] = useState<any | null>(null);
  const [text, setText] = useState<string>('');
  const [keywords, setKeywords] = useState<Keywords>(() => {
      try {
        const saved = localStorage.getItem('editor-draft-keywords');
        return saved ? JSON.parse(saved) : INITIAL_KEYWORDS;
      } catch {
        return INITIAL_KEYWORDS;
      }
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [highlightedItem, setHighlightedItem] = useState<string | any[] | null>(null);
  const [tooltip, setTooltip] = useState<{
    content: string;
    top: number;
    left: number;
    violations: { title: string; from: number }[];
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [aiResult, setAiResult] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTocVisible, setIsTocVisible] = useState(false);
  const [aiGoal, setAiGoal] = useState('البيع');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'restored'>('idle');
  const [draftExists, setDraftExists] = useState(false);
  const [isTooltipAlwaysOn, setIsTooltipAlwaysOn] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('currentUser'));
  const [currentView, setCurrentView] = useState<'login' | 'dashboard' | 'editor'>(
    sessionStorage.getItem('currentUser') ? 'dashboard' : 'login'
  );

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const [highlightStyle, setHighlightStyle] = useState<'background' | 'underline'>('background');
  const [keywordViewMode, setKeywordViewMode] = useState<'classic' | 'modern'>('classic');
  const [structureViewMode, setStructureViewMode] = useState<'grid' | 'list'>('grid');

  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const keywordsRef = useRef(keywords);
  useEffect(() => {
    keywordsRef.current = keywords;
  }, [keywords]);

  const editorStateRef = useRef(editorState);
  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  useEffect(() => {
    const savedDraft = localStorage.getItem(MANUAL_DRAFT_KEY);
    if (savedDraft) {
      setDraftExists(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleScrollToTop = () => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (editor) {
        (editor.chain() as any).focus().setTextSelection(1).run();
    }
  };


  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      ViolationHighlight.configure({ multicolor: true }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: getInitialContent(),
    onUpdate: ({ editor, transaction }) => {
        if (transaction.getMeta('preventUpdate')) {
            return;
        }
        if (transaction.getMeta('pasted')) {
          setTimeout(() => {
              handleScrollToTop();
          }, 100);
        }
        const contentJSON = editor.getJSON();
        setEditorState(contentJSON);
        setText(editor.getText());
    },
    onCreate: ({ editor }) => {
      setEditorState(editor.getJSON());
      setText(editor.getText());
    }
  });

    useEffect(() => {
        if (!editor) return;

        const autosaveInterval = setInterval(() => {
            if (editor && !editor.isDestroyed) {
                try {
                    const contentJSON = editorStateRef.current;
                    const currentTitle = titleRef.current;
                    const currentKeywords = keywordsRef.current;
                    
                    if (!contentJSON) {
                        console.log("Autosave skipped: content is not ready yet.");
                        return;
                    }

                    localStorage.setItem('editor-draft-content', JSON.stringify(contentJSON));
                    localStorage.setItem('editor-draft-title', currentTitle);
                    localStorage.setItem('editor-draft-keywords', JSON.stringify(currentKeywords));

                    localStorage.setItem(MANUAL_DRAFT_KEY, JSON.stringify(contentJSON));
                    localStorage.setItem(MANUAL_DRAFT_TITLE_KEY, currentTitle);
                    localStorage.setItem(MANUAL_DRAFT_KEYWORDS_KEY, JSON.stringify(currentKeywords));
                    
                    setDraftExists(true);
                    console.log("Draft autosaved at", new Date().toLocaleTimeString());
                } catch (error) {
                    console.error("Could not auto-save draft:", error);
                }
            }
        }, 60 * 1000);

        return () => {
            clearInterval(autosaveInterval);
        };
    }, [editor]);

  const analysisResults = useContentAnalysis(editorState, text, keywords, aiGoal);
  
  useEffect(() => {
    if (!editor || editor.isDestroyed || !analysisResults) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let lastMouseEvent: MouseEvent | null = null;

    const findViolationUnderCursor = (e: MouseEvent) => {
        const { clientX, clientY } = e;

        const posResult = editor.view.posAtCoords({ left: clientX, top: clientY });
        if (!posResult) {
            setTooltip(null);
            return;
        }

        const docPos = posResult.pos;
        const potentialViolations: {
            title: string;
            from: number;
        }[] = [];

        for (const key in analysisResults.structureAnalysis) {
            const check = analysisResults.structureAnalysis[key as keyof StructureAnalysis];
            if (check && check.violatingItems) {
                for (const violation of check.violatingItems) {
                    const start = violation.sectionFrom ?? violation.from;
                    const end = violation.sectionTo ?? violation.to;
                    
                    if (docPos >= start && docPos < end) {
                        potentialViolations.push({
                            title: check.title,
                            from: violation.from,
                        });
                    }
                }
            }
        }

        let finalViolations;
        if (!isTooltipAlwaysOn) {
            if (typeof highlightedItem === 'string') {
                finalViolations = potentialViolations.filter(v => v.title === highlightedItem);
            } else {
                finalViolations = [];
            }
        } else {
            finalViolations = potentialViolations;
        }

        const uniqueViolationsMap = new Map<string, { title: string; from: number }>();
        finalViolations.forEach(v => {
            const key = `${v.title}-${v.from}`;
            if (!uniqueViolationsMap.has(key)) {
                uniqueViolationsMap.set(key, { title: v.title, from: v.from });
            }
        });

        const violationsForState = Array.from(uniqueViolationsMap.values()).sort((a, b) => {
            const priorityA = VIOLATION_PRIORITY[a.title] ?? DEFAULT_PRIORITY;
            const priorityB = VIOLATION_PRIORITY[b.title] ?? DEFAULT_PRIORITY;
            return priorityA - priorityB;
        });

        if (violationsForState.length > 0) {
            setTooltip(prev => {
                const isSame = prev && 
                               prev.violations.length === violationsForState.length &&
                               prev.violations.every((v, i) => v.title === violationsForState[i].title && v.from === violationsForState[i].from);

                if (isSame) {
                    return { ...prev, top: clientY - 15, left: clientX + 15 };
                }
                return {
                    content: '...',
                    top: clientY - 15,
                    left: clientX + 15,
                    violations: violationsForState,
                };
            });
        } else {
            setTooltip(null);
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseEvent = e;
      findViolationUnderCursor(e);
    };

    const handleScroll = () => {
      if (lastMouseEvent) {
        findViolationUnderCursor(lastMouseEvent);
      }
    };

    const handleMouseLeave = () => {
      lastMouseEvent = null;
      setTooltip(null);
    };
    
    const handleMouseEnter = (e: MouseEvent) => {
        lastMouseEvent = e;
    };

    scrollContainer.addEventListener('mousemove', handleMouseMove);
    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [editor, analysisResults, isTooltipAlwaysOn, highlightedItem]);

  useEffect(() => {
    if (!tooltip || tooltip.violations.length === 0) {
      return;
    }

    const structureAnalysis = analysisResults.structureAnalysis;
    
    const contentItems = tooltip.violations.map(violation => {
        const { title, from } = violation;
        let currentCheck: CheckResult | undefined;

        for (const key in structureAnalysis) {
          const check = structureAnalysis[key as keyof StructureAnalysis];
          if (check && check.title === title) {
            currentCheck = check;
            break;
          }
        }

        if (currentCheck) {
            let specificMessage = '';
            if (from !== null && currentCheck.violatingItems) {
                const specificViolation = currentCheck.violatingItems.find(v => v.from === from);
                if (specificViolation?.message) {
                    specificMessage = specificViolation.message;
                }
            }
            
            const failColor = '#810701';
            const warnColor = '#F59E0B';
            const statusColor = currentCheck.status === 'fail' ? failColor : currentCheck.status === 'warn' ? warnColor : 'white';
            const separator = ` <span style="color: ${statusColor}; font-weight: bold;">&gt;&gt;</span> `;

            let messagePart = '';
            if (specificMessage) {
                 if (currentCheck.required === 'اتبع قواعد الهيكل المحددة' || specificMessage.includes('المطلوب:')) {
                     messagePart = specificMessage;
                 } else if (currentCheck.required) {
                     messagePart = `${specificMessage} | المطلوب: ${currentCheck.required}`;
                 } else {
                     messagePart = specificMessage;
                 }
            } else {
                messagePart = `الحالي: ${currentCheck.current} | المطلوب: ${currentCheck.required}`;
            }
          return `${title}${separator}${messagePart}`;
        }
        return null;
    }).filter(Boolean);
    
    const finalContent = contentItems.join('<br />');
    
    if (tooltip.content !== finalContent) {
      setTooltip(t => (t ? { ...t, content: finalContent } : null));
    }
  }, [analysisResults, tooltip?.violations]);

  useEffect(() => {
    if (currentView !== 'editor') {
      if (!isIdle) setIsIdle(true);
      return;
    }
    
    const IDLE_TIMEOUT = 2 * 60 * 1000;

    const handleUserActivity = () => {
      setIsIdle(false); 
      
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = window.setTimeout(() => {
        setIsIdle(true);
      }, IDLE_TIMEOUT);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }
        setIsIdle(true);
      } else {
        handleUserActivity();
      }
    };

    handleUserActivity();

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleUserActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, currentView]);


  useEffect(() => {
    if (!currentUser) return;

    const intervalId = setInterval(() => {
      if (currentView === 'editor' && !document.hidden && !isIdle) {
        recordTimeSpentOnArticle(currentUser, title, 10);
      }
    }, 10 * 1000);

    return () => clearInterval(intervalId);
  }, [currentUser, title, isIdle, currentView]);


  const clearAllHighlights = useCallback(() => {
    setHighlightedItem(null);
  }, [setHighlightedItem]);
  
  useEffect(() => {
    if (highlightedItem === null && editor && !editor.isDestroyed) {
        setTimeout(() => {
            if (!editor.isDestroyed) {
                const { tr } = editor.state;
                tr.removeMark(0, editor.state.doc.content.size, editor.schema.marks.highlight);
                editor.view.dispatch(tr.setMeta('preventAutoremoveHighlight', true));
            }
        }, 0);
    }
}, [highlightedItem, editor]);

  const applyHighlights = useCallback((highlights: { text: string; color: string }[], scrollToFirst = true) => {
    if (!editor) return;
    const { tr } = editor.state;
    const highlightMarkType = editor.schema.marks.highlight;

    tr.removeMark(0, editor.state.doc.content.size, highlightMarkType);
    let firstHighlightPos: number | null = null;
    
    const sortedHighlights = [...highlights].sort((a, b) => b.text.length - a.text.length);

    sortedHighlights.forEach(({ text, color }) => {
        const normalizedSearchText = text.replace(/\s+/g, ' ').trim();
        if (!normalizedSearchText) return;

        editor.state.doc.descendants((node, pos) => {
            if (node.isText) {
                const normalizedNodeText = node.text?.replace(/\s+/g, ' ') || '';
                let index = normalizedNodeText.indexOf(normalizedSearchText);
                while (index >= 0) {
                    const from = pos + index;
                    const to = from + normalizedSearchText.length;
                    
                    if (firstHighlightPos === null) {
                        firstHighlightPos = from;
                    }

                    const highlightMark = (highlightMarkType as any).create({
                        color,
                        highlightStyle: highlightStyle,
                        isViolation: false,
                    });
                    tr.addMark(from, to, highlightMark);

                    index = normalizedNodeText.indexOf(normalizedSearchText, index + 1);
                }
            }
        });
    });

    tr.setMeta('preventAutoremoveHighlight', true);
    editor.view.dispatch(tr);
    
    if (scrollToFirst && firstHighlightPos !== null) {
      setTimeout(() => {
        if (!editor.isDestroyed) {
          (editor.chain() as any).focus().setTextSelection(firstHighlightPos).scrollIntoView().run();
        }
      }, 50);
    }

  }, [editor, highlightStyle]);

  const handleToggleAllKeywordsHighlight = () => {
    if (highlightedItem === '__ALL_KEYWORDS__') {
        clearAllHighlights();
    } else {
        const allKeywords = [
            { text: keywords.primary, color: '#a7f3d0' },
            ...keywords.secondaries
              .map((s, i) => ({ text: s, color: SECONDARY_COLORS[i % SECONDARY_COLORS.length] }))
              .filter(k => k.text.trim() !== ''),
            { text: keywords.company, color: '#bae6fd' }
        ].filter(k => k.text.trim() !== '');
        applyHighlights(allKeywords, false);
        setHighlightedItem('__ALL_KEYWORDS__');
    }
  };

  const handleRemoveEmptyLines = () => {
    if (!editor) return;

    const { tr, doc } = editor.state;
    const rangesToRemove: { from: number; to: number }[] = [];

    doc.descendants((node, pos) => {
        if (!node) return;

        const isDeletableEmptyBlock = 
            (node.isBlock && node.content.size === 0 && !node.isTextblock && doc.resolve(pos).depth > 0) ||
            (node.type.name === 'paragraph' && node.content.size === 0);

        if (isDeletableEmptyBlock) {
            rangesToRemove.push({ from: pos, to: pos + node.nodeSize });
        }
    });

    if (rangesToRemove.length > 0) {
        rangesToRemove.reverse().forEach(range => {
            tr.delete(range.from, range.to);
        });
        editor.view.dispatch(tr);
    }
  };
  
  const handleAiAnalyze = async (userPrompt: string, options: any) => {
    setIsAiLoading(true);
    setAiResult('');

    const { manualCommand, targetKeywords, keywordCriteria, structureCriteria, goalCriteria, editorText } = options;

    let finalPromptParts: string[] = [];
    
    if (manualCommand && userPrompt.trim()) {
        finalPromptParts.push(`**الأمر المطلوب:**\n${userPrompt}`);
    }

    let contextParts: string[] = [];

    const createRuleString = (check: CheckResult | undefined): string | null => {
        if (check && check.current !== 'غير مطبق') {
            const description = check.description || `المطلوب هو ${check.required}`;
            return `- قاعدة "${check.title}": ${description}`;
        }
        return null;
    };

    if (targetKeywords) {
        let kwContext = "**الكلمات المستهدفة والشركة:**\n";
        kwContext += `- الكلمة الأساسية: ${keywords.primary || 'لم تحدد'}\n`;
        kwContext += `- الصيغ المرادفة: ${keywords.secondaries.filter(Boolean).join(', ') || 'لم تحدد'}\n`;
        kwContext += `- اسم الشركة: ${keywords.company || 'لم تحدد'}\n`;
        contextParts.push(kwContext);
    }

    if (keywordCriteria) {
        const kwAnalysis = analysisResults.keywordAnalysis;
        let kwRules = "**معايير الكلمات المستهدفة الصارمة (يجب الالتزام بها):**\n";
        
        if (keywords.primary) {
            kwRules += `- الكلمة الأساسية (${keywords.primary}): يجب أن تظهر بين ${kwAnalysis.primary.requiredCount.join(' و ')} مرة. ويجب أن تكون موجودة في: الفقرة الأولى، العنوان الأول، آخر عنوان، وآخر فقرة.\n`;
        }
        
        const activeSynonyms = keywords.secondaries.filter(s => s.trim());
        if(activeSynonyms.length > 0) {
            kwRules += `- الصيغ المرادفة (الإجمالي): يجب أن يظهر إجمالي المرادفات بين ${kwAnalysis.secondariesDistribution.requiredCount.join(' و ')} مرة.\n`;
        }

        if (keywords.company) {
            kwRules += `- اسم الشركة (${keywords.company}): يجب أن تظهر بين ${kwAnalysis.company.requiredCount.join(' و ')} مرة.\n`;
        }
        contextParts.push(kwRules);
    }

    if (structureCriteria) {
        const structureRules = Object.values(analysisResults.structureAnalysis)
            .map(createRuleString)
            .filter(Boolean)
            .join('\n');

        if (structureRules) {
            contextParts.push(`**معايير الهيكل والمحتوى الصارمة (يجب الالتزام بها):**\n${structureRules}`);
        }
    }

    if (goalCriteria && aiGoal === 'برنامج سياحي') {
        const goalChecks = [
            analysisResults.structureAnalysis.firstTitle,
            analysisResults.structureAnalysis.secondTitle,
            analysisResults.structureAnalysis.includesExcludes,
            analysisResults.structureAnalysis.preTravelH2,
            analysisResults.structureAnalysis.pricingH2,
            analysisResults.structureAnalysis.whoIsItForH2,
        ];
        
        const goalRules = goalChecks
            .map(createRuleString)
            .filter(Boolean)
            .join('\n');
            
        if (goalRules) {
            contextParts.push(`**معايير الهدف (برنامج سياحي) الصارمة (يجب الالتزام بها):**\n${goalRules}`);
        }
    }
    
    const contextString = contextParts.join('\n\n');
    if (contextString) {
        finalPromptParts.push(`مهمة: أنت مساعد كتابة متخصص في تحسين محركات البحث (SEO). يرجى الالتزام بالقواعد والسياق التالي بدقة عند تنفيذ الأمر المطلوب.\n\n**-- سياق وقواعد --**\n${contextString}\n**-- نهاية السياق --**`);
    }
    
    if (editorText) {
        finalPromptParts.push(`**النص للعمل عليه:**\n---\n${text}\n---`);
    }

    const finalPrompt = finalPromptParts.join('\n\n');

    if (!finalPrompt.trim()) {
        setAiResult("يرجى كتابة أمر أو تحديد سياق للتحليل.");
        setIsAiLoading(false);
        return;
    }
    
    const result = await callGeminiAnalysis(finalPrompt.trim());
    setAiResult(result);
    setIsAiLoading(false);
};

  const handleToggleToc = () => {
    if (!editor) return;
    const { tr } = editor.state;
    const tocIdentifier = '<!-- TOC -->';
    
    const firstTiptapNode = editor.state.doc.firstChild;

    if (firstTiptapNode && firstTiptapNode.textContent.startsWith(tocIdentifier)) {
        tr.delete(0, firstTiptapNode.nodeSize);
        editor.view.dispatch(tr);
        setIsTocVisible(false);
        return;
    }

    const tocItems: string[] = [];
    let introAdded = false;

    editor.state.doc.forEach(node => {
        // If there's content before the first heading, label it as "Introduction"
        if (!introAdded && node.type !== 'heading' && node.textContent.trim().length > 0) {
            tocItems.push("- المقدمة");
            introAdded = true;
        }

        if (node.type.name === 'heading') {
            // If we encounter a heading and haven't added an intro yet, add it now.
            // This covers the case where the article starts directly with a heading.
            if (!introAdded) {
                tocItems.push("- المقدمة");
                introAdded = true;
            }
            
            const indent = '  '.repeat(node.attrs.level - 1);
            tocItems.push(`${indent}- H${node.attrs.level}: ${node.textContent}`);
        }
    });

    // Handle case where there is only an introduction and no headings
    if (!introAdded && editor.state.doc.textContent.trim().length > 0) {
        tocItems.push("- المقدمة");
    }

    if (tocItems.length > 0) {
        const tocList = tocItems.join('\n');
        const tocNode = editor.schema.nodes.paragraph.create(null, editor.schema.text(`${tocIdentifier}\n${tocList}`));
        
        tr.insert(0, tocNode);
        editor.view.dispatch(tr);
        setIsTocVisible(true);
    }
  };
    
  const handleSaveDraft = useCallback(() => {
    if (editor && currentUser) {
      const contentJSON = editor.getJSON();
      const textContent = editor.getText();
      
      const isKeywordsEmpty = keywords.primary.trim() === '' &&
                          keywords.company.trim() === '' &&
                          keywords.secondaries.every(s => s.trim() === '') &&
                          keywords.lsi.length === 0;
      
      const isArticleEmpty = title.trim() === '' && textContent.trim() === '' && isKeywordsEmpty;

      if (isArticleEmpty) {
          return;
      }

      try {
        recordArticleSave(currentUser, title, contentJSON, keywords, analysisResults);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Could not save article:", error);
      }
    }
  }, [editor, title, currentUser, keywords, analysisResults]);

  const handleRestoreDraft = useCallback(() => {
    if (editor) {
      try {
        const savedContent = localStorage.getItem(MANUAL_DRAFT_KEY);
        const savedTitle = localStorage.getItem(MANUAL_DRAFT_TITLE_KEY);
        const savedKeywords = localStorage.getItem(MANUAL_DRAFT_KEYWORDS_KEY);
        if (savedContent) {
          editor.commands.setContent(JSON.parse(savedContent));
          setRestoreStatus('restored');
          setTimeout(() => setRestoreStatus('idle'), 2000);
        }
        if (savedTitle) {
          setTitle(savedTitle);
        }
        if (savedKeywords) {
          setKeywords(JSON.parse(savedKeywords));
        }
      } catch (error) {
        console.error("Could not restore manual draft:", error);
      }
    }
  }, [editor]);

  const handleExportHtml = useCallback(() => {
    if (!editor) return;

    const htmlContent = editor.getHTML();
    const articleTitle = title.trim() || 'مقالة بدون عنوان';

    const embeddedStyles = `
      body {
        font-family: 'Cairo', sans-serif;
        background-color: #FAFAFA;
        color: #333333;
        line-height: 1.75;
        font-size: 1.125rem;
        max-width: 800px;
        margin: 2rem auto;
        padding: 2rem;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
      h1 { font-size: 2.25rem; line-height: 2.5rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
      h2 { font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
      h3 { font-size: 1.5rem; line-height: 2rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
      h4 { font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
      p { margin-bottom: 1rem; }
      ul, ol { margin: 1rem 1.5rem; }
      ul { list-style-type: disc; }
      ol { list-style-type: decimal; }
      li > p {
        margin-bottom: 0.25rem;
      }
      mark {
        padding: 0;
        border-radius: 4px;
        background-clip: padding-box;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }
      table {
        border-collapse: collapse;
        margin: 1rem 0;
        overflow: hidden;
        table-layout: fixed;
        width: 100%;
      }
      td, th {
        border: 2px solid #ced4da;
        box-sizing: border-box;
        min-width: 1em;
        padding: 0.25rem 0.5rem;
        position: relative;
        vertical-align: top;
        line-height: 1.5;
        color: #333333;
      }
      th {
        background-color: #f1f3f5;
        font-weight: bold;
        text-align: right;
      }
    `;

    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${articleTitle}</title>
  <style>${embeddedStyles}</style>
</head>
<body>
  <h1>${articleTitle}</h1>
  ${htmlContent}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = articleTitle.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_').toLowerCase();
    link.download = `${filename || 'article'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [editor, title]);

  const handleLogin = useCallback((username: string, password: string): boolean => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const user = USERS.find(u => u.username === trimmedUsername && u.password === trimmedPassword);
    if (user) {
      setCurrentUser(user.username);
      recordLogin(user.username);
      try {
        sessionStorage.setItem('currentUser', user.username);
      } catch (error) {
          console.error("Could not write to sessionStorage:", error);
      }
      setCurrentView('dashboard');
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('currentUser');
    } catch (error) {
      console.error("Could not remove from sessionStorage:", error);
    }
    setCurrentView('login');
  }, []);

  const handleLoadArticle = useCallback((title: string, article: ArticleActivity) => {
    if (editor && article) {
        setTitle(title);
        setKeywords(article.keywords || INITIAL_KEYWORDS);
        editor.commands.setContent(article.content || INITIAL_CONTENT);
        setCurrentView('editor');
    }
  }, [editor]);

  const handleNewArticle = useCallback(() => {
    handleSaveDraft();

    if (editor) {
      setTitle('');
      setKeywords(INITIAL_KEYWORDS);
      editor.commands.setContent(INITIAL_CONTENT);
      setCurrentView('editor');
    }
  }, [editor, handleSaveDraft]);
  
  const handleHighlightStructureItem = useCallback((item: CheckResult) => {
    if (!editor) return;
    const title = item.title;

    if (highlightedItem === title) {
        clearAllHighlights();
        return;
    }
    
    if (item.status !== 'pass' && item.violatingItems && item.violatingItems.length > 0) {
        const { tr } = editor.state;
        const highlightMarkType = editor.schema.marks.highlight;
        tr.removeMark(0, editor.state.doc.content.size, highlightMarkType);

        item.violatingItems.forEach(violation => {
            const highlightMark = (highlightMarkType as any).create({
                color: '#fda4af',
                violation: title,
                from: violation.from,
                highlightStyle: highlightStyle,
                isViolation: true,
            });
            tr.addMark(violation.sectionFrom ?? violation.from, violation.sectionTo ?? violation.to, highlightMark);
        });

        if (tr.steps.length > 0) {
            tr.setMeta('preventAutoremoveHighlight', true);
            editor.view.dispatch(tr);
        }
        setHighlightedItem(title);

        setTimeout(() => {
            if (!editor.isDestroyed && item.violatingItems?.[0]) {
                (editor.chain() as any)
                    .focus()
                    .setTextSelection(item.violatingItems[0].from)
                    .scrollIntoView()
                    .run();
            }
        }, 50);

    } else {
        clearAllHighlights();
    }
}, [editor, highlightedItem, clearAllHighlights, setHighlightedItem, highlightStyle]);
  
    useEffect(() => {
      if (currentUser) {
          const data = getActivityData();
          const userPrefs = data[currentUser];
          setHighlightStyle(userPrefs?.preferredHighlightStyle || 'background');
          setKeywordViewMode(userPrefs?.preferredKeywordViewMode || 'classic');
          setStructureViewMode(userPrefs?.preferredStructureViewMode || 'grid');
      }
  }, [currentUser]);

  const handleHighlightStyleChange = (style: 'background' | 'underline') => {
      setHighlightStyle(style);
      if (currentUser) {
          saveUserPreference(currentUser, { preferredHighlightStyle: style });
      }
  };

  const handleKeywordViewModeChange = (mode: 'classic' | 'modern') => {
      setKeywordViewMode(mode);
      if (currentUser) {
          saveUserPreference(currentUser, { preferredKeywordViewMode: mode });
      }
  };

  const handleStructureViewModeChange = (mode: 'grid' | 'list') => {
      setStructureViewMode(mode);
      if (currentUser) {
          saveUserPreference(currentUser, { preferredStructureViewMode: mode });
      }
  };

  if (currentView === 'login') {
    return <Login onLogin={handleLogin} isDarkMode={isDarkMode} />;
  }

  if (currentView === 'dashboard') {
    return (
      <Dashboard 
        onGoToEditor={() => setCurrentView('editor')} 
        onNewArticle={handleNewArticle}
        currentUser={currentUser!}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onLoadArticle={handleLoadArticle}
        preferredHighlightStyle={highlightStyle}
        onHighlightStyleChange={handleHighlightStyleChange}
        preferredKeywordViewMode={keywordViewMode}
        onKeywordViewModeChange={handleKeywordViewModeChange}
        preferredStructureViewMode={structureViewMode}
        onStructureViewModeChange={handleStructureViewModeChange}
      />
    );
  }

  return (
    <div className={`h-screen overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
        <main className="flex h-full p-2 gap-2 bg-[#FAFAFA] dark:bg-[#181818]">
            <LeftSidebar 
                keywords={keywords}
                setKeywords={setKeywords}
                keywordAnalysis={analysisResults.keywordAnalysis}
                applyHighlights={applyHighlights}
                clearAllHighlights={clearAllHighlights}
                highlightedItem={highlightedItem}
                setHighlightedItem={setHighlightedItem}
                duplicateAnalysis={analysisResults.duplicateAnalysis}
                duplicateStats={analysisResults.duplicateStats}
                editor={editor}
                keywordViewMode={keywordViewMode}
            />
            <div className="relative basis-1/2 flex flex-col h-full min-w-0">
                <EditorToolbar 
                    editor={editor!} 
                    clearAllHighlights={clearAllHighlights} 
                    onToggleAllKeywordsHighlight={handleToggleAllKeywordsHighlight}
                    onRemoveEmptyLines={handleRemoveEmptyLines}
                    highlightedItem={highlightedItem} 
                    totalWordCount={analysisResults.wordCount}
                    totalCharCount={text.length}
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    title={title}
                    setTitle={setTitle}
                    onToggleToc={handleToggleToc}
                    isTocVisible={isTocVisible}
                    onSaveDraft={handleSaveDraft}
                    onRestoreDraft={handleRestoreDraft}
                    onExportHtml={handleExportHtml}
                    saveStatus={saveStatus}
                    restoreStatus={restoreStatus}
                    draftExists={draftExists}
                    onLogout={handleLogout}
                    isTooltipAlwaysOn={isTooltipAlwaysOn}
                    setIsTooltipAlwaysOn={setIsTooltipAlwaysOn}
                    onShowDashboard={() => setCurrentView('dashboard')}
                    isIdle={isIdle}
                />
                <div ref={scrollContainerRef} className="flex-grow overflow-y-auto custom-scrollbar border-t border-gray-300 dark:border-[#3C3C3C] bg-white dark:bg-[#1F1F1F]">
                    <EditorContent editor={editor} />
                </div>
                <button
                    onClick={handleScrollToTop}
                    className="absolute bottom-4 right-4 z-40 p-2 bg-[#00778e] text-white rounded-full shadow-lg hover:bg-[#005f73] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00778e] dark:focus:ring-offset-gray-800 transition-opacity duration-300"
                    title="العودة إلى الأعلى"
                    aria-label="العودة إلى الأعلى"
                >
                    <ArrowUp size={16} />
                </button>
            </div>
            <RightSidebar 
                analysisResults={analysisResults}
                editor={editor} 
                clearAllHighlights={clearAllHighlights}
                applyHighlights={applyHighlights}
                highlightedItem={highlightedItem}
                setHighlightedItem={setHighlightedItem}
                onAiAnalyze={handleAiAnalyze}
                aiResult={aiResult}
                isAiLoading={isAiLoading}
                keywords={keywords}
                aiGoal={aiGoal}
                highlightStyle={highlightStyle}
                setAiGoal={setAiGoal}
                onHighlightStructureItem={handleHighlightStructureItem}
                structureViewMode={structureViewMode}
            />
            {tooltip && (
                <div
                    className="fixed bg-gray-800 text-white text-xs rounded py-1 px-2 pointer-events-none z-50 shadow-lg"
                    style={{ top: tooltip.top, left: tooltip.left, transform: 'translateY(-100%)' }}
                    dangerouslySetInnerHTML={{ __html: tooltip.content }}
                >
                </div>
            )}
        </main>
    </div>
  );
};

export default App;