import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Edit, RefreshCw, Clock, Key, Save, Book, Trash2, AlertCircle, Repeat, FileText, PlusSquare, PaintRoller, Baseline, LayoutGrid, ListTree, List, ChevronRight } from 'lucide-react';
import { getActivityData, UserActivity, ArticleActivity, deleteArticleActivity, renameArticleActivity, clearAllUserData } from '../hooks/useUserActivity';

type ActivityData = {
  [username: string]: UserActivity;
};

interface DashboardProps {
  onGoToEditor: () => void;
  onNewArticle: () => void;
  currentUser: string;
  onLogout: () => void;
  isDarkMode: boolean;
  onLoadArticle: (title: string, activity: ArticleActivity) => void;
  preferredHighlightStyle: 'background' | 'underline';
  onHighlightStyleChange: (style: 'background' | 'underline') => void;
  preferredKeywordViewMode: 'classic' | 'modern';
  onKeywordViewModeChange: (mode: 'classic' | 'modern') => void;
  preferredStructureViewMode: 'grid' | 'list';
  onStructureViewModeChange: (mode: 'grid' | 'list') => void;
}

const formatSeconds = (seconds: number): string => {
  if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)} ث`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [
    h > 0 ? `${h} س` : '',
    m > 0 ? `${m} د` : '',
  ].filter(Boolean).join(' ').trim() || '0 ث';
};

const SummaryStat: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#2A2A2A] rounded-lg border border-gray-200 dark:border-[#3C3C3C]">
    <div className="p-3 bg-[#00778e]/10 dark:bg-[#00778e]/20 text-[#00778e] rounded-lg">
      {icon}
    </div>
    <div className="text-right">
      <div className="text-2xl font-bold text-[#333333] dark:text-[#b7b7b7]">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  </div>
);

const SeoScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
  const getScoreColor = () => {
    if (score >= 85) return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className={`flex items-center justify-center flex-col w-16 h-16 rounded-full border-2 ${getScoreColor()}`}>
      <span className="text-xl font-bold">{Math.round(score)}</span>
      <span className="text-xs font-medium -mt-1 opacity-80">SEO</span>
    </div>
  );
};


interface ArticleItemProps {
    title: string;
    activity: ArticleActivity;
    onLoad: () => void;
    onDelete: () => void;
    onRename: (oldTitle: string, newTitle: string) => boolean;
}

const ArticleListItem: React.FC<ArticleItemProps> = ({ title, activity, onLoad, onDelete, onRename }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [newTitle, setNewTitle] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`هل أنت متأكد من رغبتك في حذف مقال "${title}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            onDelete();
        }
    };

    const handleStartRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRenaming(true);
    };

    const handleCancelRename = () => {
        setIsRenaming(false);
        setNewTitle(title);
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onRename(title, newTitle)) {
            setIsRenaming(false);
        } else {
            alert(`لا يمكن إعادة تسمية المقال إلى "${newTitle}". قد يكون هذا الاسم مستخدمًا بالفعل.`);
            inputRef.current?.focus();
        }
    };
    
    const calculateSeoScore = () => {
        if (!activity.stats) return 0;
        const { violatingCriteriaCount = 0, totalErrorsCount = 0, keywordViolations = 0 } = activity.stats;
        const deductions = (violatingCriteriaCount * 3) + (totalErrorsCount * 0.5) + (keywordViolations * 2);
        const score = Math.max(0, 100 - deductions);
        return score;
    };
    const seoScore = calculateSeoScore();

    if (isRenaming) {
      return (
          <li className="p-3 bg-gray-100 dark:bg-[#3C3C3C] rounded-lg ring-2 ring-[#00778e]">
              <form onSubmit={handleRenameSubmit}>
                  <input
                      ref={inputRef}
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full p-2 text-sm font-bold bg-white dark:bg-[#1F1F1F] rounded-md border border-gray-300 dark:border-[#4A4A4A] focus:ring-1 focus:ring-[#00778e] focus:border-[#00778e] text-[#333333] dark:text-gray-200"
                      aria-label="New article title"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                      <button type="button" onClick={(e)=>{e.stopPropagation(); handleCancelRename();}} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-[#4A4A4A] dark:text-gray-200 dark:hover:bg-[#5A5A5A]">
                          إلغاء
                      </button>
                      <button type="submit" className="px-3 py-1 text-xs font-semibold text-white bg-[#00778e] rounded-md hover:bg-[#005f73]">
                          حفظ
                      </button>
                  </div>
              </form>
          </li>
      );
    }
    
    return (
        <li 
            className="group flex items-center gap-4 p-4 bg-white dark:bg-[#2A2A2A] rounded-lg transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-[#4A4A4A] cursor-pointer border border-gray-200 dark:border-[#3C3C3C]"
            onClick={onLoad}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && onLoad()}
        >
            <SeoScoreIndicator score={seoScore} />
            <div className="flex-grow space-y-2">
                <h4 className="font-bold text-md text-[#333333] dark:text-gray-200 truncate" title={title}>
                    {title || '(بدون عنوان)'}
                </h4>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {activity.lastSaved && (
                         <span className="flex items-center gap-1.5" title="آخر حفظ">
                            <RefreshCw size={12} />
                            {new Date(activity.lastSaved).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5" title="الوقت المستغرق"><Clock size={12} /> {formatSeconds(activity.timeSpentSeconds)}</span>
                    {activity.stats && (
                        <span className="flex items-center gap-1.5" title="عدد الكلمات"><FileText size={12} /> {activity.stats.wordCount}</span>
                    )}
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-[#3a3a3a] flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5" title="مخالفات الكلمات المفتاحية">
                        <Key size={12} className="text-yellow-500" />
                        <span>{activity.stats?.keywordViolations ?? 0}</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="معايير الهيكل المخالفة">
                        <AlertCircle size={12} className="text-red-500" />
                        <span>{activity.stats?.violatingCriteriaCount ?? 0}</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="إجمالي التكرارات">
                        <Repeat size={12} className="text-blue-500" />
                        <span>{activity.stats?.totalDuplicates ?? 0}</span>
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
                 <button
                    onClick={handleStartRename}
                    className="p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-[#3C3C3C] dark:hover:text-blue-400"
                    title="إعادة تسمية المقال"
                >
                    <Edit size={16} />
                </button>
                <button
                    onClick={handleDelete}
                    className="p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-[#3C3C3C] dark:hover:text-red-400"
                    title="حذف المقال"
                >
                    <Trash2 size={16} />
                </button>
            </div>
             <ChevronRight size={20} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
        </li>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ 
    onGoToEditor, 
    onNewArticle, 
    currentUser, 
    onLogout, 
    isDarkMode, 
    onLoadArticle, 
    preferredHighlightStyle, 
    onHighlightStyleChange,
    preferredKeywordViewMode,
    onKeywordViewModeChange,
    preferredStructureViewMode,
    onStructureViewModeChange,
}) => {
  const [activityData, setActivityData] = useState<ActivityData>(getActivityData());

  const refreshData = () => {
    setActivityData(getActivityData());
  };

  const handleDeleteArticle = (articleTitle: string) => {
    deleteArticleActivity(currentUser, articleTitle);
    refreshData();
  };
  
  const handleRenameArticle = (oldTitle: string, newTitle: string): boolean => {
      const success = renameArticleActivity(currentUser, oldTitle, newTitle);
      if (success) {
          refreshData();
      }
      return success;
  };

  const handleClearAllData = () => {
    const confirmation = window.confirm(
      "تحذير: هل أنت متأكد من رغبتك في مسح جميع البيانات؟\n\nسيتم حذف كل المقالات المحفوظة، والإحصائيات، والإعدادات بشكل نهائي.\n\nلا يمكن التراجع عن هذا الإجراء."
    );
    if (confirmation) {
      clearAllUserData();
      setActivityData({});
    }
  };

  const currentUserData = activityData[currentUser];

  const handleExportDashboardHtml = () => {
    if (!currentUserData) return;

    const articles = Object.entries(currentUserData.articles || {}) as [string, ArticleActivity][];
    const totalArticles = articles.length;
    const totalTime = articles.reduce((sum, [, activity]) => sum + (activity.timeSpentSeconds || 0), 0);
    const date = new Date().toLocaleString('ar-EG');

    const calculateSeoScore = (activity: ArticleActivity) => {
        if (!activity.stats) return 0;
        const { violatingCriteriaCount = 0, totalErrorsCount = 0, keywordViolations = 0 } = activity.stats;
        const deductions = (violatingCriteriaCount * 3) + (totalErrorsCount * 0.5) + (keywordViolations * 2);
        const score = Math.max(0, 100 - deductions);
        return Math.round(score);
    };

    const styles = `
      body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; background-color: #f9fafb; color: #1f2937; padding: 2rem; }
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
      .container { max-width: 1000px; margin: auto; background-color: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      h1, h2 { color: #00778e; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1rem; }
      h1 { font-size: 2rem; }
      h2 { font-size: 1.5rem; }
      .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; }
      .stat { background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; }
      .stat-label { font-size: 0.9rem; color: #4b5563; }
      .stat-value { font-size: 1.5rem; font-weight: bold; color: #111827; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: right; }
      th { background-color: #f3f4f6; font-weight: bold; }
      tbody tr:nth-child(even) { background-color: #f9fafb; }
      footer { margin-top: 2rem; text-align: center; font-size: 0.8rem; color: #6b7280; }
    `;

    const tableRows = articles
        .sort(([, a], [, b]) => new Date(b.lastSaved || 0).getTime() - new Date(a.lastSaved || 0).getTime())
        .map(([title, activity]) => `
      <tr>
        <td>${title || '(بدون عنوان)'}</td>
        <td>${activity.lastSaved ? new Date(activity.lastSaved).toLocaleString('ar-EG') : 'غير متوفر'}</td>
        <td>${formatSeconds(activity.timeSpentSeconds)}</td>
        <td>${activity.stats?.wordCount ?? 0}</td>
        <td>${calculateSeoScore(activity)}</td>
        <td>${activity.stats?.keywordViolations ?? 0}</td>
        <td>${activity.stats?.violatingCriteriaCount ?? 0}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير لوحة التحكم - ${currentUser}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="container">
          <h1>تقرير لوحة التحكم للمستخدم: ${currentUser}</h1>
          <p>تاريخ التقرير: ${date}</p>
          
          <h2>ملخص النشاط</h2>
          <div class="summary">
            <div class="stat">
              <div class="stat-label">إجمالي المقالات</div>
              <div class="stat-value">${totalArticles}</div>
            </div>
            <div class="stat">
              <div class="stat-label">إجمالي الوقت المستغرق</div>
              <div class="stat-value">${formatSeconds(totalTime)}</div>
            </div>
          </div>

          <h2>تفاصيل المقالات</h2>
          <table>
            <thead>
              <tr>
                <th>عنوان المقال</th>
                <th>آخر حفظ</th>
                <th>الوقت المستغرق</th>
                <th>عدد الكلمات</th>
                <th>نقاط SEO</th>
                <th>مخالفات الكلمات</th>
                <th>مخالفات الهيكل</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <footer>تم إنشاء هذا التقرير بواسطة محرر المحتوى المتقدم.</footer>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard_report_${currentUser}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const intervalId = setInterval(refreshData, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const styleButtonClass = (isActive: boolean) =>
    `flex-1 flex items-center justify-center gap-2 p-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-[#1F1F1F] focus:ring-[#00778e] ${
      isActive
        ? 'bg-[#00778e] text-white shadow-sm'
        : 'bg-white hover:bg-gray-200 dark:bg-[#2A2A2A] dark:hover:bg-[#3C3C3C] text-[#333333] dark:text-[#8d8d8d]'
    }`;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} bg-gray-50 dark:bg-[#181818]`}>
      <div className="max-w-screen-xl mx-auto p-4 sm:p-6 md:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#333333] dark:text-gray-100">لوحة التحكم</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">مرحباً بعودتك، <span className="font-bold text-[#00778e]">{currentUser}</span>!</p>
          </div>
           <div className="flex items-center gap-2">
            <button
              onClick={onNewArticle}
              className="flex items-center gap-2 px-4 py-2 font-semibold text-[#333333] dark:text-[#C7C7C7] bg-white dark:bg-[#2A2A2A] border border-gray-300 dark:border-[#3C3C3C] rounded-lg hover:bg-gray-100 dark:hover:bg-[#3C3C3C] transition-colors"
            >
              <PlusSquare size={18} />
              <span>مقالة جديدة</span>
            </button>
            <button
              onClick={onGoToEditor}
              className="flex items-center gap-2 px-4 py-2 font-bold text-white bg-[#00778e] rounded-lg hover:bg-[#005f73] transition-colors"
            >
              <Edit size={18} />
              <span>الذهاب للمحرر</span>
            </button>
            <button
              onClick={onLogout}
              className="p-2.5 border rounded-lg transition-colors text-gray-500 dark:text-[#8d8d8d] border-gray-300 dark:border-[#3C3C3C] bg-white hover:bg-gray-100 dark:bg-[#2A2A2A] dark:hover:bg-[#3C3C3C]"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">مقالاتك الأخيرة</h2>
                     <button
                        onClick={refreshData}
                        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#00778e] dark:hover:text-[#94d2bd]"
                        title="تحديث البيانات"
                    >
                        <RefreshCw size={14} />
                        <span>تحديث</span>
                    </button>
                </div>
                {currentUserData && Object.keys(currentUserData.articles).length > 0 ? (
                    <ul className="space-y-3">
                         {(Object.entries(currentUserData.articles) as [string, ArticleActivity][])
                            .sort(([, a], [, b]) => new Date(b.lastSaved || 0).getTime() - new Date(a.lastSaved || 0).getTime())
                            .map(([title, activity]) => (
                                <ArticleListItem
                                    key={title}
                                    title={title}
                                    activity={activity}
                                    onLoad={() => onLoadArticle(title, activity)}
                                    onDelete={() => handleDeleteArticle(title)}
                                    onRename={handleRenameArticle}
                                />
                            ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-[#3C3C3C] rounded-lg text-center">
                        <Book size={40} className="text-gray-400 dark:text-gray-500 mb-2"/>
                        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">لم تبدأ أي مقالة بعد</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">انقر على "مقالة جديدة" للبدء.</p>
                    </div>
                )}
            </div>

            <div className="space-y-8">
                <div>
                     <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">ملخص النشاط</h2>
                     <div className="space-y-3">
                        <SummaryStat icon={<Book size={24} />} label="إجمالي المقالات" value={currentUserData ? Object.keys(currentUserData.articles).length : 0} />
                        <SummaryStat icon={<Clock size={24} />} label="إجمالي الوقت" value={formatSeconds(currentUserData ? (Object.values(currentUserData.articles) as ArticleActivity[]).reduce((sum, article) => sum + article.timeSpentSeconds, 0) : 0)} />
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">إعدادات العرض والتطبيق</h2>
                    <div className="p-4 bg-white dark:bg-[#2A2A2A] rounded-lg border border-gray-200 dark:border-[#3C3C3C] space-y-4">
                         <div>
                            <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-2">أسلوب تمييز الأخطاء</h4>
                            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-[#1F1F1F] p-1">
                                <button onClick={() => onHighlightStyleChange('background')} className={styleButtonClass(preferredHighlightStyle === 'background')} title="خلفية"><PaintRoller size={16} /></button>
                                <button onClick={() => onHighlightStyleChange('underline')} className={styleButtonClass(preferredHighlightStyle === 'underline')} title="تسطير مموج"><Baseline size={16} /></button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-2">عرض الكلمات المستهدفة</h4>
                            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-[#1F1F1F] p-1">
                                <button onClick={() => onKeywordViewModeChange('classic')} className={styleButtonClass(preferredKeywordViewMode === 'classic')} title="بطاقات تفصيلية"><LayoutGrid size={16} /></button>
                                <button onClick={() => onKeywordViewModeChange('modern')} className={styleButtonClass(preferredKeywordViewMode === 'modern')} title="قائمة حديثة"><ListTree size={16} /></button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-2">عرض الهيكل والمحتوى</h4>
                            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-[#1F1F1F] p-1">
                                <button onClick={() => onStructureViewModeChange('grid')} className={styleButtonClass(preferredStructureViewMode === 'grid')} title="صناديق مجاورة"><LayoutGrid size={16} /></button>
                                <button onClick={() => onStructureViewModeChange('list')} className={styleButtonClass(preferredStructureViewMode === 'list')} title="قائمة مدمجة"><List size={16} /></button>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">إدارة البيانات ومنطقة الخطر</h2>
                    <div className="p-4 bg-white dark:bg-[#2A2A2A] rounded-lg border border-gray-200 dark:border-[#3C3C3C] space-y-4">
                        <div>
                            <h4 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-2">تصدير البيانات</h4>
                             <button
                                onClick={handleExportDashboardHtml}
                                className="w-full flex items-center justify-center gap-2 p-2 rounded-md transition-all duration-200 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 dark:hover:bg-blue-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-[#2A2A2A] focus:ring-blue-500"
                            >
                                <FileText size={16} />
                                <span>تصدير بيانات اللوحة (HTML)</span>
                            </button>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-red-600 dark:text-red-400 mb-2">مسح البيانات</h4>
                            <button
                                onClick={handleClearAllData}
                                className="w-full flex items-center justify-center gap-2 p-2 rounded-md transition-all duration-200 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 dark:hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-[#2A2A2A] focus:ring-red-500"
                            >
                                <Trash2 size={16} />
                                <span>مسح كل البيانات</span>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;