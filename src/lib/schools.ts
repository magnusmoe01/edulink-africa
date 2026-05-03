import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "./firebase";
import { sampleSchool } from "../data/sampleSchool";
import type { AdminProfile, GlobalAboutConfig, School } from "../types";

const COLLECTION = "schools";
const GLOBAL_ABOUT_KEY = "edulink-global-about";
const GLOBAL_CONFIG_COLLECTION = "platformConfig";
const GLOBAL_ABOUT_DOC = "globalAbout";

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
      resourceFolders: subjectClass.resourceFolders ?? [],
      resources: subjectClass.resources ?? [],
      announcements: subjectClass.announcements ?? [],
    })),
    aboutCategories: school.aboutCategories ?? [],
    aboutPages: school.aboutPages ?? [],
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
