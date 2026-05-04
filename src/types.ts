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
  phone?: string;
  email?: string;
  photoUrl?: string;
  visibleOnHomePage?: boolean;
  visibleOnStaffPage?: boolean;
};

export type ClassGroup = {
  id: string;
  name: string;
  grade?: string;
  teacher?: string;
};

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  classId: string;
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
  baseClassId?: string;
  teacherName?: string;
  studentIds: string[];
  courseMaterials?: CourseMaterial[];
  assignments?: Assignment[];
  assessments?: Assessment[];
  resourceFolders?: ResourceFolder[];
  resources?: SubjectResource[];
  announcements?: SubjectClassAnnouncement[];
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
  customAssessmentScales: AssessmentScale[];
};

export type AssessmentGrade = {
  studentId: string;
  levelId?: string;
  score?: string;
  feedback?: string;
  submitted?: boolean;
  gradedAt?: string;
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
  type: "note" | "link" | "picture";
  title: string;
  folderId?: string;
  body?: string;
  url?: string;
  imageDataUrl?: string;
  description?: string;
  createdAt: string;
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
  classes: ClassGroup[];
  students: Student[];
  subjects: Subject[];
  subjectClasses?: SubjectClass[];
  schoolWorkSettings?: SchoolWorkSettings;
  aboutCategories: AboutCategory[];
  aboutPages: AboutPage[];
  updatedAt?: string;
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
