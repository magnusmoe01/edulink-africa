export type NewsItem = {
  id?: string;
  title: string;
  slug?: string;
  date: string;
  headerImage?: string;
  body: string;
};

export type CalendarItem = {
  date: string;
  title: string;
};

export type StaffMember = {
  name: string;
  role: string;
  category?: "Teacher" | "Administration" | "Other";
  categories?: Array<"Teacher" | "Administration" | "Other">;
  phone?: string;
  email?: string;
  photoUrl?: string;
  visibleOnHomePage?: boolean;
  visibleOnStaffPage?: boolean;
};

export type ClassGroup = {
  id: string;
  name: string;
  gradeLevelId?: string;
  grade?: string;
  teacher?: string;
};

export type SchoolGradeLevel = {
  id: string;
  grade: string;
  year: string;
};

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  classId: string;
  email?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  description?: string;
  guardians?: Guardian[];
  guardianName?: string;
  guardianEmail?: string;
};

export type Guardian = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relationship?: string;
};

export type Subject = {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  teacherName?: string;
  classIds?: string[];
  studentIds?: string[];
};

export type SubjectClass = {
  id: string;
  name: string;
  subjectId: string;
  gradeLevelId?: string;
  baseClassId?: string;
  teacherName?: string;
  studentIds: string[];
  studentActivity?: SubjectClassStudentActivity[];
  courseMaterials?: CourseMaterial[];
  assignments?: Assignment[];
  assessments?: Assessment[];
  resourceFolders?: ResourceFolder[];
  resources?: SubjectResource[];
  announcements?: SubjectClassAnnouncement[];
};

export type SubjectClassStudentActivity = {
  studentId: string;
  lastOpenedAt?: string;
};

export type CourseMaterial = {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileDataUrl: string;
  uploadedAt: string;
};

export type Assignment = {
  id: string;
  title: string;
  dueDate?: string;
  description: string;
};

export type AssessmentScaleLevel = {
  id: string;
  value: string;
  minPercentage: number;
  description?: string;
};

export type AssessmentScale = {
  id: string;
  name: string;
  levels: AssessmentScaleLevel[];
};

export type SchoolWorkSettings = {
  enabledGlobalAssessmentScaleIds: string[];
  knownGlobalAssessmentScaleIds?: string[];
  customAssessmentScales: AssessmentScale[];
  allowStudentMessaging?: boolean;
};

export type LoginSettings = {
  emailPasswordEnabled: boolean;
  emailLinkEnabled: boolean;
};

export type AssessmentGrade = {
  studentId: string;
  levelId?: string;
  score?: string;
  feedback?: string;
  submitted?: boolean;
  gradedAt?: string;
  gradedBy?: string;
};

export type Assessment = {
  id: string;
  title: string;
  date: string;
  requiresTurnIn: boolean;
  format: string;
  scaleId: string;
  folderId?: string;
  description?: string;
  grades: AssessmentGrade[];
};

export type ResourceFolder = {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
};

export type SubjectResource = {
  id: string;
  type: "note" | "link" | "picture" | "test";
  title: string;
  folderId?: string;
  body?: string;
  url?: string;
  imageDataUrl?: string;
  description?: string;
  dueDate?: string;
  scaleId?: string;
  gradingMode?: "auto" | "manual";
  publishResults?: "immediately" | "after-review";
  lobbyEnabled?: boolean;
  startsAt?: string;
  timerMode?: "none" | "duration" | "fixed-end";
  timerMinutes?: number;
  timerEndsAt?: string;
  autoSubmitOnTimerEnd?: boolean;
  questions?: TestQuestion[];
  testSubmissions?: TestSubmission[];
  createdAt: string;
};

export type TestQuestion = {
  id: string;
  type: "multiple-choice" | "text";
  prompt: string;
  marks?: number;
  allowMultipleCorrect?: boolean;
  options?: TestQuestionOption[];
};

export type TestQuestionOption = {
  id: string;
  text: string;
  correct?: boolean;
};

export type TestSubmission = {
  studentId: string;
  answers: Record<string, string | string[]>;
  startedAt?: string;
  submittedAt?: string;
  lastSavedAt?: string;
  autoSubmitted?: boolean;
  reviewed?: boolean;
  score?: number;
  maxScore?: number;
  percentage?: number;
  levelId?: string;
};

export type SubjectClassAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type AboutCategory = {
  id: string;
  title: string;
};

export type AboutPage = {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  headerImage?: string;
  body: string;
};

export type School = {
  id: string;
  name: string;
  type: string;
  tagline: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  adminEmails: string[];
  loginSettings?: LoginSettings;
  principal: string;
  showWebsite?: boolean;
  heroImage: string;
  logoUrl?: string;
  mainColor?: string;
  subColor?: string;
  about: string;
  values: string[];
  announcements: NewsItem[];
  calendar: CalendarItem[];
  staff: StaffMember[];
  gradeLevels?: SchoolGradeLevel[];
  classes: ClassGroup[];
  students: Student[];
  subjects: Subject[];
  subjectClasses?: SubjectClass[];
  schoolWorkSettings?: SchoolWorkSettings;
  chatMessages?: SchoolChatMessage[];
  aboutCategories: AboutCategory[];
  aboutPages: AboutPage[];
  updatedAt?: string;
};

export type SchoolChatMessage = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  body: string;
  createdAt: string;
};

export type GlobalAboutPage = AboutPage & {
  kind?: "richText" | "staffDirectory";
};

export type GlobalAboutConfig = {
  categories: AboutCategory[];
  pages: GlobalAboutPage[];
  updatedAt?: string;
};

export type GlobalSchoolWorkConfig = {
  assessmentScales: AssessmentScale[];
  updatedAt?: string;
};

export type AdminProfile = {
  uid: string;
  email?: string;
  schoolIds: string[];
  superAdmin: boolean;
};
