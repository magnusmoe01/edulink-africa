import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { computeSlotTimes } from "./Timetable";
import type { SchoolWorkAccessLevel } from "../lib/staffUtils";
import type {
  AttendanceRecord,
  SchoolTimetable,
  Student,
  StudentAttendance,
  StudentAttendanceStatus,
  SubjectClass,
  TimetableEntry,
} from "../types";

const STATUS_CONFIG: Record<StudentAttendanceStatus, { label: string; short: string }> = {
  present: { label: "Present", short: "P" },
  absent: { label: "Absent", short: "A" },
  late: { label: "Late", short: "L" },
  excused: { label: "Excused", short: "E" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDayName(date: string): string {
  const day = new Date(date + "T12:00:00").getDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] ?? "";
}

function formatDateShort(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getActiveTimetableEntries(timetable?: SchoolTimetable): TimetableEntry[] {
  if (!timetable) return [];
  if (timetable.publishedVersionId) {
    const version = (timetable.versions ?? []).find((v) => v.id === timetable.publishedVersionId);
    if (version) return version.entries;
  }
  return timetable.entries ?? [];
}

function getActiveTimetableConfig(timetable?: SchoolTimetable) {
  if (!timetable) return null;
  if (timetable.publishedVersionId) {
    const version = (timetable.versions ?? []).find((v) => v.id === timetable.publishedVersionId);
    if (version) return version.config;
  }
  return timetable.config ?? null;
}

// ── Register view ──────────────────────────────────────────────

function RegisterView({
  subjectClass,
  students,
  date,
  slot,
  timeLabel,
  initialRecords,
  graderLabel,
  isReadOnly,
  onSave,
  onBack,
}: {
  subjectClass: SubjectClass;
  students: Student[];
  date: string;
  slot: number;
  timeLabel: string;
  initialRecords: StudentAttendance[];
  graderLabel?: string;
  isReadOnly: boolean;
  onSave: (records: StudentAttendance[]) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<StudentAttendance[]>(initialRecords);

  const setStatus = (studentId: string, status: StudentAttendanceStatus) => {
    setDraft((prev) => prev.map((r) => r.studentId === studentId ? { ...r, status } : r));
  };

  const markAllPresent = () => {
    setDraft((prev) => prev.map((r) => ({ ...r, status: "present" as const })));
  };

  const presentCount = draft.filter((r) => r.status === "present").length;
  const absentCount = draft.filter((r) => r.status === "absent").length;
  const lateCount = draft.filter((r) => r.status === "late").length;

  return (
    <div className="attendance-register">
      <div className="editor-back-row">
        <button className="assessment-back-link" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      <div className="attendance-register-heading">
        <div>
          <p className="eyebrow">{subjectClass.name}</p>
          <h3>{formatDateShort(date)} · {timeLabel}</h3>
        </div>
        <div className="attendance-register-chips">
          <span className="att-chip att-chip-present">{presentCount} present</span>
          {absentCount > 0 ? <span className="att-chip att-chip-absent">{absentCount} absent</span> : null}
          {lateCount > 0 ? <span className="att-chip att-chip-late">{lateCount} late</span> : null}
        </div>
      </div>

      {!isReadOnly ? (
        <button className="secondary-action attendance-mark-all-btn" type="button" onClick={markAllPresent}>
          Mark all present
        </button>
      ) : null}

      <div className="attendance-student-list">
        {students.map((student) => {
          const rec = draft.find((r) => r.studentId === student.id);
          const status = rec?.status ?? "present";
          return (
            <div key={student.id} className={`attendance-student-row att-row-${status}`}>
              <span className="attendance-student-name">{student.firstName} {student.lastName}</span>
              <div className="attendance-status-buttons" role="group" aria-label={`Status for ${student.firstName}`}>
                {(["present", "absent", "late", "excused"] as StudentAttendanceStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`attendance-status-btn att-btn-${s}${status === s ? " att-btn-active" : ""}`}
                    onClick={() => !isReadOnly && setStatus(student.id, s)}
                    disabled={isReadOnly}
                    title={STATUS_CONFIG[s].label}
                  >
                    {STATUS_CONFIG[s].short}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!isReadOnly ? (
        <div className="attendance-save-row">
          <button className="primary-action" type="button" onClick={() => onSave(draft)}>
            Save register
          </button>
          <button className="secondary-action" type="button" onClick={onBack}>
            Cancel
          </button>
        </div>
      ) : null}

      {graderLabel && !isReadOnly ? (
        <p className="attendance-grader-label">Saving as {graderLabel}</p>
      ) : null}
    </div>
  );
}

// ── Main attendance page ───────────────────────────────────────

export function AttendancePage({
  subjectClass,
  students,
  timetable,
  attendanceRecords,
  graderLabel,
  accessLevel,
  onAttendanceChange,
}: {
  subjectClass: SubjectClass;
  students: Student[];
  timetable?: SchoolTimetable;
  attendanceRecords: AttendanceRecord[];
  graderLabel?: string;
  accessLevel: SchoolWorkAccessLevel;
  onAttendanceChange: (records: AttendanceRecord[]) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [registerSlot, setRegisterSlot] = useState<number | null>(null);

  const config = getActiveTimetableConfig(timetable);
  const slotTimes = config ? computeSlotTimes(config) : [];
  const dayName = getDayName(selectedDate);
  const allEntries = getActiveTimetableEntries(timetable);
  const classEntries = allEntries
    .filter((e) => e.day === dayName && e.classId === subjectClass.baseClassId && e.subjectId === subjectClass.subjectId)
    .sort((a, b) => a.slot - b.slot);

  const getRecord = (slot: number) =>
    attendanceRecords.find(
      (r) => r.subjectClassId === subjectClass.id && r.date === selectedDate && r.slot === slot,
    );

  const isReadOnly = accessLevel === "student" || accessLevel === "viewer";
  const classStudents = students.filter((s) => subjectClass.studentIds.includes(s.id));

  if (registerSlot !== null) {
    const time = slotTimes[registerSlot];
    const timeLabel = time ? `${time.start} – ${time.end}` : `Slot ${registerSlot + 1}`;
    const existing = getRecord(registerSlot);
    const initDraft: StudentAttendance[] = classStudents.map((s) => {
      const existingRec = existing?.records.find((r) => r.studentId === s.id);
      return existingRec ?? { studentId: s.id, status: "present" };
    });

    return (
      <RegisterView
        subjectClass={subjectClass}
        students={classStudents}
        date={selectedDate}
        slot={registerSlot}
        timeLabel={timeLabel}
        initialRecords={initDraft}
        graderLabel={graderLabel}
        isReadOnly={isReadOnly}
        onSave={(records) => {
          const filtered = attendanceRecords.filter(
            (r) => !(r.subjectClassId === subjectClass.id && r.date === selectedDate && r.slot === registerSlot),
          );
          onAttendanceChange([...filtered, {
            id: existing?.id ?? `att-${Date.now()}`,
            date: selectedDate,
            subjectClassId: subjectClass.id,
            slot: registerSlot,
            records,
            takenBy: graderLabel,
            takenAt: new Date().toISOString(),
          }]);
          setRegisterSlot(null);
        }}
        onBack={() => setRegisterSlot(null)}
      />
    );
  }

  return (
    <div className="attendance-page">
      <div className="attendance-date-row">
        <label className="field-label attendance-date-label">
          Date
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
      </div>

      {!timetable ? (
        <p className="attendance-notice">No timetable configured for this school.</p>
      ) : classEntries.length === 0 ? (
        <p className="attendance-notice">No lessons on {dayName} for this subject class.</p>
      ) : (
        <div className="attendance-slot-list">
          {classEntries.map((entry) => {
            const time = slotTimes[entry.slot];
            const timeLabel = time ? `${time.start} – ${time.end}` : `Slot ${entry.slot + 1}`;
            const record = getRecord(entry.slot);
            const total = classStudents.length;
            const presentCount = record?.records.filter((r) => r.status === "present").length ?? null;
            const absentCount = record?.records.filter((r) => r.status === "absent").length ?? null;
            const taken = Boolean(record);

            return (
              <button
                key={entry.slot}
                className={`attendance-slot-row${taken ? " attendance-slot-taken" : ""}`}
                type="button"
                onClick={() => setRegisterSlot(entry.slot)}
              >
                <span className="attendance-slot-time">{timeLabel}</span>
                <span className="attendance-slot-info">
                  {taken ? (
                    <>
                      <span className="att-chip att-chip-present">{presentCount}/{total}</span>
                      {absentCount ? <span className="att-chip att-chip-absent">{absentCount} absent</span> : null}
                    </>
                  ) : (
                    <span className="attendance-not-taken">Not taken</span>
                  )}
                </span>
                <span className="attendance-slot-cta">
                  {isReadOnly ? "View" : taken ? "Edit" : "Take register"} →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Attendance summary for contact teacher view ────────────────

export function AttendanceSummary({
  classStudents,
  subjectClasses,
  attendanceRecords,
}: {
  classStudents: Student[];
  subjectClasses: SubjectClass[];
  attendanceRecords: AttendanceRecord[];
}) {
  const classSubjectClassIds = new Set(subjectClasses.map((sc) => sc.id));
  const relevantRecords = attendanceRecords.filter((r) => classSubjectClassIds.has(r.subjectClassId));

  if (relevantRecords.length === 0) {
    return <p className="attendance-notice">No attendance records yet for this class.</p>;
  }

  return (
    <div className="attendance-summary-table-wrap">
      <table className="data-table attendance-summary-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Late</th>
            <th>Excused</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {classStudents.map((student) => {
            const allRecs = relevantRecords.flatMap((r) =>
              r.records.filter((s) => s.studentId === student.id),
            );
            const present = allRecs.filter((r) => r.status === "present").length;
            const absent = allRecs.filter((r) => r.status === "absent").length;
            const late = allRecs.filter((r) => r.status === "late").length;
            const excused = allRecs.filter((r) => r.status === "excused").length;
            const total = allRecs.length;
            const rate = total > 0 ? Math.round((present / total) * 100) : null;

            return (
              <tr key={student.id}>
                <td><strong>{student.firstName} {student.lastName}</strong></td>
                <td className="att-count att-present-count">{present}</td>
                <td className="att-count att-absent-count">{absent}</td>
                <td className="att-count att-late-count">{late}</td>
                <td className="att-count att-excused-count">{excused}</td>
                <td>
                  {rate !== null ? (
                    <span className={`att-rate-badge${rate < 80 ? " att-rate-low" : rate < 90 ? " att-rate-mid" : " att-rate-high"}`}>
                      {rate}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
