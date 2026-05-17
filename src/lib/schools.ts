import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "./firebase";
import { sampleSchool } from "../data/sampleSchool";
import type { AdminProfile, AssessmentScale, GlobalAboutConfig, GlobalSchoolWorkConfig, School, SubjectClass } from "../types";

const COLLECTION = "schools";
const GLOBAL_ABOUT_KEY = "edulink-global-about";
const GLOBAL_CONFIG_COLLECTION = "platformConfig";
const GLOBAL_ABOUT_DOC = "globalAbout";
const GLOBAL_SCHOOL_WORK_KEY = "edulink-global-schoolwork";
const GLOBAL_SCHOOL_WORK_DOC = "globalSchoolWork";
const REQUIRED_ASSESSMENT_SCALE_LEVELS = [
  { id: "excused", value: "Excused", minPercentage: 0, description: "" },
  { id: "assessed", value: "Assessed", minPercentage: 0, description: "" },
] as const;

function createPercentageAssessmentScale(): AssessmentScale {
  return {
    id: "percentage-0-100",
    name: "Percentage 0-100",
    levels: [
      ...Array.from({ length: 101 }, (_, index) => {
        const value = 100 - index;
        return {
          id: `percentage-${value}`,
          value: String(value),
          minPercentage: value,
          description: `${value}%`,
        };
      }),
      ...REQUIRED_ASSESSMENT_SCALE_LEVELS,
    ],
  };
}

export const defaultGlobalAboutConfig: GlobalAboutConfig = {
  categories: [{ id: "global-about", title: "About" }],
  pages: [
    {
      id: "global-leadership-and-administration",
      categoryId: "global-about",
      title: "Leadership and administration",
      slug: "leadership-and-administration",
      headerImage: "",
      body: "",
      kind: "staffDirectory",
    },
  ],
};

export const defaultGlobalSchoolWorkConfig: GlobalSchoolWorkConfig = {
  assessmentScales: [
    {
      id: "proficiency",
      name: "Proficiency scale",
      levels: [
        { id: "exceeding", value: "4", minPercentage: 90, description: "Consistently exceeds the expected standard." },
        { id: "meeting", value: "3", minPercentage: 70, description: "Meets the expected standard." },
        { id: "approaching", value: "2", minPercentage: 50, description: "Approaching the expected standard." },
        { id: "beginning", value: "1", minPercentage: 0, description: "Needs support to reach the expected standard." },
        ...REQUIRED_ASSESSMENT_SCALE_LEVELS,
      ],
    },
    createPercentageAssessmentScale(),
  ],
};

export async function getSchool(id: string): Promise<School> {
  if (!hasFirebaseConfig || !db) {
    return id === sampleSchool.id ? sampleSchool : { ...sampleSchool, id };
  }

  const snapshot = await getDoc(doc(db, COLLECTION, id));

  if (!snapshot.exists()) {
    return id === sampleSchool.id ? sampleSchool : { ...sampleSchool, id };
  }

  return normalizeSchool({ id: snapshot.id, ...snapshot.data() } as School);
}

export async function deleteSchool(id: string) {
  window.localStorage.removeItem(`edulink-school-${id}`);

  if (!hasFirebaseConfig || !db) {
    return;
  }

  await deleteDoc(doc(db, COLLECTION, id));
}

export async function listSchools(): Promise<School[]> {
  if (!hasFirebaseConfig || !db) {
    const localSchools = Object.keys(window.localStorage)
      .filter((key) => key.startsWith("edulink-school-"))
      .map((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}") as School);
    return localSchools.length ? localSchools : [sampleSchool];
  }

  const snapshots = await getDocs(collection(db, COLLECTION));
  const schools = snapshots.docs.map((snapshot) => normalizeSchool({ id: snapshot.id, ...snapshot.data() } as School));
  return schools.length ? schools : [sampleSchool];
}

export async function getAdminProfile(uid: string, email?: string | null): Promise<AdminProfile | null> {
  if (!hasFirebaseConfig || !db) {
    return {
      uid,
      email: "local-admin@edulink.africa",
      schoolIds: [sampleSchool.id],
      superAdmin: true,
    };
  }

  const snapshot = await getDoc(doc(db, "schoolAdmins", uid));

  if (!snapshot.exists() && email) {
    const emailSnapshot = await getDoc(doc(db, "schoolAdmins", getAdminEmailProfileId(email)));
    if (emailSnapshot.exists()) {
      const data = emailSnapshot.data();
      return {
        uid,
        email: typeof data.email === "string" ? data.email : email,
        schoolIds: Array.isArray(data.schoolIds) ? data.schoolIds.filter((id): id is string => typeof id === "string") : [],
        superAdmin: data.superAdmin === true,
      };
    }
  }

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    uid,
    email: typeof data.email === "string" ? data.email : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    schoolIds: Array.isArray(data.schoolIds) ? data.schoolIds.filter((id): id is string => typeof id === "string") : [],
    superAdmin: data.superAdmin === true,
  };
}

