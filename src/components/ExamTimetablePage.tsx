import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { RegistrationModal, SelectInput, TextInput } from "./ui";
import { formatDate } from "../lib/utils";
import type { ClassGroup, ExamTimetableEntry, School, Subject } from "../types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h}:${String(m ?? 0).padStart(2, "0")}`;
}

function fmtDateHeading(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(entries: ExamTimetableEntry[]): [string, ExamTimetableEntry[]][] {
  const map = new Map<string, ExamTimetableEntry[]>();
  for (const entry of [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  )) {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, list);
  }
  return [...map.entries()];
}

function ExamEntryModal({
  initial,
  subjects,
  classes,
  onSubmit,
  onRemove,
  onClose,
}: {
  initial?: ExamTimetableEntry;
  subjects: Subject[];
  classes: ClassGroup[];
  onSubmit: (data: Omit<ExamTimetableEntry, "id">) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [startTime, setStartTime] = useState(initial?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "10:00");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [classIds, setClassIds] = useState<string[]>(initial?.classIds ?? []);
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const toggleClass = (id: string) =>
    setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSubmit = () => {
    if (!date || !subjectId || classIds.length === 0) return;
    onSubmit({
      date,
      startTime,
      endTime: endTime || undefined,
      subjectId,
      classIds,
      venue: venue.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <RegistrationModal
      title={initial ? "Edit exam" : "Add exam"}
      eyebrow="Exam timetable"
      submitLabel={initial ? "Save changes" : "Add exam"}
      onClose={onClose}
      onSubmit={handleSubmit}
      onRemove={onRemove}
    >
      <div className="exam-modal-time-row">
        <label className="field-label">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field-label">
          Start time
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="field-label">
          End time
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>
      <SelectInput
        label="Subject"
        value={subjectId}
        options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSubjectId}
      />
      <div>
        <p className="field-label">Classes</p>
        <div className="exam-class-checkbox-grid">
          {classes.map((cls) => (
            <label key={cls.id} className="exam-class-checkbox-row">
              <input
                type="checkbox"
                checked={classIds.includes(cls.id)}
                onChange={() => toggleClass(cls.id)}
              />
              {cls.name}
            </label>
          ))}
        </div>
      </div>
      <TextInput label="Venue (optional)" value={venue} onChange={setVenue} />
      <TextInput label="Notes (optional)" value={notes} onChange={setNotes} />
    </RegistrationModal>
  );
}

function ExamEntryCard({
  entry,
  subjects,
  classes,
  onEdit,
  onDelete,
}: {
  entry: ExamTimetableEntry;
  subjects: Subject[];
  classes: ClassGroup[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const subject = subjects.find((s) => s.id === entry.subjectId);
  const classNames = entry.classIds
    .map((id) => classes.find((c) => c.id === id)?.name ?? id)
    .join(", ");

  return (
    <div
      className="exam-entry-card"
      style={{ "--exam-subject-color": subject?.color ?? "#1f6857" } as React.CSSProperties}
    >
      <div className="exam-entry-color-bar" />
      <div className="exam-entry-body">
        <p className="exam-entry-subject">{subject?.name ?? "Unknown subject"}</p>
        <p className="exam-entry-meta">
          <span className="exam-entry-time">
            {fmtTime(entry.startTime)}{entry.endTime ? ` – ${fmtTime(entry.endTime)}` : ""}
          </span>
          {entry.venue ? <span className="exam-entry-venue">{entry.venue}</span> : null}
        </p>
        <p className="exam-entry-classes">{classNames}</p>
        {entry.notes ? <p className="exam-entry-notes">{entry.notes}</p> : null}
      </div>
      <div className="exam-entry-actions">
        <button className="icon-action-button" type="button" title="Edit" onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <button className="icon-action-button icon-action-danger" type="button" title="Delete" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function ExamTimetableAdminPage({
  school,
  onSchoolChange,
}: {
  school: School;
  onSchoolChange: (school: School) => void;
}) {
  const [modalMode, setModalMode] = useState<"add" | ExamTimetableEntry | null>(null);
  const entries = school.examTimetable?.entries ?? [];

  const saveEntries = (next: ExamTimetableEntry[]) =>
    onSchoolChange({ ...school, examTimetable: { entries: next } });

  const handleSubmit = (data: Omit<ExamTimetableEntry, "id">) => {
    if (typeof modalMode === "object" && modalMode !== null) {
      saveEntries(entries.map((e) => (e.id === modalMode.id ? { id: modalMode.id, ...data } : e)));
    } else {
      saveEntries([...entries, { id: `exam-${Date.now()}`, ...data }]);
    }
    setModalMode(null);
  };

  const handleDelete = (id: string) => {
    saveEntries(entries.filter((e) => e.id !== id));
    setModalMode(null);
  };

  const grouped = groupByDate(entries);

  return (
    <div className="exam-admin-page">
      <button
        className="secondary-action repeater-add-button"
        type="button"
        onClick={() => setModalMode("add")}
      >
        <Plus size={15} /> Add exam
      </button>

      {entries.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No exams scheduled</h3>
          <p>Add exams to build the exam timetable for students and parents.</p>
        </div>
      ) : (
        <div className="exam-date-groups">
          {grouped.map(([date, dayEntries]) => (
            <div key={date} className="exam-date-group">
              <h3 className="exam-date-heading">{fmtDateHeading(date)}</h3>
              <div className="exam-entry-list">
                {dayEntries.map((entry) => (
                  <ExamEntryCard
                    key={entry.id}
                    entry={entry}
                    subjects={school.subjects}
                    classes={school.classes}
                    onEdit={() => setModalMode(entry)}
                    onDelete={() => handleDelete(entry.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode !== null ? (
        <ExamEntryModal
          initial={modalMode !== "add" ? modalMode : undefined}
          subjects={school.subjects}
          classes={school.classes}
          onSubmit={handleSubmit}
          onRemove={
            modalMode !== "add"
              ? () => handleDelete(modalMode.id)
              : undefined
          }
          onClose={() => setModalMode(null)}
        />
      ) : null}
    </div>
  );
}

// ── Read-only view (students + parents) ───────────────────────

function ExamViewCard({
  entry,
  subjects,
  classes,
  showClasses,
}: {
  entry: ExamTimetableEntry;
  subjects: Subject[];
  classes: ClassGroup[];
  showClasses: boolean;
}) {
  const subject = subjects.find((s) => s.id === entry.subjectId);
  const today = todayStr();
  const isPast = entry.date < today;
  const isToday = entry.date === today;

  return (
    <div
      className={`exam-view-card${isPast ? " exam-view-card-past" : isToday ? " exam-view-card-today" : ""}`}
      style={{ "--exam-subject-color": subject?.color ?? "#1f6857" } as React.CSSProperties}
    >
      <div className="exam-view-color-bar" />
      <div className="exam-view-card-date-col">
        <span className="exam-view-card-day">
          {new Date(entry.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}
        </span>
        <span className="exam-view-card-daynum">
          {new Date(entry.date + "T12:00:00").getDate()}
        </span>
        <span className="exam-view-card-month">
          {new Date(entry.date + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}
        </span>
      </div>
      <div className="exam-view-card-body">
        <p className="exam-view-subject">{subject?.name ?? "Unknown subject"}</p>
        <p className="exam-view-meta">
          <span className="exam-view-time">{fmtTime(entry.startTime)}{entry.endTime ? ` – ${fmtTime(entry.endTime)}` : ""}</span>
          {entry.venue ? <span className="exam-view-venue">{entry.venue}</span> : null}
        </p>
        {showClasses ? (
          <p className="exam-view-classes">
            {entry.classIds.map((id) => classes.find((c) => c.id === id)?.name ?? id).join(", ")}
          </p>
        ) : null}
        {entry.notes ? <p className="exam-view-notes">{entry.notes}</p> : null}
      </div>
      {isToday ? <span className="exam-view-today-badge">Today</span> : null}
    </div>
  );
}

function ExamViewGroup({
  label,
  entries,
  subjects,
  classes,
  showClasses,
  muted,
}: {
  label: string;
  entries: ExamTimetableEntry[];
  subjects: Subject[];
  classes: ClassGroup[];
  showClasses: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`exam-view-group${muted ? " exam-view-group-past" : ""}`}>
      <h3 className="exam-view-group-label">{label}</h3>
      <div className="exam-view-list">
        {entries.map((entry) => (
          <ExamViewCard
            key={entry.id}
            entry={entry}
            subjects={subjects}
            classes={classes}
            showClasses={showClasses}
          />
        ))}
      </div>
    </div>
  );
}

export function ExamView({
  entries,
  subjects,
  classes,
  filterClassId,
}: {
  entries: ExamTimetableEntry[];
  subjects: Subject[];
  classes: ClassGroup[];
  filterClassId?: string;
}) {
  const today = todayStr();
  const filtered = filterClassId
    ? entries.filter((e) => e.classIds.includes(filterClassId))
    : entries;

  const sorted = [...filtered].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
  const upcoming = sorted.filter((e) => e.date >= today);
  const past = sorted.filter((e) => e.date < today).reverse();

  if (filtered.length === 0) {
    return <p className="parent-empty">No exams scheduled.</p>;
  }

  return (
    <div className="exam-view">
      {upcoming.length > 0 && (
        <ExamViewGroup
          label="Upcoming"
          entries={upcoming}
          subjects={subjects}
          classes={classes}
          showClasses={!filterClassId}
        />
      )}
      {past.length > 0 && (
        <ExamViewGroup
          label="Past"
          entries={past}
          subjects={subjects}
          classes={classes}
          showClasses={!filterClassId}
          muted
        />
      )}
    </div>
  );
}
