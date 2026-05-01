export type NewsItem = {
  title: string;
  date: string;
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
  guardianName?: string;
  guardianEmail?: string;
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
  heroImage: string;
  logoUrl?: string;
  about: string;
  values: string[];
  announcements: NewsItem[];
  calendar: CalendarItem[];
  staff: StaffMember[];
  classes: ClassGroup[];
  students: Student[];
  aboutCategories: AboutCategory[];
  aboutPages: AboutPage[];
  updatedAt?: string;
};

export type AdminProfile = {
  uid: string;
  email?: string;
  schoolIds: string[];
  superAdmin: boolean;
};
