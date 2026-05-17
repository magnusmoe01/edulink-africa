import type { School } from "../types";
import { getLocalSchool, getSchool } from "./schools";

export const schoolCache = new Map<string, School>();

export function getCachedSchool(schoolId: string) {
  const localSchool = getLocalSchool(schoolId);
  if (localSchool) {
    schoolCache.set(schoolId, localSchool);
    return localSchool;
  }
  return schoolCache.get(schoolId) ?? null;
}

export async function loadSchoolForPublicPage(schoolId: string, setSchool: (school: School) => void) {
  const remoteSchool = await getSchool(schoolId);
  const nextSchool = getLocalSchool(schoolId) ?? remoteSchool;
  schoolCache.set(schoolId, nextSchool);
  setSchool(nextSchool);
}
