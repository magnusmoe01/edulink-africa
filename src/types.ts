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

export type AdminProfile = {
  uid: string;
  email?: string;
  schoolIds: string[];
  superAdmin: boolean;
};
