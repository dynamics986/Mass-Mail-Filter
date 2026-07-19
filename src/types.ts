export type Lang = "zh" | "en";
export type Eligibility = "eligible" | "likely" | "unknown" | "ineligible";
export type DeadlineKind = "apply" | "event" | "rolling" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type L1Type =
  | "paid_work"
  | "research"
  | "event"
  | "programme"
  | "competition"
  | "service"
  | "admin";
export type L2Domain =
  | "Engineering"
  | "CS_AI"
  | "Business"
  | "Medicine"
  | "Arts"
  | "Education"
  | "Science"
  | "SocialScience"
  | "Law"
  | "Language"
  | "Cross";
export type L3Role = "ra" | "helper" | "intern" | "volunteer" | "applicant" | "attendee";
export type GoalType = "paid" | "research" | "competition" | "volunteer" | "event";
export type YearLevel = "Y1" | "Y2" | "Y3" | "Y4" | "Y5" | "Final" | "PG" | "";
export type SortKey = "total" | "urgent" | "value" | "fit";

export type RequirementField =
  | "studentLevel"
  | "major"
  | "nativeLanguage"
  | "spokenLanguage"
  | "age"
  | "gender"
  | "residency"
  | "health"
  | "skill";

export interface Requirement {
  field: RequirementField;
  operator: "equals" | "includes" | "min" | "max";
  value: string | number;
  confidence: "high" | "medium";
  evidence: string;
}

export interface Compensation {
  type: "cash" | "voucher" | "allowance" | "prize" | "unknown";
  minHkd?: number;
  maxHkd?: number;
}

export interface Taxonomy {
  type: L1Type;
  domains: L2Domain[];
  roles: L3Role[];
  confidence: Confidence;
  evidence: string;
}

export type TimeKind =
  | "published"
  | "apply_deadline"
  | "event_point"
  | "event_range"
  | "project_start"
  | "project_end"
  | "work_period"
  | "rolling";
export type TimeShape = "point" | "range" | "open";

export interface TimeMark {
  kind: TimeKind;
  shape: TimeShape;
  start?: string;
  end?: string;
  confidence: Confidence;
  evidence: string;
  label: string;
}

export interface MailItem {
  id: string;
  digestDate: string;
  category: string;
  title: string;
  bodyText: string;
  cleanBody?: string;
  summary: string;
  summaryEvidence: string[];
  organizer?: string;
  contactEmail?: string;
  sourceUrl: string;
  applicationUrls: string[];
  deadline?: string;
  deadlineKind: DeadlineKind;
  deadlineConfidence: Confidence;
  deadlineEvidence: string;
  timeMarks?: TimeMark[];
  compensation?: Compensation;
  taxonomy: Taxonomy;
  tags: string[];
  keyPhrases: string[];
  requirements: Requirement[];
  publishedAt: string;
  fetchedAt: string;
  source?: "digest" | "import";
}

export interface FeedMeta {
  latestDigest: string;
  fetchedAt: string;
  itemCount: number;
  status: "ok" | "stale" | "error";
  sourceUrl: string;
}

export interface DimensionWeights {
  fit: number;
  urgent: number;
  value: number;
  meaningful: number;
  important: number;
}

export interface Profile {
  studentLevel: "undergraduate" | "postgraduate";
  facultyId: string;
  programmeId: string;
  major: string;
  year: YearLevel;
  nativeLanguages: string[];
  spokenLanguages: string[];
  goals: GoalType[];
  skills: string[];
  excluded: string[];
  age?: number;
  gender?: string;
  residency?: string;
  health?: string;
  weights: DimensionWeights;
  language: Lang;
  onboarded: boolean;
}

export interface ScoreBreakdown {
  fit: number;
  urgent: number;
  value: number;
  meaningful: number;
  important: number;
  total: number;
}

export interface ScoreReason {
  key: string;
  dimension: keyof Omit<ScoreBreakdown, "total">;
  points: number;
  label: string;
}

export interface Evaluation {
  eligibility: Eligibility;
  evidence: string[];
  reasons: ScoreReason[];
  scores: ScoreBreakdown;
  score: number;
}

export interface FavoriteSnapshot {
  id: string;
  title: string;
  sourceUrl: string;
  deadline?: string;
  summary: string;
  savedAt: string;
}

export interface LocalState {
  profile: Profile;
  hidden: string[];
  favorites: Record<string, FavoriteSnapshot>;
  corrections: string[];
  importedItems: MailItem[];
  itemFeedback: Record<string, "less" | "more">;
}

export interface Programme {
  id: string;
  nameEn: string;
  nameZh: string;
  facultyId: string;
}

export interface Faculty {
  id: string;
  nameEn: string;
  nameZh: string;
  programmes: Programme[];
}

export interface FacultiesFile {
  sourceUrl: string;
  fetchedAt: string;
  faculties: Faculty[];
}
