

import { useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Keywords, FullAnalysis, CheckResult, AnalysisStatus, DuplicateAnalysis, StructureAnalysis, SecondaryKeywordAnalysis, PrimaryKeywordAnalysis, CompanyNameAnalysis, KeywordStats, LsiKeywordAnalysis } from '../types';
import {
  FAQ_KEYWORDS, INTERROGATIVE_H2_KEYWORDS, TRANSITIONAL_WORDS, CTA_WORDS,
  INTERACTIVE_WORDS, CONCLUSION_KEYWORDS, WARNING_ADVICE_WORDS, CONCLUSION_INDICATOR_WORDS, SLOW_WORDS, AMBIGUOUS_HEADING_WORDS
} from '../constants';

// --- Helper Functions ---

const getNodeText = (node: any): string => {
  if (!node) {
    return '';
  }
  if (node.type === 'text' && node.text) {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return node.content.map(getNodeText).join('');
  }
  return '';
};

const getWordCount = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

const getSentenceCount = (text: string): number => {
    return text.split(/[.!?؟]+/).filter(s => s.trim().length > 2).length || (text.trim() ? 1 : 0);
};

const normalizeArabicText = (text: string): string => {
    if (!text) return text;
    return text
        .replace(/[\u064B-\u0652]/g, "") 
        .replace(/\u0640/g, "") 
        .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") 
        .replace(/[\u0624]/g, "\u0648") 
        .replace(/[\u0626\u0649]/g, "\u064A")
        .replace(/\u0629/g, "\u0647"); 
};