export async function getSuperAdmins(): Promise<AdminProfile[]> {
  if (!hasFirebaseConfig || !db) {
    return [{ uid: "local", email: "local-admin@edulink.africa", name: "Local Admin", schoolIds: [], superAdmin: true }];
  }
  const snapshots = await getDocs(collection(db, "schoolAdmins"));
  const all = snapshots.docs
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        uid: snapshot.id,
        email: typeof data.email === "string" ? data.email : undefined,
        name: typeof data.name === "string" ? data.name : undefined,
        schoolIds: Array.isArray(data.schoolIds) ? data.schoolIds.filter((id): id is string => typeof id === "string") : [],
        superAdmin: data.superAdmin === true,
      };
    })
    .filter((profile) => profile.superAdmin);

  // Deduplicate: prefer uid-keyed docs over email-keyed docs (email-keyed ids start with "email-")
  const seenEmails = new Set<string>();
  const deduped: AdminProfile[] = [];
  // First pass: uid-keyed docs
  for (const profile of all) {
    if (!profile.uid.startsWith("email-")) {
      if (profile.email) seenEmails.add(profile.email.toLowerCase());
      deduped.push(profile);
    }
  }
  // Second pass: email-keyed docs not already covered by a uid doc
  for (const profile of all) {
    if (profile.uid.startsWith("email-")) {
      const email = profile.email?.toLowerCase() ?? "";
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        deduped.push(profile);
      }
    }
  }
  return deduped;
}

export async function deleteSuperAdminProfile(uid: string, email?: string): Promise<void> {
  if (!hasFirebaseConfig || !db) return;
  await deleteDoc(doc(db, "schoolAdmins", uid));
  // Also remove the email-keyed shadow doc if it exists
  if (email) {
    await deleteDoc(doc(db, "schoolAdmins", getAdminEmailProfileId(email)));
  }
}

export async function saveSuperAdminProfile(email: string, name?: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (!hasFirebaseConfig || !db) {
    return;
  }

  const docData: Record<string, unknown> = {
    uid: getAdminEmailProfileId(normalizedEmail),
    email: normalizedEmail,
    schoolIds: [],
    superAdmin: true,
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  };
  if (name?.trim()) {
    docData.name = name.trim();
  }

  await setDoc(
    doc(db, "schoolAdmins", getAdminEmailProfileId(normalizedEmail)),
    docData,
    { merge: true },
  );
}

