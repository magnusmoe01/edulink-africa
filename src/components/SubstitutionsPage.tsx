import { useState } from "react";
import { Plus, Trash2, UserRound, AlertCircle, CalendarDays, Clock } from "lucide-react";
import { computeSlotTimes } from "./Timetable";
import { RegistrationModal, SelectInput } from "./ui";
import type { LessonSubstitution, School, TeacherAbsence, TimetableEntry } from "../types";

const ABSENCE_REASONS = [
  { value: "sick", label: "Sick leave" },
  { value: "personal", label: "Personal leave" },
  { value: "training", label: "Training / PD" },
  { value: "official", label: "Official duties" },
  { value: "other", label: "Other" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDayLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getShortDateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getTimetableDayName(date: string): string {
  const day = new Date(date + "T12:00:00").getDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] ?? "";
}

function getTeacherForEntry(entry: TimetableEntry, school: School): string | undefined {
  const sc = (school.subjectClasses ?? []).find(
    (c) => c.subjectId === entry.subjectId && c.baseClassId === entry.classId,
  );
  if (sc?.teacherName) return sc.teacherName;
  return school.subjects.find((s) => s.id === entry.subjectId)?.teacherName;
}

function getActiveTimetableEntries(school: School): TimetableEntry[] {
  const timetable = school.timetable;
  if (!timetable) return [];
  if (timetable.publishedVersionId) {
    const version = (timetable.versions ?? []).find((v) => v.id === timetable.publishedVersionId);
    if (version) return version.entries;
  }
  return timetable.entries ?? [];
}

function getActiveTimetableConfig(school: School) {
  const timetable = school.timetable;
  if (!timetable) return null;
  if (timetable.publishedVersionId) {
    const version = (timetable.versions ?? []).find((v) => v.id === timetable.publishedVersionId);
    if (version) return version.config;
  }
  return timetable.config ?? null;
}

function getLessonsForTeacherOnDay(teacherName: string, dayName: string, school: School): TimetableEntry[] {
  return getActiveTimetableEntries(school)
    .filter((e) => e.day === dayName && getTeacherForEntry(e, school) === teacherName)
    .sort((a, b) => a.slot - b.slot);
}

function getTeacherStaff(school: School) {
  return school.staff.filter(
    (m) => !m.deletedAt && (m.category === "Teacher" || (m.categories ?? []).includes("Teacher")),
  );
}

function absenceCoversDate(absence: TeacherAbsence, date: string): boolean {
  return absence.startDate <= date && absence.endDate >= date;
}

// ── Add Absence Modal ──────────────────────────────────────────

function AddAbsenceModal({
  school,
  defaultDate,
  onAdd,
  onClose,
}: {
  school: School;
  defaultDate: string;
  onAdd: (absence: TeacherAbsence) => void;
  onClose: () => void;
}) {
  const [absenceType, setAbsenceType] = useState<"partial" | "longterm">("partial");
  const [teacherName, setTeacherName] = useState("");
  const [reason, setReason] = useState("sick");
  const [date, setDate] = useState(defaultDate);
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [slotsInitialised, setSlotsInitialised] = useState(false);

  const config = getActiveTimetableConfig(school);
  const slotTimes = config ? computeSlotTimes(config) : [];
  const teacherStaff = getTeacherStaff(school);

  const dayName = getTimetableDayName(date);
  const lessonsOnDay = teacherName
    ? getLessonsForTeacherOnDay(teacherName, dayName, school)
    : [];

  const initSlots = (name: string, d: string) => {
    const lessons = getLessonsForTeacherOnDay(name, getTimetableDayName(d), school);
    setSelectedSlots(new Set(lessons.map((e) => e.slot)));
    setSlotsInitialised(true);
  };

  const handleTeacherChange = (name: string) => {
    setTeacherName(name);
    setSlotsInitialised(false);
    if (name && absenceType === "partial") initSlots(name, date);
  };

  const handleDateChange = (d: string) => {
    setDate(d);
    if (teacherName) initSlots(teacherName, d);
  };

  const toggleSlot = (slot: number) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(slot) ? next.delete(slot) : next.add(slot);
      return next;
    });
  };

  const canSubmit = teacherName && (absenceType === "partial"
    ? Boolean(date && (lessonsOnDay.length === 0 || selectedSlots.size > 0))
    : Boolean(startDate && endDate && startDate <= endDate));

  const handleSubmit = () => {
    if (!teacherName) return;

    let lessonSubstitutions: LessonSubstitution[] = [];

    if (absenceType === "partial") {
      const lessons = slotsInitialised
        ? getLessonsForTeacherOnDay(teacherName, dayName, school).filter((e) => selectedSlots.has(e.slot))
        : getLessonsForTeacherOnDay(teacherName, dayName, school);
      lessonSubstitutions = lessons.map((e) => ({
        subjectId: e.subjectId,
        classId: e.classId,
        slot: e.slot,
      }));
    }

    onAdd({
      id: `absence-${Date.now()}`,
      absenceType,
      startDate: absenceType === "partial" ? date : startDate,
      endDate: absenceType === "partial" ? date : endDate,
      teacherName,
      reason,
      lessonSubstitutions,
    });
    onClose();
  };

  const getSubjectName = (subjectId: string) =>
    school.subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
  const getClassName = (classId: string) =>
    school.classes.find((c) => c.id === classId)?.name ?? classId;

  return (
    <RegistrationModal
      eyebrow="Absence"
      title="Register absence"
      submitLabel="Register"
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="absence-modal-type-toggle">
        <button
          type="button"
          className={absenceType === "partial" ? "active-absence-type" : ""}
          onClick={() => { setAbsenceType("partial"); setSlotsInitialised(false); if (teacherName) initSlots(teacherName, date); }}
        >
          <Clock size={15} />
          Parts of the day
        </button>
        <button
          type="button"
          className={absenceType === "longterm" ? "active-absence-type" : ""}
          onClick={() => setAbsenceType("longterm")}
        >
          <CalendarDays size={15} />
          Long-term
        </button>
      </div>

      <div className="absence-modal-fields">
        <SelectInput
          label="Teacher"
          value={teacherName}
          options={[
            { value: "", label: "Select teacher..." },
            ...teacherStaff.map((m) => ({ value: m.name, label: m.name })),
          ]}
          onChange={handleTeacherChange}
        />

        <SelectInput
          label="Reason"
          value={reason}
          options={ABSENCE_REASONS}
          onChange={setReason}
        />

        {absenceType === "partial" ? (
          <label className="field-label">
            Date
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="field-label">
              From date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="field-label">
              To date
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {absenceType === "partial" && teacherName ? (
        <div className="absence-slot-picker">
          <p className="absence-slot-picker-label">
            {lessonsOnDay.length === 0
              ? `No lessons on ${dayName} for this teacher.`
              : "Select which lessons are affected:"}
          </p>
          {lessonsOnDay.map((entry) => {
            const time = slotTimes[entry.slot];
            const timeLabel = time ? `${time.start} – ${time.end}` : `Slot ${entry.slot + 1}`;
            const checked = selectedSlots.has(entry.slot);
            return (
              <label key={`${entry.subjectId}-${entry.classId}-${entry.slot}`} className="absence-slot-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSlot(entry.slot)}
                />
                <span className="absence-slot-time">{timeLabel}</span>
                <span className="absence-slot-detail">
                  {getSubjectName(entry.subjectId)} · {getClassName(entry.classId)}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </RegistrationModal>
  );
}

// ── Main page ─────────────────────────────────────────────────

export function SubstitutionsPage({
  school,
  onSchoolChange,
}: {
  school: School;
  onSchoolChange: (school: School) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [modalOpen, setModalOpen] = useState(false);

  const absences = school.absences ?? [];
  const dayAbsences = absences.filter((a) => absenceCoversDate(a, selectedDate));
  const dayName = getTimetableDayName(selectedDate);
  const config = getActiveTimetableConfig(school);
  const slotTimes = config ? computeSlotTimes(config) : [];
  const allStaff = school.staff.filter((m) => !m.deletedAt);

  const updateAbsences = (next: TeacherAbsence[]) => onSchoolChange({ ...school, absences: next });

  const addAbsence = (absence: TeacherAbsence) => updateAbsences([...absences, absence]);

  const removeAbsence = (id: string) => updateAbsences(absences.filter((a) => a.id !== id));

  const updateLessonSub = (
    absenceId: string,
    patch: Partial<LessonSubstitution>,
    key: { date?: string; subjectId: string; classId: string; slot: number },
  ) => {
    updateAbsences(absences.map((a) => {
      if (a.id !== absenceId) return a;
      const existing = a.lessonSubstitutions.find(
        (ls) => ls.subjectId === key.subjectId && ls.classId === key.classId && ls.slot === key.slot && ls.date === key.date,
      );
      if (existing) {
        return { ...a, lessonSubstitutions: a.lessonSubstitutions.map((ls) =>
          ls.subjectId === key.subjectId && ls.classId === key.classId && ls.slot === key.slot && ls.date === key.date
            ? { ...ls, ...patch } : ls,
        )};
      }
      return { ...a, lessonSubstitutions: [...a.lessonSubstitutions, { ...key, ...patch }] };
    }));
  };

  const getSubjectName = (subjectId: string) =>
    school.subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
  const getClassName = (classId: string) =>
    school.classes.find((c) => c.id === classId)?.name ?? classId;

  const hasTimetable = Boolean(school.timetable);
  const isWeekend = dayName === "Sat" || dayName === "Sun";

  const getLessonsForAbsenceOnDay = (absence: TeacherAbsence): TimetableEntry[] => {
    if (absence.absenceType === "partial") {
      return getLessonsForTeacherOnDay(absence.teacherName, dayName, school)
        .filter((e) => absence.lessonSubstitutions.some((ls) => ls.subjectId === e.subjectId && ls.classId === e.classId && ls.slot === e.slot));
    }
    return getLessonsForTeacherOnDay(absence.teacherName, dayName, school);
  };

  const getSubstituteForLesson = (absence: TeacherAbsence, entry: TimetableEntry) => {
    if (absence.absenceType === "partial") {
      return absence.lessonSubstitutions.find(
        (ls) => ls.subjectId === entry.subjectId && ls.classId === entry.classId && ls.slot === entry.slot,
      )?.substituteTeacherName ?? "";
    }
    return absence.lessonSubstitutions.find(
      (ls) => ls.subjectId === entry.subjectId && ls.classId === entry.classId && ls.slot === entry.slot && ls.date === selectedDate,
    )?.substituteTeacherName ?? "";
  };

  return (
    <div className="substitutions-page">
      {modalOpen ? (
        <AddAbsenceModal
          school={school}
          defaultDate={selectedDate}
          onAdd={addAbsence}
          onClose={() => setModalOpen(false)}
        />
      ) : null}

      <div className="substitutions-header">
        <label className="field-label substitutions-date-picker">
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
      </div>

      {!hasTimetable ? (
        <div className="substitutions-notice">
          <AlertCircle size={18} />
          <p>No timetable configured. Set up the timetable first to see lesson coverage.</p>
        </div>
      ) : isWeekend ? (
        <div className="substitutions-notice">
          <AlertCircle size={18} />
          <p>{getDayLabel(selectedDate)} is a weekend — no lessons scheduled.</p>
        </div>
      ) : null}

      <div className="substitutions-day-heading">
        <span>{getDayLabel(selectedDate)}</span>
        <button
          className="primary-action substitutions-add-btn"
          type="button"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={16} />
          Register absence
        </button>
      </div>

      {dayAbsences.length === 0 ? (
        <p className="substitutions-empty">No absences recorded for this day.</p>
      ) : null}

      <div className="substitutions-list">
        {dayAbsences.map((absence) => {
          const reasonLabel = ABSENCE_REASONS.find((r) => r.value === absence.reason)?.label ?? absence.reason ?? "Absent";
          const isLongterm = absence.absenceType === "longterm";
          const lessons = getLessonsForAbsenceOnDay(absence);

          return (
            <div key={absence.id} className="substitution-card">
              <div className="substitution-card-header">
                <div className="substitution-teacher-info">
                  <UserRound size={18} />
                  <strong>{absence.teacherName}</strong>
                  <span className="substitution-reason-badge">{reasonLabel}</span>
                  {isLongterm ? (
                    <span className="substitution-range-badge">
                      <CalendarDays size={12} />
                      {getShortDateLabel(absence.startDate)} – {getShortDateLabel(absence.endDate)}
                    </span>
                  ) : (
                    <span className="substitution-range-badge">
                      <Clock size={12} />
                      Partial day
                    </span>
                  )}
                </div>
                <button className="remove-button" type="button" onClick={() => removeAbsence(absence.id)}>
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>

              {lessons.length === 0 ? (
                <p className="substitution-no-lessons">No lessons on {dayName} for this teacher.</p>
              ) : (
                <table className="data-table substitution-lessons-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Substitute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((entry) => {
                      const time = slotTimes[entry.slot];
                      const timeLabel = time ? `${time.start} – ${time.end}` : `Slot ${entry.slot + 1}`;
                      const substituteValue = getSubstituteForLesson(absence, entry);
                      const subKey = {
                        date: isLongterm ? selectedDate : undefined,
                        subjectId: entry.subjectId,
                        classId: entry.classId,
                        slot: entry.slot,
                      };
                      return (
                        <tr key={`${entry.subjectId}-${entry.classId}-${entry.slot}`}>
                          <td className="substitution-time-cell">{timeLabel}</td>
                          <td>{getClassName(entry.classId)}</td>
                          <td>{getSubjectName(entry.subjectId)}</td>
                          <td className="substitution-assign-cell">
                            <select
                              className="substitution-substitute-select"
                              value={substituteValue}
                              onChange={(e) =>
                                updateLessonSub(absence.id, { substituteTeacherName: e.target.value || undefined }, subKey)
                              }
                            >
                              <option value="">Unassigned</option>
                              {allStaff
                                .filter((m) => m.name !== absence.teacherName)
                                .map((m) => (
                                  <option key={m.name} value={m.name}>{m.name}</option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
