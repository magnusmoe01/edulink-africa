import type { School } from "../types";

export const sampleSchool: School = {
  id: "demo",
  name: "Nairobi Community School",
  type: "Primary and Junior Secondary School",
  tagline: "A welcoming learning community for curious, confident learners.",
  country: "Kenya",
  city: "Nairobi",
  address: "Kilimani Road, Nairobi",
  phone: "+254 700 123 456",
  email: "office@nairobi-community.example",
  adminEmails: ["admin@nairobi-community.example"],
  principal: "Amina Okoth",
  showWebsite: true,
  heroImage:
    "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1600&q=80",
  mainColor: "#18322e",
  subColor: "#e0b44f",
  about:
    "Our school combines strong classroom teaching, practical digital skills, arts, sport, and a culture of care. Families can use this page to follow school news, find contact information, and stay close to daily school life.",
  values: ["Learning with purpose", "Care and inclusion", "Community service"],
  announcements: [
    {
      title: "New reading program starts this term",
      date: "2026-05-04",
      body: "Learners in grades 1 to 6 will receive weekly reading challenges and family reading guides.",
    },
    {
      title: "Parent meeting for grade 7",
      date: "2026-05-12",
      body: "The grade 7 team will share assessment plans and junior secondary expectations.",
    },
    {
      title: "Sports day registration",
      date: "2026-05-20",
      body: "Families can register learners for athletics, football, netball, and chess events.",
    },
  ],
  calendar: [
    { date: "2026-05-01", title: "Labour Day" },
    { date: "2026-05-08", title: "School assembly" },
    { date: "2026-05-16", title: "Community clean-up" },
    { date: "2026-05-29", title: "Mid-term break begins" },
  ],
  staff: [
    {
      name: "Amina Okoth",
      role: "Principal",
      category: "Administration",
      phone: "+254 700 123 456",
      email: "principal@nairobi-community.example",
    },
    {
      name: "Daniel Mensah",
      role: "Deputy Principal",
      category: "Administration",
      phone: "+254 700 222 456",
    },
    {
      name: "Lerato Ndlovu",
      role: "Admissions and Office",
      category: "Administration",
      email: "admissions@nairobi-community.example",
    },
  ],
  classes: [
    {
      id: "grade-1",
      name: "Grade 1",
      grade: "1",
      teacher: "Grace Wanjiku",
    },
    {
      id: "grade-2",
      name: "Grade 2",
      grade: "2",
      teacher: "Peter Kamau",
    },
  ],
  students: [
    {
      id: "student-001",
      firstName: "Malaika",
      lastName: "Achieng",
      classId: "grade-1",
      guardianName: "Joseph Achieng",
      guardianEmail: "joseph.achieng@example.com",
    },
  ],
  subjects: [
    {
      id: "math",
      name: "Mathematics",
      abbreviation: "MATH",
      color: "#2f6fbb",
    },
  ],
  subjectClasses: [
    {
      id: "math-grade-1",
      name: "Math - Grade 1",
      subjectId: "math",
      baseClassId: "grade-1",
      teacherName: "Grace Wanjiku",
      studentIds: ["student-001"],
      courseMaterials: [],
      assignments: [],
    },
  ],
  aboutCategories: [
    {
      id: "learning",
      title: "Learning",
      description: "How teaching, assessment, and learner support work at our school.",
    },
    {
      id: "families",
      title: "Families",
      description: "Useful information for parents and guardians.",
    },
  ],
  aboutPages: [
    {
      id: "curriculum",
      categoryId: "learning",
      title: "Curriculum",
      body: "We follow the national curriculum and enrich lessons with reading, digital skills, arts, sport, and practical projects.",
    },
    {
      id: "school-day",
      categoryId: "families",
      title: "School day",
      body: "The school day starts with morning registration, followed by classroom learning, breaks, lunch, enrichment, and afternoon dismissal.",
    },
  ],
};
