import type { AdminProfile, AssessmentScale, GlobalSchoolWorkConfig, RemarkCategory, School, SchoolRemarkSettings, SchoolWorkSettings, StaffMember, Student, SubjectClass } from "../types";
import { hasFirebaseConfig } from "./firebase";
import { sampleSchool } from "../data/sampleSchool";

export type StaffCategory = NonNullable<StaffMember["categories"]>[number];
export type SchoolWorkAccessLevel = "admin" | "teacher" | "viewer" | "student";
export type SchoolWorkIdentity =
  | { role: "admin"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "teacher"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "viewer"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "student"; label: string; subjectClasses: SubjectClass[]; studentId: string };

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getStaffCategories(member: StaffMember): StaffCategory[] {
  const categories = member.categories?.length ? member.categories : [member.category ?? "Other"];
  return mergeUnique(categories) as StaffCategory[];
}

export function hasStaffCategory(member: StaffMember, category: StaffCategory) {
  return getStaffCategories(member).includes(category);
}

export function staffCanAccessAdminPage(member: StaffMember) {
  return member.canAccessAdminPage ?? hasStaffCategory(member, "Administration");
}

export function isStaffAccountDisabled(member: StaffMember) {
  return Boolean(member.accountDisabled) && !staffCanAccessAdminPage(member);
}

export function isStaffDeleted(member: StaffMember) {
  return Boolean(member.deletedAt);
}

export function isStaffPermanentlyRemoved(member: StaffMember) {
  if (!member.deletedAt) return false;
  const deletedMs = new Date(member.deletedAt).getTime();
  return Date.now() - deletedMs > 7 * 24 * 60 * 60 * 1000;
}

