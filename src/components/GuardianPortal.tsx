import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { GraduationCap, LogOut, UserRound } from "lucide-react";
import { navigate } from "../lib/navigate";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import { getSchool } from "../lib/schools";
import { getCachedSchool } from "../lib/schoolCache";
import { useSchoolDocumentBrand, PublicSchoolLoadingPage } from "./SchoolWebsite";
import { AttendanceSummary } from "./AttendancePage";
import { ExamView } from "./ExamTimetablePage";
import { formatDate } from "../lib/utils";
import type { Assessment, AssessmentGrade, AttendanceRecord, School, Student, SubjectClass } from "../types";

function getGuardianChildren(school: School, email: string): Student[] {
  const norm = email.toLowerCase();
  return school.students.filter(
    (s) =>
      s.guardianEmail?.toLowerCase() === norm ||
      s.guardians?.some((g) => g.email?.toLowerCase() === norm),
  );
}

function getGradeDisplay(assessment: Assessment, grade: AssessmentGrade, school: School): string | null {
  if (grade.score) return grade.score;
  if (grade.levelId) {
    const scale = school.schoolWorkSettings?.customAssessmentScales?.find((s) => s.id === assessment.scaleId);
    return scale?.levels.find((l) => l.id === grade.levelId)?.value ?? null;
  }
  return null;
}

type PortalTab = "grades" | "attendance" | "announcements" | "exams";