export async function updateSuperAdminProfile(oldEmail: string, newEmail: string, name?: string): Promise<void> {
  const normalizedOld = oldEmail.trim().toLowerCase();
  const normalizedNew = newEmail.trim().toLowerCase();
  if (!normalizedNew.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (!hasFirebaseConfig || !db) {
    return;
  }
  if (normalizedOld !== normalizedNew) {
    await deleteDoc(doc(db, "schoolAdmins", getAdminEmailProfileId(normalizedOld)));
  }
  const docData: Record<string, unknown> = {
    uid: getAdminEmailProfileId(normalizedNew),
    email: normalizedNew,
    schoolIds: [],
    superAdmin: true,
    updatedAt: new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  };
  if (name?.trim()) {
    docData.name = name.trim();
  }
  await setDoc(doc(db, "schoolAdmins", getAdminEmailProfileId(normalizedNew)), docData, { merge: true });
}

export async function saveSchool(school: School): Promise<void> {
  if (!hasFirebaseConfig || !db) {
    window.localStorage.setItem(`edulink-school-${school.id}`, JSON.stringify({ ...school, adminEmails: getStaffAdminEmails(school.staff ?? []) }));
    return;
  }

  const schoolData = removeUndefinedValues({
    ...school,
    adminEmails: getStaffAdminEmails(school.staff ?? []),
    schoolWorkStaffEmails: (school.staff ?? []).map((member) => member.email?.toLowerCase()).filter(Boolean),
    schoolWorkStudentEmails: (school.students ?? []).map((student) => student.email?.toLowerCase()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  });

  await setDoc(
    doc(db, COLLECTION, school.id),
    {
      ...schoolData,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getGlobalAboutConfig(): Promise<GlobalAboutConfig> {
  if (!hasFirebaseConfig || !db) {
    const raw = window.localStorage.getItem(GLOBAL_ABOUT_KEY);
    return raw ? normalizeGlobalAboutConfig(JSON.parse(raw) as GlobalAboutConfig) : defaultGlobalAboutConfig;
  }

  const snapshot = await getDoc(doc(db, GLOBAL_CONFIG_COLLECTION, GLOBAL_ABOUT_DOC));
  if (!snapshot.exists()) {
    return defaultGlobalAboutConfig;
  }

  return normalizeGlobalAboutConfig(snapshot.data() as GlobalAboutConfig);
}

export async function saveGlobalAboutConfig(config: GlobalAboutConfig): Promise<void> {
  const normalizedConfig = normalizeGlobalAboutConfig(config);
  if (!hasFirebaseConfig || !db) {
    window.localStorage.setItem(GLOBAL_ABOUT_KEY, JSON.stringify({ ...normalizedConfig, updatedAt: new Date().toISOString() }));
    return;
  }

  const configData = removeUndefinedValues({
    ...normalizedConfig,
    updatedAt: new Date().toISOString(),
  });

  await setDoc(
    doc(db, GLOBAL_CONFIG_COLLECTION, GLOBAL_ABOUT_DOC),
    {
      ...configData,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getGlobalSchoolWorkConfig(): Promise<GlobalSchoolWorkConfig> {
  if (!hasFirebaseConfig || !db) {
    const raw = window.localStorage.getItem(GLOBAL_SCHOOL_WORK_KEY);
    return raw ? normalizeGlobalSchoolWorkConfig(JSON.parse(raw) as GlobalSchoolWorkConfig) : defaultGlobalSchoolWorkConfig;
  }

  const snapshot = await getDoc(doc(db, GLOBAL_CONFIG_COLLECTION, GLOBAL_SCHOOL_WORK_DOC));
  if (!snapshot.exists()) {
    return defaultGlobalSchoolWorkConfig;
  }

  return normalizeGlobalSchoolWorkConfig(snapshot.data() as GlobalSchoolWorkConfig);
}

export async function saveGlobalSchoolWorkConfig(config: GlobalSchoolWorkConfig): Promise<void> {
  const normalizedConfig = normalizeGlobalSchoolWorkConfig(config);
  if (!hasFirebaseConfig || !db) {
    window.localStorage.setItem(GLOBAL_SCHOOL_WORK_KEY, JSON.stringify({ ...normalizedConfig, updatedAt: new Date().toISOString() }));
    return;
  }

  const configData = removeUndefinedValues({
    ...normalizedConfig,
    updatedAt: new Date().toISOString(),
  });

  await setDoc(
    doc(db, GLOBAL_CONFIG_COLLECTION, GLOBAL_SCHOOL_WORK_DOC),
    {
      ...configData,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function getLocalSchool(id: string): School | undefined {
  const raw = window.localStorage.getItem(`edulink-school-${id}`);
  return raw ? normalizeSchool(JSON.parse(raw) as School) : undefined;
}

export function slugifySchoolName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeSchool(school: School): School {
  const defaultGlobalScaleIds = defaultGlobalSchoolWorkConfig.assessmentScales.map((scale) => scale.id);
  const knownGlobalScaleIds = school.schoolWorkSettings?.knownGlobalAssessmentScaleIds ?? defaultGlobalScaleIds;
  const newlyAddedGlobalScaleIds = defaultGlobalScaleIds.filter((id) => !knownGlobalScaleIds.includes(id));
  const enabledGlobalAssessmentScaleIds = mergeUnique([
    ...(school.schoolWorkSettings?.enabledGlobalAssessmentScaleIds ?? defaultGlobalScaleIds),
    ...newlyAddedGlobalScaleIds,
  ]).filter((id) => defaultGlobalScaleIds.includes(id));

  return {
    ...sampleSchool,
    ...school,
    showWebsite: school.showWebsite ?? true,
    adminEmails: getStaffAdminEmails(school.staff ?? []),
    loginSettings: {
      emailPasswordEnabled: school.loginSettings?.emailPasswordEnabled ?? true,
      emailLinkEnabled: school.loginSettings?.emailLinkEnabled ?? false,
    },
    values: school.values ?? [],
    announcements: school.announcements ?? [],
    calendar: school.calendar ?? [],
    staff: (school.staff ?? []).map((member) => ({
      ...member,
      categories: member.categories?.length ? member.categories : [member.category ?? "Other"],
      canAccessAdminPage: member.canAccessAdminPage ?? (member.categories?.includes("Administration") || member.category === "Administration"),
      accountDisabled: (member.canAccessAdminPage ?? (member.categories?.includes("Administration") || member.category === "Administration")) ? false : member.accountDisabled ?? false,
      visibleOnHomePage: member.visibleOnHomePage ?? true,
      visibleOnStaffPage: member.visibleOnStaffPage ?? true,
    })),
    gradeLevels: normalizeGradeLevels(school),
    classes: (school.classes ?? []).map((classGroup) => ({
      ...classGroup,
      gradeLevelId: classGroup.gradeLevelId ?? getGradeLevelIdForGrade(classGroup.grade),
    })),
    students: (school.students ?? []).map((student) => ({
      ...student,
      email: student.email ?? "",
      accountDisabled: student.accountDisabled ?? false,
      photoUrl: student.photoUrl ?? "",
      guardians: student.guardians ?? (student.guardianName || student.guardianEmail ? [{
        id: `guardian-${student.id}`,
        name: student.guardianName ?? "",
        email: student.guardianEmail ?? "",
        phone: "",
        relationship: "",
      }] : []),
    })),
    subjects: (school.subjects ?? []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      abbreviation: subject.abbreviation ?? subject.name.slice(0, 4).toUpperCase(),
      color: subject.color ?? "#1f6857",
    })),
    subjectClasses: (school.subjectClasses ?? (school.subjects ?? []).flatMap((subject) => {
      const legacyClassIds = subject.classIds ?? [];
      return legacyClassIds.map((classId) => ({
        id: `subject-class-${subject.id}-${classId}`,
        name: `${subject.name} ${school.classes?.find((classGroup) => classGroup.id === classId)?.name ?? ""}`.trim(),
        subjectId: subject.id,
        baseClassId: classId,
        teacherName: subject.teacherName ?? "",
        studentIds: subject.studentIds ?? [],
      } as Partial<SubjectClass> & { id: string; name: string; subjectId: string; baseClassId: string; teacherName: string; studentIds: string[] }));
    })).map((subjectClass) => ({
      ...subjectClass,
      nameOverride: subjectClass.nameOverride ?? false,
      gradeLevelId: subjectClass.gradeLevelId ?? (school.classes ?? []).find((classGroup) => classGroup.id === subjectClass.baseClassId)?.gradeLevelId ?? getGradeLevelIdForGrade((school.classes ?? []).find((classGroup) => classGroup.id === subjectClass.baseClassId)?.grade),
      courseMaterials: subjectClass.courseMaterials ?? [],
      assignments: subjectClass.assignments ?? [],
      assessments: (subjectClass.assessments ?? []).map((assessment) => ({
        ...assessment,
        requiresTurnIn: assessment.requiresTurnIn ?? true,
        grades: assessment.grades ?? [],
      })),
      resourceFolders: subjectClass.resourceFolders ?? [],
      resources: subjectClass.resources ?? [],
      announcements: subjectClass.announcements ?? [],
      studentActivity: (subjectClass.studentActivity ?? []).filter((activity) => typeof activity.studentId === "string"),
    })),
    aboutCategories: school.aboutCategories ?? [],
    aboutPages: school.aboutPages ?? [],
    schoolWorkSettings: {
      enabledGlobalAssessmentScaleIds,
      knownGlobalAssessmentScaleIds: defaultGlobalScaleIds,
      allowStudentMessaging: school.schoolWorkSettings?.allowStudentMessaging ?? false,
      customAssessmentScales: (school.schoolWorkSettings?.customAssessmentScales ?? []).map((scale, scaleIndex) => ({
        id: scale.id || `school-scale-${scaleIndex + 1}`,
        name: scale.name || "Assessment scale",
        levels: ensureRequiredAssessmentScaleLevels((scale.levels ?? []).map((level, levelIndex) => ({
          id: level.id || `level-${levelIndex + 1}`,
          value: level.value || String(levelIndex + 1),
          minPercentage: typeof level.minPercentage === "number" ? clampPercentage(level.minPercentage) : inferDefaultPercentage(levelIndex),
          description: level.description ?? "",
        }))),
      })),
    },
    chatMessages: school.chatMessages ?? [],
    supportTickets: school.supportTickets ?? [],
  };
}

function normalizeGradeLevels(school: School) {
  const existingLevels = school.gradeLevels ?? [];
  const classGrades = (school.classes ?? [])
    .map((classGroup) => classGroup.grade?.trim())
    .filter((grade): grade is string => Boolean(grade));
  const currentYear = String(new Date().getFullYear());
  const derivedLevels = classGrades.map((grade) => ({
    id: getGradeLevelIdForGrade(grade),
    grade,
    year: currentYear,
  }));
  const levels = [...existingLevels, ...derivedLevels.filter((derived) => !existingLevels.some((level) => level.id === derived.id))];

  return levels.map((level, index) => ({
    id: level.id || `grade-${index + 1}`,
    grade: level.grade || String(index + 1),
    year: level.year || currentYear,
  }));
}

function getGradeLevelIdForGrade(grade?: string) {
  const normalizedGrade = grade?.trim() || "grade";
  return `grade-${normalizedGrade.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${new Date().getFullYear()}`;
}

function mergeUnique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function getStaffAdminEmails(staff: School["staff"]) {
  return mergeUnique(
    staff
      .filter((member) => member.canAccessAdminPage ?? (member.categories?.includes("Administration") || member.category === "Administration"))
      .map((member) => member.email?.trim().toLowerCase() ?? "")
      .filter(Boolean),
  );
}

function getAdminEmailProfileId(email: string) {
  return `email-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function normalizeGlobalAboutConfig(config: GlobalAboutConfig): GlobalAboutConfig {
  const categories = config.categories?.length ? config.categories : defaultGlobalAboutConfig.categories;
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const pages = config.pages?.length ? config.pages : defaultGlobalAboutConfig.pages;

  return {
    ...config,
    categories,
    pages: pages.map((page) => ({
      ...page,
      categoryId: validCategoryIds.has(page.categoryId) ? page.categoryId : categories[0]?.id ?? "",
      kind: page.kind ?? "richText",
    })),
  };
}

function normalizeGlobalSchoolWorkConfig(config: GlobalSchoolWorkConfig): GlobalSchoolWorkConfig {
  const assessmentScales = config.assessmentScales?.length ? config.assessmentScales : defaultGlobalSchoolWorkConfig.assessmentScales;
  const scalesWithDefaults = [
    ...assessmentScales,
    ...defaultGlobalSchoolWorkConfig.assessmentScales.filter((defaultScale) => !assessmentScales.some((scale) => scale.id === defaultScale.id)),
  ];

  return {
    ...config,
    assessmentScales: scalesWithDefaults.map((scale, scaleIndex) => {
      const defaultScale = defaultGlobalSchoolWorkConfig.assessmentScales.find((item) => item.id === scale.id) ?? defaultGlobalSchoolWorkConfig.assessmentScales[0];
      return {
      id: scale.id || `scale-${scaleIndex + 1}`,
      name: scale.name || "Assessment scale",
      levels: ensureRequiredAssessmentScaleLevels((scale.levels?.length ? scale.levels : defaultScale.levels).map((level, levelIndex) => ({
        id: level.id || `level-${levelIndex + 1}`,
        value: level.value || ("label" in level && typeof level.label === "string" ? level.label : String(levelIndex + 1)),
        minPercentage: typeof level.minPercentage === "number" ? clampPercentage(level.minPercentage) : inferDefaultPercentage(levelIndex),
        description: level.description ?? "",
      }))),
    };
    }),
    updatedAt: config.updatedAt,
  };
}

function ensureRequiredAssessmentScaleLevels(levels: Array<{ id: string; value: string; minPercentage: number; description?: string }>) {
  const requiredIds = new Set<string>(REQUIRED_ASSESSMENT_SCALE_LEVELS.map((level) => level.id));
  const customLevels = levels.filter((level) => !requiredIds.has(level.id));
  const requiredLevels = REQUIRED_ASSESSMENT_SCALE_LEVELS.map((requiredLevel) => {
    const existingLevel = levels.find((level) => level.id === requiredLevel.id);
    return existingLevel
      ? { ...existingLevel, minPercentage: 0, value: existingLevel.value || requiredLevel.value }
      : { ...requiredLevel };
  });

  return [...customLevels, ...requiredLevels];
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferDefaultPercentage(levelIndex: number) {
  return [90, 70, 50, 0][levelIndex] ?? 0;
}

function removeUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedValues(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, currentValue]) => currentValue !== undefined)
        .map(([key, currentValue]) => [key, removeUndefinedValues(currentValue)]),
    ) as T;
  }

  return value;
}
