export type AnalysisStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface Keywords {
  primary: string;
  secondaries: string[];
  company: string;
  lsi: string[];
}

export interface KeywordCheck {
  text: string;
  isMet: boolean;
}

export interface KeywordStats {
  count: number;
  percentage: number;
  requiredCount: [number, number];
  requiredPercentage: [number, number];
  status: AnalysisStatus;
}

export interface PrimaryKeywordAnalysis extends KeywordStats {
  checks: KeywordCheck[];
}

export interface SecondaryKeywordAnalysis extends KeywordStats {
  checks: KeywordCheck[];
}

export interface CompanyNameAnalysis extends KeywordStats {}

export interface LsiKeywordAnalysis {
  distribution: KeywordStats;
  balance: CheckResult;
  keywords: {
      text: string;
      count: number;
      percentage: number;
  }[];
}

export interface KeywordAnalysis {
  primary: PrimaryKeywordAnalysis;
  secondaries: SecondaryKeywordAnalysis[];
  secondariesDistribution: KeywordStats;
  company: CompanyNameAnalysis;
  lsi: LsiKeywordAnalysis;
}

export interface CheckResult {
  title: string;
  description?: string;
  status: AnalysisStatus;
  current: string | number;
  required: string | number;
  progress: number; // Value from 0 to 1
  details?: string;
  violatingItems?: { 
    from: number; 
    to: number; 
    message: string; 
    sectionFrom?: number; 
    sectionTo?: number 
  }[];
}

export interface StructureAnalysis {
    wordCount: CheckResult;
    firstTitle: CheckResult;
    secondTitle: CheckResult;
    includesExcludes: CheckResult;
    preTravelH2: CheckResult;
    pricingH2: CheckResult;
    whoIsItForH2: CheckResult;
    summaryParagraph: CheckResult;
    secondParagraph: CheckResult;
    paragraphLength: CheckResult;
    h2Structure: CheckResult;
    h2Count: CheckResult;
    h3Structure: CheckResult;
    h4Structure: CheckResult;
    betweenH2H3: CheckResult;
    faqSection: CheckResult;
    answerParagraph: CheckResult;
    ambiguousHeadings: CheckResult;
    punctuation: CheckResult;
    paragraphEndings: CheckResult;
    interrogativeH2: CheckResult;
    differentTransitionalWords: CheckResult;
    duplicateWordsInParagraph: CheckResult;
    duplicateWordsInHeading: CheckResult;
    sentenceLength: CheckResult;
    stepsIntroduction: CheckResult;
    automaticLists: CheckResult;
    ctaWords: CheckResult;
    interactiveLanguage: CheckResult;
    arabicOnly: CheckResult;
    lastH2IsConclusion: CheckResult;
    conclusionParagraph: CheckResult;
    conclusionWordCount: CheckResult;
    conclusionHasNumber: CheckResult;
    conclusionHasList: CheckResult;
    sentenceBeginnings: CheckResult;
    warningWords: CheckResult;
    spacing: CheckResult;
    repeatedBigrams: CheckResult;
    slowWords: CheckResult;
    wordConsistency: CheckResult;
}

export interface DuplicatePhrase {
    text: string;
    count: number;
    locations: number[]; // start indices
    containsKeyword?: boolean;
}

export interface DuplicateAnalysis {
    2: DuplicatePhrase[];
    3: DuplicatePhrase[];
    4: DuplicatePhrase[];
    5: DuplicatePhrase[];
    6: DuplicatePhrase[];
    7: DuplicatePhrase[];
    8: DuplicatePhrase[];
}

export interface StructureStats {
  violatingCriteriaCount: number;
  totalErrorsCount: number;
  paragraphCount: number;
  headingCount: number;
}

export interface DuplicateStats {
  totalWords: number;
  uniqueWords: number;
  duplicateSentencesCount: number;
  totalDuplicates: number;
  commonDuplicatesCount: number;
}

export interface FullAnalysis {
  keywordAnalysis: KeywordAnalysis;
  structureAnalysis: StructureAnalysis;
  structureStats: StructureStats;
  duplicateAnalysis: DuplicateAnalysis;
  duplicateStats: DuplicateStats;
  wordCount: number;
}
