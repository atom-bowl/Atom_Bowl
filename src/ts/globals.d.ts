type AtomSettings = {
  sfx: boolean;
  tts: boolean;
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  div: string;
  mode: string;
  rememberTopics: boolean;
  autoCheck?: boolean;
  autoThreshold?: number;
  highContrast: boolean;
  animations: boolean;
  fontSize: string;
  accent: string;
  theme: string;
};

type AutoCheckerResult = {
  isCorrect: boolean;
  confidence: number;
  matched: string;
};

type AutoChecker = {
  grade(input: {
    userAnswer: string;
    correctAnswer: string;
    questionType: string;
    threshold: number;
  }): AutoCheckerResult;
};

declare global {
  interface Window {
    atomSettings?: AtomSettings;
    atomNavigate?: (url: string) => void;
    autoChecker?: AutoChecker;
    startRun?: (mode: string) => void;
    bank?: unknown[];
  }

  interface Element {
    dataset?: DOMStringMap;
    value?: string;
    checked?: boolean;
    disabled?: boolean;
  }

  interface HTMLElement {
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    options?: HTMLOptionsCollection;
    src?: string;
    alt?: string;
  }
}

export {};
