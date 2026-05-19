import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "../lib/utils";
import type { Subject, SubjectClass } from "../types";

type HomeworkItem = {
  id: string;
  type: "assignment" | "assessment" | "test";
  title: string;
  subjectClassName: string;
  subjectColor: string;
  dueDate?: string;
  description?: string;
  submitted: boolean;
};

type DueGroup = "overdue" | "soon" | "later" | "none";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDueGroup(dueDate: string | undefined, today: string): DueGroup {
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate <= addDays(today, 7)) return "soon";
  return "later";
}

function formatDueLabel(dueDate: string): string {
  const today = todayStr();
  if (dueDate === today) return "Due today";
  if (dueDate === addDays(today, 1)) return "Due tomorrow";
  if (dueDate < today) {
    const diff = Math.round(
      (new Date(today + "T12:00:00").getTime() - new Date(dueDate + "T12:00:00").getTime()) / 86400000,
    );
    return `${diff} day${diff !== 1 ? "s" : ""} overdue`;
  }
  return `Due ${formatDate(dueDate)}`;
}

function HomeworkItemCard({ item }: { item: HomeworkItem }) {
  const today = todayStr();
  const isOverdue = Boolean(item.dueDate && item.dueDate < today && !item.submitted);

  return (
    <div
      className={`homework-item${item.submitted ? " homework-item-submitted" : isOverdue ? " homework-item-overdue" : ""}`}
      style={{ "--hw-subject-color": item.subjectColor } as React.CSSProperties}
    >
      <div className="homework-item-color-bar" />
      <div className="homework-item-body">
        <div className="homework-item-top">
          <span className="homework-subject-chip">{item.subjectClassName}</span>
          <span className={`homework-type-badge homework-type-${item.type}`}>
            {item.type === "assignment" ? "Assignment" : item.type === "assessment" ? "Turn-in" : "Test"}
          </span>
        </div>
        <p className="homework-item-title">{item.title}</p>
        {item.description ? <p className="homework-item-desc">{item.description}</p> : null}
        <div className="homework-item-meta">
          {item.submitted ? (
            <span className="homework-submitted-label">
              <CheckCircle2 size={13} /> Submitted
            </span>
          ) : item.dueDate ? (
            <span className={`homework-due-label${isOverdue ? " homework-due-overdue" : ""}`}>
              <Clock size={13} />
              {formatDueLabel(item.dueDate)}
            </span>
          ) : (
            <span className="homework-no-due">
              <CalendarDays size={13} /> No due date
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeworkGroup({
  label,
  items,
  variant,
}: {
  label: string;
  items: HomeworkItem[];
  variant: DueGroup | "submitted";
}) {
  return (
    <div className={`homework-group homework-group-${variant}`}>
      <h3 className="homework-group-label">
        {label}
        <span className="homework-group-count">{items.length}</span>
      </h3>
      <div className="homework-item-list">
        {items.map((item) => (
          <HomeworkItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function HomeworkPage({
  subjectClasses,
  subjects,
  studentId,
}: {
  subjectClasses: SubjectClass[];
  subjects: Subject[];
  studentId: string;
}) {
  const today = todayStr();

  const items = useMemo<HomeworkItem[]>(() => {
    const result: HomeworkItem[] = [];

    for (const sc of subjectClasses) {
      const subject = subjects.find((s) => s.id === sc.subjectId);
      const color = subject?.color ?? "#1f6857";

      for (const a of sc.assignments ?? []) {
        result.push({
          id: `${sc.id}-assignment-${a.id}`,
          type: "assignment",
          title: a.title,
          subjectClassName: sc.name,
          subjectColor: color,
          dueDate: a.dueDate,
          description: a.description || undefined,
          submitted: false,
        });
      }

      for (const a of sc.assessments ?? []) {
        if (!a.requiresTurnIn || a.hidden) continue;
        const grade = a.grades.find((g) => g.studentId === studentId);
        result.push({
          id: `${sc.id}-assessment-${a.id}`,
          type: "assessment",
          title: a.title,
          subjectClassName: sc.name,
          subjectColor: color,
          dueDate: a.date,
          description: a.description,
          submitted: Boolean(grade?.submitted),
        });
      }

      for (const r of sc.resources ?? []) {
        if (r.type !== "test" || r.hidden || !r.dueDate) continue;
        const submission = r.testSubmissions?.find((s) => s.studentId === studentId);
        result.push({
          id: `${sc.id}-test-${r.id}`,
          type: "test",
          title: r.title,
          subjectClassName: sc.name,
          subjectColor: color,
          dueDate: r.dueDate,
          description: r.description,
          submitted: Boolean(submission?.submittedAt),
        });
      }
    }

    return result.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [subjectClasses, subjects, studentId]);

  const pending = items.filter((i) => !i.submitted);
  const submitted = items.filter((i) => i.submitted);

  const overdue = pending.filter((i) => getDueGroup(i.dueDate, today) === "overdue");
  const soon = pending.filter((i) => getDueGroup(i.dueDate, today) === "soon");
  const later = pending.filter((i) => getDueGroup(i.dueDate, today) === "later");
  const noDue = pending.filter((i) => getDueGroup(i.dueDate, today) === "none");

  if (items.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No homework</h3>
        <p>No assignments or tasks have been set for your subjects yet.</p>
      </div>
    );
  }

  return (
    <div className="homework-page">
      {overdue.length > 0 && <HomeworkGroup label="Overdue" items={overdue} variant="overdue" />}
      {soon.length > 0 && <HomeworkGroup label="Due this week" items={soon} variant="soon" />}
      {later.length > 0 && <HomeworkGroup label="Upcoming" items={later} variant="later" />}
      {noDue.length > 0 && <HomeworkGroup label="No due date" items={noDue} variant="none" />}
      {submitted.length > 0 && <HomeworkGroup label="Submitted" items={submitted} variant="submitted" />}
    </div>
  );
}
