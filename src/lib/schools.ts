import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db, hasFirebaseConfig } from "./firebase";
import { sampleSchool } from "../data/sampleSchool";
import type { AdminProfile, School } from "../types";

const COLLECTION = "schools";

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

  await setDoc(
    doc(db, COLLECTION, school.id),
    {
      ...school,
      updatedAt: new Date().toISOString(),
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
    adminEmails: school.adminEmails ?? [],
    values: school.values ?? [],
    announcements: school.announcements ?? [],
    calendar: school.calendar ?? [],
    staff: school.staff ?? [],
    classes: school.classes ?? [],
    students: school.students ?? [],
    aboutCategories: school.aboutCategories ?? [],
    aboutPages: school.aboutPages ?? [],
  };
}
