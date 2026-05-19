import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Search, UserRound } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAddressBook,
  faBook,
  faBookOpen,
  faCalendarDays,
  faChalkboardUser,
  faCircleInfo,
  faClipboardCheck,
  faClipboardList,
  faFolderOpen,
  faGaugeHigh,
  faGlobe,
  faIdCard,
  faKey,
  faLayerGroup,
  faMessage,
  faNewspaper,
  faScaleBalanced,
  faUserGraduate,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { navigate } from "../lib/navigate";
import { mergeUnique, splitCsv, formatDate, formatGradeLevel, formatSubjectClassGradeLevel, parsePercentageInput, getTextExcerpt } from "../lib/utils";
import {
  StaffCategory,
  SchoolWorkAccessLevel,
  canTeachSubjectClass,
  daysUntilPermanentRemoval,
  getSchoolAdminEmails,
  getStaffAdminEmails,
  getStaffCategories,
  getStaffEmail,
  hasStaffCategory,
  isStaffAccountDisabled,
  isStaffDeleted,
  isStaffPermanentlyRemoved,
  staffCanAccessAdminPage,
  REMARK_PARENTS,
} from "../lib/staffUtils";
import {
  AdminCardTitle,
  CheckboxInput,
  CheckboxGroup,
  DateInput,
  EditorPanel,
  GuardianEditor,
  ImageUpload,
  RegistrationModal,
  Repeater,
  RichTextEditor,
  SelectInput,
  TextArea,
  TextInput,
  InfoPanel,
  prepareImageUpload,
} from "./ui";
import { SchoolWorkOverview, SubjectClassWorkPage } from "./SchoolWork";
import { TimetablePage } from "./Timetable";
import { slugifySchoolName } from "../lib/schools";
import { SchoolBillingPanel } from "./SuperAdmin";
import { SubstitutionsPage } from "./SubstitutionsPage";
import { ExamTimetableAdminPage } from "./ExamTimetablePage";
import type {
  AboutCategory,
  AboutPage,
  AssessmentScale,
  CalendarItem,
  ClassGroup,
  GlobalAboutConfig,
  GlobalAboutPage,
  GlobalSchoolWorkConfig,
  NewsItem,
  School,
  SchoolGradeLevel,
  SchoolRemarkSettings,
  SchoolWorkSettings,
  StaffMember,
  Student,
  Subject,
  SubjectClass,
} from "../types";

export type EditorSection = "profile" | "contact" | "about" | "news" | "calendar" | "staff" | "access" | "grades" | "classes" | "subjectClasses" | "subjects" | "students" | "schoolWork" | "loginSettings" | "billing" | "timetable" | "substitutions" | "examTimetable";
export type EditorCategory = "website" | "people" | "schoolWork" | "settings" | "administrative";

const subjectColorOptions = [
  "#1f6857", "#2f6fbb", "#8f4bb8", "#c65353", "#c5872f", "#5d6b7a",
  "#0f766e", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c",
  "#ca8a04", "#65a30d", "#16a34a", "#059669", "#0891b2", "#0284c7",
  "#4f46e5", "#9333ea", "#c026d3", "#e11d48", "#be123c", "#92400e",
  "#854d0e", "#3f6212", "#166534", "#115e59", "#1e40af", "#334155",
];

export const editorSections: Array<{ id: EditorSection; label: string }> = [
  { id: "profile", label: "School profile" },
  { id: "contact", label: "Contact details" },
  { id: "about", label: "Website pages" },
  { id: "news", label: "News" },
  { id: "calendar", label: "Calendar" },
  { id: "staff", label: "Staff and administrators" },
  { id: "access", label: "Access" },
  { id: "grades", label: "Grades and years" },
  { id: "classes", label: "Classes" },
  { id: "subjectClasses", label: "Subject classes" },
  { id: "subjects", label: "Subjects" },
  { id: "students", label: "Students" },
  { id: "schoolWork", label: "Subject class pages" },
  { id: "loginSettings", label: "Login format" },
  { id: "billing", label: "Billing" },
  { id: "timetable", label: "Timetable" },
  { id: "substitutions", label: "Absence & Substitutions" },
  { id: "examTimetable", label: "Exam Timetable" },
];