const countOccurrences = (text: string, sub: string): number => {
    if (!sub || !text) return 0;
    const normalizedText = normalizeArabicText(text.toLowerCase());
    const normalizedSub = normalizeArabicText(sub.toLowerCase());
    
    if (!normalizedSub) return 0;

    const escapedSub = normalizedSub.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<!\\p{L})${escapedSub}(?!\\p{L})`, 'gu');
    return (normalizedText.match(regex) || []).length;
};


const createCheckResult = (
    title: string,
    status: AnalysisStatus,
    current: string | number,
    required: string | number,
    progress: number, // Always include progress
    description?: string,
    details?: string
): CheckResult => ({
  title, status, current, required, progress, description, details
});

const getStatus = (current: number, min: number, max: number, warnMin?: number, warnMax?: number): AnalysisStatus => {
  if (current >= min && current <= max) return 'pass';
  if ((warnMin !== undefined && current >= warnMin) && (warnMax !== undefined && current <= warnMax)) return 'warn';
  return 'fail';
};

const DUPLICATE_WORDS_EXCLUSION_LIST_RAW = [
    'الذي', 'التي', 'اللذان', 'اللتان', 'الذين', 'اللاتي', 'اللواتي', 'ما', 'من', 'متى', 'أين', 'كيف', 'كم', 'أي', 'أيان', 'مهما', 'أينما', 'حيثما', 'كيفما', 'كان', 'أصبح', 'أضحى', 'ظل', 'أمسى', 'بات', 'صار', 'ليس', 'ما زال', 'ما دام', 'ما برح', 'ما انفك', 'ما فتئ', 'إن', 'أن', 'كأن', 'لكن', 'ليت', 'لعل', 'ظن', 'حسب', 'خال', 'زعم', 'رأى', 'علم', 'وجد', 'ثم', 'أو', 'أم', 'بل', 'لا', 'حتى', 'لن', 'كي', 'لم', 'لما', 'ها', 'ألا', 'أما', 'إلا', 'غير', 'سوى', 'عدا', 'خلا', 'حاشا', 'أنى', 'إذما', 'جعل', 'حجا', 'عد', 'هب', 'تعلم', 'درى', 'ألفى', 'وهب', 'إذن', 'لا يكون', 'أنا', 'نحن', 'أنت', 'أنتِ', 'أنتما', 'أنتن', 'هو', 'هي', 'هما', 'هم', 'هن', 'أب', 'أخ', 'حم', 'فو', 'ذو', 'يا', 'أيا', 'هيا', 'هذا', 'هذه', 'ذلك', 'تلك', 'هؤلاء', 'أولئك', 'هنا', 'هناك', 'هنالك'
];
const DUPLICATE_WORDS_EXCLUSION_LIST = new Set(DUPLICATE_WORDS_EXCLUSION_LIST_RAW.map(normalizeArabicText));

const getTextAndOffsetsFromNode = (node: any): { text: string, offsets: { char: string, isText: boolean }[] } => {
    let text = '';
    let offsets: { char: string, isText: boolean }[] = [];

    if (!node.content) {
        if (node.type === 'text' && node.text) {
            return {
                text: node.text,
                offsets: node.text.split('').map((char: string) => ({ char, isText: true }))
            };
        }
        return { text: '', offsets: [] };
    }

    for (const childNode of node.content) {
        if (childNode.type === 'text') {
            if (childNode.text) {
                text += childNode.text;
                offsets.push(...childNode.text.split('').map((char: string) => ({ char, isText: true })));
            }
        } else if (childNode.type === 'hardBreak') {
            offsets.push({ char: '\n', isText: false });
        }
    }
    return { text, offsets };
};

const getAdjustedIndex = (originalIndex: number, offsets: { char: string, isText: boolean }[]): number => {
    let textCharsSeen = 0;
    for (let i = 0; i < offsets.length; i++) {
        if (offsets[i].isText) {
            if (textCharsSeen === originalIndex) {
                return i;
            }
            textCharsSeen++;
        }
    }
    if (textCharsSeen === originalIndex) {
        return offsets.length;
    }
    return originalIndex;
};


const analyzeSubHeadingStructure = (
    nodes: { type: string; level?: number; text: string; node: any; pos: number }[],
    headings: { type: string; level?: number; text: string; node: any; pos: number }[],
    level: 3 | 4,
    totalDocSize: number,
    isPosInFaqSection: (pos: number) => boolean
): CheckResult => {
    const title = `قسم H${level}`;
    
    let minWords, maxWords, minParas, maxParas, minSentences, maxSentences, description, requiredText;

    if (level === 3) {
        minWords = 35;
        maxWords = 70;
        minSentences = 2;
        maxSentences = 4;
        description = `المحتوى تحت عنوان مستوى ثالث يجب أن يتكون من ${minSentences}-${maxSentences} جمل، بإجمالي كلمات يتراوح بين ${minWords} و ${maxWords} كلمة.`;
        requiredText = `${minSentences}-${maxSentences} جمل (${minWords}-${maxWords} كلمة)`;
    } else { // level === 4
        minWords = 20;
        maxWords = 60;
        minParas = 1;
        maxParas = 1;
        description = `المحتوى تحت عنوان مستوى رابع يجب أن يكون فقرة واحدة قصيرة ومحددة، وتحتوي على ${minWords} إلى ${maxWords} كلمة.`;
        requiredText = `${maxParas} فقرة (${minWords}-${maxWords} كلمة)`;
    }

    const relevantHeadings = headings.filter(h => {
        if (h.level !== level) return false;
        if (level === 3 && isPosInFaqSection(h.pos)) return false; // Exclude H3s in FAQ
        return true;
    });

    if (relevantHeadings.length === 0) {
        return createCheckResult(title, 'pass', '0 عناوين', `مستحسن للمقالات الطويلة`, 1, description);
    }
    
    const violations: { from: number; to: number; message: string; sectionFrom?: number; sectionTo?: number }[] = [];
    const warnings: { from: number; to: number; message: string; sectionFrom?: number; sectionTo?: number }[] = [];

    const headingIndices = nodes
        .map((node, index) => {
            if (node.type === 'heading' && node.level === level) {
                if (level === 3 && isPosInFaqSection(node.pos)) return -1; // Exclude H3s in FAQ
                return index;
            }
            return -1;
        })
        .filter(index => index !== -1);

    for (const headingIndex of headingIndices) {
        const headingNode = nodes[headingIndex];
        
        let nextHeadingIndex = -1;
        for (let i = headingIndex + 1; i < nodes.length; i++) {
            if (nodes[i].type === 'heading') {
                nextHeadingIndex = i;
                break;
            }
        }

        const endNodeIndex = nextHeadingIndex === -1 ? nodes.length : nextHeadingIndex;
        const sectionNodes = nodes.slice(headingIndex + 1, endNodeIndex);
        
        const sectionParagraphs = sectionNodes.filter(n => n.type === 'paragraph' && n.text.trim().length > 0);
        
        const sectionContentForWords = sectionNodes.filter(n => 
            (n.type === 'paragraph' && n.text.trim().length > 0) || 
            n.type === 'bulletList' || 
            n.type === 'orderedList'
        );
        const sectionText = sectionContentForWords.map(n => n.text).join(' ');
        const sectionWordCount = getWordCount(sectionText);

        let wordsMet, structureMet, wordsWarn, message;

        if (level === 3) {
            const sectionSentenceCount = getSentenceCount(sectionText);
            wordsMet = sectionWordCount >= minWords && sectionWordCount <= maxWords;
            structureMet = sectionSentenceCount >= minSentences! && sectionSentenceCount <= maxSentences!;
            wordsWarn = (sectionWordCount >= minWords - 5 && sectionWordCount < minWords) || (sectionWordCount > maxWords && sectionWordCount <= maxWords + 5);
            message = `الحالي: ${sectionWordCount} كلمة, ${sectionSentenceCount} جمل`;
        } else { // level === 4
            const sectionParaCount = sectionParagraphs.length;
            wordsMet = sectionWordCount >= minWords && sectionWordCount <= maxWords;
            structureMet = sectionParaCount >= minParas! && sectionParaCount <= maxParas!;
            wordsWarn = (sectionWordCount >= minWords - 5 && sectionWordCount < minWords) || (sectionWordCount > maxWords && sectionWordCount <= maxWords + 5);
            message = `الحالي: ${sectionWordCount} كلمة, ${sectionParaCount} فقرة`;
        }

        if (!wordsMet || !structureMet) {
            const endOfSectionPos = nextHeadingIndex !== -1 ? nodes[nextHeadingIndex].pos : totalDocSize;

            const baseViolation = {
                from: headingNode.pos,
                to: headingNode.pos + getNodeSizeFromJSON(headingNode.node),
                message: message,
                sectionFrom: headingNode.pos,
                sectionTo: endOfSectionPos
            };

            if (structureMet && wordsWarn) {
                warnings.push(baseViolation);
            } else {
                violations.push(baseViolation);
            }
        }
    }
    
    const progress = relevantHeadings.length > 0 ? (relevantHeadings.length - violations.length) / relevantHeadings.length : 1;
    let worstStatus: AnalysisStatus = 'pass';
    if (violations.length > 0) {
        worstStatus = 'fail';
    } else if (warnings.length > 0) {
        worstStatus = 'warn';
    }
    
    const currentText = `${violations.length} مخالفة, ${warnings.length} تحذير`;
    if (worstStatus !== 'pass') {
        const result = createCheckResult(title, worstStatus, currentText, requiredText, progress, description);
        result.violatingItems = [...violations, ...warnings];
        return result;
    }

    return createCheckResult(title, 'pass', 'جيد', `كل الأقسام تلتزم بـ: ${requiredText}`, 1, description);
};

const findDuplicateWords = (
    nodes: { type: string; level?: number; text: string; node: any; pos: number }[],
    nodeType: 'paragraph' | 'heading'
): CheckResult => {
    const description = nodeType === 'paragraph'
        ? 'يجب تجنب تكرار الكلمات (أطول من حرفين) في نفس الفقرة. يتم استثناء قائمة من الكلمات الشائعة.'
        : 'تجنب تكرار الكلمات في نفس العنوان.';
    const title = nodeType === 'paragraph' ? 'تكرار بالفقرة' : 'تكرار بالعنوان';
    const details = nodeType === 'paragraph' ? DUPLICATE_WORDS_EXCLUSION_LIST_RAW.join(', ') : undefined;

    const relevantNodes = nodes.filter(n => n.type === nodeType && n.text.trim().length > 0);
    
    if (relevantNodes.length === 0) {
        return createCheckResult(title, 'pass', 'جيد', description, 1, description, details);
    }
    
    const violations: { from: number; to: number; message: string }[] = [];
    const violatingNodePositions = new Set<number>();

    relevantNodes.forEach(node => {
        const { text, offsets } = getTextAndOffsetsFromNode(node.node);
        const wordsMap: Map<string, { text: string; index: number }[]> = new Map();
        
        const wordRegex = /\p{L}{3,}/gu;
        let match;

        while ((match = wordRegex.exec(text)) !== null) {
            const wordText = match[0];
            const normalizedWord = normalizeArabicText(wordText.toLowerCase());

            if (nodeType === 'paragraph' && DUPLICATE_WORDS_EXCLUSION_LIST.has(normalizedWord)) {
                continue; // Skip excluded words for paragraphs only
            }

            const wordInfo = { text: wordText, index: match.index };

            if (!wordsMap.has(normalizedWord)) {
                wordsMap.set(normalizedWord, []);
            }
            wordsMap.get(normalizedWord)!.push(wordInfo);
        }

        wordsMap.forEach((occurrences, word) => {
            if (occurrences.length > 1) {
                violatingNodePositions.add(node.pos);
                for (let i = 0; i < occurrences.length; i++) { // Highlight all occurrences including the first
                    const occurrence = occurrences[i];
                    const adjustedIndex = getAdjustedIndex(occurrence.index, offsets);
                    const from = node.pos + 1 + adjustedIndex;
                    const to = from + occurrence.text.length;
                    violations.push({
                        from,
                        to,
                        message: `الكلمة المكررة: ${word}`
                    });
                }
            }
        });
    });
    
    const requiredText = description;
    const progress = relevantNodes.length > 0 ? (relevantNodes.length - violatingNodePositions.size) / relevantNodes.length : 1;

    if (violatingNodePositions.size === 0) {
        return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description, details);
    }

    const result = createCheckResult(title, 'fail', `${violations.length} تكرار`, requiredText, progress, description, details);
    result.violatingItems = violations;
    return result;
};


// --- Main Hook ---
const getNodeSizeFromJSON = (nodeJSON: any): number => {
    if (!nodeJSON || typeof nodeJSON !== 'object') {
        return 0;
    }

    if (nodeJSON.type === 'text') {
        return nodeJSON.text?.length || 0;
    }
    
    // Leaf nodes that are not text and have size 1
    if (['hardBreak', 'horizontalRule'].includes(nodeJSON.type)) {
        return 1;
    }
    
    let size = 2; // For open and close tags for non-leaf/wrapper nodes
    
    if (Array.isArray(nodeJSON.content)) {
        for (const child of nodeJSON.content) {
            size += getNodeSizeFromJSON(child);
        }
    }
    
    return size;
};

export const useContentAnalysis = (editorState: any, textContent: string, keywords: Keywords, aiGoal: string): FullAnalysis => {
  return useMemo(() => {
    const doc = editorState;
    const totalWordCount = getWordCount(textContent);

    let nodes: { type: string; level?: number; text: string; node: any; pos: number }[] = [];
    let totalDocSize = 1;
    if (doc?.content) {
      let pos = 1;
      doc.content.forEach((node: any) => {
        if (!node || typeof node !== 'object') {
          return; // Skip invalid nodes
        }
        const nodeSize = getNodeSizeFromJSON(node);
        nodes.push({ 
            type: node.type, 
            level: node.attrs?.level, 
            text: getNodeText(node), 
            node,
            pos
        });
        pos += nodeSize;
      });
      totalDocSize = pos;
    }

    const paragraphs = nodes.filter(n => n.type === 'paragraph');
    const nonEmptyParagraphs = paragraphs.filter(p => p.text.trim().length > 0);
    const headings = nodes.filter(n => n.type === 'heading');
    
    const faqSections: { startPos: number; endPos: number }[] = [];
    const faqH2Indices = nodes
        .map((node, index) => (node.type === 'heading' && node.level === 2 && FAQ_KEYWORDS.some(k => countOccurrences(node.text, k)) ? index : -1))
        .filter(index => index !== -1);

    faqH2Indices.forEach(startIndex => {
        const startPos = nodes[startIndex].pos;
        let endIndex = -1;
        for (let i = startIndex + 1; i < nodes.length; i++) {
            if (nodes[i].type === 'heading' && nodes[i].level === 2) {
                endIndex = i;
                break;
            }
        }
        const endPos = endIndex === -1 ? totalDocSize : nodes[endIndex].pos;
        faqSections.push({ startPos, endPos });
    });

    const isPosInFaqSection = (pos: number) => faqSections.some(section => pos >= section.startPos && pos < section.endPos);

    // --- Keyword Analysis ---
    const primaryAnalysis: PrimaryKeywordAnalysis = (() => {
      const p = keywords.primary;
      const count = p ? countOccurrences(textContent, p) : 0;
      const percentage = totalWordCount > 0 ? count / totalWordCount : 0;
      
      let requiredPercentage: [number, number];
      if (aiGoal === 'اكاديمية') {
          requiredPercentage = [0.008, 0.009];
      } else if (aiGoal === 'البيع') {
          requiredPercentage = [0.005, 0.008];
      } else if (aiGoal === 'مدونة' || aiGoal === 'برنامج سياحي') {
          requiredPercentage = [0.009, 0.011];
      } else {
          requiredPercentage = [0.005, 0.01];
      }
      
      const requiredCount: [number, number] = [
        Math.floor(totalWordCount * requiredPercentage[0]),
        Math.ceil(totalWordCount * requiredPercentage[1])
      ];

      const firstH2 = headings.find(h => h.level === 2);
      const h2Headings = headings.filter(h => h.level === 2);
      const lastH2 = h2Headings.length > 0 ? h2Headings[h2Headings.length - 1] : null;

      const checks = p ? [
        { text: 'في أول فقرة', isMet: paragraphs.length > 0 && countOccurrences(paragraphs[0].text, p) > 0 },
        { text: 'في أول H2', isMet: firstH2 ? countOccurrences(firstH2.text, p) > 0 : false },
        { text: 'في آخر H2', isMet: lastH2 ? countOccurrences(lastH2.text, p) > 0 : false },
        { 
          text: 'في آخر فقرتين', 
          isMet: (paragraphs.length > 0 && countOccurrences(paragraphs[paragraphs.length - 1].text, p) > 0) || 
                 (paragraphs.length > 1 && countOccurrences(paragraphs[paragraphs.length - 2].text, p) > 0) 
        }
      ] : [];

      if (p) {
        const h2Count = h2Headings.length;
        const h2sText = h2Headings.map(h => h.text).join(' ');
        const countInH2 = countOccurrences(h2sText, p);

        let h2CheckIsMet = true;
        if (h2Count >= 5 && h2Count <= 8) {
            h2CheckIsMet = countInH2 >= 1 && countInH2 <= 2;
        }
        
        checks.push({
          text: `في H2 (${countInH2})`,
          isMet: h2CheckIsMet
        });
      }

      return {
        count,
        percentage,
        requiredPercentage: requiredPercentage,
        requiredCount: requiredCount,
        status: getStatus(count, requiredCount[0], requiredCount[1]),
        checks: checks
      };
    })();

    // --- Synonyms Analysis ---
    let totalSecondariesRequiredPercentage: [number, number];
    if (aiGoal === 'البيع') {
        totalSecondariesRequiredPercentage = [0.003, 0.005];
    } else {
        totalSecondariesRequiredPercentage = [0.005, 0.01]; // 0.5% - 1%
    }

    const activeSecondariesCount = keywords.secondaries.filter(s => s.trim()).length;
    
    const individualSecondaryRequiredPercentage: [number, number] = activeSecondariesCount > 0
        ? [totalSecondariesRequiredPercentage[0] / activeSecondariesCount, totalSecondariesRequiredPercentage[1] / activeSecondariesCount]
        : [0, 0];
        
    const secondariesAnalysis: SecondaryKeywordAnalysis[] = keywords.secondaries.map((s): SecondaryKeywordAnalysis => {
      if (!s.trim()) {
        return {
          count: 0,
          percentage: 0,
          requiredPercentage: [0, 0],
          requiredCount: [0, 0],
          status: 'info',
          checks: [],
        };
      }
      const count = countOccurrences(textContent, s);
      const percentage = totalWordCount > 0 ? count / totalWordCount : 0;
      
      const requiredPercentage = individualSecondaryRequiredPercentage;
      const requiredCount: [number, number] = [
          Math.floor(totalWordCount * requiredPercentage[0]), 
          Math.ceil(totalWordCount * requiredPercentage[1])
      ];
      
      const h2s = headings.filter(h => h.level === 2);
      const h2sWithSynonym = h2s.filter(h => countOccurrences(h.text, s) > 0);
      const isInH2 = h2sWithSynonym.length > 0;

      let allH2sWithSynonymAreValid = true;
      if (isInH2) {
          for (const h2 of h2sWithSynonym) {
              const h2IndexInNodes = nodes.findIndex(node => node.pos === h2.pos);
              if (h2IndexInNodes === -1) continue;

              let nextHeadingIndex = -1;
              for (let i = h2IndexInNodes + 1; i < nodes.length; i++) {
                  if (nodes[i].type === 'heading') {
                      nextHeadingIndex = i;
                      break;
                  }
              }
              
              const endOfSectionIndex = nextHeadingIndex === -1 ? nodes.length : nextHeadingIndex;
              const sectionParagraphs = nodes.slice(h2IndexInNodes + 1, endOfSectionIndex)
                  .filter(node => node.type === 'paragraph');
              
              const sectionText = sectionParagraphs.map(p => p.text).join(' ');
              
              if (countOccurrences(sectionText, s) === 0) {
                  allH2sWithSynonymAreValid = false;
                  break;
              }
          }
      }

      return {
        count,
        percentage,
        requiredPercentage,
        requiredCount,
        status: getStatus(count, requiredCount[0], requiredCount[1]),
        checks: [
          { text: 'في H2', isMet: isInH2 },
          { text: 'في فقرة H2', isMet: isInH2 && allH2sWithSynonymAreValid }
        ],
      };
    });

    const secondariesDistribution: KeywordStats = (() => {
        const totalCount = secondariesAnalysis.reduce((sum, s) => sum + s.count, 0);
        const percentage = totalWordCount > 0 ? totalCount / totalWordCount : 0;
        
        const requiredPercentage = totalSecondariesRequiredPercentage;
        const requiredCount: [number, number] = [
            Math.floor(totalWordCount * requiredPercentage[0]), 
            Math.ceil(totalWordCount * requiredPercentage[1])
        ];

        return {
            count: totalCount,
            percentage,
            requiredPercentage,
            requiredCount,
            status: getStatus(totalCount, requiredCount[0], requiredCount[1]),
        };
    })();

    const companyAnalysis: CompanyNameAnalysis = (() => {
        const c = keywords.company;
        const count = c ? countOccurrences(textContent, c) : 0;
        const percentage = totalWordCount > 0 ? count / totalWordCount : 0;
        const requiredPercentage: [number, number] = [0.001, 0.002];
        const requiredCount: [number, number] = [Math.floor(totalWordCount * requiredPercentage[0]), Math.ceil(totalWordCount * requiredPercentage[1])];

        return {
            count,
            percentage,
            requiredPercentage,
            requiredCount,
            status: getStatus(count, requiredCount[0], requiredCount[1]),
        };
    })();

    const lsiAnalysis = ((): LsiKeywordAnalysis => {
        const lsiKeywords = keywords.lsi.filter(k => k.trim());

        const result: LsiKeywordAnalysis = {
            distribution: { count: 0, percentage: 0, requiredCount: [0, 0], requiredPercentage: [0, 0], status: 'info' },
            balance: createCheckResult('توازن LSI', 'pass', 'لا توجد كلمات', 'الفرق <= 2', 1, 'يعتبر التوازن جيداً عندما يكون الفرق في عدد مرات التكرار بين أكثر كلمة وأقل كلمة استخداماً (من الكلمات المذكورة) لا يزيد عن 2.'),
            keywords: []
        };

        if (lsiKeywords.length === 0) {
            return result;
        }

        result.keywords = lsiKeywords.map(k => {
            const count = countOccurrences(textContent, k);
            const percentage = totalWordCount > 0 ? count / totalWordCount : 0;
            return { text: k, count, percentage };
        });

        let requiredPercentage: [number, number];
        switch(aiGoal) {
            case 'مدونة':
                requiredPercentage = [0.02, 0.03];
                break;
            case 'البيع':
            case 'برنامج سياحي':
            case 'اكاديمية':
            default:
                requiredPercentage = [0.015, 0.025];
        }
        
        const totalCount = result.keywords.reduce((sum, kw) => sum + kw.count, 0);
        const totalPercentage = totalWordCount > 0 ? totalCount / totalWordCount : 0;
        const requiredCount: [number, number] = [
            Math.floor(totalWordCount * requiredPercentage[0]),
            Math.ceil(totalWordCount * requiredPercentage[1])
        ];
        
        const warnMin = Math.max(0, requiredCount[0] - 5);
        const warnMax = requiredCount[1] + 5;

        result.distribution = {
            count: totalCount,
            percentage: totalPercentage,
            requiredPercentage,
            requiredCount,
            status: getStatus(totalCount, requiredCount[0], requiredCount[1], warnMin, warnMax)
        };

        const keywordsWithCount = result.keywords;
        const missingKeywords = keywordsWithCount.filter(kw => kw.count === 0).map(kw => kw.text);
        const usedKeywords = keywordsWithCount.filter(kw => kw.count > 0);
        
        if (missingKeywords.length > 0) {
             result.balance = createCheckResult(
                'توازن LSI', 
                'fail', 
                `${missingKeywords.length} كلمات مفقودة`, 
                'استخدام كل الكلمات', 
                0, 
                `الكلمات التالية لم تستخدم: ${missingKeywords.join(', ')}`
            );
            return result;
        }
        
        if (usedKeywords.length < 2) {
            result.balance = createCheckResult('توازن LSI', 'pass', 'جيد', 'الفرق <= 2', 1, 'يعتبر التوازن جيداً عندما يكون الفرق في عدد مرات التكرار بين أكثر كلمة وأقل كلمة استخداماً (من الكلمات المذكورة) لا يزيد عن 2.');
            return result;
        }

        let minCount = Infinity;
        let maxCount = -Infinity;
        let mostUsedKeyword = '';
        let leastUsedKeyword = '';

        usedKeywords.forEach(kw => {
            if (kw.count < minCount) {
                minCount = kw.count;
                leastUsedKeyword = kw.text;
            }
            if (kw.count > maxCount) {
                maxCount = kw.count;
                mostUsedKeyword = kw.text;
            }
        });
        
        const difference = maxCount - minCount;

        if (difference > 2) {
            const description = `الفرق في التكرار بين الكلمات المستخدمة كبير. الأكثر تكراراً هي "${mostUsedKeyword}" (${maxCount} مرة) والأقل هي "${leastUsedKeyword}" (${minCount} مرة). الفرق هو ${difference} (المطلوب <= 2).`;
            result.balance = createCheckResult(
                'توازن LSI', 
                'fail',
                `الفرق: ${difference}`, 
                'الفرق <= 2', 
                0, 
                description
            );
        } else {
             const description = `توزيع الكلمات متوازن. الفرق بين الأكثر والأقل استخدامًا هو ${difference} (المطلوب <= 2).`;
             result.balance = createCheckResult(
                'توازن LSI', 
                'pass', 
                `الفرق: ${difference}`, 
                'الفرق <= 2', 
                1, 
                description
            );
        }

        return result;
    })();
    
    // --- Structure Analysis ---
    
    const conclusionSection = (() => {
        const lastH2Index = nodes.map((n, i) => (n.type === 'heading' && n.level === 2 ? i : -1)).filter(i => i !== -1).pop();
        if (lastH2Index === undefined) return null;
        const lastH2Node = nodes[lastH2Index];
        const isConclusion = CONCLUSION_KEYWORDS.some(k => countOccurrences(lastH2Node.text, k) > 0);
        if (!isConclusion) return null;
        const sectionNodes = nodes.slice(lastH2Index + 1);
        const sectionText = sectionNodes.map(n => n.text).join(' ');
        const sectionParagraphs = sectionNodes.filter(n => n.type === 'paragraph' && n.text.trim().length > 0);
        const hasList = sectionNodes.some(n => n.type === 'bulletList' || n.type === 'orderedList');
        const hasNumber = /\d/.test(sectionText);
        return { text: sectionText, paragraphs: sectionParagraphs, hasList, hasNumber, wordCount: getWordCount(sectionText) };
    })();

    const h2StructureCheck = (() => {
        const title = 'قسم H2';
        const description = 'يجب أن يتبع كل قسم عنوان مستوى ثاني بنية محددة بناءً على عدد الكلمات والعناوين الفرعية (عنوان مستوى ثالث). انقر على أيقونة المعلومات لعرض القواعد بالتفصيل.';
        const details = `
