import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "./firebase";
import { sampleSchool } from "../data/sampleSchool";
import type { AdminProfile, GlobalAboutConfig, GlobalSchoolWorkConfig, School } from "../types";

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

export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  if (!hasFirebaseConfig || !db) {
    return {
      uid,
      email: "local-admin@edulink.africa",
      schoolIds: [sampleSchool.id],
      superAdmin: true,
    };
  }

  const snapshot = await getDoc(doc(db, "schoolAdmins", uid));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    uid,
    email: typeof data.email === "string" ? data.email : undefined,
    schoolIds: Array.isArray(data.schoolIds) ? data.schoolIds.filter((id): id is string => typeof id === "string") : [],
    superAdmin: data.superAdmin === true,
  };
}

export async function saveSchool(school: School): Promise<void> {
  if (!hasFirebaseConfig || !db) {
    window.localStorage.setItem(`edulink-school-${school.id}`, JSON.stringify(school));
    return;
  }

  const schoolData = removeUndefinedValues({
    ...school,
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
  return {
    ...sampleSchool,
    ...school,
    showWebsite: school.showWebsite ?? true,
    adminEmails: school.adminEmails ?? [],
    values: school.values ?? [],
    announcements: school.announcements ?? [],
    calendar: school.calendar ?? [],
    staff: (school.staff ?? []).map((member) => ({
      ...member,
      visibleOnHomePage: member.visibleOnHomePage ?? true,
      visibleOnStaffPage: member.visibleOnStaffPage ?? true,
    })),
    classes: school.classes ?? [],
    students: (school.students ?? []).map((student) => ({
      ...student,
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
      }));
    })).map((subjectClass) => ({
      ...subjectClass,
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
    })),
    aboutCategories: school.aboutCategories ?? [],
    aboutPages: school.aboutPages ?? [],
    schoolWorkSettings: {
      enabledGlobalAssessmentScaleIds: school.schoolWorkSettings?.enabledGlobalAssessmentScaleIds ?? defaultGlobalSchoolWorkConfig.assessmentScales.map((scale) => scale.id),
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
  };
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

  return {
    ...config,
    assessmentScales: assessmentScales.map((scale, scaleIndex) => ({
      id: scale.id || `scale-${scaleIndex + 1}`,
      name: scale.name || "Assessment scale",
      levels: ensureRequiredAssessmentScaleLevels((scale.levels?.length ? scale.levels : defaultGlobalSchoolWorkConfig.assessmentScales[0].levels).map((level, levelIndex) => ({
        id: level.id || `level-${levelIndex + 1}`,
        value: level.value || ("label" in level && typeof level.label === "string" ? level.label : String(levelIndex + 1)),
        minPercentage: typeof level.minPercentage === "number" ? clampPercentage(level.minPercentage) : inferDefaultPercentage(levelIndex),
        description: level.description ?? "",
      }))),
    })),
    updatedAt: config.updatedAt,
  };
}

function ensureRequiredAssessmentScaleLevels(levels: Array<{ id: string; value: string; minPercentage: number; description?: string }>) {
  const requiredIds = new Set(REQUIRED_ASSESSMENT_SCALE_LEVELS.map((level) => level.id));
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