export const editorCategories: Array<{
  id: EditorCategory;
  label: string;
  description: string;
  sections: EditorSection[];
  groups?: Array<{ label: string; sections: EditorSection[] }>;
}> = [
  {
    id: "website",
    label: "Website",
    description: "Public website content, contact details, pages, news, and calendar.",
    sections: ["profile", "contact", "about", "news", "calendar"],
  },
  {
    id: "people",
    label: "People & Academics",
    description: "Staff, students, access, grades, classes, and subjects.",
    sections: ["staff", "students", "grades", "classes", "subjectClasses", "subjects"],
    groups: [
      { label: "People", sections: ["staff", "students"] },
      { label: "Academics", sections: ["grades", "classes", "subjectClasses", "subjects"] },
    ],
  },
  {
    id: "schoolWork",
    label: "EduLink LMS",
    description: "Course materials and subject class work.",
    sections: ["schoolWork"],
  },
  {
    id: "administrative",
    label: "Administrative",
    description: "Timetable scheduling and school operations.",
    sections: ["timetable", "substitutions", "examTimetable"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Login format, access control, subscription plan, and payment history.",
    sections: ["loginSettings", "access", "billing"],
    groups: [
      { label: "Platform", sections: ["loginSettings", "access"] },
      { label: "Billing", sections: ["billing"] },
    ],
  },
];

export function SchoolEditor({
  school,
  globalAbout,
  globalSchoolWork,
  onChange,
  onSubmit,
  onAutoSave,
  activeCategory,
  activeSection,
  currentUserEmail,
  canAccessAllSubjectClasses,
  isSuperAdmin,
  onSimulateStaff,
  onSimulateStudent,
  onBack,
  onSectionChange,
}: {
  school: School;
  globalAbout?: GlobalAboutConfig;
  globalSchoolWork?: GlobalSchoolWorkConfig;
  onChange: (school: School) => void;
  onSubmit: () => Promise<void>;
  onAutoSave?: (school: School) => Promise<void>;
  activeCategory: EditorCategory;
  activeSection: EditorSection | null;
  currentUserEmail?: string | null;
  canAccessAllSubjectClasses?: boolean;
  isSuperAdmin?: boolean;
  onSimulateStaff?: (staffMember: StaffMember) => void;
  onSimulateStudent?: (student: Student) => void;
  onBack: () => void;
  onSectionChange: (section: EditorSection) => void;
}) {
  const createStaffMember = (): StaffMember => ({
    name: "Staff name",
    role: "Role",
    category: "Teacher",
    categories: ["Teacher"],
    visibleOnHomePage: true,
    visibleOnStaffPage: true,
    accountDisabled: false,
  });
  const classes = school.classes ?? [];
  const gradeLevels = school.gradeLevels ?? [];
  const gradeOptions = [
    { value: "", label: "Select grade and year" },
    ...gradeLevels.map((gradeLevel) => ({ value: gradeLevel.id, label: formatGradeLevel(gradeLevel) })),
  ];
  const subjectClassGradeOptions = [
    { value: "", label: "Select grade and year" },
    ...gradeLevels.map((gradeLevel) => ({ value: gradeLevel.id, label: formatSubjectClassGradeLevel(gradeLevel) })),
  ];
  const getGradeLevel = (gradeLevelId?: string) => gradeLevels.find((gradeLevel) => gradeLevel.id === gradeLevelId);
  const createGradeLevel = (): SchoolGradeLevel => ({ id: `grade-${Date.now()}`, grade: "", year: String(new Date().getFullYear()) });
  const createClassGroup = (): ClassGroup => {
    const gradeLevel = gradeLevels[0];
    return { id: `class-${Date.now()}`, name: "New class", gradeLevelId: gradeLevel?.id ?? "", grade: gradeLevel?.grade ?? "", teacher: "" };
  };
  const students = school.students ?? [];
  const subjects = school.subjects ?? [];
  const subjectClasses = school.subjectClasses ?? [];
  const schoolWorkSettings = school.schoolWorkSettings ?? {
    enabledGlobalAssessmentScaleIds: globalSchoolWork?.assessmentScales.map((scale) => scale.id) ?? [],
    knownGlobalAssessmentScaleIds: globalSchoolWork?.assessmentScales.map((scale) => scale.id) ?? [],
    allowStudentMessaging: false,
    customAssessmentScales: [],
  };
  const loginSettings = school.loginSettings ?? {
    emailPasswordEnabled: true,
    emailLinkEnabled: false,
  };
  const effectiveAssessmentScales = [
    ...(globalSchoolWork?.assessmentScales.filter((scale) => schoolWorkSettings.enabledGlobalAssessmentScaleIds.includes(scale.id)) ?? []),
    ...(schoolWorkSettings.customAssessmentScales ?? []),
  ];
  const accessibleSubjectClasses = subjectClasses.filter((subjectClass) => canAccessAllSubjectClasses || canTeachSubjectClass(school, subjectClass, currentUserEmail));
  const [activeWorkSubjectClassId, setActiveWorkSubjectClassId] = useState<string | null>(null);
  const aboutCategories = school.aboutCategories ?? [];
  const aboutPages = school.aboutPages ?? [];
  const createStudent = (): Student => ({
    id: `student-${Date.now()}`,
    firstName: "",
    lastName: "",
    classId: "",
    email: "",
    photoUrl: "",
    dateOfBirth: "",
    enrolledAt: new Date().toISOString().slice(0, 10),
    gender: "",
    description: "",
    guardians: [],
    accountDisabled: false,
  });
  const createNewsItem = (): NewsItem => ({
    id: `news-${Date.now()}`,
    title: "New announcement",
    slug: "",
    date: "2026-05-01",
    headerImage: "",
    body: "<p>Announcement details</p>",
  });
  const createCalendarItem = (): CalendarItem => ({ title: "School event", date: "2026-05-01" });
  const [newsModalIndex, setNewsModalIndex] = useState<number | null | undefined>(undefined);
  const [calendarModalIndex, setCalendarModalIndex] = useState<number | null | undefined>(undefined);
  const [staffModalIndex, setStaffModalIndex] = useState<number | null | undefined>(undefined);
  const [gradeLevelModalIndex, setGradeLevelModalIndex] = useState<number | null | undefined>(undefined);
  const [classModalIndex, setClassModalIndex] = useState<number | null | undefined>(undefined);
  const [subjectClassModalIndex, setSubjectClassModalIndex] = useState<number | null | undefined>(undefined);
  const [subjectModalIndex, setSubjectModalIndex] = useState<number | null | undefined>(undefined);
  const [studentModalIndex, setStudentModalIndex] = useState<number | null | undefined>(undefined);
  const [draftNews, setDraftNews] = useState<NewsItem>(() => createNewsItem());
  const [draftCalendar, setDraftCalendar] = useState<CalendarItem>(() => createCalendarItem());
  const [draftStaff, setDraftStaff] = useState<StaffMember>(() => createStaffMember());
  const [draftGradeLevel, setDraftGradeLevel] = useState<SchoolGradeLevel>(() => createGradeLevel());
  const [draftClass, setDraftClass] = useState<ClassGroup>(() => createClassGroup());
  const [draftStudent, setDraftStudent] = useState<Student>(() => createStudent());
  const [draftStudentSubjectClassIds, setDraftStudentSubjectClassIds] = useState<string[]>([]);
  const [draftStudentUseGradeSubjectClasses, setDraftStudentUseGradeSubjectClasses] = useState(false);
  const [subjectClassSearch, setSubjectClassSearch] = useState("");
  const [draftSubject, setDraftSubject] = useState<Subject>(() => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  }));
  const createSchoolAssessmentScale = (): AssessmentScale => ({
    id: `school-scale-${Date.now()}`,
    name: "New school assessment scale",
    levels: [
      { id: `level-${Date.now()}-1`, value: "3", minPercentage: 80, description: "" },
      { id: `level-${Date.now()}-2`, value: "2", minPercentage: 50, description: "" },
      { id: `level-${Date.now()}-3`, value: "1", minPercentage: 0, description: "" },
      { id: "excused", value: "Excused", minPercentage: 0, description: "" },
      { id: "assessed", value: "Assessed", minPercentage: 0, description: "" },
    ],
  });
  const updateSchool = (nextSchool: School) => {
    onChange(nextSchool);
    void onAutoSave?.(nextSchool);
  };
  const setField = <K extends keyof School>(field: K, value: School[K]) => {
    updateSchool({ ...school, [field]: value });
  };
  const updateSchoolWorkSettings = (nextSettings: SchoolWorkSettings) => setField("schoolWorkSettings", nextSettings);
  const updateRemarkSettings = (next: SchoolRemarkSettings) => setField("remarkSettings", next);
  const globalRemarkCategories = globalSchoolWork?.remarkCategories ?? [];

  const createSubject = (): Subject => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  });
  const getAutomaticSubjectClassName = (
    subjectId: string,
    baseClassId?: string,
    gradeLevelId?: string,
    subjectList: Subject[] = subjects,
    classList: ClassGroup[] = classes,
    gradeLevelList: SchoolGradeLevel[] = gradeLevels,
  ) => {
    const subjectName = subjectList.find((subject) => subject.id === subjectId)?.name;
    const className = classList.find((classGroup) => classGroup.id === baseClassId)?.name;
    const gradeLabel = formatSubjectClassGradeLevel(gradeLevelList.find((gradeLevel) => gradeLevel.id === gradeLevelId));
    if (subjectName && className) {
      return `${subjectName} - ${className}`;
    }
    if (subjectName && gradeLabel) {
      return `${subjectName} - ${gradeLabel}`;
    }
    return subjectName || className || (gradeLabel ? `Grade ${gradeLabel}` : "New subject class");
  };
  const withAutomaticSubjectClassName = (
    subjectClass: SubjectClass,
    subjectList: Subject[] = subjects,
    classList: ClassGroup[] = classes,
    gradeLevelList: SchoolGradeLevel[] = gradeLevels,
  ): SubjectClass => subjectClass.nameOverride
    ? subjectClass
    : {
      ...subjectClass,
      name: getAutomaticSubjectClassName(subjectClass.subjectId, subjectClass.baseClassId, subjectClass.gradeLevelId, subjectList, classList, gradeLevelList),
    };
  const updateAutomaticSubjectClassNames = (
    nextSubjectClasses: SubjectClass[],
    subjectList: Subject[] = subjects,
    classList: ClassGroup[] = classes,
    gradeLevelList: SchoolGradeLevel[] = gradeLevels,
  ) => nextSubjectClasses.map((subjectClass) => withAutomaticSubjectClassName(subjectClass, subjectList, classList, gradeLevelList));
  const createSubjectClass = (): SubjectClass => {
    const baseClass = classes[0];
    const subjectId = subjects[0]?.id ?? "";
    const baseClassId = baseClass?.id ?? "";
    const gradeLevelId = baseClass?.gradeLevelId ?? "";
    return {
      id: `subject-class-${Date.now()}`,
      name: getAutomaticSubjectClassName(subjectId, baseClassId, gradeLevelId),
      nameOverride: false,
      subjectId,
      gradeLevelId,
      baseClassId,
      teacherName: "",
      studentIds: [],
    };
  };
  const [draftSubjectClass, setDraftSubjectClass] = useState<SubjectClass>(() => createSubjectClass());
  const staffOptions = [
    { value: "", label: "Select staff member" },
    ...school.staff.map((member) => ({ value: member.name, label: `${member.name} - ${member.role}` })),
  ];
  const staffCategoryOptions: Array<{ value: StaffCategory; label: string }> = [
    { value: "Teacher", label: "Teacher" },
    { value: "Administration", label: "Administration" },
    { value: "Other", label: "Other" },
  ];
  const renderStaffFields = (item: StaffMember, update: (item: StaffMember) => void) => (
    <>
      <TextInput label="Name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <CheckboxGroup
        label="Categories"
        values={getStaffCategories(item)}
        options={staffCategoryOptions}
        onChange={(categories) => {
          const nextCategories = categories as StaffCategory[];
          update({
            ...item,
            categories: nextCategories,
            category: nextCategories[0] as StaffMember["category"] | undefined,
            canAccessAdminPage: item.canAccessAdminPage ?? nextCategories.includes("Administration"),
          });
        }}
      />
      <CheckboxInput
        label="Access admin page"
        checked={staffCanAccessAdminPage(item)}
        onChange={(checked) => update({ ...item, canAccessAdminPage: checked, accountDisabled: checked ? false : item.accountDisabled ?? false })}
      />
      <CheckboxInput
        label="Disable account"
        checked={isStaffAccountDisabled(item)}
        disabled={staffCanAccessAdminPage(item)}
        onChange={(checked) => update({ ...item, accountDisabled: checked })}
      />
      <TextInput label="Description" value={item.role} onChange={(value) => update({ ...item, role: value })} />
      <TextInput label="Phone" value={item.phone ?? ""} onChange={(value) => update({ ...item, phone: value })} />
      <TextInput label="Email" value={item.email ?? ""} onChange={(value) => update({ ...item, email: value })} />
      <StaffImageUpload photoUrl={item.photoUrl ?? ""} onChange={(photoUrl) => update({ ...item, photoUrl })} />
      <div className="checkbox-row">
        <CheckboxInput
          label="Visible on home page"
          checked={item.visibleOnHomePage ?? true}
          onChange={(checked) => update({ ...item, visibleOnHomePage: checked })}
        />
        <CheckboxInput
          label="Visible on staff page"
          checked={item.visibleOnStaffPage ?? true}
          onChange={(checked) => update({ ...item, visibleOnStaffPage: checked })}
        />
      </div>
    </>
  );
  const renderGradeLevelFields = (item: SchoolGradeLevel, update: (item: SchoolGradeLevel) => void) => (
    <>
      <TextInput
        label="Grade"
        value={item.grade}
        onChange={(grade) => update({ ...item, grade, id: slugifyGradeLevel(grade, item.year) })}
      />
      <TextInput
        label="Year"
        value={item.year}
        onChange={(year) => update({ ...item, year, id: slugifyGradeLevel(item.grade, year) })}
      />
    </>
  );
  const renderClassFields = (item: ClassGroup, update: (item: ClassGroup) => void) => (
    <>
      <TextInput label="Main class name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <SelectInput
        label="Grade and year"
        value={item.gradeLevelId ?? ""}
        options={gradeOptions}
        onChange={(gradeLevelId) => {
          const gradeLevel = getGradeLevel(gradeLevelId);
          update({ ...item, gradeLevelId, grade: gradeLevel?.grade ?? "" });
        }}
      />
      <SelectInput
        label="Class teacher"
        value={item.teacher ?? ""}
        options={staffOptions}
        onChange={(value) => update({ ...item, teacher: value })}
      />
    </>
  );
  const renderNewsFields = (item: NewsItem, update: (item: NewsItem) => void) => (
    <>
      <TextInput
        label="Title"
        value={item.title}
        onChange={(value) => update({ ...item, title: value, slug: item.slug || slugifySchoolName(value) })}
      />
      <TextInput label="URL slug" value={item.slug ?? ""} onChange={(value) => update({ ...item, slug: slugifySchoolName(value) })} />
      <DateInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
      <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
      <RichTextEditor label="Body" value={item.body} onChange={(value) => update({ ...item, body: value })} />
    </>
  );
  const renderCalendarFields = (item: CalendarItem, update: (item: CalendarItem) => void) => (
    <>
      <TextInput label="Title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
      <DateInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
    </>
  );
  const renderSubjectFields = (item: Subject, update: (item: Subject) => void) => (
    <>
      <TextInput label="Subject name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <TextInput
        label="Abbreviation"
        value={item.abbreviation ?? ""}
        onChange={(value) => update({ ...item, abbreviation: value.toUpperCase().slice(0, 8) })}
      />
      <SubjectColorPicker value={item.color ?? subjectColorOptions[0]} onChange={(color) => update({ ...item, color })} />
    </>
  );
  const renderSubjectClassFields = (item: SubjectClass, update: (item: SubjectClass) => void) => {
    const selectedStudents = students.filter((student) => item.studentIds.includes(student.id));
    const baseClassStudents = students.filter((student) => student.classId === item.baseClassId);
    const updateNameIfAutomatic = (next: SubjectClass) => update(withAutomaticSubjectClassName(next));

    return (
      <>
        <TextInput
          label="Subject class name"
          value={item.nameOverride ? item.name : getAutomaticSubjectClassName(item.subjectId, item.baseClassId, item.gradeLevelId)}
          onChange={(value) => update({ ...item, name: value, nameOverride: true })}
          disabled={!item.nameOverride}
        />
        <button
          className="secondary-action"
          type="button"
          onClick={() => update(item.nameOverride
            ? withAutomaticSubjectClassName({ ...item, nameOverride: false })
            : { ...item, nameOverride: true, name: item.name || getAutomaticSubjectClassName(item.subjectId, item.baseClassId, item.gradeLevelId) })}
        >
          {item.nameOverride ? "Use standard class name" : "Override standard class name"}
        </button>
        <SelectInput
          label="Subject"
          value={item.subjectId}
          options={[
            { value: "", label: "Select subject" },
            ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
          ]}
          onChange={(value) => {
            updateNameIfAutomatic({
              ...item,
              subjectId: value,
            });
          }}
        />
        <SelectInput
          label="Based on main class"
          value={item.baseClassId ?? ""}
          options={[
            { value: "", label: "Mixed classes" },
            ...classes.map((classGroup) => ({ value: classGroup.id, label: classGroup.name })),
          ]}
          onChange={(value) => {
            const classGroup = classes.find((currentClass) => currentClass.id === value);
            const gradeLevelId = classGroup?.gradeLevelId ?? item.gradeLevelId ?? "";
            updateNameIfAutomatic({
              ...item,
              baseClassId: value,
              gradeLevelId,
            });
          }}
        />
        <SelectInput
          label="Grade and year"
          value={item.gradeLevelId ?? ""}
          options={subjectClassGradeOptions}
          onChange={(gradeLevelId) => updateNameIfAutomatic({
            ...item,
            gradeLevelId,
          })}
        />
        <SelectInput
          label="Teacher"
          value={item.teacherName ?? ""}
          options={staffOptions}
          onChange={(value) => update({ ...item, teacherName: value })}
        />
        <CheckboxGroup
          label="Students in subject class"
          allowSelectAll
          options={students.map((student) => {
            const classGroup = classes.find((currentClass) => currentClass.id === student.classId);
            return {
              value: student.id,
              label: `${student.firstName} ${student.lastName}${classGroup ? ` - ${classGroup.name}` : ""}`,
            };
          })}
          values={item.studentIds}
          onChange={(studentIds) => update({ ...item, studentIds })}
        />
        <div className="subject-summary">
          <strong>{selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"} selected</strong>
          <span>{baseClassStudents.length} student{baseClassStudents.length === 1 ? "" : "s"} currently in the selected main class</span>
        </div>
      </>
    );
  };
  const getStudentSubjectClassIds = (studentId: string) => subjectClasses
    .filter((subjectClass) => subjectClass.studentIds.includes(studentId))
    .map((subjectClass) => subjectClass.id);
  const getRelevantSubjectClassIds = (classId: string, useGrade: boolean) => {
    const selectedClass = classes.find((classGroup) => classGroup.id === classId);
    const selectedGradeLevelId = selectedClass?.gradeLevelId;
    const selectedGrade = selectedClass?.grade?.trim();
    return subjectClasses
      .filter((subjectClass) => {
        if (!classId) {
          return false;
        }
        if (!useGrade) {
          return subjectClass.baseClassId === classId;
        }
        if (selectedGradeLevelId) {
          return subjectClass.gradeLevelId === selectedGradeLevelId;
        }
        if (!selectedGrade) {
          return subjectClass.baseClassId === classId;
        }
        const subjectBaseClass = classes.find((classGroup) => classGroup.id === subjectClass.baseClassId);
        return subjectBaseClass?.grade?.trim() === selectedGrade;
      })
      .map((subjectClass) => subjectClass.id);
  };
  const setDraftStudentClass = (classId: string) => {
    setDraftStudent((current) => ({ ...current, classId }));
    setDraftStudentSubjectClassIds(getRelevantSubjectClassIds(classId, draftStudentUseGradeSubjectClasses));
  };
  const setDraftStudentGradeMode = (useGrade: boolean) => {
    setDraftStudentUseGradeSubjectClasses(useGrade);
    setDraftStudentSubjectClassIds(getRelevantSubjectClassIds(draftStudent.classId, useGrade));
  };
  const saveDraftStudent = () => {
    const nextStudents = studentModalIndex === null
      ? [...students, draftStudent]
      : students.map((student, index) => index === studentModalIndex ? draftStudent : student);
    const nextSubjectClassIds = new Set(draftStudentSubjectClassIds);
    updateSchool({
      ...school,
      students: nextStudents,
      subjectClasses: subjectClasses.map((subjectClass) => ({
        ...subjectClass,
        studentIds: nextSubjectClassIds.has(subjectClass.id)
          ? mergeUnique([...subjectClass.studentIds, draftStudent.id])
          : subjectClass.studentIds.filter((studentId) => studentId !== draftStudent.id),
      })),
    });
    setStudentModalIndex(undefined);
  };
  const renderStudentFields = (item: Student, update: (item: Student) => void) => (
    <div className="student-modal-grid">
      <div className="student-modal-main">
        <div className="split-fields">
          <TextInput label="First name" value={item.firstName} onChange={(value) => update({ ...item, firstName: value })} />
          <TextInput label="Last name" value={item.lastName} onChange={(value) => update({ ...item, lastName: value })} />
        </div>
        <TextInput label="Student login email" value={item.email ?? ""} onChange={(value) => update({ ...item, email: value.trim().toLowerCase() })} />
        <CheckboxInput
          label="Disable account"
          checked={Boolean(item.accountDisabled)}
          onChange={(checked) => update({ ...item, accountDisabled: checked })}
        />
        <ImageUpload label="Student image" value={item.photoUrl ?? ""} onChange={(photoUrl) => update({ ...item, photoUrl })} variant="strictSquare" />
        <SelectInput
          label="Class"
          value={item.classId}
          options={[
            { value: "", label: "Select class" },
            ...classes.map((classGroup) => ({ value: classGroup.id, label: classGroup.name })),
          ]}
          onChange={setDraftStudentClass}
        />
        <CheckboxInput
          label="Add to subject classes for all classes in this grade"
          checked={draftStudentUseGradeSubjectClasses}
          onChange={setDraftStudentGradeMode}
        />
        <div className="split-fields">
          <DateInput label="Date of birth" value={item.dateOfBirth ?? ""} onChange={(value) => update({ ...item, dateOfBirth: value })} />
          <SelectInput
            label="Gender"
            value={item.gender ?? ""}
            options={[
              { value: "", label: "Select gender" },
              { value: "Female", label: "Female" },
              { value: "Male", label: "Male" },
              { value: "Other", label: "Other" },
              { value: "Prefer not to say", label: "Prefer not to say" },
            ]}
            onChange={(value) => update({ ...item, gender: value })}
          />
        </div>
        <TextArea label="Description (optional)" value={item.description ?? ""} onChange={(value) => update({ ...item, description: value })} />
        <GuardianEditor guardians={item.guardians ?? []} onChange={(guardians) => update({ ...item, guardians })} />
      </div>
      <SubjectClassStudentPicker
        classes={classes}
        subjects={subjects}
        subjectClasses={subjectClasses}
        search={subjectClassSearch}
        selectedIds={draftStudentSubjectClassIds}
        onSearchChange={setSubjectClassSearch}
        onSelectedIdsChange={setDraftStudentSubjectClassIds}
      />
    </div>
  );
  const renderAssessmentScaleFields = (scale: AssessmentScale, update: (scale: AssessmentScale) => void) => (
    <>
      <div className="scale-heading">
        <TextInput label="Scale name" value={scale.name} onChange={(name) => update({ ...scale, name })} />
        <TextInput label="Scale id" value={scale.id} onChange={(id) => update({ ...scale, id: slugifySchoolName(id) })} />
      </div>
      <div className="assessment-level-list">
        {scale.levels.map((level, levelIndex) => {
          const isRequiredLevel = level.id === "excused" || level.id === "assessed";
          return (
            <div className="assessment-level-row" key={level.id}>
              <TextInput
                label="Value"
                value={level.value}
                onChange={(value) => update({
                  ...scale,
                  levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, value } : item),
                })}
              />
              <TextInput
                label="Minimum %"
                value={String(level.minPercentage ?? 0)}
                onChange={(minPercentage) => update({
                  ...scale,
                  levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, minPercentage: parsePercentageInput(minPercentage) } : item),
                })}
              />
              <TextInput
                label="Description"
                value={level.description ?? ""}
                onChange={(description) => update({
                  ...scale,
                  levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, description } : item),
                })}
              />
              {isRequiredLevel ? <span className="required-scale-level-label">Required</span> : (
                <button
                  className="remove-button"
                  type="button"
                  onClick={() => update({ ...scale, levels: scale.levels.filter((_, index) => index !== levelIndex) })}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        className="secondary-action"
        type="button"
        onClick={() => update({
          ...scale,
          levels: [...scale.levels.slice(0, -2), { id: `level-${Date.now()}`, value: "", minPercentage: 0, description: "" }, ...scale.levels.slice(-2)],
        })}
      >
        Add level
      </button>
    </>
  );
  const globalCategories = globalAbout?.categories ?? [];
  const globalPageSlugs = new Set(globalAbout?.pages.map((page) => page.slug) ?? []);
  const editableAboutPages = aboutPages.filter((page) => !globalPageSlugs.has(page.slug));
  const activeCategoryInfo = editorCategories.find((category) => category.id === activeCategory) ?? editorCategories[0];
  const isSchoolWorkPage = activeSection === "schoolWork" || (activeCategory === "schoolWork" && !activeSection);
  const showSchoolWorkOverview = isSchoolWorkPage && !activeWorkSubjectClassId;

  return (
    <form
      className="school-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="editor-grid">
        {!activeSection && activeCategory !== "schoolWork" ? (
          <EditorSectionCards
            category={activeCategoryInfo}
            onSelect={onSectionChange}
            extraContent={activeCategory === "website" ? (
              <div className="school-website-visibility-bar">
                <div>
                  <strong>School website</strong>
                  <small>{school.showWebsite !== false ? "Visible to the public" : "Hidden — not visible to the public"}</small>
                </div>
                <CheckboxInput
                  label="Show school website"
                  checked={school.showWebsite !== false}
                  onChange={(checked) => setField("showWebsite", checked)}
                />
              </div>
            ) : undefined}
          />
        ) : activeSection && activeSection !== "schoolWork" ? (
          <div className="editor-back-row">
            <button className="secondary-action" type="button" onClick={onBack}>
              Back
            </button>
          </div>
        ) : null}
        {showSchoolWorkOverview ? (
          <SchoolWorkOverview
            subjectClasses={accessibleSubjectClasses}
            subjects={subjects}
            classes={classes}
            students={students}
            role={canAccessAllSubjectClasses ? "admin" : "teacher"}
            participantLabel={school.staff.find((member) => member.email?.toLowerCase() === currentUserEmail?.toLowerCase())?.name}
            remarks={school.remarks ?? []}
            remarkSettings={school.remarkSettings}
            globalRemarkCategories={globalRemarkCategories}
            schoolWorkSettings={schoolWorkSettings}
            globalAssessmentScales={globalSchoolWork?.assessmentScales ?? []}
            onOpen={(subjectClassId) => setActiveWorkSubjectClassId(subjectClassId)}
            onRemarksChange={(nextRemarks) => setField("remarks", nextRemarks)}
            onStudentChange={(student) => setField("students", students.map((s) => s.id === student.id ? student : s))}
            onSchoolWorkSettingsChange={updateSchoolWorkSettings}
          />
        ) : null}
        {activeSection === "profile" ? (
          <EditorPanel title="School profile">
            <div className="profile-field-table">
              <div className="profile-field-row">
                <div className="profile-field-description">
                  <strong>URL slug</strong>
                  <small>Contact support to change the school URL.</small>
                </div>
                <span className="input-shell">
                  <input value={school.id} readOnly aria-label="URL slug" className="readonly-slug-input" />
                </span>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>School name</strong></div>
                <span className="input-shell">
                  <input value={school.name} onChange={(event) => setField("name", event.target.value)} aria-label="School name" />
                </span>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>School type</strong></div>
                <span className="input-shell">
                  <input value={school.type} onChange={(event) => setField("type", event.target.value)} aria-label="School type" />
                </span>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Tagline</strong></div>
                <span className="input-shell">
                  <input value={school.tagline} onChange={(event) => setField("tagline", event.target.value)} aria-label="Tagline" />
                </span>
              </div>
              <div className="profile-field-row profile-field-row-tall">
                <div className="profile-field-description"><strong>About</strong></div>
                <textarea value={school.about} onChange={(event) => setField("about", event.target.value)} rows={5} aria-label="About" />
              </div>
              <div className="profile-field-row profile-field-row-tall">
                <div className="profile-field-description"><strong>School logo</strong></div>
                <ImageUpload label="School logo" value={school.logoUrl ?? ""} onChange={(logoUrl) => setField("logoUrl", logoUrl)} variant="logo" hideLabel />
              </div>
              <div className="profile-field-row profile-field-row-tall">
                <div className="profile-field-description"><strong>Hero image</strong></div>
                <ImageUpload label="Hero image" value={school.heroImage} onChange={(heroImage) => setField("heroImage", heroImage)} variant="hero" hideLabel />
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Main color</strong></div>
                <div className="color-input-wrapper">
                  <div className="color-preview" style={{ background: school.mainColor ?? "#18322e" }} />
                  <input type="color" value={school.mainColor ?? "#18322e"} onChange={(event) => setField("mainColor", event.target.value)} aria-label="Main color" />
                </div>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Sub color</strong></div>
                <div className="color-input-wrapper">
                  <div className="color-preview" style={{ background: school.subColor ?? "#e0b44f" }} />
                  <input type="color" value={school.subColor ?? "#e0b44f"} onChange={(event) => setField("subColor", event.target.value)} aria-label="Sub color" />
                </div>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Values</strong><small>Comma separated</small></div>
                <span className="input-shell">
                  <input value={school.values.join(", ")} onChange={(event) => setField("values", splitCsv(event.target.value))} aria-label="Values, comma separated" />
                </span>
              </div>
            </div>
          </EditorPanel>
        ) : null}

        {activeSection === "billing" ? (
          <SchoolBillingPanel
            school={school}
            onUpdatePayment={(payment) => {
              const existing = school.payments ?? [];
              const nextPayments = existing.some((p) => p.id === payment.id)
                ? existing.map((p) => (p.id === payment.id ? payment : p))
                : [...existing, payment];
              setField("payments", nextPayments);
            }}
          />
        ) : null}

        {activeSection === "timetable" ? (
          <EditorPanel title="Timetable">
            <TimetablePage
              school={school}
              onChange={(timetable) => setField("timetable", timetable)}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "substitutions" ? (
          <EditorPanel title="Absence & Substitutions">
            <SubstitutionsPage
              school={school}
              onSchoolChange={onChange}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "examTimetable" ? (
          <EditorPanel title="Exam Timetable">
            <ExamTimetableAdminPage
              school={school}
              onSchoolChange={(next) => { onChange(next); void onAutoSave?.(next); }}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "loginSettings" ? (
          <EditorPanel title="Settings">
            <div className="nested-editor-grid">
              <section className="sub-editor-panel">
                <h3>Login format</h3>
                <p className="editor-helper-text">Choose which sign-in methods are available for staff with admin page access.</p>
                <div className="login-format-list">
                  <label className="login-format-option">
                    <div>
                      <strong>Username and password</strong>
                      <small>Admins sign in with their email address and password.</small>
                    </div>
                    <CheckboxInput
                      label="Enabled"
                      checked={loginSettings.emailPasswordEnabled}
                      onChange={(checked) => setField("loginSettings", { ...loginSettings, emailPasswordEnabled: checked })}
                    />
                  </label>
                  <label className="login-format-option">
                    <div>
                      <strong>Email link</strong>
                      <small>Admins receive a passwordless sign-in link by email.</small>
                    </div>
                    <CheckboxInput
                      label="Enabled"
                      checked={loginSettings.emailLinkEnabled}
                      onChange={(checked) => setField("loginSettings", { ...loginSettings, emailLinkEnabled: checked })}
                    />
                  </label>
                </div>
              </section>
              <section className="sub-editor-panel">
                <h3>Messages</h3>
                <p className="editor-helper-text">Control who students can contact in school chat.</p>
                <label className="login-format-option">
                  <div>
                    <strong>Student-to-student messages</strong>
                    <small>When disabled, students can message teachers and admins, but not other students.</small>
                  </div>
                  <CheckboxInput
                    label="Enabled"
                    checked={Boolean(schoolWorkSettings.allowStudentMessaging)}
                    onChange={(allowStudentMessaging) => updateSchoolWorkSettings({ ...schoolWorkSettings, allowStudentMessaging })}
                  />
                </label>
              </section>
            </div>
          </EditorPanel>
        ) : null}

        {activeSection === "contact" ? (
          <EditorPanel title="Contact details">
            <div className="split-fields">
              <TextInput label="City" value={school.city} onChange={(value) => setField("city", value)} />
              <TextInput label="Country" value={school.country} onChange={(value) => setField("country", value)} />
            </div>
            <TextInput label="Address" value={school.address} onChange={(value) => setField("address", value)} />
            <TextInput label="Phone" value={school.phone} onChange={(value) => setField("phone", value)} />
            <TextInput label="Email" value={school.email} onChange={(value) => setField("email", value)} />
            <TextInput label="Principal" value={school.principal} onChange={(value) => setField("principal", value)} />
          </EditorPanel>
        ) : null}

        {activeSection === "about" ? (
          <EditorPanel title="Website pages">
            <p className="website-pages-description">
              All pages shown on your school website, organized by category. Global categories and pages are managed by the superadmin.
              School categories appear as navigation links in the header.
            </p>
            {[
              ...globalCategories.map((cat) => ({ ...cat, isGlobal: true as const })),
              ...aboutCategories.map((cat) => ({ ...cat, isGlobal: false as const })),
            ].map((category) => {
              const catGlobalPages = category.isGlobal
                ? (globalAbout?.pages ?? []).filter((p) => p.categoryId === category.id)
                : [];
              const catSchoolPages = editableAboutPages.filter((p) => p.categoryId === category.id);
              return (
                <section className="website-pages-category" key={category.id}>
                  <div className="website-pages-category-header">
                    {category.isGlobal ? (
                      <>
                        <h3>{category.title}</h3>
                        <span className="website-pages-global-badge">Global</span>
                      </>
                    ) : (
                      <>
                        <TextInput
                          label="Category name"
                          value={category.title}
                          onChange={(title) => setField("aboutCategories", aboutCategories.map((c) => c.id === category.id ? { ...c, title } : c))}
                        />
                        <button
                          className="remove-button"
                          type="button"
                          onClick={() => {
                            const remaining = aboutCategories.filter((c) => c.id !== category.id);
                            const fallbackId = remaining[0]?.id ?? globalCategories[0]?.id ?? "";
                            updateSchool({
                              ...school,
                              aboutCategories: remaining,
                              aboutPages: aboutPages.map((page) => ({
                                ...page,
                                categoryId: page.categoryId === category.id ? fallbackId : page.categoryId,
                              })),
                            });
                          }}
                        >
                          Remove category
                        </button>
                      </>
                    )}
                  </div>
                  {catGlobalPages.map((page) => (
                    <article className="website-pages-global-page" key={page.id}>
                      <div className="website-pages-global-page-meta">
                        <strong>{page.title}</strong>
                        <small>/{page.slug}</small>
                      </div>
                      {page.kind === "contact" ? (
                        <p className="website-pages-contact-note">Shows your school's contact information automatically.</p>
                      ) : (
                        <RichTextEditor
                          label={page.kind === "staffDirectory" ? "Local description above staff directory" : "Additional school content (shown on this page)"}
                          value={aboutPages.find((item) => item.slug === page.slug)?.body ?? ""}
                          onChange={(body) => {
                            const existing = aboutPages.find((item) => item.slug === page.slug);
                            const updated: AboutPage = {
                              id: existing?.id ?? `local-global-page-${page.slug}`,
                              categoryId: page.categoryId,
                              title: page.title,
                              slug: page.slug,
                              headerImage: existing?.headerImage ?? "",
                              body,
                            };
                            const idx = aboutPages.findIndex((item) => item.slug === page.slug);
                            setField("aboutPages", idx >= 0
                              ? aboutPages.map((item, i) => i === idx ? updated : item)
                              : [...aboutPages, updated]);
                          }}
                        />
                      )}
                    </article>
                  ))}
                  <Repeater
                    items={catSchoolPages}
                    addLabel="Add page"
                    createItem={(): AboutPage => ({
                      id: `about-page-${Date.now()}`,
                      categoryId: category.id,
                      title: "New page",
                      slug: "",
                      headerImage: "",
                      body: "",
                    })}
                    onChange={(items) => {
                      const globalLocalPages = aboutPages.filter((p) => globalPageSlugs.has(p.slug));
                      const otherPages = editableAboutPages.filter((p) => p.categoryId !== category.id);
                      setField("aboutPages", [...globalLocalPages, ...otherPages, ...items]);
                    }}
                    renderItem={(item, update) => (
                      <>
                        <TextInput
                          label="Page title"
                          value={item.title}
                          onChange={(value) => update({ ...item, title: value, slug: item.slug || value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })}
                        />
                        <TextInput label="URL slug" value={item.slug} onChange={(value) => update({ ...item, slug: value })} />
                        <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
                        <RichTextEditor label="Page content" value={item.body} onChange={(value) => update({ ...item, body: value })} />
                      </>
                    )}
                  />
                </section>
              );
            })}
            <button
              className="secondary-action"
              type="button"
              onClick={() => setField("aboutCategories", [...aboutCategories, { id: `about-category-${Date.now()}`, title: "New category" }])}
            >
              Add category
            </button>
          </EditorPanel>
        ) : null}

        {activeSection === "news" ? (
          <EditorPanel title="News">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => {
                setDraftNews(createNewsItem());
                setNewsModalIndex(null);
              }}
            >
              Add news
            </button>
            <NewsTable
              news={school.announcements}
              onEdit={(item, index) => {
                setDraftNews(item);
                setNewsModalIndex(index);
              }}
              onRemove={(index) => setField("announcements", school.announcements.filter((_, currentIndex) => currentIndex !== index))}
            />
            {newsModalIndex !== undefined ? (
              <RegistrationModal
                title={newsModalIndex === null ? "Create news" : "Edit news"}
                eyebrow="News"
                submitLabel={newsModalIndex === null ? "Add news" : "Save news"}
                onClose={() => setNewsModalIndex(undefined)}
                onSubmit={() => {
                  setField("announcements", newsModalIndex === null
                    ? [...school.announcements, draftNews]
                    : school.announcements.map((item, index) => index === newsModalIndex ? draftNews : item));
                  setNewsModalIndex(undefined);
                }}
              >
                {renderNewsFields(draftNews, setDraftNews)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "calendar" ? (
          <EditorPanel title="Calendar">
            <div className="calendar-editor-layout">
              <div className="calendar-editor-main">
                <button
                  className="secondary-action repeater-add-button"
                  type="button"
                  onClick={() => {
                    setDraftCalendar(createCalendarItem());
                    setCalendarModalIndex(null);
                  }}
                >
                  Add event
                </button>
                <CalendarTable
                  items={school.calendar}
                  onEdit={(item, index) => {
                    setDraftCalendar(item);
                    setCalendarModalIndex(index);
                  }}
                  onRemove={(index) => setField("calendar", school.calendar.filter((_, currentIndex) => currentIndex !== index))}
                />
              </div>
              <CalendarAdminPreview items={school.calendar} />
            </div>
            {calendarModalIndex !== undefined ? (
              <RegistrationModal
                title={calendarModalIndex === null ? "Create event" : "Edit event"}
                eyebrow="Calendar"
                submitLabel={calendarModalIndex === null ? "Add event" : "Save event"}
                onClose={() => setCalendarModalIndex(undefined)}
                onSubmit={() => {
                  setField("calendar", calendarModalIndex === null
                    ? [...school.calendar, draftCalendar]
                    : school.calendar.map((item, index) => index === calendarModalIndex ? draftCalendar : item));
                  setCalendarModalIndex(undefined);
                }}
              >
                {renderCalendarFields(draftCalendar, setDraftCalendar)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "staff" ? (
          <EditorPanel title="Staff and administrators">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => {
                setDraftStaff(createStaffMember());
                setStaffModalIndex(null);
              }}
            >
              Add staff member
            </button>
            <StaffTable
              staff={school.staff}
              onEdit={(member, index) => {
                setDraftStaff(member);
                setStaffModalIndex(index);
              }}
              onSimulate={onSimulateStaff}
              onRecover={(index) => {
                const nextStaff = school.staff.map((member, i) =>
                  i === index ? { ...member, deletedAt: undefined, accountDisabled: false } : member
                ).filter((member) => !isStaffPermanentlyRemoved(member));
                updateSchool({ ...school, adminEmails: getStaffAdminEmails(nextStaff), staff: nextStaff });
              }}
            />
            {staffModalIndex !== undefined ? (
              <RegistrationModal
                title={staffModalIndex === null ? "Register staff member" : "Edit staff member"}
                eyebrow="Staff"
                submitLabel={staffModalIndex === null ? "Add staff member" : "Save staff member"}
                onClose={() => setStaffModalIndex(undefined)}
                onSubmit={() => {
                  const nextDraftStaff = staffCanAccessAdminPage(draftStaff)
                    ? { ...draftStaff, accountDisabled: false }
                    : draftStaff;
                  const nextStaff = staffModalIndex === null
                    ? [...school.staff, nextDraftStaff]
                    : school.staff.map((member, index) => index === staffModalIndex ? nextDraftStaff : member);
                  updateSchool({
                    ...school,
                    adminEmails: getStaffAdminEmails(nextStaff),
                    staff: nextStaff,
                  });
                  setStaffModalIndex(undefined);
                }}
                onRemove={staffModalIndex !== null ? () => {
                  const nextStaff = school.staff
                    .map((member, i) => i === staffModalIndex
                      ? { ...member, deletedAt: new Date().toISOString(), accountDisabled: true, visibleOnHomePage: false, visibleOnStaffPage: false, canAccessAdminPage: false }
                      : member)
                    .filter((member) => !isStaffPermanentlyRemoved(member));
                  updateSchool({
                    ...school,
                    adminEmails: getStaffAdminEmails(nextStaff),
                    staff: nextStaff,
                  });
                  setStaffModalIndex(undefined);
                } : undefined}
              >
                {renderStaffFields(draftStaff, setDraftStaff)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "access" ? (
          <EditorPanel title="Access">
            <section className="sub-editor-panel">
              <h3>Platform admin</h3>
              <p className="editor-helper-text">The platform admin is the only staff member with access to the Settings page. Leave unset to allow all school admins to access Settings.</p>
              {(() => {
                const adminStaff = school.staff.filter((m) => m.canAccessAdminPage ?? hasStaffCategory(m, "Administration")).filter((m) => m.email);
                const options = [
                  { value: "", label: "No restriction — all admins" },
                  ...adminStaff.map((m) => ({ value: m.email!, label: `${m.name} (${m.email})` })),
                ];
                return (
                  <SelectInput
                    label="Platform admin"
                    value={school.platformAdminEmail ?? ""}
                    options={options}
                    onChange={(value) => setField("platformAdminEmail", value || undefined)}
                  />
                );
              })()}
            </section>
            <AccessOverview
              school={school}
              classes={classes}
              staff={school.staff}
              students={students}
              subjectClasses={subjectClasses}
              subjects={subjects}
              isPlatformAdmin={Boolean(
                isSuperAdmin || (
                  canAccessAllSubjectClasses && (
                    !school.platformAdminEmail ||
                    school.platformAdminEmail.toLowerCase() === currentUserEmail?.toLowerCase()
                  )
                )
              )}
              onUpdateStaff={(updatedStaff) => setField("staff", updatedStaff)}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "grades" || activeSection === "classes" || activeSection === "subjectClasses" ? (
          <EditorPanel title={activeSection === "grades" ? "Grades and years" : activeSection === "subjectClasses" ? "Subject classes" : "Classes"}>
            <div className="classes-editor-layout">
              {activeSection === "grades" ? <section className="sub-editor-panel class-management-panel">
                <div className="section-heading class-management-heading">
                  <h3>Grades and years</h3>
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => {
                      setDraftGradeLevel(createGradeLevel());
                      setGradeLevelModalIndex(null);
                    }}
                  >
                    Add grade
                  </button>
                </div>
                <GradeLevelTable
                  gradeLevels={gradeLevels}
                  classes={classes}
                  subjectClasses={subjectClasses}
                  onEdit={(gradeLevel, index) => {
                    setDraftGradeLevel(gradeLevel);
                    setGradeLevelModalIndex(index);
                  }}
                  onRemove={(index) => {
                    const removedGradeLevelId = gradeLevels[index]?.id;
                    updateSchool({
                      ...school,
                      gradeLevels: gradeLevels.filter((_, currentIndex) => currentIndex !== index),
                      classes: classes.map((classGroup) => classGroup.gradeLevelId === removedGradeLevelId ? { ...classGroup, gradeLevelId: "", grade: "" } : classGroup),
                      subjectClasses: updateAutomaticSubjectClassNames(subjectClasses.map((subjectClass) => subjectClass.gradeLevelId === removedGradeLevelId ? { ...subjectClass, gradeLevelId: "" } : subjectClass), subjects, classes, gradeLevels.filter((_, currentIndex) => currentIndex !== index)),
                    });
                  }}
                />
              </section> : null}
              {activeSection === "classes" ? <section className="sub-editor-panel class-management-panel">
                <div className="section-heading class-management-heading">
                  <h3>Classes</h3>
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => {
                      setDraftClass(createClassGroup());
                      setClassModalIndex(null);
                    }}
                  >
                    Add main class
                  </button>
                </div>
                <ClassTable
                  classes={classes}
                  gradeLevels={gradeLevels}
                  students={students}
                  subjectClasses={subjectClasses}
                  onEdit={(classGroup, index) => {
                    setDraftClass(classGroup);
                    setClassModalIndex(index);
                  }}
                  onRemove={(index) => {
                    const nextClasses = classes.filter((_, currentIndex) => currentIndex !== index);
                    const validIds = new Set(nextClasses.map((classGroup) => classGroup.id));
                    updateSchool({
                      ...school,
                      classes: nextClasses,
                      students: students.map((student) => ({
                        ...student,
                        classId: validIds.has(student.classId) ? student.classId : nextClasses[0]?.id ?? "",
                      })),
                      subjectClasses: updateAutomaticSubjectClassNames(subjectClasses.map((subjectClass) => ({
                        ...subjectClass,
                        baseClassId: subjectClass.baseClassId && validIds.has(subjectClass.baseClassId) ? subjectClass.baseClassId : "",
                      })), subjects, nextClasses, gradeLevels),
                    });
                  }}
                />
              </section> : null}
              {activeSection === "subjectClasses" ? <section className="sub-editor-panel class-management-panel">
                <div className="section-heading class-management-heading">
                  <h3>Subject classes</h3>
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => {
                      setDraftSubjectClass(createSubjectClass());
                      setSubjectClassModalIndex(null);
                    }}
                    disabled={subjects.length === 0}
                  >
                    Add subject class
                  </button>
                </div>
                {subjects.length === 0 ? (
                  <div className="empty-editor-state">
                    <h3>Add a subject first</h3>
                    <p>Subject classes need a subject. Students can be added later and can come from multiple main classes.</p>
                  </div>
                ) : (
                  <SubjectClassTable
                    classes={classes}
                    gradeLevels={gradeLevels}
                    subjectClasses={subjectClasses}
                    subjects={subjects}
                    onEdit={(subjectClass, index) => {
                      setDraftSubjectClass(subjectClass);
                      setSubjectClassModalIndex(index);
                    }}
                    onRemove={(index) => setField("subjectClasses", subjectClasses.filter((_, currentIndex) => currentIndex !== index))}
                  />
                )}
              </section> : null}
            </div>
            {gradeLevelModalIndex !== undefined ? (
              <RegistrationModal
                title={gradeLevelModalIndex === null ? "Create grade" : "Edit grade"}
                eyebrow="Grades"
                submitLabel={gradeLevelModalIndex === null ? "Add grade" : "Save grade"}
                onClose={() => setGradeLevelModalIndex(undefined)}
                onSubmit={() => {
                  const nextGradeLevels = gradeLevelModalIndex === null
                    ? [...gradeLevels, draftGradeLevel]
                    : gradeLevels.map((current, currentIndex) => currentIndex === gradeLevelModalIndex ? draftGradeLevel : current);
                  const previousGradeLevelId = gradeLevelModalIndex === null ? null : gradeLevels[gradeLevelModalIndex]?.id;
                  updateSchool({
                    ...school,
                    gradeLevels: nextGradeLevels,
                    classes: previousGradeLevelId
                      ? classes.map((classGroup) => classGroup.gradeLevelId === previousGradeLevelId ? { ...classGroup, gradeLevelId: draftGradeLevel.id, grade: draftGradeLevel.grade } : classGroup)
                      : classes,
                    subjectClasses: updateAutomaticSubjectClassNames(previousGradeLevelId
                      ? subjectClasses.map((subjectClass) => subjectClass.gradeLevelId === previousGradeLevelId ? { ...subjectClass, gradeLevelId: draftGradeLevel.id } : subjectClass)
                      : subjectClasses, subjects, classes, nextGradeLevels),
                  });
                  setGradeLevelModalIndex(undefined);
                }}
              >
                {renderGradeLevelFields(draftGradeLevel, setDraftGradeLevel)}
              </RegistrationModal>
            ) : null}
            {classModalIndex !== undefined ? (
              <RegistrationModal
                title={classModalIndex === null ? "Create main class" : "Edit main class"}
                eyebrow="Classes"
                submitLabel={classModalIndex === null ? "Add class" : "Save class"}
                onClose={() => setClassModalIndex(undefined)}
                onSubmit={() => {
                  const nextClasses = classModalIndex === null
                    ? [...classes, draftClass]
                    : classes.map((current, currentIndex) => (currentIndex === classModalIndex ? draftClass : current));
                  const validIds = new Set(nextClasses.map((classGroup) => classGroup.id));
                  if (classModalIndex === null) {
                    updateSchool({ ...school, classes: nextClasses });
                  } else {
                    updateSchool({
                      ...school,
                      classes: nextClasses,
                      students: students.map((student) => ({
                        ...student,
                        classId: validIds.has(student.classId) ? student.classId : nextClasses[0]?.id ?? "",
                      })),
                      subjectClasses: updateAutomaticSubjectClassNames(subjectClasses.map((subjectClass) => ({
                        ...subjectClass,
                        baseClassId: subjectClass.baseClassId && validIds.has(subjectClass.baseClassId) ? subjectClass.baseClassId : "",
                      })), subjects, nextClasses, gradeLevels),
                    });
                  }
                  setClassModalIndex(undefined);
                }}
              >
                {renderClassFields(draftClass, setDraftClass)}
              </RegistrationModal>
            ) : null}
            {subjectClassModalIndex !== undefined ? (
              <RegistrationModal
                title={subjectClassModalIndex === null ? "Create subject class" : "Edit subject class"}
                eyebrow="Subject classes"
                submitLabel={subjectClassModalIndex === null ? "Create subject class" : "Save subject class"}
                onClose={() => setSubjectClassModalIndex(undefined)}
                onSubmit={() => {
                  setField("subjectClasses", subjectClassModalIndex === null
                    ? [...subjectClasses, withAutomaticSubjectClassName(draftSubjectClass)]
                    : subjectClasses.map((item, index) => index === subjectClassModalIndex ? withAutomaticSubjectClassName(draftSubjectClass) : item));
                  setSubjectClassModalIndex(undefined);
                }}
              >
                {renderSubjectClassFields(draftSubjectClass, setDraftSubjectClass)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "subjects" ? (
          <EditorPanel title="Subjects">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => {
                setDraftSubject(createSubject());
                setSubjectModalIndex(null);
              }}
            >
              Add subject
            </button>
            <SubjectTable
              subjects={subjects}
              subjectClasses={subjectClasses}
              onEdit={(item, index) => {
                setDraftSubject(item);
                setSubjectModalIndex(index);
              }}
              onRemove={(index) => {
                const removedSubjectId = subjects[index]?.id;
                const nextSchool = {
                  ...school,
                  subjects: subjects.filter((_, currentIndex) => currentIndex !== index),
                  subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.subjectId !== removedSubjectId),
                };
                onChange(nextSchool);
                void onAutoSave?.(nextSchool);
              }}
            />
            {subjectModalIndex !== undefined ? (
              <RegistrationModal
                title={subjectModalIndex === null ? "Create subject" : "Edit subject"}
                eyebrow="Subjects"
                submitLabel={subjectModalIndex === null ? "Add subject" : "Save subject"}
                onClose={() => setSubjectModalIndex(undefined)}
                onSubmit={() => {
                  const nextSubjects = subjectModalIndex === null
                    ? [...subjects, draftSubject]
                    : subjects.map((item, index) => index === subjectModalIndex ? draftSubject : item);
                  updateSchool({
                    ...school,
                    subjects: nextSubjects,
                    subjectClasses: updateAutomaticSubjectClassNames(subjectClasses, nextSubjects, classes, gradeLevels),
                  });
                  setSubjectModalIndex(undefined);
                }}
              >
                {renderSubjectFields(draftSubject, setDraftSubject)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}


        {isSchoolWorkPage && activeWorkSubjectClassId ? (
          <div className="school-work-detail-shell">
            <SubjectClassWorkPage
              subjectClass={subjectClasses.find((item) => item.id === activeWorkSubjectClassId) ?? null}
              subjects={subjects}
              students={students}
              assessmentScales={effectiveAssessmentScales}
              globalAssessmentScales={globalSchoolWork?.assessmentScales ?? []}
              schoolWorkSettings={schoolWorkSettings}
              allSubjectClasses={subjectClasses}
              remarks={school.remarks ?? []}
              remarkSettings={school.remarkSettings}
              globalRemarkCategories={globalRemarkCategories}
              accessLevel="admin"
              graderLabel="Admin"
              onBack={() => setActiveWorkSubjectClassId(null)}
              onChange={(nextSubjectClass) => setField("subjectClasses", subjectClasses.map((item) => item.id === nextSubjectClass.id ? nextSubjectClass : item))}
              onSchoolWorkSettingsChange={updateSchoolWorkSettings}
              onRemarkSettingsChange={updateRemarkSettings}
              onRemarksChange={(nextRemarks) => setField("remarks", nextRemarks)}
            />
          </div>
        ) : null}

        {activeSection === "students" ? (
          <EditorPanel title="Students">
            {classes.length === 0 ? (
              <div className="empty-editor-state">
                <h3>Create a class first</h3>
                <p>Students must belong to a class. Add at least one class before adding students.</p>
                <button className="primary-action" type="button" onClick={() => onSectionChange("classes")}>
                  Go to classes
                </button>
              </div>
            ) : (
              <>
                <button
                  className="secondary-action repeater-add-button"
                  type="button"
                  onClick={() => {
                    const nextStudent = createStudent();
                    setDraftStudent(nextStudent);
                    setDraftStudentUseGradeSubjectClasses(false);
                    setDraftStudentSubjectClassIds([]);
                    setSubjectClassSearch("");
                    setStudentModalIndex(null);
                  }}
                >
                  Add student
                </button>
                <StudentTable
                  students={students}
                  classes={classes}
                  onSimulate={onSimulateStudent}
                  onEdit={(student, index) => {
                    setDraftStudent(student);
                    setDraftStudentUseGradeSubjectClasses(false);
                    setDraftStudentSubjectClassIds(getStudentSubjectClassIds(student.id));
                    setSubjectClassSearch("");
                    setStudentModalIndex(index);
                  }}
                  onRemove={(index) => {
                    const removedStudentId = students[index]?.id;
                    updateSchool({
                      ...school,
                      students: students.filter((_, currentIndex) => currentIndex !== index),
                      subjectClasses: removedStudentId
                        ? subjectClasses.map((subjectClass) => ({
                          ...subjectClass,
                          studentIds: subjectClass.studentIds.filter((studentId) => studentId !== removedStudentId),
                        }))
                        : subjectClasses,
                    });
                  }}
                />
                {studentModalIndex !== undefined ? (
                  <RegistrationModal
                    title={studentModalIndex === null ? "Add student" : "Edit student"}
                    eyebrow="Students"
                    submitLabel={studentModalIndex === null ? "Add student" : "Save student"}
                    wide
                    onClose={() => setStudentModalIndex(undefined)}
                    onSubmit={saveDraftStudent}
                  >
                    {renderStudentFields(draftStudent, setDraftStudent)}
                  </RegistrationModal>
                ) : null}
              </>
            )}
          </EditorPanel>
        ) : null}
      </div>
    </form>
  );
}

export function EditorMenu({
  activeCategory,
  activeSection,
  onChange,
  hiddenCategories = [],
}: {
  activeCategory: EditorCategory;
  activeSection: EditorSection | null;
  onChange: (category: EditorCategory) => void;
  hiddenCategories?: EditorCategory[];
}) {
  return (
    <nav className="editor-menu" aria-label="School admin categories">
      {editorCategories.filter((category) => !hiddenCategories.includes(category.id)).map((category) => (
        <button
          className={activeCategory === category.id ? "active-editor-section" : ""}
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
        >
          <span>{category.label}</span>
          <small>{activeSection && category.sections.includes(activeSection) ? getEditorSectionLabel(activeSection) : category.description}</small>
        </button>
      ))}
    </nav>
  );
}

function EditorSectionCards({
  category,
  onSelect,
  extraContent,
}: {
  category: (typeof editorCategories)[number];
  onSelect: (section: EditorSection) => void;
  extraContent?: React.ReactNode;
}) {
  const renderSectionCards = (sections: EditorSection[]) => (
    <div className="editor-section-card-grid">
      {sections.map((section) => (
        <button className="editor-section-card" key={section} type="button" onClick={() => onSelect(section)}>
          <AdminCardTitle icon={getEditorSectionIcon(section)} title={getEditorSectionLabel(section)} />
          {getEditorSectionExample(section) ? <small>{getEditorSectionExample(section)}</small> : null}
          <span>{getEditorSectionDescription(section)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <section className="editor-section-picker">
      <div>
        <p className="eyebrow">{category.label}</p>
        <h2>{category.label}</h2>
        <p>{category.description}</p>
      </div>
      {extraContent}
      {category.groups ? (
        category.groups.map((group) => (
          <div key={group.label} className="editor-section-group">
            <h3 className="editor-section-group-label">{group.label}</h3>
            {renderSectionCards(group.sections)}
          </div>
        ))
      ) : (
        renderSectionCards(category.sections)
      )}
    </section>
  );
}

function getEditorSectionLabel(section: EditorSection) {
  return editorSections.find((item) => item.id === section)?.label ?? section;
}

function getEditorSectionIcon(section: EditorSection): IconDefinition {
  const icons: Record<EditorSection, IconDefinition> = {
    profile: faIdCard,
    contact: faAddressBook,
    about: faCircleInfo,
    news: faNewspaper,
    calendar: faCalendarDays,
    staff: faUsers,
    access: faKey,
    grades: faLayerGroup,
    classes: faChalkboardUser,
    subjectClasses: faBookOpen,
    subjects: faBook,
    students: faUserGraduate,
    schoolWork: faFolderOpen,
    loginSettings: faGaugeHigh,
    billing: faScaleBalanced,
    timetable: faCalendarDays,
    substitutions: faClipboardCheck,
    examTimetable: faClipboardList,
  };
  return icons[section];
}

function getEditorSectionExample(section: EditorSection) {
  const examples: Partial<Record<EditorSection, string>> = {
    grades: "Grade 8",
    classes: "Class 8A",
    subjectClasses: "Mathematics - 8A",
    subjects: "Mathematics",
  };
  return examples[section];
}

export function getEditorCategoryForSection(section: EditorSection) {
  return editorCategories.find((category) => category.sections.includes(section))?.id ?? "website";
}

export function getEditorStateFromHash(): { category: EditorCategory; section: EditorSection | null } {
  const [categoryValue, sectionValue] = window.location.hash.replace(/^#/, "").split("/");
  const category = editorCategories.some((item) => item.id === categoryValue) ? categoryValue as EditorCategory : "website";
  const section = editorSections.some((item) => item.id === sectionValue) ? sectionValue as EditorSection : null;

  if (section && getEditorCategoryForSection(section) !== category) {
    return { category: getEditorCategoryForSection(section), section };
  }

  return { category, section };
}

export function setEditorHash(category: EditorCategory, section?: EditorSection) {
  const nextHash = section ? `#${category}/${section}` : `#${category}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function getEditorSectionDescription(section: EditorSection) {
  const descriptions: Record<EditorSection, string> = {
    profile: "School identity, colors, headline text, and hero image.",
    contact: "Address, phone, email, location, and principal details.",
    about: "About page categories, pages, and rich content.",
    news: "School news articles and announcements.",
    calendar: "Important school dates and events.",
    staff: "Staff profiles, administrator access, visibility, and contact details.",
    access: "Overview of users, roles, pages, and EduLink LMS access.",
    grades: "Register grade levels and school years.",
    classes: "Main class groups and class teachers.",
    subjectClasses: "Subject class groups with teachers and students.",
    subjects: "Subject catalog, abbreviations, and display colors.",
    schoolWork: "Course materials and assignments for subject classes.",
    loginSettings: "Choose username/password and email link sign-in options.",
    students: "Student records, guardians, and class assignments.",
    billing: "Subscription plan, invoices, and payment history.",
    timetable: "Build and manage the school timetable.",
    substitutions: "Register teacher absences and assign cover for their lessons.",
    examTimetable: "Schedule exams by subject, class, date, time, and venue.",
  };
  return descriptions[section];
}

function StudentTable({
  students,
  classes,
  onSimulate,
  onEdit,
  onRemove,
}: {
  students: Student[];
  classes: ClassGroup[];
  onSimulate?: (student: Student) => void;
  onEdit: (student: Student, index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [infoStudent, setInfoStudent] = useState<Student | null>(null);
  const [missingFieldFilter, setMissingFieldFilter] = useState("all");

  if (students.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No students yet</h3>
        <p>Add a student to start building the student list.</p>
      </div>
    );
  }

  const getClassName = (classId: string) => classes.find((classGroup) => classGroup.id === classId)?.name ?? "No class";
  const getGuardianSummary = (student: Student) => {
    const guardians = student.guardians ?? [];
    if (guardians.length === 0) {
      return "No guardians";
    }
    return guardians.map((guardian) => [guardian.name, guardian.relationship].filter(Boolean).join(" - ")).join(", ");
  };
  const missingFieldOptions = [
    { value: "all", label: "All students" },
    { value: "class", label: "Without class" },
    { value: "email", label: "Without login email" },
    { value: "photo", label: "Without photo" },
    { value: "dateOfBirth", label: "Without date of birth" },
    { value: "gender", label: "Without gender" },
    { value: "guardians", label: "Without guardians" },
    { value: "description", label: "Without description" },
  ];
  const studentRows = students
    .map((student, index) => ({ student, index }))
    .filter(({ student }) => {
      if (missingFieldFilter === "all") {
        return true;
      }
      if (missingFieldFilter === "class") {
        return !student.classId || !classes.some((classGroup) => classGroup.id === student.classId);
      }
      if (missingFieldFilter === "email") {
        return !student.email?.trim();
      }
      if (missingFieldFilter === "photo") {
        return !student.photoUrl?.trim();
      }
      if (missingFieldFilter === "dateOfBirth") {
        return !student.dateOfBirth?.trim();
      }
      if (missingFieldFilter === "gender") {
        return !student.gender?.trim();
      }
      if (missingFieldFilter === "guardians") {
        return (student.guardians ?? []).length === 0;
      }
      if (missingFieldFilter === "description") {
        return !student.description?.trim();
      }
      return true;
    });

  return (
    <div className="student-table-panel">
      <div className="student-table-filter-row">
        <label className="field-label">
          Filter
          <select value={missingFieldFilter} onChange={(event) => setMissingFieldFilter(event.target.value)}>
            {missingFieldOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <span>{studentRows.length} of {students.length} student{students.length === 1 ? "" : "s"}</span>
      </div>
      {studentRows.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No students match this filter</h3>
          <p>Choose another missing-field filter to see more students.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map(({ student, index }) => (
                <tr key={student.id || `${student.firstName}-${student.lastName}-${index}`}>
                  <td>
                    <strong>{student.firstName} {student.lastName}</strong>
                    {student.accountDisabled ? <span>Account disabled</span> : null}
                  </td>
                  <td>{getClassName(student.classId)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="secondary-action" type="button" onClick={() => setInfoStudent(student)}>
                        View more info
                      </button>
                      {onSimulate ? (
                        <button className="secondary-action" type="button" onClick={() => onSimulate(student)} disabled={student.accountDisabled}>
                          Simulate
                        </button>
                      ) : null}
                      <button className="secondary-action" type="button" onClick={() => onEdit(student, index)}>
                        Edit
                      </button>
                      <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {infoStudent ? (
        <div className="modal-backdrop" role="presentation">
          <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="student-info-title">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">Student</p>
                <h2 id="student-info-title">{infoStudent.firstName} {infoStudent.lastName}</h2>
              </div>
            </div>
            <div className="staff-modal-body student-info-modal-body">
              {infoStudent.photoUrl ? <img className="student-info-photo" src={infoStudent.photoUrl} alt="" /> : null}
              <div className="student-info-list">
                <p><strong>Class:</strong> {getClassName(infoStudent.classId)}</p>
                <p><strong>Date of birth:</strong> {infoStudent.dateOfBirth ? formatDate(infoStudent.dateOfBirth) : "Not set"}</p>
                <p><strong>Gender:</strong> {infoStudent.gender || "Not set"}</p>
                <p><strong>Email:</strong> {infoStudent.email || "No login email"}</p>
                <p><strong>Account:</strong> {infoStudent.accountDisabled ? "Disabled" : "Active"}</p>
                <p><strong>Guardians:</strong> {getGuardianSummary(infoStudent)}</p>
                <p><strong>Description:</strong> {infoStudent.description || "No description"}</p>
                <p><strong>Student ID:</strong> {infoStudent.id}</p>
              </div>
            </div>
            <div className="staff-modal-actions">
              <button className="secondary-action" type="button" onClick={() => setInfoStudent(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SubjectClassStudentPicker({
  classes,
  subjects,
  subjectClasses,
  search,
  selectedIds,
  onSearchChange,
  onSelectedIdsChange,
}: {
  classes: ClassGroup[];
  subjects: Subject[];
  subjectClasses: SubjectClass[];
  search: string;
  selectedIds: string[];
  onSearchChange: (search: string) => void;
  onSelectedIdsChange: (selectedIds: string[]) => void;
}) {
  const selectedSet = new Set(selectedIds);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSubjectClasses = subjectClasses.filter((subjectClass) => {
    const subject = subjects.find((item) => item.id === subjectClass.subjectId);
    const classGroup = classes.find((item) => item.id === subjectClass.baseClassId);
    const haystack = `${subjectClass.name} ${subject?.name ?? ""} ${classGroup?.name ?? ""} ${classGroup?.grade ?? ""} ${subjectClass.teacherName ?? ""}`.toLowerCase();
    return !normalizedSearch || haystack.includes(normalizedSearch);
  });

  return (
    <aside className="student-subject-class-picker">
      <div>
        <h3>Subject classes</h3>
        <p>{selectedIds.length} selected</p>
      </div>
      <TextInput label="Search subject classes" value={search} onChange={onSearchChange} icon={<Search size={18} />} />
      <div className="student-subject-class-actions">
        <button
          className="secondary-action"
          type="button"
          onClick={() => onSelectedIdsChange(mergeUnique([...selectedIds, ...filteredSubjectClasses.map((subjectClass) => subjectClass.id)]))}
        >
          Select shown
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() => onSelectedIdsChange(selectedIds.filter((id) => !filteredSubjectClasses.some((subjectClass) => subjectClass.id === id)))}
        >
          Clear shown
        </button>
      </div>
      <div className="student-subject-class-list">
        {filteredSubjectClasses.length === 0 ? (
          <div className="empty-editor-state">
            <h3>No subject classes found</h3>
            <p>Try another search term.</p>
          </div>
        ) : filteredSubjectClasses.map((subjectClass) => {
          const subject = subjects.find((item) => item.id === subjectClass.subjectId);
          const classGroup = classes.find((item) => item.id === subjectClass.baseClassId);
          return (
            <label className="student-subject-class-option" key={subjectClass.id}>
              <input
                type="checkbox"
                checked={selectedSet.has(subjectClass.id)}
                onChange={(event) => {
                  onSelectedIdsChange(event.target.checked
                    ? mergeUnique([...selectedIds, subjectClass.id])
                    : selectedIds.filter((id) => id !== subjectClass.id));
                }}
              />
              <span>
                <strong>{subjectClass.name}</strong>
                <small>{subject?.name ?? "No subject"}{classGroup ? ` - ${classGroup.name}${classGroup.grade ? `, Grade ${classGroup.grade}` : ""}` : " - Mixed classes"}</small>
              </span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}

function GradeLevelTable({
  gradeLevels,
  classes,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  gradeLevels: SchoolGradeLevel[];
  classes: ClassGroup[];
  subjectClasses: SubjectClass[];
  onEdit: (gradeLevel: SchoolGradeLevel, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (gradeLevels.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No grades registered</h3>
        <p>Add grades with a year before creating classes and subject classes.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table grade-level-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>Year</th>
            <th>Main classes</th>
            <th>Subject classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {gradeLevels.map((gradeLevel, index) => (
            <tr key={gradeLevel.id}>
              <td><strong>{gradeLevel.grade || "Not set"}</strong></td>
              <td>{gradeLevel.year || "Not set"}</td>
              <td>{classes.filter((classGroup) => classGroup.gradeLevelId === gradeLevel.id).length}</td>
              <td>{subjectClasses.filter((subjectClass) => subjectClass.gradeLevelId === gradeLevel.id).length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(gradeLevel, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassTable({
  classes,
  gradeLevels,
  students,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  classes: ClassGroup[];
  gradeLevels: SchoolGradeLevel[];
  students: Student[];
  subjectClasses: SubjectClass[];
  onEdit: (classGroup: ClassGroup, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No main classes yet</h3>
        <p>Add main classes like 8A and 8B before assigning students.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table class-table">
        <thead>
          <tr>
            <th>Main class</th>
            <th>Grade</th>
            <th>Class teacher</th>
            <th>Students</th>
            <th>Subject classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classGroup, index) => (
            <tr key={classGroup.id}>
              <td>
                <strong>{classGroup.name}</strong>
                <span>{classGroup.id}</span>
              </td>
              <td>{formatGradeLevel(gradeLevels.find((gradeLevel) => gradeLevel.id === classGroup.gradeLevelId)) || classGroup.grade || "Not set"}</td>
              <td>{classGroup.teacher || "Not assigned"}</td>
              <td>{students.filter((student) => student.classId === classGroup.id).length}</td>
              <td>{subjectClasses.filter((subjectClass) => subjectClass.baseClassId === classGroup.id).length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(classGroup, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectClassTable({
  classes,
  gradeLevels,
  subjectClasses,
  subjects,
  onEdit,
  onRemove,
}: {
  classes: ClassGroup[];
  gradeLevels: SchoolGradeLevel[];
  subjectClasses: SubjectClass[];
  subjects: Subject[];
  onEdit: (subjectClass: SubjectClass, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (subjectClasses.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No subject classes yet</h3>
        <p>Add a subject class to create a course group such as Math for 8A or a mixed student group.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table subject-class-table">
        <thead>
          <tr>
            <th>Subject class</th>
            <th>Subject</th>
            <th>Grade/year</th>
            <th>Main class</th>
            <th>Teacher</th>
            <th>Students</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjectClasses.map((subjectClass, index) => (
            <tr key={subjectClass.id}>
              <td>
                <strong>{subjectClass.name}</strong>
                <span>{subjectClass.id}</span>
              </td>
              <td>{subjects.find((subject) => subject.id === subjectClass.subjectId)?.name ?? "No subject"}</td>
              <td>{formatGradeLevel(gradeLevels.find((gradeLevel) => gradeLevel.id === subjectClass.gradeLevelId)) || "Not set"}</td>
              <td>{classes.find((classGroup) => classGroup.id === subjectClass.baseClassId)?.name ?? "Mixed classes"}</td>
              <td>{subjectClass.teacherName || "Not assigned"}</td>
              <td>{subjectClass.studentIds.length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(subjectClass, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffTable({
  staff,
  onSimulate,
  onEdit,
  onRecover,
}: {
  staff: StaffMember[];
  onSimulate?: (member: StaffMember) => void;
  onEdit: (member: StaffMember, index: number) => void;
  onRecover: (index: number) => void;
}) {
  const [showVisibility, setShowVisibility] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const activeStaff = staff.filter((m) => !isStaffDeleted(m));
  const deletedStaff = staff.map((m, i) => ({ member: m, index: i })).filter(({ member }) => isStaffDeleted(member));

  return (
    <div className="staff-table-panel">
      {activeStaff.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No staff members yet</h3>
          <p>Add staff members to publish profiles and assign teachers.</p>
        </div>
      ) : (
        <>
          <div className="staff-table-show-row">
            <span className="staff-table-show-label">Show:</span>
            <button
              type="button"
              className={`staff-table-show-btn${showVisibility ? " active" : ""}`}
              onClick={() => setShowVisibility((v) => !v)}
            >
              Visibility
            </button>
            <button
              type="button"
              className={`staff-table-show-btn${showCategories ? " active" : ""}`}
              onClick={() => setShowCategories((v) => !v)}
            >
              Categories
            </button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table staff-table">
              <thead>
                <tr>
                  <th className="staff-table-photo-col"></th>
                  <th>Name</th>
                  {showCategories ? <th>Category</th> : null}
                  <th>Description</th>
                  <th>Contact</th>
                  {showVisibility ? <th>Visibility</th> : null}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member, index) => isStaffDeleted(member) ? null : (
                  <tr key={`${member.name}-${index}`}>
                    <td className="staff-table-photo-col">
                      <div className="staff-avatar staff-table-avatar">
                        {member.photoUrl ? <img src={member.photoUrl} alt={member.name} /> : <UserRound size={20} />}
                      </div>
                    </td>
                    <td>
                      <strong>{member.name}</strong>
                    </td>
                    {showCategories ? (
                      <td>
                        <span>{getStaffCategories(member).join(", ") || "—"}</span>
                        {staffCanAccessAdminPage(member) ? <span>Admin page access</span> : null}
                        {isStaffAccountDisabled(member) ? <span>Account disabled</span> : null}
                      </td>
                    ) : null}
                    <td>{member.role || "—"}</td>
                    <td>
                      {member.phone ? <span>{member.phone}</span> : null}
                      {member.email ? <span>{member.email}</span> : null}
                      {!member.phone && !member.email ? "—" : null}
                    </td>
                    {showVisibility ? (
                      <td>
                        <span>{member.visibleOnHomePage === false ? "Hidden from home" : "Home page"}</span>
                        <span>{member.visibleOnStaffPage === false ? "Hidden from staff page" : "Staff page"}</span>
                      </td>
                    ) : null}
                    <td>
                      <div className="table-actions">
                        {onSimulate ? (
                          <button className="secondary-action" type="button" onClick={() => onSimulate(member)} disabled={!member.email || isStaffAccountDisabled(member)}>
                            Simulate
                          </button>
                        ) : null}
                        <button className="secondary-action" type="button" onClick={() => onEdit(member, index)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {deletedStaff.length > 0 ? (
        <div className="staff-deleted-section">
          <p className="staff-deleted-heading">Recently removed</p>
          {deletedStaff.map(({ member, index }) => {
            const days = daysUntilPermanentRemoval(member);
            return (
              <div key={`deleted-${index}`} className="staff-deleted-row">
                <div className="staff-avatar staff-table-avatar">
                  {member.photoUrl ? <img src={member.photoUrl} alt={member.name} /> : <UserRound size={18} />}
                </div>
                <div className="staff-deleted-info">
                  <span className="staff-deleted-name">{member.name}</span>
                  <span className="staff-deleted-meta">{member.role || "No description"} · Permanently removed in {days} {days === 1 ? "day" : "days"}</span>
                </div>
                <button className="secondary-action staff-recover-btn" type="button" onClick={() => onRecover(index)}>
                  Recover
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const ACCESS_ADMIN_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "website", label: "Website" },
  { id: "people", label: "People & Academics" },
  { id: "schoolWork", label: "EduLink LMS" },
  { id: "administrative", label: "Administrative" },
];

function AccessOverview({
  school,
  classes,
  staff,
  students,
  subjectClasses,
  subjects,
  isPlatformAdmin,
  onUpdateStaff,
}: {
  school: School;
  classes: ClassGroup[];
  staff: StaffMember[];
  students: Student[];
  subjectClasses: SubjectClass[];
  subjects: Subject[];
  isPlatformAdmin?: boolean;
  onUpdateStaff?: (updatedStaff: StaffMember[]) => void;
}) {
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "teacher" | "staff" | "student">("all");
  const [adminPagesTarget, setAdminPagesTarget] = useState<StaffMember | null>(null);

  const adminEmails = getSchoolAdminEmails(school);
  const allowStudentMessaging = Boolean(school.schoolWorkSettings?.allowStudentMessaging);

  const updateMember = (target: StaffMember, patch: Partial<StaffMember>) => {
    if (!onUpdateStaff) return;
    const key = target.email?.toLowerCase() || target.name;
    onUpdateStaff(staff.map((m) => ((m.email?.toLowerCase() || m.name) === key ? { ...m, ...patch } : m)));
  };

  type AccessRow = {
    id: string;
    member?: StaffMember;
    name: string;
    filterRole: "admin" | "teacher" | "staff" | "student";
    roleLabel: string;
    signIn: string;
    isAdmin: boolean;
    isTeacher: boolean;
    isStudent: boolean;
    accountDisabled: boolean;
    lmsLabel: string;
    lmsEditable: boolean;
  };

  const staffRows: AccessRow[] = staff.filter((m) => !isStaffDeleted(m)).map((member) => {
    const categories = getStaffCategories(member);
    const isTeacher = categories.includes("Teacher");
    const isAdmin = Boolean(member.email && adminEmails.map((e) => e.toLowerCase()).includes(member.email!.toLowerCase()));
    const accountDisabled = isStaffAccountDisabled(member);
    const taughtSubjectClasses = subjectClasses.filter((sc) => sc.teacherName === member.name);
    let lmsLabel: string;
    if (isTeacher) {
      lmsLabel = member.lmsAccess === "none" ? "No access" : `Teacher — ${taughtSubjectClasses.length} class${taughtSubjectClasses.length === 1 ? "" : "es"}`;
    } else {
      const access = member.lmsAccess ?? "view";
      lmsLabel = access === "none" ? "No access" : "View all";
    }
    const filterRole: "admin" | "teacher" | "staff" = isAdmin ? "admin" : isTeacher ? "teacher" : "staff";
    return {
      id: `staff-${member.email || member.name}`,
      member,
      name: member.name,
      filterRole,
      roleLabel: isAdmin ? "School admin" : categories.join(", "),
      signIn: accountDisabled ? `${member.email || "—"} (disabled)` : member.email || "—",
      isAdmin,
      isTeacher,
      isStudent: false,
      accountDisabled,
      lmsLabel,
      lmsEditable: true,
    };
  });

  const studentRows: AccessRow[] = students.map((student) => ({
    id: `student-${student.id}`,
    name: `${student.firstName} ${student.lastName}`,
    filterRole: "student",
    roleLabel: "Student",
    signIn: student.accountDisabled ? `${student.email || "—"} (disabled)` : student.email || "—",
    isAdmin: false,
    isTeacher: false,
    isStudent: true,
    accountDisabled: Boolean(student.accountDisabled),
    lmsLabel: "Student LMS",
    lmsEditable: false,
  }));

  const staffAdminEmails = new Set(staff.map((m) => m.email?.toLowerCase()).filter(Boolean));
  const standaloneRows: AccessRow[] = adminEmails
    .filter((email) => !staffAdminEmails.has(email.toLowerCase()))
    .map((email) => ({
      id: `admin-${email}`,
      name: email,
      filterRole: "admin",
      roleLabel: "School admin",
      signIn: email,
      isAdmin: true,
      isTeacher: false,
      isStudent: false,
      accountDisabled: false,
      lmsLabel: "View all",
      lmsEditable: false,
    }));

  const allRows = [...standaloneRows, ...staffRows, ...studentRows];
  const filteredRows = roleFilter === "all" ? allRows : allRows.filter((r) => r.filterRole === roleFilter);

  const adminPagesTargetMember = adminPagesTarget;

  return (
    <div className="access-overview">
      <section className="access-summary-grid">
        <article className="access-summary-card">
          <AdminCardTitle icon={faGlobe} title="Public website" />
          <span>Everyone can view published school pages, about pages, news, calendar, staff, and student/guardian information pages.</span>
        </article>
        <article className="access-summary-card">
          <AdminCardTitle icon={faGaugeHigh} title="Admin dashboard" />
          <span>Staff with admin page access can use the admin dashboard. Platform admin can restrict which sections each user can access.</span>
        </article>
        <article className="access-summary-card">
          <AdminCardTitle icon={faBookOpen} title="EduLink LMS" />
          <span>Teachers see assigned subject classes. Non-teacher admins can have view access to all or no LMS access. Students see their classes.</span>
        </article>
        <article className="access-summary-card">
          <AdminCardTitle icon={faMessage} title="School chat" />
          <span>Students can contact teachers and admins{allowStudentMessaging ? ", and student-to-student messaging is enabled." : ". Student-to-student messaging is disabled."}</span>
        </article>
      </section>
      <div className="access-table-controls">
        {(["all", "admin", "teacher", "staff", "student"] as const).map((role) => (
          <button
            key={role}
            type="button"
            className={`access-role-filter-btn${roleFilter === role ? " active" : ""}`}
            onClick={() => setRoleFilter(role)}
          >
            {role === "all" ? "All" : role.charAt(0).toUpperCase() + role.slice(1)}
          </button>
        ))}
      </div>
      <div className="data-table-wrap">
        <table className="data-table access-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Sign-in</th>
              <th>LMS access</th>
              {isPlatformAdmin ? <th>Admin pages</th> : null}
              <th>Chat</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const chatEnabled = row.member ? (row.member.chatEnabled ?? true) : true;
              const allowedCats = row.member?.allowedAdminCategories;
              const adminPagesLabel = !allowedCats?.length
                ? "All pages"
                : `${allowedCats.length} page${allowedCats.length === 1 ? "" : "s"}`;
              return (
                <tr key={row.id} className={row.accountDisabled ? "access-row-disabled" : ""}>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.roleLabel}</td>
                  <td className="access-signin-cell">{row.signIn}</td>
                  <td>
                    {isPlatformAdmin && row.lmsEditable && row.member ? (
                      <select
                        className="access-inline-select"
                        value={row.member.lmsAccess ?? (row.isTeacher ? "teacher" : "view")}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateMember(row.member!, { lmsAccess: val === "teacher" ? undefined : (val as "view" | "none") });
                        }}
                      >
                        {row.isTeacher ? <option value="teacher">Teacher access</option> : <option value="view">View all</option>}
                        <option value="none">No access</option>
                      </select>
                    ) : (
                      <span className="access-lms-label">{row.lmsLabel}</span>
                    )}
                  </td>
                  {isPlatformAdmin ? (
                    <td>
                      {row.isAdmin && row.member && row.member.email ? (
                        <button
                          type="button"
                          className="access-admin-pages-btn"
                          onClick={() => setAdminPagesTarget(row.member!)}
                        >
                          {adminPagesLabel}
                        </button>
                      ) : row.isAdmin && row.member && !row.member.email ? (
                        <span className="access-needs-login">Needs login email</span>
                      ) : (
                        <span className="access-na">—</span>
                      )}
                    </td>
                  ) : null}
                  <td>
                    {isPlatformAdmin && row.member ? (
                      <CheckboxInput
                        label=""
                        checked={chatEnabled}
                        onChange={(checked) => updateMember(row.member!, { chatEnabled: checked })}
                      />
                    ) : (
                      <span className="access-lms-label">{chatEnabled ? "Enabled" : "Disabled"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adminPagesTargetMember ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setAdminPagesTarget(null)}>
          <section className="staff-modal" role="dialog" aria-modal="true" aria-label="Admin pages access" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header">
              <h2>Admin pages — {adminPagesTargetMember.name}</h2>
              <button type="button" onClick={() => setAdminPagesTarget(null)}>×</button>
            </div>
            <div className="staff-modal-body">
              <p className="editor-helper-text">Choose which admin sections this user can access. Leave all checked for full access.</p>
              <div className="admin-pages-checklist">
                {ACCESS_ADMIN_CATEGORIES.map((cat) => {
                  const allowed = adminPagesTargetMember.allowedAdminCategories;
                  const isChecked = !allowed?.length || allowed.includes(cat.id);
                  return (
                    <label key={cat.id} className="admin-pages-check-row">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = adminPagesTargetMember.allowedAdminCategories ?? ACCESS_ADMIN_CATEGORIES.map((c) => c.id);
                          const next = e.target.checked
                            ? mergeUnique([...current, cat.id])
                            : current.filter((id) => id !== cat.id);
                          const patch = next.length === ACCESS_ADMIN_CATEGORIES.length ? { allowedAdminCategories: undefined } : { allowedAdminCategories: next };
                          updateMember(adminPagesTargetMember, patch);
                          setAdminPagesTarget({ ...adminPagesTargetMember, ...patch });
                        }}
                      />
                      <span>{cat.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function NewsTable({
  news,
  onEdit,
  onRemove,
}: {
  news: NewsItem[];
  onEdit: (item: NewsItem, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (news.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No news yet</h3>
        <p>Add news items to publish updates on the school website.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table news-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Slug</th>
            <th>Image</th>
            <th>Excerpt</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {news.map((item, index) => (
            <tr key={item.id || `${item.title}-${index}`}>
              <td><strong>{item.title}</strong></td>
              <td>{formatDate(item.date)}</td>
              <td>{item.slug || getNewsSlug(item)}</td>
              <td>{item.headerImage ? "Image set" : "No image"}</td>
              <td>{getTextExcerpt(item.body, 120) || "No body"}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(item, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarTable({
  items,
  onEdit,
  onRemove,
}: {
  items: CalendarItem[];
  onEdit: (item: CalendarItem, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No calendar events yet</h3>
        <p>Add events to show important dates on the school website.</p>
      </div>
    );
  }

  const sorted = items.map((item, index) => ({ item, index })).sort((a, b) => b.item.date.localeCompare(a.item.date));

  return (
    <div className="data-table-wrap calendar-table-wrap">
      <table className="data-table calendar-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ item, index }) => (
            <tr key={`${item.title}-${item.date}-${index}`}>
              <td><strong>{item.title}</strong></td>
              <td>{formatDate(item.date)}</td>
              <td>
                <div className="table-actions calendar-table-actions">
                  <button className="calendar-edit-action" type="button" onClick={() => onEdit(item, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarAdminPreview({ items }: { items: CalendarItem[] }) {
  return (
    <aside className="calendar-admin-preview" aria-label="Calendar website preview">
      <div className="mini-preview-label">Website preview</div>
      <InfoPanel title="Calendar">
        {items.length === 0 ? (
          <div className="empty-editor-state calendar-preview-empty">
            <h3>No events yet</h3>
            <p>Add events to preview the public calendar list.</p>
          </div>
        ) : (
          <div className="calendar-list">
            {items.map((item) => (
              <div className="calendar-row" key={`${item.title}-${item.date}`}>
                <CalendarDays size={18} />
                <div>
                  <time>{formatDate(item.date)}</time>
                  <p>{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </InfoPanel>
    </aside>
  );
}

function SubjectTable({
  subjects,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  subjects: Subject[];
  subjectClasses: SubjectClass[];
  onEdit: (item: Subject, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (subjects.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No subjects yet</h3>
        <p>Add subjects before creating subject classes.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table subject-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Abbreviation</th>
            <th>Color</th>
            <th>Subject classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject, index) => (
            <tr key={subject.id}>
              <td>
                <strong>{subject.name}</strong>
                <span>{subject.id}</span>
              </td>
              <td>{subject.abbreviation}</td>
              <td>
                <span className="table-color-swatch" style={{ background: subject.color }} />
                {subject.color}
              </td>
              <td>{subjectClasses.filter((subjectClass) => subjectClass.subjectId === subject.id).length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(subject, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="field-label subject-color-field">
      <span>Subject color</span>
      <div className="subject-color-options">
        {subjectColorOptions.map((color) => (
          <button
            className={value === color ? "active-subject-color" : ""}
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ "--subject-color": color } as React.CSSProperties}
            aria-label={`Select ${color}`}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="subject-color-selected">
        <span style={{ background: value }} />
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function slugifyGradeLevel(grade: string, year: string) {
  const slug = slugifySchoolName(`${grade}-${year}`);
  return slug ? `grade-${slug}` : `grade-${Date.now()}`;
}

function getNewsSlug(item: NewsItem) {
  return item.slug || slugifySchoolName(item.title);
}

function StaffImageUpload({ photoUrl, onChange }: { photoUrl: string; onChange: (photoUrl: string) => void }) {
  return <ImageUpload label="Staff image" value={photoUrl} onChange={onChange} variant="square" />;
}