- 80-150 كلمة: يجب أن يحتوي على 1-2 فقرة وبدون عنوان مستوى ثالث.
- 150-180 كلمة: وضع عنوان مستوى ثالث اختياري (تحذير). إذا تم وضع عنوان مستوى ثالث، يصبح مطلوب 2-4 فقرات في القسم.
- 180-220 كلمة: يجب وضع 2-3 عناوين مستوى ثالث و 3-8 فقرات في القسم.
- 220-300 كلمة: يجب وضع 3-4 عناوين مستوى ثالث و 4-10 فقرات في القسم.
- أكثر من 300 كلمة: مخالف.
        `.trim();
        const h2Headings = headings.filter(h => h.level === 2);
        const h2Count = h2Headings.length;
    
        if (h2Count === 0) {
            return createCheckResult(title, totalWordCount > 300 ? 'warn' : 'pass', '0 عناوين', 'يفضل استخدام عنوان مستوى ثاني', totalWordCount > 300 ? 0 : 1, description, details);
        }
    
        const violations: { from: number; to: number; message: string; sectionFrom?: number, sectionTo?: number }[] = [];
        const warnings: { from: number; to: number; message: string; sectionFrom?: number, sectionTo?: number }[] = [];
    
        const h2Indices = nodes
            .map((node, index) => (node.type === 'heading' && node.level === 2 ? index : -1))
            .filter(index => index !== -1);
        
        const boundaries = [...h2Indices, nodes.length];
    
        for (let i = 0; i < boundaries.length - 1; i++) {
            const startNodeIndex = boundaries[i];
            const h2Node = nodes[startNodeIndex];
            const endNodeIndex = boundaries[i + 1];
            const endOfSectionPos = endNodeIndex < nodes.length ? nodes[endNodeIndex].pos : totalDocSize;
    
            const sectionNodes = nodes.slice(startNodeIndex + 1, endNodeIndex);
            const sectionParagraphs = sectionNodes.filter(n => n.type === 'paragraph' && n.text.trim().length > 0);
            const paraCount = sectionParagraphs.length;
            const sectionH3s = sectionNodes.filter(n => n.type === 'heading' && n.level === 3);
            const h3Count = sectionH3s.length;
            const sectionText = sectionNodes.map(n => n.text).join(' ');
            const wordCount = getWordCount(sectionText);
            
            let statusForThisSection: AnalysisStatus = 'pass';
            let requiredCondition = '';
    
            if (wordCount >= 80 && wordCount <= 150) {
                requiredCondition = '1-2 فقرة, بدون عنوان مستوى ثالث';
                if (!(paraCount >= 1 && paraCount <= 2 && h3Count === 0)) statusForThisSection = 'fail';
            } else if (wordCount > 150 && wordCount <= 180) {
                if (h3Count > 0) {
                    requiredCondition = '2-4 فقرات';
                    if (!(paraCount >= 2 && paraCount <= 4)) statusForThisSection = 'fail';
                } else {
                    requiredCondition = 'يفضل إضافة عنوان مستوى ثالث أو تعديل عدد الكلمات';
                    statusForThisSection = 'warn';
                }
            } else if (wordCount > 180 && wordCount <= 220) {
                requiredCondition = '2-3 عناوين مستوى ثالث, 3-8 فقرات';
                if (!(h3Count >= 2 && h3Count <= 3 && paraCount >= 3 && paraCount <= 8)) statusForThisSection = 'fail';
            } else if (wordCount > 220 && wordCount <= 300) {
                requiredCondition = '3-4 عناوين مستوى ثالث, 4-10 فقرات';
                if (!(h3Count >= 3 && h3Count <= 4 && paraCount >= 4 && paraCount <= 10)) statusForThisSection = 'fail';
            } else if (wordCount > 310) {
                requiredCondition = 'أقل من 300 كلمة';
                statusForThisSection = 'fail';
            } else if (wordCount < 70) {
                requiredCondition = 'أكثر من 80 كلمة';
                statusForThisSection = 'fail';
            } else { // Word count is in a warning range
                statusForThisSection = 'warn';
                if (wordCount >= 70 && wordCount < 80) requiredCondition = `(تحذير) ${'1-2 فقرة, بدون عنوان مستوى ثالث'}`;
                else if (wordCount > 170 && wordCount < 180) requiredCondition = `(تحذير) ${'2-3 عناوين مستوى ثالث, 3-8 فقرات'}`;
                else if (wordCount > 220 && wordCount <= 230) requiredCondition = `(تحذير) ${'2-3 عناوين مستوى ثالث, 3-8 فقرات'}`;
                else if (wordCount > 210 && wordCount < 220) requiredCondition = `(تحذير) ${'3-4 عناوين مستوى ثالث, 4-10 فقرات'}`;
                else if (wordCount > 300 && wordCount <= 310) requiredCondition = `(تحذير) ${'3-4 عناوين مستوى ثالث, 4-10 فقرات'}`;
            }
    
            if (statusForThisSection !== 'pass') {
                const message = `الحالي: ${wordCount} كلمة, ${paraCount} فقرة, ${h3Count} عناوين مستوى ثالث. المطلوب: ${requiredCondition}`;
                const item = {
                    from: h2Node.pos,
                    to: h2Node.pos + getNodeSizeFromJSON(h2Node.node),
                    message: message,
                    sectionFrom: h2Node.pos,
                    sectionTo: endOfSectionPos
                };
                if (statusForThisSection === 'fail') {
                    violations.push(item);
                } else {
                    warnings.push(item);
                }
            }
        }
        
        const progress = h2Count > 0 ? (h2Count - violations.length) / h2Count : 1;
        const requiredText = 'اتبع قواعد الهيكل المحددة';
        
        let worstStatus: AnalysisStatus = 'pass';
        if (violations.length > 0) {
            worstStatus = 'fail';
        } else if (warnings.length > 0) {
            worstStatus = 'warn';
        }
    
        if (worstStatus !== 'pass') {
            const currentText = `${violations.length} مخالفة, ${warnings.length} تحذير`;
            const result = createCheckResult(title, worstStatus, currentText, requiredText, progress, description, details);
            result.violatingItems = [...violations, ...warnings];
            return result;
        }
    
        return createCheckResult(title, 'pass', 'جيد', `كل الأقسام تلتزم بالقواعد`, 1, description, details);
    })();
    
    const h2CountCheck = (() => {
        const title = 'عدد H2';
        const description = 'يراقب عدد عناوين مستوى ثاني بناءً على طول المقال.\n- 1000-1500 كلمة: 6-7 عناوين\n- 1500-2000 كلمة: 8-9 عناوين\n- 2000-2500 كلمة: 9-10 عناوين';
        
        const h2Headings = headings.filter(h => h.level === 2);
        const h2Count = h2Headings.length;
    
        let min = 0;
        let max = Infinity;
        let requiredText = "غير مطبق";
    
        if (totalWordCount >= 1000 && totalWordCount <= 1500) {
            min = 6;
            max = 7;
            requiredText = '6-7';
        } else if (totalWordCount > 1500 && totalWordCount <= 2000) {
            min = 8;
            max = 9;
            requiredText = '8-9';
        } else if (totalWordCount > 2000 && totalWordCount <= 2500) {
            min = 9;
            max = 10;
            requiredText = '9-10';
        } else {
            const result = createCheckResult(title, 'pass', h2Count, requiredText, 1, description);
            result.violatingItems = h2Headings.map(h => ({
                from: h.pos,
                to: h.pos + getNodeSizeFromJSON(h.node),
                message: `عنوان مستوى ثاني: ${h.text}`
            }));
            return result;
        }
    
        const status = getStatus(h2Count, min, max);
        const progress = status === 'pass' ? 1 : (max > 0 ? Math.min(h2Count / max, 1) : 0);
    
        const result = createCheckResult(title, status, h2Count, requiredText, progress, description);
        
        result.violatingItems = h2Headings.map(h => ({
            from: h.pos,
            to: h.pos + getNodeSizeFromJSON(h.node),
            message: `عنوان مستوى ثاني: ${h.text}`
        }));
    
        return result;
    })();

    const h3StructureCheck = analyzeSubHeadingStructure(nodes, headings, 3, totalDocSize, isPosInFaqSection);
    const h4StructureCheck = analyzeSubHeadingStructure(nodes, headings, 4, totalDocSize, isPosInFaqSection);

    const wordCountCheck = ((): CheckResult => {
        if (aiGoal === 'برنامج سياحي') {
            let numberOfDays = 0;
            
            const durationRegex = /(\d+)\s+(يوم|أيام)/;
            const durationMatch = textContent.match(durationRegex);
    
            if (durationMatch && durationMatch[1]) {
                numberOfDays = parseInt(durationMatch[1], 10);
            } else {
                const dayHeadingRegex = /اليوم\s+(?:\d+|الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر|السادس عشر|السابع عشر|الثامن عشر|التاسع عشر|العشرون)/i;
                const mentionedDays = new Set<string>();
                headings.forEach(h => {
                    const match = h.text.match(dayHeadingRegex);
                    if (match && match[0]) {
                        mentionedDays.add(normalizeArabicText(match[0].trim()));
                    }
                });
                numberOfDays = mentionedDays.size;
            }
    
            const calculatedMin = numberOfDays > 0 ? (numberOfDays * 200 + 900) : 1100;
            const requiredWordCount = Math.max(1100, calculatedMin);
            
            const description = `لبرنامج سياحي، عدد الكلمات الأدنى هو ${requiredWordCount} بناءً على ${numberOfDays > 0 ? `${numberOfDays} يوم/أيام تم اكتشافها` : 'قاعدة عامة'}. المعادلة: عدد الأيام * 200 + 900.`;
            const requiredText = `> ${requiredWordCount}`;
    
            return createCheckResult(
                'عدد الكلمات',
                getStatus(totalWordCount, requiredWordCount, Infinity, requiredWordCount * 0.8, requiredWordCount -1),
                totalWordCount,
                requiredText,
                Math.min(totalWordCount / requiredWordCount, 1),
                description
            );
        }
    
        return createCheckResult('عدد الكلمات', getStatus(totalWordCount, 800, Infinity, 600, 799), totalWordCount, '> 800', Math.min(totalWordCount / 800, 1), 'المقال يجب أن يحتوي على 800 كلمة على الأقل للتقييم الأمثل.');
    })();

    const firstTitleCheck = ((): CheckResult => {
        const title = "العنوان الاول";
        const description = "يجب أن يكون المحتوى بعد العنوان الرئيسي H1 وقبل العنوان التالي بين 150 و 200 كلمة.";
        const requiredText = "150-200 كلمة";

        if (aiGoal !== 'برنامج سياحي') {
            return createCheckResult(title, 'pass', 'غير مطبق', requiredText, 1, description);
        }
        
        const h1Index = nodes.findIndex(n => n.type === 'heading' && n.level === 1);
        if (h1Index === -1) {
            return createCheckResult(title, 'fail', 'لا يوجد H1', requiredText, 0, description);
        }

        const nextHeadingIndex = nodes.findIndex((n, index) => index > h1Index && n.type === 'heading');
        const endOfSectionIndex = nextHeadingIndex === -1 ? nodes.length : nextHeadingIndex;

        const sectionNodes = nodes.slice(h1Index + 1, endOfSectionIndex);
        const sectionText = sectionNodes.filter(n => n.type === 'paragraph').map(n => n.text).join(' ');
        const wordCount = getWordCount(sectionText);
        const status = getStatus(wordCount, 150, 200);

        const result = createCheckResult(title, status, wordCount, requiredText, Math.min(wordCount/200, 1), description);
        
        if (status === 'fail') {
            const h1Node = nodes[h1Index];
            const endOfSectionPos = endOfSectionIndex < nodes.length ? nodes[endOfSectionIndex].pos : totalDocSize;
            result.violatingItems = [{
                from: h1Node.pos,
                to: h1Node.pos + getNodeSizeFromJSON(h1Node.node),
                message: `الحالي: ${wordCount} كلمة`,
                sectionFrom: h1Node.pos,
                sectionTo: endOfSectionPos
            }];
        }
        
        return result;
    })();

    const secondTitleCheck = ((): CheckResult => {
        const title = "H2 الثاني";
        const description = "أول عنوان مستوى ثاني يجب أن يحتوي على 'أيام' أو 'ليالي' وأن يتبعه عنوانين مستوى ثالث على الأقل.";
        const requiredText = "عنوان مستوى ثاني يتضمن 'أيام'/'ليالي' و 2+ عنوان مستوى ثالث";

        if (aiGoal !== 'برنامج سياحي') {
            return createCheckResult(title, 'pass', 'غير مطبق', requiredText, 1, description);
        }
        
        const firstH2Index = nodes.findIndex(n => n.type === 'heading' && n.level === 2);
        if (firstH2Index === -1) {
            return createCheckResult(title, 'fail', 'لا يوجد عنوان مستوى ثاني', requiredText, 0, description);
        }
        const firstH2Node = nodes[firstH2Index];

        const textCondition = countOccurrences(firstH2Node.text, 'أيام') > 0 || countOccurrences(firstH2Node.text, 'ليالي') > 0;
        
        const nextH2Index = nodes.findIndex((n, index) => index > firstH2Index && n.type === 'heading' && n.level === 2);
        const sectionEndIndex = nextH2Index === -1 ? nodes.length : nextH2Index;
        const sectionNodes = nodes.slice(firstH2Index + 1, sectionEndIndex);
        const h3Count = sectionNodes.filter(n => n.type === 'heading' && n.level === 3).length;
        const h3Condition = h3Count >= 2;

        const status = textCondition && h3Condition ? 'pass' : 'fail';
        const current = `النص: ${textCondition ? '✓' : '✗'}, عناوين مستوى ثالث: ${h3Count}`;
        
        const result = createCheckResult(title, status, current, requiredText, status === 'pass' ? 1 : 0, description);

        if (status === 'fail') {
            result.violatingItems = [{
                from: firstH2Node.pos,
                to: firstH2Node.pos + getNodeSizeFromJSON(firstH2Node.node),
                message: `النص يتضمن الكلمة المطلوبة: ${textCondition ? 'نعم' : 'لا'}. عدد عناوين مستوى ثالث: ${h3Count} (المطلوب >= 2).`
            }];
        }
        
        return result;
    })();

    const includesExcludesCheck = ((): CheckResult => {
        const title = "يشمل/لايشمل";
        const description = "يجب أن يحتوي المقال على عنوان مستوى ثاني واحد يتضمن كلمة 'يشمل'، وتحته عنوان مستوى ثالث يتضمن 'يشمل' وآخر يتضمن 'لا يشمل'.";
        const requiredText = "عنوان مستوى ثاني 'يشمل' > عنوان مستوى ثالث 'يشمل' + عنوان مستوى ثالث 'لا يشمل'";

        if (aiGoal !== 'برنامج سياحي') {
            return createCheckResult(title, 'pass', 'غير مطبق', requiredText, 1, description);
        }

        const h2IncludesHeadings = headings.filter(h => h.level === 2 && countOccurrences(h.text, 'يشمل') > 0);

        if (h2IncludesHeadings.length === 0) {
            return createCheckResult(title, 'fail', 'لا يوجد عنوان مستوى ثاني يتضمن "يشمل"', requiredText, 0, description);
        }

        if (h2IncludesHeadings.length > 1) {
            const result = createCheckResult(title, 'fail', `${h2IncludesHeadings.length} عناوين مستوى ثاني تتضمن "يشمل"`, requiredText, 0, description);
            result.violatingItems = h2IncludesHeadings.map(h => ({
                from: h.pos, to: h.pos + getNodeSizeFromJSON(h.node), message: "يجب أن يكون هناك عنوان مستوى ثاني واحد فقط يتضمن 'يشمل'"
            }));
            return result;
        }

        const targetH2 = h2IncludesHeadings[0];
        const targetH2Index = nodes.findIndex(n => n.pos === targetH2.pos);
        
        const nextH2Index = nodes.findIndex((n, index) => index > targetH2Index && n.type === 'heading' && n.level === 2);
        const sectionEndIndex = nextH2Index === -1 ? nodes.length : nextH2Index;
        const sectionNodes = nodes.slice(targetH2Index + 1, sectionEndIndex);
        
        const sectionH3s = sectionNodes.filter(n => n.type === 'heading' && n.level === 3);

        const hasIncludesH3 = sectionH3s.some(h3 => countOccurrences(h3.text, 'يشمل') > 0);
        const hasExcludesH3 = sectionH3s.some(h3 => countOccurrences(h3.text, 'لا يشمل') > 0);

        const status = hasIncludesH3 && hasExcludesH3 ? 'pass' : 'fail';
        const current = `عنوان مستوى ثالث 'يشمل': ${hasIncludesH3 ? '✓' : '✗'}, عنوان مستوى ثالث 'لا يشمل': ${hasExcludesH3 ? '✓' : '✗'}`;
        
        const result = createCheckResult(title, status, current, requiredText, status === 'pass' ? 1 : 0, description);
        if (status === 'fail') {
             result.violatingItems = [{
                from: targetH2.pos,
                to: targetH2.pos + getNodeSizeFromJSON(targetH2.node),
                message: `الحالة الحالية: ${current}`
             }];
        }
        return result;
    })();

    const createH2KeywordAndWordCountCheck = (
        title: string,
        keywords: string[],
        nodes: any[],
        headings: any[],
        totalDocSize: number
    ): CheckResult => {
        const description = `يجب أن يحتوي المقال على عنوان مستوى ثاني واحد يتضمن إحدى الكلمات (${keywords.join('/')})، وأن يكون محتواه بين 150-180 كلمة.`;
        const requiredText = "150-180 كلمة";
    
        const targetH2s = headings.filter(h => h.level === 2 && keywords.some(k => countOccurrences(h.text, k) > 0));
    
        if (targetH2s.length === 0) {
            return createCheckResult(title, 'fail', `لا يوجد عنوان مستوى ثاني بالمطلوب`, requiredText, 0, description);
        }
        
        const targetH2 = targetH2s[0]; 
        const targetH2Index = nodes.findIndex(n => n.pos === targetH2.pos);
    
        const nextHeadingIndex = nodes.findIndex((n, index) => index > targetH2Index && n.type === 'heading');
        const endOfSectionIndex = nextHeadingIndex === -1 ? nodes.length : nextHeadingIndex;
    
        const sectionNodes = nodes.slice(targetH2Index + 1, endOfSectionIndex);
        const sectionText = sectionNodes.filter(n => n.type === 'paragraph').map(n => n.text).join(' ');
        const wordCount = getWordCount(sectionText);
        
        const status = getStatus(wordCount, 150, 180);
    
        const result = createCheckResult(title, status, `${wordCount} كلمة`, requiredText, Math.min(wordCount / 180, 1), description);
        
        if (status === 'fail') {
            const endOfSectionPos = endOfSectionIndex < nodes.length ? nodes[endOfSectionIndex].pos : totalDocSize;
            result.violatingItems = [{
                from: targetH2.pos,
                to: targetH2.pos + getNodeSizeFromJSON(targetH2.node),
                message: `الحالي: ${wordCount} كلمة`,
                sectionFrom: targetH2.pos,
                sectionTo: endOfSectionPos,
            }];
        }
        
        return result;
    };

    const preTravelH2Check = ((): CheckResult => {
        const title = "H2 قبل السفر";
        if (aiGoal !== 'برنامج سياحي') {
            return createCheckResult(title, 'pass', 'غير مطبق', '150-180 كلمة', 1);
        }
        return createH2KeywordAndWordCountCheck(
            title,
            ["معلومات", "ما قبل السفر", "ما عليك معرفته"],
            nodes,
            headings,
            totalDocSize
        );
    })();
    
    const pricingH2Check = ((): CheckResult => {
        const title = "H2 سعر وحجز";
        if (aiGoal !== 'برنامج سياحي') {
            return createCheckResult(title, 'pass', 'غير مطبق', '150-180 كلمة', 1);
        }
        return createH2KeywordAndWordCountCheck(
            title,
            ["سعر", "أسعار", "حجز", "تكاليف"],
            nodes,
            headings,
            totalDocSize
        );
    })();
    
    const whoIsItForH2Check = ((): CheckResult => {
        const title = "H2 المرشح";
        const keywords = ["مناسب", "مرشح", "يناسب"];
        const description = `يجب أن يحتوي المقال على عنوان مستوى ثاني واحد يتضمن إحدى الكلمات (${keywords.join('/')}) لتحديد لمن هذا البرنامج.`;
        const requiredText = `عنوان مستوى ثاني يتضمن "مناسب" أو "مرشح" أو "يناسب"`;

        if (aiGoal !== 'برنامج سياحي') {
            return createCheckResult(title, 'pass', 'غير مطبق', requiredText, 1, description);
        }
        
        const targetH2s = headings.filter(h => h.level === 2 && keywords.some(k => countOccurrences(h.text, k) > 0));

        if (targetH2s.length > 0) {
            const result = createCheckResult(title, 'pass', 'موجود', requiredText, 1, description);
            result.violatingItems = targetH2s.map(h => ({
                from: h.pos,
                to: h.pos + getNodeSizeFromJSON(h.node),
                message: `العنوان الموجود: ${h.text}`
            }));
            return result;
        }

        return createCheckResult(title, 'fail', 'غير موجود', requiredText, 0, description);
    })();

    const summaryParagraphCheck = (() => {
        const description = 'الفقرة الأولى يجب أن تكون موجزة وتعطي نظرة عامة، بطول 30-60 كلمة وجملتين إلى أربع جمل.';
        if (nonEmptyParagraphs.length === 0) return createCheckResult('الفقرة التلخيصية', 'fail', 'لا يوجد', '30-60 كلمة', 0, description);
        
        const p = nonEmptyParagraphs[0];
        const wc = getWordCount(p.text);
        const sc = getSentenceCount(p.text);

        const wcStatus = getStatus(wc, 30, 60, 25, 65);
        const scMet = sc >= 2 && sc <= 4;
        
        let finalStatus: AnalysisStatus;
        if (!scMet) {
            finalStatus = 'fail';
        } else {
            finalStatus = wcStatus;
        }

        const progress = finalStatus === 'pass' ? 1 : (finalStatus === 'warn' ? 0.5 : 0);

        if (finalStatus === 'pass') {
            return createCheckResult('الفقرة التلخيصية', 'pass', `${wc} كلمة, ${sc} جمل`, '30-60 كلمة, 2-4 جمل', 1, description);
        }

        const result = createCheckResult('الفقرة التلخيصية', finalStatus, `${wc} كلمة, ${sc} جمل`, '30-60 كلمة, 2-4 جمل', progress, description);
        result.violatingItems = [{
            from: p.pos,
            to: p.pos + getNodeSizeFromJSON(p.node),
            message: `الحالي: ${wc} كلمة, ${sc} جمل`,
        }];
        return result;
    })();

    const secondParagraphCheck = (() => {
        const description = 'الفقرة الثانية في المقدمة يجب أن تكون قصيرة ومباشرة، بطول 30-60 كلمة وجملتين إلى ثلاث جمل.';
        const requiredText = '30-60 كلمة, 2-3 جمل';

        const firstHeadingIndex = nodes.findIndex(n => n.type === 'heading');
        const introductionNodes = firstHeadingIndex === -1 ? nodes : nodes.slice(0, firstHeadingIndex);
        const introductionParagraphs = introductionNodes.filter(n => n.type === 'paragraph' && n.text.trim().length > 0);
        
        if (introductionParagraphs.length < 2) {
            return createCheckResult('الفقرة الثانية', 'fail', 'لا يوجد فقرة ثانية في المقدمة', requiredText, 0, description);
        }
        
        const p = introductionParagraphs[1];
        const wc = getWordCount(p.text);
        const sc = getSentenceCount(p.text);
        
        const wcStatus = getStatus(wc, 30, 60, 25, 65);
        const scMet = sc >= 2 && sc <= 3;

        let finalStatus: AnalysisStatus;
        if (!scMet) {
            finalStatus = 'fail';
        } else {
            finalStatus = wcStatus;
        }
        
        const progress = finalStatus === 'pass' ? 1 : (finalStatus === 'warn' ? 0.5 : 0);
        const currentText = `${wc} كلمة, ${sc} جمل`;

        if (finalStatus === 'pass') {
            return createCheckResult('الفقرة الثانية', 'pass', currentText, requiredText, 1, description);
        }
    
        const result = createCheckResult('الفقرة الثانية', finalStatus, currentText, requiredText, progress, description);
        result.violatingItems = [{
            from: p.pos,
            to: p.pos + getNodeSizeFromJSON(p.node),
            message: `الحالي: ${currentText}`,
        }];
        return result;
    })();
    
    const paragraphLengthCheck = (() => {
        const description = 'معظم فقرات المحتوى يجب أن تتكون من 2-4 جمل (40-80 كلمة) لتكون سهلة القراءة.';
        
        const firstHeadingIndex = nodes.findIndex(n => n.type === 'heading');
        const introNodes = firstHeadingIndex === -1 ? nodes : nodes.slice(0, firstHeadingIndex);
        const introParagraphPositions = new Set(
            introNodes.filter(n => n.type === 'paragraph').map(p => p.pos)
        );

        const conclusionParas = conclusionSection ? conclusionSection.paragraphs : [];
        const conclusionParaPositions = new Set(conclusionParas.map(p => p.pos));

        const contentParagraphs = nonEmptyParagraphs.filter(p => {
            if (introParagraphPositions.has(p.pos)) return false;
            if (conclusionParaPositions.has(p.pos)) return false;
            return true;
        });
        
        const violations: { from: number; to: number; message: string }[] = [];
        const warnings: { from: number; to: number; message: string }[] = [];
        
        contentParagraphs.forEach(p => {
            if (!p || !p.node) return;
            const wc = getWordCount(p.text);
            const sc = getSentenceCount(p.text);
            const scMet = sc >= 2 && sc <= 4;
            const wcMet = wc >= 40 && wc <= 80;
            const wcWarn = (wc >= 35 && wc < 40) || (wc > 80 && wc <= 90);

            if (!scMet || !wcMet) {
                const item = {
                    from: p.pos,
                    to: p.pos + getNodeSizeFromJSON(p.node),
                    message: `الحالي: ${wc} كلمة, ${sc} جمل`
                };
                if (scMet && wcWarn) {
                    warnings.push(item);
                } else {
                    violations.push(item);
                }
            }
        });

        const requiredText = '2-4 جمل (40-80 كلمة)';
        const totalContentParagraphs = contentParagraphs.length;
        const progress = totalContentParagraphs > 0 ? (totalContentParagraphs - violations.length) / totalContentParagraphs : 1;
        
        let worstStatus: AnalysisStatus = 'pass';
        if (violations.length > 0) {
            worstStatus = 'fail';
        } else if (warnings.length > 0) {
            worstStatus = 'warn';
        }

        if (worstStatus !== 'pass') {
            const currentText = `${violations.length} مخالفة, ${warnings.length} تحذير`;
            const result = createCheckResult('طول الفقرات', worstStatus, currentText, requiredText, progress, description);
            result.violatingItems = [...violations, ...warnings];
            return result;
        }

        return createCheckResult('طول الفقرات', 'pass', 'جيد', `كل الفقرات تلتزم بـ: ${requiredText}`, 1, description);
    })();

    const betweenH2H3Check = (() => {
        const title = 'بين H2-H3';
        const minWords = 40;
        const maxWords = 120;
        const minParas = 1;
        const maxParas = 2;
        const description = 'يجب أن يكون هناك فقرة إلى فقرتين (40-120 كلمة) بين عنوان مستوى ثاني وعنوان مستوى ثالث التالي له.';
        const requiredText = '1-2 فقرة (40-120 كلمة)';
        const warnMargin = 5;

        const violations: { from: number; to: number; message: string; sectionFrom?: number; sectionTo?: number }[] = [];
        const warnings: { from: number; to: number; message: string; sectionFrom?: number; sectionTo?: number }[] = [];
        let totalSections = 0;

        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].type === 'heading' && nodes[i].level === 2) {
                const h2Node = nodes[i];

                const isFaqH2 = FAQ_KEYWORDS.some(k => countOccurrences(h2Node.text, k) > 0);
                if (isFaqH2) continue;
                
                let sectionNodesBetween: any[] = [];
                
                for (let j = i + 1; j < nodes.length; j++) {
                    const aheadNode = nodes[j];
                    if (aheadNode.type === 'heading') {
                        if (aheadNode.level === 3) {
                            totalSections++;
                            const sectionParagraphs = sectionNodesBetween.filter(n => n.type === 'paragraph' && n.text.trim().length > 0);
                            const paraCount = sectionParagraphs.length;
                            const sectionText = sectionNodesBetween.map(n => n.text).join(' ');
                            const sectionWordCount = getWordCount(sectionText);
                            
                            const paragraphsMet = paraCount >= minParas && paraCount <= maxParas;
                            const wordsMet = sectionWordCount >= minWords && sectionWordCount <= maxWords;
                            const wordsWarn = (sectionWordCount >= minWords - warnMargin && sectionWordCount < minWords) || (sectionWordCount > maxWords && sectionWordCount <= maxWords + warnMargin);
                            
                            if (!paragraphsMet || !wordsMet) {
                                const item = {
                                    from: h2Node.pos,
                                    to: h2Node.pos + getNodeSizeFromJSON(h2Node.node),
                                    message: `الحالي: ${paraCount} فقرة, ${sectionWordCount} كلمة`,
                                    sectionFrom: h2Node.pos,
                                    sectionTo: aheadNode.pos
                                };
                                if (paragraphsMet && wordsWarn) {
                                    warnings.push(item);
                                } else {
                                    violations.push(item);
                                }
                            }
                        }
                        break; 
                    } else {
                        sectionNodesBetween.push(aheadNode);
                    }
                }
            }
        }
        
        const progress = totalSections > 0 ? (totalSections - violations.length) / totalSections : 1;
        let worstStatus: AnalysisStatus = 'pass';
        if (violations.length > 0) {
            worstStatus = 'fail';
        } else if (warnings.length > 0) {
            worstStatus = 'warn';
        }
        
        if (worstStatus !== 'pass') {
            const currentText = `${violations.length} مخالفة, ${warnings.length} تحذير`;
            const result = createCheckResult(title, worstStatus, currentText, requiredText, progress, description);
            result.violatingItems = [...violations, ...warnings];
            return result;
        }

        return createCheckResult(title, 'pass', 'جيد', `كل الأقسام تلتزم بـ: ${requiredText}`, 1, description);
    })();

    const sentenceLengthCheck = (() => {
        const description = 'يجب أن تكون الجمل قصيرة وسهلة الفهم، وألا تتجاوز 25 كلمة.';
        const requiredText = '< 25 كلمة';
        const violations: { from: number; to: number; message: string }[] = [];
        let totalSentences = 0;
    
        nonEmptyParagraphs.forEach(p => {
            const { text, offsets } = getTextAndOffsetsFromNode(p.node);
            const sentenceRegex = /[^.!?؟]+(?:[.!?؟]+|\s*$)/g;
            
            const matches = [...text.matchAll(sentenceRegex)];
            totalSentences += matches.length;

            for (const match of matches) {
                const sentenceText = match[0].trim();
                if (!sentenceText) continue;

                const wordCount = getWordCount(sentenceText);

                if (wordCount > 25) {
                    const adjustedIndex = getAdjustedIndex(match.index!, offsets);
                    const from = p.pos + 1 + adjustedIndex;
                    const to = from + match[0].length;
                    violations.push({
                        from: from,
                        to: to,
                        message: `الحالي: ${wordCount} كلمة`
                    });
                }
            }
        });
        
        const progress = totalSentences > 0 ? (totalSentences - violations.length) / totalSentences : 1;
    
        if (violations.length === 0) {
            return createCheckResult('طول الجمل', 'pass', `${violations.length} جمل طويلة`, requiredText, 1, description);
        }
    
        const result = createCheckResult('طول الجمل', 'fail', `${violations.length} جمل طويلة`, requiredText, progress, description);
        result.violatingItems = violations;
        return result;
    })();

    const stepsIntroductionCheck = (() => {
        const title = 'تمهيد خطوات';
        const description = 'قبل كل قائمة (تعداد نقطي أو رقمي)، يجب أن تكون هناك فقرة تمهيدية تتكون من 25-60 كلمة و 1-3 جمل.';
        const requiredText = '25-60 كلمة | 1-3 جمل';

        const listIndices = nodes
            .map((node, index) => (node.type === 'bulletList' || node.type === 'orderedList' ? index : -1))
            .filter(index => index !== -1);
        
        if (listIndices.length === 0) {
            return createCheckResult(title, 'pass', 'لا يوجد تعداد', requiredText, 1, description);
        }

        const violations: { from: number; to: number; message: string }[] = [];
        const warnings: { from: number; to: number; message: string }[] = [];

        listIndices.forEach(listIndex => {
            const listNode = nodes[listIndex];
            if (listIndex === 0) {
                violations.push({ from: listNode.pos, to: listNode.pos + getNodeSizeFromJSON(listNode.node), message: 'لا توجد فقرة تمهيدية قبل القائمة.'});
                return;
            }

            const precedingNode = nodes[listIndex - 1];
            if (precedingNode.type !== 'paragraph') {
                violations.push({ from: listNode.pos, to: listNode.pos + getNodeSizeFromJSON(listNode.node), message: `العنصر السابق للقائمة ليس فقرة (بل ${precedingNode.type}).`});
                return;
            }

            const p = precedingNode;
            const wc = getWordCount(p.text);
            const sc = getSentenceCount(p.text);
            const wcMet = wc >= 25 && wc <= 60;
            const scMet = sc >= 1 && sc <= 3;
            const wcWarn = (wc >= 20 && wc < 25) || (wc > 60 && wc <= 65);

            if (!wcMet || !scMet) {
                 const item = { from: p.pos, to: p.pos + getNodeSizeFromJSON(p.node), message: `التمهيد غير صحيح: ${wc} كلمة, ${sc} جمل.` };
                 if (scMet && wcWarn) {
                     warnings.push(item);
                 } else {
                     violations.push(item);
                 }
            }
        });
        
        const progress = listIndices.length > 0 ? (listIndices.length - violations.length) / listIndices.length : 1;
        let worstStatus: AnalysisStatus = 'pass';
        if (violations.length > 0) {
            worstStatus = 'fail';
        } else if (warnings.length > 0) {
            worstStatus = 'warn';
        }

        if (worstStatus !== 'pass') {
            const currentText = `الحالي: ${violations.length > 0 ? violations[0].message.split(': ')[1] : warnings[0].message.split(': ')[1]}`;
            const result = createCheckResult(title, worstStatus, currentText, requiredText, progress, description);
            result.violatingItems = [...violations, ...warnings];
            return result;
        }

        return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description);
    })();

    const faqSectionCheck = (() => {
        const hasFaq = headings.some(h => h.level === 2 && FAQ_KEYWORDS.some(k => countOccurrences(h.text, k) > 0));
        return createCheckResult(
            'الأسئلة والاجوبة',
            hasFaq ? 'pass' : 'fail',
            hasFaq ? 'موجود' : 'غير موجود',
            'وجود عنوان مستوى ثاني للأسئلة',
            hasFaq ? 1 : 0,
            'يجب أن يحتوي المقال على قسم للأسئلة الشائعة بعنوان مستوى ثاني يتضمن إحدى الكلمات التالية.',
            FAQ_KEYWORDS.join(', ')
        );
    })();

    const answerParagraphCheck = ((): CheckResult => {
        const title = "فقرة الأجوبة";
        const description = "كل سؤال (H3) تحت قسم الأسئلة الشائعة (H2) يجب أن يتبعه إجابة من فقرة واحدة (35-70 كلمة و 2-3 جمل).";
        const requiredText = "35-70 كلمة | 2-3 جمل";

        if (faqSections.length === 0) {
            return createCheckResult(title, 'pass', 'لا يوجد قسم أسئلة', requiredText, 1, description);
        }
        
        const faqH3s = headings.filter(h => h.level === 3 && isPosInFaqSection(h.pos));

        if (faqH3s.length === 0) {
            return createCheckResult(title, 'pass', 'لا توجد أسئلة (H3)', requiredText, 1, description);
        }

        const violations: { from: number; to: number; message: string, sectionFrom?: number, sectionTo?: number }[] = [];
        const warnings: { from: number; to: number; message: string, sectionFrom?: number, sectionTo?: number }[] = [];

        faqH3s.forEach((h3, index) => {
            const h3NodeIndex = nodes.findIndex(n => n.pos === h3.pos);
            let nextH3Pos = index < faqH3s.length - 1 ? faqH3s[index + 1].pos : undefined;
            let sectionEndPos = faqSections.find(s => h3.pos >= s.startPos && h3.pos < s.endPos)?.endPos || totalDocSize;
            const answerEndPos = nextH3Pos ? Math.min(nextH3Pos, sectionEndPos) : sectionEndPos;
            
            const answerNodes = nodes.filter(n => n.pos > h3.pos && n.pos < answerEndPos);
            const answerParagraphs = answerNodes.filter(n => n.type === 'paragraph' && n.text.trim().length > 0);

            if (answerParagraphs.length !== 1) {
                violations.push({ from: h3.pos, to: h3.pos + getNodeSizeFromJSON(h3.node), message: `${answerParagraphs.length} فقرة`, sectionFrom: h3.pos, sectionTo: answerEndPos });
                return;
            }

            const answerPara = answerParagraphs[0];
            const wc = getWordCount(answerPara.text);
            const sc = getSentenceCount(answerPara.text);
            const wcMet = wc >= 35 && wc <= 70;
            const scMet = sc >= 2 && sc <= 3;
            const wcWarn = (wc >= 30 && wc < 35) || (wc > 70 && wc <= 75);

            if (!wcMet || !scMet) {
                const item = { from: answerPara.pos, to: answerPara.pos + getNodeSizeFromJSON(answerPara.node), message: `${wc} كلمة, ${sc} جمل`, sectionFrom: h3.pos, sectionTo: answerEndPos };
                if (scMet && wcWarn) {
                    warnings.push(item);
                } else {
                    violations.push(item);
                }
            }
        });

        const progress = faqH3s.length > 0 ? (faqH3s.length - violations.length) / faqH3s.length : 1;
        let worstStatus: AnalysisStatus = 'pass';
        if (violations.length > 0) {
            worstStatus = 'fail';
        } else if (warnings.length > 0) {
            worstStatus = 'warn';
        }

        if (worstStatus !== 'pass') {
            const worstItem = violations.length > 0 ? violations[0] : warnings[0];
            const currentText = worstItem.message;
            const result = createCheckResult(title, worstStatus, currentText, requiredText, progress, description);
            result.violatingItems = [...violations, ...warnings];
            return result;
        }

        return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description);
    })();
    
    const ambiguousHeadingsCheck = ((): CheckResult => {
        const title = 'عناوين مبهمة';
        const description = 'لا تستخدم كلمات الإشارة أو الضمائر الغامضة في عناوين H2 لجعلها صريحة ومباشرة. يجب أن يكون العنوان مفهوماً بذاته دون الحاجة لسياق.';
        const details = AMBIGUOUS_HEADING_WORDS.join(', ');
        const requiredText = '0 عناوين مبهمة';
    
        const h2Headings = headings.filter(h => h.level === 2);
        if (h2Headings.length === 0) {
            return createCheckResult(title, 'pass', 'لا يوجد H2', requiredText, 1, description, details);
        }
    
        const violations: { from: number; to: number; message: string }[] = [];
        const violatingHeadings = new Set<number>();
    
        h2Headings.forEach(h => {
            const { text, offsets } = getTextAndOffsetsFromNode(h.node);
            AMBIGUOUS_HEADING_WORDS.forEach(word => {
                const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`(?<!\\p{L})${escapedWord}(?!\\p{L})`, 'gu');
                
                let match;
                while ((match = regex.exec(text)) !== null) {
                    violatingHeadings.add(h.pos);
                    const adjustedIndex = getAdjustedIndex(match.index, offsets);
                    const from = h.pos + 1 + adjustedIndex;
                    const to = from + match[0].length;
                    violations.push({
                        from,
                        to,
                        message: `كلمة مبهمة: "${match[0]}"`
                    });
                }
            });
        });
    
        const progress = (h2Headings.length - violatingHeadings.size) / h2Headings.length;
    
        if (violations.length === 0) {
            return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description, details);
        }
    
        const result = createCheckResult(title, 'fail', `${violations.length} كلمة مخالفة`, requiredText, progress, description, details);
        result.violatingItems = violations;
        return result;
    })();
    
    const punctuationCheck = (() => {
        const description = 'يجب أن تنتهي كل فقرة بعلامة ترقيم مناسبة مثل النقطة (.), علامة الاستفهام (؟), علامة التعجب (!), أو النقطتين (:).';
        const validEndings = ['.', '?', '!', '؟', ':'];
        const violations: { from: number; to: number; message: string }[] = [];
        
        nonEmptyParagraphs.forEach(p => {
             const pText = p.text.trim();
             if (pText.length === 0) return;
             const lastChar = pText.slice(-1);
             if (!validEndings.includes(lastChar)) {
                 violations.push({
                     from: p.pos,
                     to: p.pos + getNodeSizeFromJSON(p.node),
                     message: `الفقرة تنتهي ب '${lastChar}'`
                 });
             }
        });
        
        const requiredText = 'يجب الانتهاء ب (. ؟ ! :)';
        const progress = nonEmptyParagraphs.length > 0 ? (nonEmptyParagraphs.length - violations.length) / nonEmptyParagraphs.length : 1;
    
        if (violations.length === 0) {
            return createCheckResult('علامات الترقيم', 'pass', 'جيد', requiredText, 1, description);
        }
        
        const result = createCheckResult('علامات الترقيم', 'fail', 'إنتهاء خاطئ', requiredText, progress, description);
        result.violatingItems = violations;
        return result;
    })();

    const paragraphEndingsCheck = (() => {
        const description = 'يجب تجنب إنهاء فقرتين متتاليتين بنفس الكلمة للحفاظ على التنوع اللغوي.';
        if (nonEmptyParagraphs.length < 2) {
            return createCheckResult('نهايات الفقرات', 'pass', 'N/A', 'تجنب إنهاء فقرتين متتاليتين بنفس الكلمة', 1, description);
        }

        const violations: { from: number; to: number; message: string }[] = [];
        let violatingPairs = 0;
        const wordRegex = /\p{L}+/gu;

        for (let i = 1; i < nonEmptyParagraphs.length; i++) {
            const prevP = nonEmptyParagraphs[i - 1];
            const currentP = nonEmptyParagraphs[i];

            const { text: prevText, offsets: prevOffsets } = getTextAndOffsetsFromNode(prevP.node);
            const { text: currentText, offsets: currentOffsets } = getTextAndOffsetsFromNode(currentP.node);

            const prevMatches = [...prevText.matchAll(wordRegex)];
            const currentMatches = [...currentText.matchAll(wordRegex)];

            if (prevMatches.length > 0 && currentMatches.length > 0) {
                const lastMatchPrev = prevMatches[prevMatches.length - 1];
                const lastMatchCurrent = currentMatches[currentMatches.length - 1];
                
                const prevLastWord = lastMatchPrev[0];
                const currentLastWord = lastMatchCurrent[0];

                if (prevLastWord && currentLastWord && normalizeArabicText(prevLastWord.toLowerCase()) === normalizeArabicText(currentLastWord.toLowerCase())) {
                    violatingPairs++;

                    const adjustedPrevIndex = getAdjustedIndex(lastMatchPrev.index!, prevOffsets);
                    violations.push({
                        from: prevP.pos + 1 + adjustedPrevIndex,
                        to: prevP.pos + 1 + adjustedPrevIndex + prevLastWord.length,
                        message: `الكلمة الأخيرة المكررة: ${prevLastWord}`
                    });

                    const adjustedCurrentIndex = getAdjustedIndex(lastMatchCurrent.index!, currentOffsets);
                    violations.push({
                        from: currentP.pos + 1 + adjustedCurrentIndex,
                        to: currentP.pos + 1 + adjustedCurrentIndex + currentLastWord.length,
                        message: `الكلمة الأخيرة المكررة: ${currentLastWord}`
                    });
                }
            }
        }

        const requiredText = 'تجنب إنهاء فقرتين متتاليتين بنفس الكلمة';
        const progress = nonEmptyParagraphs.length > 1 ? (nonEmptyParagraphs.length - 1 - violatingPairs) / (nonEmptyParagraphs.length - 1) : 1;

        if (violations.length === 0) {
            return createCheckResult('نهايات الفقرات', 'pass', 'جيد', requiredText, 1, description);
        }
        
        const result = createCheckResult('نهايات الفقرات', 'fail', `${violatingPairs} زوج مخالف`, requiredText, progress, description);
        result.violatingItems = violations;
        return result;
    })();

    const interrogativeH2Check = (() => {
        const count = headings.filter(h => h.level === 2 && INTERROGATIVE_H2_KEYWORDS.some(k => countOccurrences(h.text, k) > 0)).length;
        const required = 3;
        return createCheckResult('عناوين H2 استفهامية', getStatus(count, required, Infinity, 1, 2), count, `${required}+`, Math.min(count / required, 1), 'يجب استخدام 3 عناوين مستوى ثاني استفهامية على الأقل باستخدام إحدى الكلمات التالية.', INTERROGATIVE_H2_KEYWORDS.join(', '));
    })();

    const transitionalWordsCheck = (() => {
        const description = 'يجب أن تحتوي 30% على الأقل من الجمل على كلمة انتقالية. التحذير بين 20-30%. الفشل أقل من 20%.';
        const details = TRANSITIONAL_WORDS.join(', ');

        const sentences = textContent.split(/[.!?؟]+/).filter(s => s.trim().length > 2);
        const totalSentences = sentences.length;

        if (totalSentences === 0) {
            return createCheckResult(
                'كلمات إنتقالية',
                'fail',
                '0%',
                '> 30%',
                0,
                description,
                details
            );
        }

        let sentencesWithTransitions = 0;
        sentences.forEach(sentence => {
            const hasTransition = TRANSITIONAL_WORDS.some(word => countOccurrences(sentence, word) > 0);
            if (hasTransition) {
                sentencesWithTransitions++;
            }
        });

        const percentage = (sentencesWithTransitions / totalSentences) * 100;
        const percentageString = `${percentage.toFixed(0)}%`;
        
        let status: AnalysisStatus;
        if (percentage >= 30) {
            status = 'pass';
        } else if (percentage >= 20) {
            status = 'warn';
        } else {
            status = 'fail';
        }

        const progress = Math.min(percentage / 30, 1);

        return createCheckResult(
            'كلمات إنتقالية',
            status,
            percentageString,
            '> 30%',
            progress,
            description,
            details
        );
    })();
    
    const ctaWordsCheck = (() => {
        const hasCta = CTA_WORDS.some(w => countOccurrences(textContent, w) > 0);
        return createCheckResult(
            'كلمات الحث',
            hasCta ? 'pass' : 'fail',
            hasCta ? 'موجود' : 'غير موجود',
            'وجود كلمة واحدة على الأقل',
            hasCta ? 1 : 0,
            'يجب أن يحتوي المقال على كلمة واحدة على الأقل للحث على اتخاذ إجراء. الكلمات المتاحة:',
            CTA_WORDS.join(', ')
        );
    })();

    const interactiveLanguageCheck = (() => {
        const count = INTERACTIVE_WORDS.reduce((acc, word) => acc + countOccurrences(textContent, word), 0);
        const percentage = totalWordCount > 0 ? (count / totalWordCount) : 0;
        const required = 0.0002;
        return createCheckResult(
            '0.02% لغة تفاعلية',
            percentage >= required ? 'pass' : 'fail',
            `${(percentage * 100).toFixed(3)}%`,
            `> ${required * 100}%`,
            Math.min(percentage / required, 1),
            'يجب استخدام لغة تفاعلية بنسبة لا تقل عن 0.02% من إجمالي الكلمات لمخاطبة القارئ مباشرة. الكلمات المتاحة:',
            INTERACTIVE_WORDS.join(', ')
        );
    })();

    const lastH2ConclusionCheck = (() => {
        const lastH2 = headings.filter(h => h.level === 2).pop();
        const isConclusion = lastH2 ? CONCLUSION_KEYWORDS.some(k => countOccurrences(lastH2.text, k) > 0) : false;
        return createCheckResult(
            'عنوان الخاتمة',
            isConclusion ? 'pass' : 'fail',
            isConclusion ? 'نعم' : 'لا',
            'يجب أن يكون',
            isConclusion ? 1 : 0,
            'آخر عنوان مستوى ثاني في المقال يجب أن يكون الخاتمة باستخدام إحدى الكلمات التالية.',
            CONCLUSION_KEYWORDS.join(', ')
        );
    })();

    const automaticListsCheck = (() => {
        const hasList = nodes.some(n => n.type === 'bulletList' || n.type === 'orderedList');
        return createCheckResult(
            'التعداد الآلي',
            hasList ? 'pass' : 'fail',
            hasList ? 'موجود' : 'غير موجود',
            'وجود قوائم',
            hasList ? 1 : 0,
            'يجب استخدام قوائم نقطية أو رقمية لتنظيم المعلومات وتسهيل قراءتها.'
        );
    })();

    const arabicOnlyCheck = (() => {
        const title = 'كلمات لاتينية';
        const description = 'يجب أن لا تتجاوز نسبة الكلمات اللاتينية 0.5% من إجمالي النص. سيتم استثناء الكلمات اللاتينية الموجودة في الكلمة المفتاحية الأساسية.';
        const requiredText = '< 0.5%';
        const englishWordRegex = /[a-zA-Z]+/g;
    
        const primaryKeywordLatinWords = new Set(
            (keywords.primary.match(englishWordRegex) || []).map(w => w.toLowerCase())
        );
    
        let nonKeywordLatinWordsCount = 0;
        const violations: { from: number; to: number; message: string }[] = [];
        
        const contentNodes = nodes.filter(n => n.type === 'paragraph' || n.type === 'heading');
    
        for (const node of contentNodes) {
            const { text, offsets } = getTextAndOffsetsFromNode(node.node);
            let match;
            while ((match = englishWordRegex.exec(text)) !== null) {
                const latinWord = match[0];
                if (!primaryKeywordLatinWords.has(latinWord.toLowerCase())) {
                    nonKeywordLatinWordsCount++;
                    const adjustedIndex = getAdjustedIndex(match.index, offsets);
                    const from = node.pos + 1 + adjustedIndex;
                    const to = from + match[0].length;
                    violations.push({ from, to, message: `كلمة لاتينية: ${latinWord}` });
                }
            }
        }
    
        const percentage = totalWordCount > 0 ? nonKeywordLatinWordsCount / totalWordCount : 0;
        const percentageString = `${(percentage * 100).toFixed(2)}%`;
    
        if (percentage > 0.005) {
            const result = createCheckResult(title, 'fail', percentageString, requiredText, 0, description);
            result.violatingItems = violations;
            return result;
        } else if (percentage > 0) {
            const result = createCheckResult(title, 'warn', percentageString, requiredText, 0.5, description);
            result.violatingItems = violations;
            return result;
        } else {
            return createCheckResult(title, 'pass', '0%', requiredText, 1, description);
        }
    })();

    const duplicateWordsInParagraphCheck = findDuplicateWords(nodes, 'paragraph');

    const duplicateWordsInHeadingCheck = findDuplicateWords(nodes, 'heading');

    const sentenceBeginningsCheck = (() => {
        const description = 'يجب تجنب بدء جملتين متتاليتين بنفس الكلمة (أطول من حرفين).';
        const allSentences: { text: string; indexInNode: number; node: any; offsets: { char: string; isText: boolean }[] }[] = [];

        const allParagraphsWithPos: { node: any, pos: number }[] = [];
        const collectParagraphs = (node: any, pos: number) => {
            if (node.type === 'paragraph' && getNodeText(node).trim().length > 0) {
                allParagraphsWithPos.push({ node, pos });
            }
            if (node.content && Array.isArray(node.content)) {
                let childPos = pos + 1;
                node.content.forEach((child: any) => {
                    collectParagraphs(child, childPos);
                    childPos += getNodeSizeFromJSON(child);
                });
            }
        };

        if(doc?.content) {
            let currentPos = 1;
            doc.content.forEach((node: any) => {
                collectParagraphs(node, currentPos);
                currentPos += getNodeSizeFromJSON(node);
            });
        }

        allParagraphsWithPos.forEach(pInfo => {
            const { node: pNode, pos: pPos } = pInfo;
            const { text, offsets } = getTextAndOffsetsFromNode(pNode);
            const sentenceRegex = /([^\.!?؟]+(?:[\.!?؟]+|$))/g;
            let match;
            while ((match = sentenceRegex.exec(text)) !== null) {
                const sentenceWithWhitespace = match[0];
                const trimmedSentence = sentenceWithWhitespace.trim();
                if (trimmedSentence.length > 2) {
                    const indexInNode = match.index + sentenceWithWhitespace.indexOf(trimmedSentence);
                    const nodeForSentence = {
                        node: pNode,
                        pos: pPos,
                        type: 'paragraph',
                        text: text,
                    };
                    allSentences.push({ text: trimmedSentence, indexInNode, node: nodeForSentence, offsets });
                }
            }
        });


        if (allSentences.length < 2) {
            return createCheckResult('بدايات الجمل', 'pass', 'N/A', 'تجنب بدء جملتين متتاليتين بنفس الكلمة', 1, description);
        }

        const violations: { from: number; to: number; message: string }[] = [];
        let violatingPairs = 0;

        for (let i = 1; i < allSentences.length; i++) {
            const prevSentence = allSentences[i - 1];
            const currentSentence = allSentences[i];

            const firstWordPrevMatch = prevSentence.text.match(/\p{L}+/u);
            const firstWordCurrentMatch = currentSentence.text.match(/\p{L}+/u);

            if (firstWordPrevMatch && firstWordCurrentMatch) {
                const firstWordPrev = firstWordPrevMatch[0];
                const firstWordCurrent = firstWordCurrentMatch[0];
                
                if (firstWordPrev.length > 2 && normalizeArabicText(firstWordPrev.toLowerCase()) === normalizeArabicText(firstWordCurrent.toLowerCase())) {
                    violatingPairs++;
                    
                    const firstWordIndexInPrev = prevSentence.text.indexOf(firstWordPrev);
                    const adjustedPrevIndex = getAdjustedIndex(prevSentence.indexInNode + firstWordIndexInPrev, prevSentence.offsets);
                    violations.push({
                        from: prevSentence.node.pos + 1 + adjustedPrevIndex,
                        to: prevSentence.node.pos + 1 + adjustedPrevIndex + firstWordPrev.length,
                        message: `الكلمة الأولى المكررة: ${firstWordPrev}`
                    });

                    const firstWordIndexInCurrent = currentSentence.text.indexOf(firstWordCurrent);
                    const adjustedCurrentIndex = getAdjustedIndex(currentSentence.indexInNode + firstWordIndexInCurrent, currentSentence.offsets);
                    violations.push({
                        from: currentSentence.node.pos + 1 + adjustedCurrentIndex,
                        to: currentSentence.node.pos + 1 + adjustedCurrentIndex + firstWordCurrent.length,
                        message: `الكلمة الأولى المكررة: ${firstWordCurrent}`
                    });
                }
            }
        }
        
        const requiredText = 'تجنب بدء جملتين متتاليتين بنفس الكلمة';
        const progress = allSentences.length > 1 ? (allSentences.length - 1 - violatingPairs) / (allSentences.length - 1) : 1;

        if (violatingPairs === 0) {
            return createCheckResult('بدايات الجمل', 'pass', 'جيد', requiredText, 1, description);
        }
        
        const result = createCheckResult('بدايات الجمل', 'fail', `${violatingPairs} زوج مخالف`, requiredText, progress, description);
        result.violatingItems = violations;
        return result;
    })();

    const warningWordsCheck = (() => {
        const hasWarningWords = WARNING_ADVICE_WORDS.some(w => countOccurrences(textContent, w) > 0);
        return createCheckResult(
            'كلمات تحذيرية',
            hasWarningWords ? 'pass' : 'fail',
            hasWarningWords ? 'موجودة' : 'غير موجودة',
            'وجود كلمة تحذيرية أو نصيحة واحدة على الأقل',
            hasWarningWords ? 1 : 0,
            'يجب أن يحتوي المقال على كلمة تحذيرية أو نصيحة واحدة على الأقل. الكلمات المتاحة:',
            WARNING_ADVICE_WORDS.join(', ')
        );
    })();
    
    const conclusionParagraphCheck = (() => {
        const description = 'الفقرة الأولى بعد عنوان الخاتمة يجب أن تبدأ بكلمة دالة على الخاتمة. الكلمات المتاحة:';
        const requiredText = 'وجود كلمة دالة على الخاتمة';
        if (!conclusionSection) return createCheckResult('فقرة الخاتمة', 'fail', 'لا يوجد قسم خاتمة', requiredText, 0, description, CONCLUSION_INDICATOR_WORDS.join(', '));
        const firstParagraph = conclusionSection.paragraphs[0];
        if (!firstParagraph) return createCheckResult('فقرة الخاتمة', 'fail', 'لا توجد فقرة بعد العنوان', requiredText, 0, description, CONCLUSION_INDICATOR_WORDS.join(', '));
        const paragraphText = firstParagraph.text;
        const foundWord = CONCLUSION_INDICATOR_WORDS.find(word => countOccurrences(paragraphText, word) > 0);
        if (foundWord) return createCheckResult('فقرة الخاتمة', 'pass', foundWord, requiredText, 1, description, CONCLUSION_INDICATOR_WORDS.join(', '));
        return createCheckResult('فقرة الخاتمة', 'fail', '0', requiredText, 0, description, CONCLUSION_INDICATOR_WORDS.join(', '));
    })();

    const conclusionWordCountCheck = (() => {
        const description = 'يجب أن يتراوح طول قسم الخاتمة بين 50 و 100 كلمة.';
        const requiredText = '50-100 كلمة';
        if (!conclusionSection) return createCheckResult('طول الخاتمة', 'fail', 'لا يوجد قسم خاتمة', requiredText, 0, description);
        const wordCount = conclusionSection.wordCount;
        const status = getStatus(wordCount, 50, 100, 45, 105);
        const progress = status === 'pass' ? 1 : (status === 'warn' ? 0.5 : 0);
        return createCheckResult('طول الخاتمة', status, `${wordCount} كلمة`, requiredText, progress, description);
    })();

    const conclusionHasNumberCheck = (() => {
        const description = 'يجب أن يحتوي قسم الخاتمة على رقم واحد على الأقل.';
        const requiredText = 'وجود رقم واحد على الأقل';
        if (!conclusionSection) return createCheckResult('أرقام بالخاتمة', 'fail', 'لا يوجد قسم خاتمة', requiredText, 0, description);
        const hasNumber = conclusionSection.hasNumber;
        return createCheckResult('أرقام بالخاتمة', hasNumber ? 'pass' : 'fail', hasNumber ? 'موجود' : 'غير موجود', requiredText, hasNumber ? 1 : 0, description);
    })();
    
    const conclusionHasListCheck = (() => {
        const description = 'يجب أن يحتوي قسم الخاتمة على قائمة نقطية أو رقمية واحدة على الأقل.';
        const requiredText = 'وجود قائمة واحدة على الأقل';
        if (!conclusionSection) return createCheckResult('قائمة الخاتمة', 'fail', 'لا يوجد قسم خاتمة', requiredText, 0, description);
        const hasList = conclusionSection.hasList;
        return createCheckResult('قائمة الخاتمة', hasList ? 'pass' : 'fail', hasList ? 'موجود' : 'غير موجود', requiredText, hasList ? 1 : 0, description);
    })();
    
    const spacingCheck = (() => {
        const title = 'الفراغات';
        const description = 'يجب الالتزام بقواعد المسافات الصحيحة: لا مسافات مزدوجة، لا مسافة قبل علامات الترقيم، ومسافة بعدها (إلا في نهاية النص)، ولا مسافات في نهاية الأسطر.';
        const requiredText = 'مسافات صحيحة';
        const violations: { from: number; to: number; message: string }[] = [];
        const violatingNodePositions = new Set<number>();

        const contentNodes = nodes.filter(n => n.type === 'paragraph' || n.type === 'heading');

        const errorChecks = [
            { regex: /\s{2,}/g, message: 'يوجد مسافات مزدوجة' },
            { regex: /\s+([.,!؟،:])/g, message: 'يوجد مسافة قبل علامة الترقيم' },
            { regex: /([.,!؟،:])(?!\s|$|\d|['"])/g, message: 'لا يوجد مسافة بعد علامة الترقيم' },
            { regex: /\s+$/g, message: 'يوجد مسافة في نهاية السطر' },
        ];

        for (const node of contentNodes) {
            const { text, offsets } = getTextAndOffsetsFromNode(node.node);
            let hasViolationInNode = false;

            for (const check of errorChecks) {
                let match;
                while ((match = check.regex.exec(text)) !== null) {
                    const adjustedIndex = getAdjustedIndex(match.index, offsets);
                    const from = node.pos + 1 + adjustedIndex;
                    const to = from + match[0].length;
                    
                    violations.push({ from, to, message: check.message });
                    hasViolationInNode = true;
                }
            }

            if (hasViolationInNode) {
                violatingNodePositions.add(node.pos);
            }
        }

        const progress = contentNodes.length > 0 ? (contentNodes.length - violatingNodePositions.size) / contentNodes.length : 1;

        if (violations.length === 0) {
            return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description);
        }

        const result = createCheckResult(title, 'fail', `${violations.length} خطأ`, requiredText, progress, description);
        result.violatingItems = violations;
        return result;
    })();

    const repeatedBigramsCheck = ((): CheckResult => {
        const title = 'ثنائيات مكررة';
        const description = 'تجنب تكرار العبارات الشائعة أكثر من مرة واحدة للحفاظ على أسلوب فريد.';
        const requiredText = 'تكرار < 2';
        const violations: { from: number; to: number; message: string }[] = [];
        const violatingPhrases = new Set<string>();

        const phrasesToCheck = [...new Set([
          'عالم', 'أفضل النتائج', 'من خلال', 'العمل مع', 'أن تكون', 'سواء كان', 'تركز على', 'بما في', 'إلى جانب', 'يجب أن', 'يمكن أن', 'بالإضافة إلى', 'يعني أنه', 'إلى العديد', 'في حل', 'مما يعزز', 'تحديد المشكلة', 'في حال', 'مما يسهم', 'إلى ذلك', 'يعزز فرص', 'مما يساعد', 'مما يسهل', 'الحفاظ على', 'أن يكون', 'تقدم الشركة', 'مما يجعل', 'أكثر من', 'في مجال', 'في تعزيز', 'نتائج ملموسة', 'خبرة واسعة', 'العلامة التجارية', 'مجموعة من', 'رحلتك نحو', 'نحو النجاح', 'لمساعدتك على', 'إن هذا', 'في ذلك', 'رغم أن', 'التي يمكن', 'يُعتبر هذا', 'يُعد هذا', 'يُؤدي إلى',
          'عبر', 'بوساطة', 'باستخدام', 'اعتمادًا على', 'استنادًا إلى', 'يؤدي دورًا', 'وبالتالي', 'وهذا بدوره', 'الأمر الذي يؤدي', 'علاوة على ذلك', 'فضلًا عن', 'من الممكن أن', 'يُحتمل أن', 'عندما', 'عند حدوث', 'بالتوازي مع', 'جنبًا إلى جنب', 'للوصول إلى', 'سعيًا إلى', 'ضمن نطاق', 'على صعيد', 'في إطار', 'آثار واضحة', 'قابلة للقياس', 'تجربة عميقة', 'معرفة متراكمة', 'باتجاه النجاح', 'في طريق', 'فرص واعدة', 'إمكانات جديدة', 'توجه حديث', 'فكر إبداعي', 'أداء متميز', 'تطوير مستمر', 'تقدم ملموس', 'تعاون فعّال', 'شراكة ناجحة', 'تجربة فريدة', 'نتائج واقعية', 'رؤية واضحة', 'هدف مشترك', 'تأثير إيجابي', 'حلول مبتكرة', 'خطوات مدروسة', 'استراتيجية متكاملة', 'جودة عالية', 'معايير دقيقة', 'نمو متسارع', 'تحسين دائم', 'موارد محدودة', 'بيئة داعمة', 'دعم فني', 'توسع عالمي', 'تحليل دقيق', 'التزام قوي', 'تطوير مهني', 'تفكير نقدي', 'أداء مستدام', 'فريق متكامل', 'رؤية مستقبلية'
        ])];
    
        phrasesToCheck.forEach(phrase => {
            if (countOccurrences(textContent, phrase) > 1) {
                violatingPhrases.add(phrase);
            }
        });
    
        if (violatingPhrases.size > 0) {
            nodes.forEach(node => {
                if (node.type === 'paragraph' || node.type === 'heading') {
                    const { text, offsets } = getTextAndOffsetsFromNode(node.node);
                    violatingPhrases.forEach(phrase => {
                        const phraseRegex = new RegExp(phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                        let match;
                        while ((match = phraseRegex.exec(text)) !== null) {
                            const adjustedIndex = getAdjustedIndex(match.index, offsets);
                            const from = node.pos + 1 + adjustedIndex;
                            const to = from + match[0].length;
                            violations.push({
                                from,
                                to,
                                message: `العبارة المكررة: ${phrase}`
                            });
                        }
                    });
                }
            });
        }
        
        const progress = violatingPhrases.size > 0 ? 0 : 1;
        
        if (violatingPhrases.size === 0) {
            return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description, phrasesToCheck.join(', '));
        }
    
        const result = createCheckResult(title, 'fail', `${violatingPhrases.size} عبارة مكررة`, requiredText, progress, description, phrasesToCheck.join(', '));
        result.violatingItems = violations;
        return result;
    })();

    const slowWordsCheck = ((): CheckResult => {
        const title = 'كلمات بطيئة';
        const description = 'الكلمات البطيئة هي عبارات حشو تضعف الكتابة. يجب أن يكون إجمالي كلماتها أقل من 2% من إجمالي كلمات النص.';
        const requiredText = '< 2%';

        if (totalWordCount === 0) {
            return createCheckResult(title, 'pass', '0%', requiredText, 1, description, SLOW_WORDS.join(', '));
        }

        const violations: { from: number; to: number; message: string }[] = [];
        let totalSlowWordsWordCount = 0;

        nodes.forEach(node => {
            if (node.type === 'paragraph' || node.type === 'heading') {
                const { text, offsets } = getTextAndOffsetsFromNode(node.node);
                
                SLOW_WORDS.forEach(slowWord => {
                    const escapedSlowWord = slowWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`(?<!\\p{L})${escapedSlowWord}(?!\\p{L})`, 'gu');
                    
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        totalSlowWordsWordCount += getWordCount(slowWord);
                        
                        const adjustedIndex = getAdjustedIndex(match.index, offsets);
                        const from = node.pos + 1 + adjustedIndex;
                        const to = from + match[0].length; 
                        violations.push({
                            from,
                            to,
                            message: `كلمة بطيئة: ${slowWord}`
                        });
                    }
                });
            }
        });

        const percentage = totalWordCount > 0 ? (totalSlowWordsWordCount / totalWordCount) : 0;
        const percentageString = `${(percentage * 100).toFixed(1)}%`;
        
        const status: AnalysisStatus = percentage >= 0.02 ? 'fail' : 'pass';
        const progress = status === 'pass' ? 1 : Math.max(0, 1 - (percentage / 0.04));

        const result = createCheckResult(title, status, percentageString, requiredText, progress, description, SLOW_WORDS.join(', '));
        if (status === 'fail') {
            result.violatingItems = violations;
        }
        return result;
    })();

    const wordConsistencyCheck = (
        nodes: { type: string; level?: number; text: string; node: any; pos: number }[]
    ): CheckResult => {
        const title = 'تناسق الكلمات';
        const description = 'يجب كتابة نفس الكلمة بنفس الطريقة في كل مرة (مثل استخدام الهمزة \'أ\' أو عدم استخدامها \'ا\'). هذا يساعد على الاتساق.';
        const requiredText = '0 تناقضات';
    
        const wordsMap = new Map<string, Set<string>>();
        const wordRegex = /\p{L}{3,}/gu;
    
        nodes.forEach(node => {
            if (node.type === 'paragraph' || node.type === 'heading') {
                const { text } = getTextAndOffsetsFromNode(node.node);
                let match;
                while ((match = wordRegex.exec(text)) !== null) {
                    const originalWord = match[0];
                    const normalizedWord = normalizeArabicText(originalWord);
    
                    if (!wordsMap.has(normalizedWord)) {
                        wordsMap.set(normalizedWord, new Set());
                    }
                    wordsMap.get(normalizedWord)!.add(originalWord);
                }
            }
        });
    
        const inconsistentGroups: { normalized: string, variations: string[] }[] = [];
        wordsMap.forEach((variationsSet) => {
            if (variationsSet.size > 1) {
                inconsistentGroups.push({ normalized: '', variations: Array.from(variationsSet) });
            }
        });
    
        if (inconsistentGroups.length === 0) {
            return createCheckResult(title, 'pass', 'جيد', requiredText, 1, description);
        }
    
        const violations: { from: number; to: number; message: string }[] = [];
        
        inconsistentGroups.forEach(group => {
            const message = `تناقض: ${group.variations.join(', ')}`;
            group.variations.forEach(variation => {
                const escapedVariation = variation.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const variationRegex = new RegExp(`(?<!\\p{L})${escapedVariation}(?!\\p{L})`, 'gu');
    
                nodes.forEach(node => {
                    if (node.type === 'paragraph' || node.type === 'heading') {
                        const { text, offsets } = getTextAndOffsetsFromNode(node.node);
                        let match;
                        while ((match = variationRegex.exec(text)) !== null) {
                            const adjustedIndex = getAdjustedIndex(match.index, offsets);
                            const from = node.pos + 1 + adjustedIndex;
                            const to = from + match[0].length;
                            violations.push({ from, to, message });
                        }
                    }
                });
            });
        });
    
        const progress = 0; // It's a binary pass/fail
        const result = createCheckResult(title, 'fail', `${inconsistentGroups.length} مجموعة متناقضة`, requiredText, progress, description);
        result.violatingItems = violations;
        return result;
    };


    const duplicateAnalysis = (() => {
      const result: DuplicateAnalysis = { 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
      const ngramsMap: { [key: string]: { originalText: string; count: number } } = {};
      const blockNodes = nodes.filter(n => n.type === 'paragraph' || n.type === 'heading');
      
      const allKeywords = [
        keywords.primary,
        ...keywords.secondaries,
        keywords.company,
        ...keywords.lsi,
      ]
      .filter(Boolean)
      .map(kw => normalizeArabicText(kw.toLowerCase()));


      blockNodes.forEach(blockNode => {
          const blockText = blockNode.text;
          if (blockText.trim().length === 0) return;

          const punctuationRegex = /[.,!؟،؛:"'()\[\]{}«»-]/g;
          const originalWords = blockText.replace(punctuationRegex, ' ').split(/\s+/).filter(Boolean);
          const normalizedWords = normalizeArabicText(blockText.toLowerCase()).replace(punctuationRegex, ' ').split(/\s+/).filter(Boolean);

          for (let n = 2; n <= 8; n++) {
              if (originalWords.length < n) continue;
              for (let i = 0; i <= originalWords.length - n; i++) {
                  const originalGram = originalWords.slice(i, i + n).join(' ');
                  const normalizedGram = normalizedWords.slice(i, i + n).join(' ');

                  if (ngramsMap[normalizedGram]) {
                      ngramsMap[normalizedGram].count++;
                  } else {
                      ngramsMap[normalizedGram] = { originalText: originalGram, count: 1 };
                  }
              }
          }
      });
      
      Object.values(ngramsMap).forEach((item) => {
          if (item.count > 1) {
              const n = item.originalText.split(' ').length;
              if (n >= 2 && n <= 8 && result[n as keyof DuplicateAnalysis]) {
                  const normalizedGramText = normalizeArabicText(item.originalText.toLowerCase());
                  
                  const containsKeyword = allKeywords.some(kw => 
                    normalizedGramText.includes(kw) || kw.includes(normalizedGramText)
                  );

                  result[n as keyof DuplicateAnalysis].push({ 
                    text: item.originalText, 
                    count: item.count, 
                    locations: [],
                    containsKeyword: containsKeyword,
                  });
              }
          }
      });
      return result;
    })();

    const structureAnalysis: StructureAnalysis = {
        wordCount: wordCountCheck,
        firstTitle: firstTitleCheck,
        secondTitle: secondTitleCheck,
        includesExcludes: includesExcludesCheck,
        preTravelH2: preTravelH2Check,
        pricingH2: pricingH2Check,
        whoIsItForH2: whoIsItForH2Check,
        summaryParagraph: summaryParagraphCheck,
        secondParagraph: secondParagraphCheck,
        paragraphLength: paragraphLengthCheck,
        h2Structure: h2StructureCheck,
        h2Count: h2CountCheck,
        h3Structure: h3StructureCheck,
        h4Structure: h4StructureCheck,
        betweenH2H3: betweenH2H3Check,
        faqSection: faqSectionCheck,
        answerParagraph: answerParagraphCheck,
        ambiguousHeadings: ambiguousHeadingsCheck,
        punctuation: punctuationCheck,
        paragraphEndings: paragraphEndingsCheck,
        interrogativeH2: interrogativeH2Check,
        differentTransitionalWords: transitionalWordsCheck,
        duplicateWordsInParagraph: duplicateWordsInParagraphCheck,
        duplicateWordsInHeading: duplicateWordsInHeadingCheck,
        sentenceLength: sentenceLengthCheck,
        stepsIntroduction: stepsIntroductionCheck,
        automaticLists: automaticListsCheck,
        ctaWords: ctaWordsCheck,
        interactiveLanguage: interactiveLanguageCheck,
        arabicOnly: arabicOnlyCheck,
        lastH2IsConclusion: lastH2ConclusionCheck,
        conclusionParagraph: conclusionParagraphCheck,
        conclusionWordCount: conclusionWordCountCheck,
        conclusionHasNumber: conclusionHasNumberCheck,
        conclusionHasList: conclusionHasListCheck,
        sentenceBeginnings: sentenceBeginningsCheck,
        warningWords: warningWordsCheck,
        spacing: spacingCheck,
        repeatedBigrams: repeatedBigramsCheck,
        slowWords: slowWordsCheck,
        wordConsistency: wordConsistencyCheck(nodes),
    };
    
    const structureStats = {
      violatingCriteriaCount: Object.values(structureAnalysis).filter(c => c.status === 'fail').length,
      totalErrorsCount: Object.values(structureAnalysis).reduce((acc, c) => acc + (c.violatingItems?.length || 0), 0),
      paragraphCount: nonEmptyParagraphs.length,
      headingCount: headings.length,
    };
    
    const duplicateStats = (() => {
      const allWords = textContent.trim().split(/\s+/).filter(Boolean);
      const uniqueWords = new Set(allWords.map(w => normalizeArabicText(w.toLowerCase())));
      
      const allDuplicatePhrases = Object.values(duplicateAnalysis).flat();

      const keywordDuplicatesCount = allDuplicatePhrases
        .filter(phrase => phrase.containsKeyword)
        .length;

      const commonDuplicatesCount = allDuplicatePhrases
        .filter(phrase => !phrase.containsKeyword)
        .length;

      const totalDuplicates = allDuplicatePhrases.reduce((sum, item) => sum + item.count - 1, 0);

      return {
        totalWords: allWords.length,
        uniqueWords: uniqueWords.size,
        duplicateSentencesCount: keywordDuplicatesCount,
        totalDuplicates,
        commonDuplicatesCount,
      };
    })();

    return {
      keywordAnalysis: {
        primary: primaryAnalysis,
        secondaries: secondariesAnalysis,
        secondariesDistribution,
        company: companyAnalysis,
        lsi: lsiAnalysis,
      },
      structureAnalysis,
      structureStats,
      duplicateAnalysis,
      duplicateStats,
      wordCount: totalWordCount,
    };
  }, [editorState, textContent, keywords, aiGoal]);
};

// --- Gemini API Call ---
export const callGeminiAnalysis = async (prompt: string): Promise<string> => {
    if (!process.env.API_KEY) {
        return "خطأ: لم يتم تكوين مفتاح Gemini API.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const text = response.text;
        if (text) {
          return text;
        }
        return "لم يتمكن الذكاء الاصطناعي من إنشاء استجابة.";

    } catch (error) {
        console.error("Gemini API error:", error);
        return `حدث خطأ أثناء الاتصال بـ Gemini API: ${error instanceof Error ? error.message : String(error)}`;
    }
};