function GradesView({ student, subjectClasses, school }: { student: Student; subjectClasses: SubjectClass[]; school: School }) {
  const subjectsWithGrades = subjectClasses
    .map((sc) => {
      const subject = school.subjects.find((s) => s.id === sc.subjectId);
      const graded = (sc.assessments ?? [])
        .filter((a) => !a.hidden)
        .map((a) => ({ assessment: a, grade: a.grades.find((g) => g.studentId === student.id) }))
        .filter(({ grade }) => grade && (grade.levelId || grade.score));
      return { sc, subject, graded };
    })
    .filter((x) => x.graded.length > 0);

  if (subjectsWithGrades.length === 0) {
    return <p className="guardian-empty">No grades recorded yet.</p>;
  }

  return (
    <div className="guardian-grades-list">
      {subjectsWithGrades.map(({ sc, subject, graded }) => (
        <div key={sc.id} className="guardian-subject-block">
          <h3
            className="guardian-subject-heading"
            style={{ "--subject-color": subject?.color ?? "#1f6857" } as React.CSSProperties}
          >
            {sc.name}
          </h3>
          <div className="guardian-assessment-list">
            {graded.map(({ assessment, grade }) => {
              const display = getGradeDisplay(assessment, grade as AssessmentGrade, school);
              return (
                <div key={assessment.id} className="guardian-assessment-row">
                  <div className="guardian-assessment-info">
                    <strong>{assessment.title}</strong>
                    <span className="guardian-assessment-date">{formatDate(assessment.date)}</span>
                  </div>
                  <div className="guardian-assessment-right">
                    {display ? <span className="student-grade-badge">{display}</span> : null}
                    {(grade as AssessmentGrade).feedback ? (
                      <span className="guardian-assessment-feedback">{(grade as AssessmentGrade).feedback}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AnnouncementsView({ subjectClasses }: { subjectClasses: SubjectClass[] }) {
  const all = subjectClasses
    .flatMap((sc) => (sc.announcements ?? []).map((a) => ({ ...a, subjectClassName: sc.name })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (all.length === 0) {
    return <p className="guardian-empty">No announcements yet.</p>;
  }

  return (
    <div className="guardian-announcements">
      {all.map((a) => (
        <article key={a.id} className="guardian-announcement-card">
          <div className="guardian-announcement-meta">
            <span className="guardian-announcement-subject">{a.subjectClassName}</span>
            <span className="guardian-announcement-date">{formatDate(a.createdAt)}</span>
          </div>
          <h3>{a.title}</h3>
          <p>{a.body}</p>
        </article>
      ))}
    </div>
  );
}

function ChildView({ student, school }: { student: Student; school: School }) {
  const [tab, setTab] = useState<PortalTab>("grades");
  const classGroup = school.classes.find((c) => c.id === student.classId);
  const subjectClasses = (school.subjectClasses ?? []).filter((sc) => sc.studentIds.includes(student.id));

  return (
    <div className="guardian-child-view">
      <div className="guardian-child-header">
        <p className="guardian-child-name">{student.firstName} {student.lastName}</p>
        {classGroup ? <p className="guardian-child-class">{classGroup.name}</p> : null}
      </div>

      <div className="guardian-tab-bar">
        {(["grades", "attendance", "announcements", "exams"] as PortalTab[]).map((t) => (
          <button
            key={t}
            className={`guardian-tab${tab === t ? " guardian-tab-active" : ""}`}
            type="button"
            onClick={() => setTab(t)}
          >
            {t === "grades" ? "Grades" : t === "attendance" ? "Attendance" : t === "announcements" ? "Announcements" : "Exams"}
          </button>
        ))}
      </div>

      {tab === "grades" ? (
        <GradesView student={student} subjectClasses={subjectClasses} school={school} />
      ) : tab === "attendance" ? (
        <AttendanceSummary
          classStudents={[student]}
          subjectClasses={subjectClasses}
          attendanceRecords={school.attendanceRecords ?? []}
        />
      ) : tab === "announcements" ? (
        <AnnouncementsView subjectClasses={subjectClasses} />
      ) : (
        <ExamView
          entries={school.examTimetable?.entries ?? []}
          subjects={school.subjects}
          classes={school.classes}
          filterClassId={student.classId}
        />
      )}
    </div>
  );
}

export function GuardianPortalPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));
  const [user, setUser] = useState<User | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    void getSchool(schoolId).then(setSchool);
  }, [schoolId]);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) return undefined;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useSchoolDocumentBrand(school);

  const logout = async () => {
    if (auth) await signOut(auth);
    navigate("/login");
  };

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} />;
  }

  const guardianEmail = user?.email ?? null;
  const children = guardianEmail ? getGuardianChildren(school, guardianEmail) : [];
  const selectedChild = children.find((c) => c.id === selectedChildId) ?? children[0] ?? null;

  return (
    <main className="guardian-portal">
      <header className="guardian-portal-header">
        <button className="brand-button" type="button" onClick={() => navigate(`/${school.id}`)}>
          <GraduationCap size={28} />
          <span>{school.name}</span>
        </button>
        <div className="guardian-portal-actions">
          {guardianEmail ? (
            <span className="guardian-email-label">
              <UserRound size={14} />
              {guardianEmail}
            </span>
          ) : null}
          {hasFirebaseConfig && user ? (
            <button className="secondary-action" type="button" onClick={() => void logout()}>
              <LogOut size={14} />
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <div className="guardian-portal-body">
        <div className="guardian-portal-heading">
          <p className="eyebrow">Guardian portal</p>
          <h1>{school.name}</h1>
        </div>

        {children.length === 0 ? (
          <div className="empty-editor-state">
            <h3>No children found</h3>
            <p>
              {guardianEmail
                ? `${guardianEmail} is not registered as a guardian for any student at this school.`
                : "Sign in with your guardian email to view your child's progress."}
            </p>
            {!user && hasFirebaseConfig ? (
              <button className="primary-action" type="button" onClick={() => navigate("/login")}>
                Sign in
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {children.length > 1 ? (
              <div className="guardian-child-selector">
                {children.map((child) => (
                  <button
                    key={child.id}
                    className={`guardian-child-tab${selectedChild?.id === child.id ? " guardian-child-tab-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                  >
                    {child.firstName} {child.lastName}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedChild ? <ChildView student={selectedChild} school={school} /> : null}
          </>
        )}
      </div>
    </main>
  );
}