export function daysUntilPermanentRemoval(member: StaffMember) {
  if (!member.deletedAt) return null;
  const deletedMs = new Date(member.deletedAt).getTime();
  const remainingMs = 7 * 24 * 60 * 60 * 1000 - (Date.now() - deletedMs);
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function getStaffEmail(member?: StaffMember) {
  return member?.email?.trim().toLowerCase() ?? "";
}

export function getStaffAdminEmails(staff: StaffMember[]) {
  return mergeUnique(staff.filter((m) => !isStaffDeleted(m) && staffCanAccessAdminPage(m)).map(getStaffEmail).filter(Boolean));
}

export function getSchoolAdminEmails(school: School) {
  return getStaffAdminEmails(school.staff ?? []);
}

export function canManageSchool(profile: AdminProfile | null, schoolId: string, userEmail?: string | null, school?: School) {
  if (profile?.superAdmin || profile?.schoolIds.includes(schoolId)) {
    return true;
  }

  const normalizedEmail = userEmail?.toLowerCase();
  return Boolean(normalizedEmail && school && getSchoolAdminEmails(school).includes(normalizedEmail));
}

export function canTeachAnySubjectClass(school: School, userEmail?: string | null) {
  return (school.subjectClasses ?? []).some((subjectClass) => canTeachSubjectClass(school, subjectClass, userEmail));
}

export function canTeachSubjectClass(school: School, subjectClass: SubjectClass, userEmail?: string | null) {
  const normalizedEmail = userEmail?.toLowerCase();
  if (!normalizedEmail || !subjectClass.teacherName) {
    return false;
  }
  return school.staff.some((member) => (
    member.email?.toLowerCase() === normalizedEmail
    && member.name === subjectClass.teacherName
    && hasStaffCategory(member, "Teacher")
    && !isStaffAccountDisabled(member)
  ));
}

export function getSchoolWorkIdentity(school: School, userEmail: string | null, profile: AdminProfile | null): SchoolWorkIdentity | null {
  const params = new URLSearchParams(window.location.search);
  const simulateRole = params.get("simulateRole");
  const simulateId = params.get("simulateId");
  const subjectClasses = school.subjectClasses ?? [];
  const isDemoSchool = school.id === sampleSchool.id;
  const canSimulate = !hasFirebaseConfig || isDemoSchool || canManageSchool(profile, school.id, userEmail, school);

  if (canSimulate && simulateRole === "admin") {
    return {
      role: "admin",
      label: "School admin",
      subjectClasses,
    };
  }

  if (canSimulate && simulateRole === "staff" && simulateId) {
    const staffMember = school.staff.find((member) => member.email?.toLowerCase() === simulateId.toLowerCase());
    if (staffMember && !isStaffAccountDisabled(staffMember)) {
      const isTeacher = hasStaffCategory(staffMember, "Teacher");
      return {
        role: isTeacher ? "teacher" : "viewer",
        label: staffMember.name,
        subjectClasses: isTeacher
          ? subjectClasses.filter((subjectClass) => subjectClass.teacherName === staffMember.name)
          : subjectClasses,
      };
    }
  }

  if (canSimulate && simulateRole === "student" && simulateId) {
    const student = school.students.find((item) => item.id === simulateId);
    if (student && !student.accountDisabled) {
      return {
        role: "student",
        label: `${student.firstName} ${student.lastName}`,
        studentId: student.id,
        subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.studentIds.includes(student.id)),
      };
    }
  }

  if (isDemoSchool && !simulateRole) {
    return {
      role: "admin",
      label: "School admin",
      subjectClasses,
    };
  }

  if (profile?.superAdmin) {
    return {
      role: "admin",
      label: "Superadmin",
      subjectClasses,
    };
  }

  const normalizedEmail = userEmail?.toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const staffMember = school.staff.find((member) => member.email?.toLowerCase() === normalizedEmail);
  if (staffMember && !isStaffAccountDisabled(staffMember)) {
    const isTeacher = hasStaffCategory(staffMember, "Teacher");
    const isAdmin = getSchoolAdminEmails(school).includes(normalizedEmail);
    if (isTeacher) {
      if (staffMember.lmsAccess === "none") return null;
      return {
        role: "teacher",
        label: staffMember.name,
        subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.teacherName === staffMember.name),
      };
    }
    if (isAdmin) {
      const lmsAccess = staffMember.lmsAccess ?? "view";
      if (lmsAccess === "none") return null;
      return {
        role: "viewer",
        label: staffMember.name,
        subjectClasses,
      };
    }
    return {
      role: "viewer",
      label: staffMember.name,
      subjectClasses,
    };
  }

  if (getSchoolAdminEmails(school).includes(normalizedEmail)) {
    return {
      role: "admin",
      label: "School admin",
      subjectClasses,
    };
  }

  const student = school.students.find((item) => item.email?.toLowerCase() === normalizedEmail);
  if (student && !student.accountDisabled) {
    return {
      role: "student",
      label: `${student.firstName} ${student.lastName}`,
      studentId: student.id,
      subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.studentIds.includes(student.id)),
    };
  }

  return null;
}

export function isVisibleOnHomePage(member: StaffMember) {
  return !isStaffDeleted(member) && member.visibleOnHomePage !== false;
}

export function isVisibleOnStaffPage(member: StaffMember) {
  return !isStaffDeleted(member) && member.visibleOnStaffPage !== false;
}

export function getEffectiveAssessmentScales(school: School, globalSchoolWork: GlobalSchoolWorkConfig) {
  const settings = school.schoolWorkSettings ?? {
    enabledGlobalAssessmentScaleIds: globalSchoolWork.assessmentScales.map((scale) => scale.id),
    knownGlobalAssessmentScaleIds: globalSchoolWork.assessmentScales.map((scale) => scale.id),
    allowStudentMessaging: false,
    customAssessmentScales: [],
  };
  return [
    ...globalSchoolWork.assessmentScales.filter((scale) => settings.enabledGlobalAssessmentScaleIds.includes(scale.id)),
    ...settings.customAssessmentScales,
  ];
}

export function getEffectiveRemarkCategories(globalCategories: RemarkCategory[], remarkSettings?: SchoolRemarkSettings): RemarkCategory[] {
  const disabled = new Set(remarkSettings?.disabledGlobalCategoryIds ?? []);
  return [
    ...globalCategories.filter((c) => !disabled.has(c.id)),
    ...(remarkSettings?.customCategories ?? []),
  ];
}

export const REMARK_PARENTS: RemarkCategory[] = [
  { id: "conduct", name: "Conduct" },
  { id: "behavior", name: "Behavior" },
];
