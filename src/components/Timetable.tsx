import { useState } from "react";
import type { School, SchoolTimetable, TimetableBreak, TimetableConfig, TimetableDefault, TimetableVersion } from "../types";

export const DEFAULT_TIMETABLE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const ALL_WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function computeSlotTimes(config: TimetableConfig): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  let cursor = config.startTime;
  for (let i = 0; i < config.sessionsPerDay; i++) {
    const start = cursor;
    const end = addMinutes(cursor, config.sessionMinutes);
    slots.push({ start, end });
    cursor = end;
    const brk = config.breaks.find((b) => b.afterSlot === i);
    if (brk) cursor = addMinutes(cursor, brk.durationMinutes);
  }
  return slots;
}

export function PublishedTimetableView({ school }: { school: School }) {
  const timetable = school.timetable;
  const [selectedClassId, setSelectedClassId] = useState<string>(() => school.classes[0]?.id ?? "");

  if (!timetable?.publishedVersionId) return null;
  const version = (timetable.versions ?? []).find((v) => v.id === timetable.publishedVersionId);
  if (!version) return null;

  const { config, entries } = version;
  const slotTimes = computeSlotTimes(config);
  const getEntry = (classId: string, day: string, slot: number) =>
    entries.find((e) => e.classId === classId && e.day === day && e.slot === slot);

  return (
    <div className="pub-timetable-wrap">
      <div className="pub-timetable-header">
        <h2>Timetable</h2>
        <p className="pub-timetable-version">{version.name}</p>
      </div>
      {school.classes.length > 1 ? (
        <div className="pub-timetable-class-tabs">
          {school.classes.map((cls) => (
            <button
              key={cls.id}
              type="button"
              className={`pub-timetable-class-btn${selectedClassId === cls.id ? " active" : ""}`}
              onClick={() => setSelectedClassId(cls.id)}
            >
              {cls.name}
            </button>
          ))}
        </div>
      ) : null}
      {selectedClassId ? (
        <div className="pub-timetable-scroll">
          <div className="pub-timetable-grid" style={{ "--tt-days": config.days.length } as React.CSSProperties}>
            <div className="pub-timetable-cell pub-timetable-corner" />
            {config.days.map((day) => (
              <div key={day} className="pub-timetable-cell pub-timetable-day-header">{day}</div>
            ))}
            {slotTimes.map((slot, slotIndex) => (
              <>
                {config.breaks.filter((b) => b.afterSlot === slotIndex - 1).map((brk) => (
                  <>
                    <div key={`bl-${brk.id}`} className="pub-timetable-cell pub-timetable-break-label">{brk.name}</div>
                    {config.days.map((day) => (
                      <div key={`bc-${brk.id}-${day}`} className="pub-timetable-cell pub-timetable-break-cell" />
                    ))}
                  </>
                ))}
                <div key={`t-${slotIndex}`} className="pub-timetable-cell pub-timetable-time">
                  <span>{slot.start}</span>
                  <span className="pub-timetable-time-end">{slot.end}</span>
                </div>
                {config.days.map((day) => {
                  const entry = getEntry(selectedClassId, day, slotIndex);
                  const subj = entry ? school.subjects.find((s) => s.id === entry.subjectId) : null;
                  return (
                    <div key={`s-${slotIndex}-${day}`} className="pub-timetable-cell pub-timetable-slot">
                      {subj ? (
                        <span className="pub-timetable-subject" style={{ "--chip-color": subj.color } as React.CSSProperties}>
                          {subj.abbreviation ?? subj.name}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TimetablePage({ school, onChange }: { school: School; onChange: (timetable: SchoolTimetable) => void }) {
  const [activeTab, setActiveTab] = useState<"setup" | "defaults" | "periods" | "schedule" | "versions">("setup");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [defaultScopeId, setDefaultScopeId] = useState<string>("school");
  const [dragItem, setDragItem] = useState<{ classId: string; subjectId: string } | null>(null);
  const [newVersionName, setNewVersionName] = useState("");

  const timetable: SchoolTimetable = school.timetable ?? {
    config: {
      days: DEFAULT_TIMETABLE_DAYS,
      startTime: "08:00",
      sessionMinutes: 45,
      sessionsPerDay: 8,
      breaks: [
        { id: "brk-1", name: "Morning break", afterSlot: 2, durationMinutes: 15 },
        { id: "brk-2", name: "Lunch", afterSlot: 5, durationMinutes: 30 },
      ],
    },
    periodTargets: [],
    entries: [],
  };

  const updateConfig = (patch: Partial<TimetableConfig>) =>
    onChange({ ...timetable, config: { ...timetable.config, ...patch } });

  const updateBreak = (id: string, patch: Partial<TimetableBreak>) =>
    updateConfig({ breaks: timetable.config.breaks.map((b) => b.id === id ? { ...b, ...patch } : b) });

  const addBreak = () =>
    updateConfig({ breaks: [...timetable.config.breaks, { id: `brk-${Date.now()}`, name: "Break", afterSlot: 0, durationMinutes: 15 }] });

  const removeBreak = (id: string) =>
    updateConfig({ breaks: timetable.config.breaks.filter((b) => b.id !== id) });

  const getPeriodTarget = (classId: string, subjectId: string) =>
    timetable.periodTargets.find((t) => t.classId === classId && t.subjectId === subjectId)?.periodsPerWeek ?? 0;

  const setPeriodTarget = (classId: string, subjectId: string, periodsPerWeek: number) => {
    const existing = timetable.periodTargets.filter((t) => !(t.classId === classId && t.subjectId === subjectId));
    const next = periodsPerWeek > 0 ? [...existing, { classId, subjectId, periodsPerWeek }] : existing;
    onChange({ ...timetable, periodTargets: next });
  };

  const getPlacedCount = (classId: string, subjectId: string) =>
    timetable.entries.filter((e) => e.classId === classId && e.subjectId === subjectId).length;

  const getCellEntry = (classId: string, day: string, slot: number) =>
    timetable.entries.find((e) => e.classId === classId && e.day === day && e.slot === slot);

  const placeEntry = (classId: string, subjectId: string, day: string, slot: number) => {
    const existing = getCellEntry(classId, day, slot);
    if (existing) {
      if (existing.subjectId === subjectId) return;
      const filtered = timetable.entries.filter((e) => !(e.classId === classId && e.day === day && e.slot === slot));
      onChange({ ...timetable, entries: [...filtered, { id: `entry-${Date.now()}`, classId, subjectId, day, slot }] });
    } else {
      onChange({ ...timetable, entries: [...timetable.entries, { id: `entry-${Date.now()}`, classId, subjectId, day, slot }] });
    }
  };

  const removeEntry = (classId: string, day: string, slot: number) =>
    onChange({ ...timetable, entries: timetable.entries.filter((e) => !(e.classId === classId && e.day === day && e.slot === slot)) });

  const defaults = timetable.defaults ?? [];

  const getDefault = (subjectId: string, gradeLevelId?: string): number => {
    if (gradeLevelId) {
      const gradeDefault = defaults.find((d) => d.subjectId === subjectId && d.gradeLevelId === gradeLevelId);
      if (gradeDefault) return gradeDefault.periodsPerWeek;
    }
    return defaults.find((d) => d.subjectId === subjectId && !d.gradeLevelId)?.periodsPerWeek ?? 0;
  };

  const setDefault = (subjectId: string, gradeLevelId: string | undefined, periodsPerWeek: number) => {
    const next = defaults.filter((d) => !(d.subjectId === subjectId && d.gradeLevelId === gradeLevelId));
    const updated: TimetableDefault[] = periodsPerWeek > 0 ? [...next, { subjectId, gradeLevelId, periodsPerWeek }] : next;
    onChange({ ...timetable, defaults: updated });
  };

  const applyDefaults = () => {
    const gradeLevels = school.gradeLevels ?? [];
    let nextTargets = [...timetable.periodTargets];
    for (const cls of school.classes) {
      const gradeLevel = gradeLevels.find((g) => g.id === cls.gradeLevelId);
      for (const subj of school.subjects) {
        const effective = getDefault(subj.id, gradeLevel?.id);
        if (effective > 0) {
          nextTargets = nextTargets.filter((t) => !(t.classId === cls.id && t.subjectId === subj.id));
          nextTargets.push({ classId: cls.id, subjectId: subj.id, periodsPerWeek: effective });
        }
      }
    }
    onChange({ ...timetable, periodTargets: nextTargets });
  };

  const versions = timetable.versions ?? [];
  const publishedVersionId = timetable.publishedVersionId;

  const saveVersion = () => {
    const name = newVersionName.trim() || `Version ${versions.length + 1}`;
    const version: TimetableVersion = {
      id: `v-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      config: timetable.config,
      periodTargets: timetable.periodTargets,
      entries: timetable.entries,
    };
    onChange({ ...timetable, versions: [...versions, version] });
    setNewVersionName("");
  };

  const publishVersion = (versionId: string) =>
    onChange({ ...timetable, publishedVersionId: versionId });

  const unpublishVersion = () =>
    onChange({ ...timetable, publishedVersionId: undefined });

  const restoreVersion = (version: TimetableVersion) =>
    onChange({
      ...timetable,
      config: version.config,
      periodTargets: version.periodTargets,
      entries: version.entries,
    });

  const deleteVersion = (versionId: string) => {
    const next = versions.filter((v) => v.id !== versionId);
    onChange({
      ...timetable,
      versions: next,
      publishedVersionId: publishedVersionId === versionId ? undefined : publishedVersionId,
    });
  };

  const { config } = timetable;
  const slotTimes = computeSlotTimes(config);

  const unscheduledLessons: Array<{ classId: string; subjectId: string; remaining: number }> = [];
  if (selectedClassId) {
    for (const subj of school.subjects) {
      const target = getPeriodTarget(selectedClassId, subj.id);
      if (target > 0) {
        const placed = getPlacedCount(selectedClassId, subj.id);
        const remaining = target - placed;
        if (remaining > 0) {
          unscheduledLessons.push({ classId: selectedClassId, subjectId: subj.id, remaining });
        }
      }
    }
  }

  return (
    <>
      <nav className="school-work-overview-menu" style={{ marginBottom: 16 }}>
        <button className={activeTab === "setup" ? "active-school-work-overview-menu-item" : ""} type="button" onClick={() => setActiveTab("setup")}>Grid setup</button>
        <button className={activeTab === "defaults" ? "active-school-work-overview-menu-item" : ""} type="button" onClick={() => setActiveTab("defaults")}>Defaults</button>
        <button className={activeTab === "periods" ? "active-school-work-overview-menu-item" : ""} type="button" onClick={() => setActiveTab("periods")}>Periods</button>
        <button className={activeTab === "schedule" ? "active-school-work-overview-menu-item" : ""} type="button" onClick={() => setActiveTab("schedule")}>Schedule</button>
        <button className={activeTab === "versions" ? "active-school-work-overview-menu-item" : ""} type="button" onClick={() => setActiveTab("versions")}>
          Versions
          {publishedVersionId ? <span className="timetable-versions-live-dot" /> : null}
        </button>
      </nav>

      {activeTab === "setup" ? (
        <div className="nested-editor-grid">
          <section className="sub-editor-panel">
            <h3>Days</h3>
            <div className="timetable-days-grid">
              {ALL_WEEK_DAYS.map((day) => (
                <label key={day} className="timetable-day-label">
                  <input
                    type="checkbox"
                    checked={config.days.includes(day)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...config.days, day].sort((a, b) => ALL_WEEK_DAYS.indexOf(a) - ALL_WEEK_DAYS.indexOf(b)) : config.days.filter((d) => d !== day);
                      updateConfig({ days: next });
                    }}
                  />
                  {day}
                </label>
              ))}
            </div>
          </section>

          <section className="sub-editor-panel">
            <h3>Session timing</h3>
            <div className="timetable-timing-grid">
              <label className="field-label">
                Start time
                <input type="time" value={config.startTime} onChange={(e) => updateConfig({ startTime: e.target.value })} className="timetable-time-input" />
              </label>
              <label className="field-label">
                Session length (minutes)
                <input type="number" min="5" max="120" value={config.sessionMinutes} onChange={(e) => updateConfig({ sessionMinutes: Math.max(5, parseInt(e.target.value) || 45) })} className="timetable-number-input" />
              </label>
              <label className="field-label">
                Sessions per day
                <input type="number" min="1" max="20" value={config.sessionsPerDay} onChange={(e) => updateConfig({ sessionsPerDay: Math.max(1, parseInt(e.target.value) || 8) })} className="timetable-number-input" />
              </label>
            </div>
          </section>

          <section className="sub-editor-panel">
            <h3>Breaks</h3>
            <button className="secondary-action repeater-add-button" type="button" onClick={addBreak}>Add break</button>
            {config.breaks.length === 0 ? (
              <p className="editor-helper-text">No breaks configured.</p>
            ) : config.breaks.map((brk) => (
              <div key={brk.id} className="timetable-break-row">
                <label className="field-label">
                  Name
                  <input value={brk.name} onChange={(e) => updateBreak(brk.id, { name: e.target.value })} />
                </label>
                <label className="field-label">
                  After slot
                  <select value={brk.afterSlot} onChange={(e) => updateBreak(brk.id, { afterSlot: parseInt(e.target.value) })}>
                    {Array.from({ length: config.sessionsPerDay - 1 }, (_, i) => (
                      <option key={i} value={i}>After slot {i + 1} ({slotTimes[i]?.end ?? ""})</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Duration (min)
                  <input type="number" min="5" max="120" value={brk.durationMinutes} onChange={(e) => updateBreak(brk.id, { durationMinutes: Math.max(5, parseInt(e.target.value) || 15) })} className="timetable-number-input" />
                </label>
                <button className="remove-button" type="button" onClick={() => removeBreak(brk.id)}>Remove</button>
              </div>
            ))}
          </section>

          <section className="sub-editor-panel">
            <h3>Preview</h3>
            <div className="timetable-preview-list">
              {slotTimes.map((slot, i) => (
                <>
                  <div key={i} className="timetable-preview-slot">
                    <span className="timetable-preview-num">Slot {i + 1}</span>
                    <span>{slot.start} – {slot.end}</span>
                  </div>
                  {config.breaks.filter((b) => b.afterSlot === i).map((b) => (
                    <div key={b.id} className="timetable-preview-break">
                      {b.name} — {b.durationMinutes} min
                    </div>
                  ))}
                </>
              ))}
            </div>
          </section>
        </div>
      ) : activeTab === "defaults" ? (
        <div className="nested-editor-grid">
          <section className="sub-editor-panel">
            <h3>Scope</h3>
            <div className="timetable-class-tabs">
              <button
                type="button"
                className={defaultScopeId === "school" ? "active-school-work-overview-menu-item" : "timetable-class-tab"}
                onClick={() => setDefaultScopeId("school")}
              >
                School-wide
              </button>
              {(school.gradeLevels ?? []).map((gl) => (
                <button
                  key={gl.id}
                  type="button"
                  className={defaultScopeId === gl.id ? "active-school-work-overview-menu-item" : "timetable-class-tab"}
                  onClick={() => setDefaultScopeId(gl.id)}
                >
                  {gl.grade} {gl.year}
                </button>
              ))}
            </div>
          </section>
          <section className="sub-editor-panel">
            <div className="timetable-defaults-header">
              <h3>
                {defaultScopeId === "school"
                  ? "School-wide defaults"
                  : (() => {
                      const gl = (school.gradeLevels ?? []).find((g) => g.id === defaultScopeId);
                      return gl ? `Defaults for ${gl.grade} ${gl.year}` : "Grade defaults";
                    })()}
              </h3>
              <p className="editor-helper-text">
                {defaultScopeId === "school"
                  ? "These apply to all classes unless a grade-level default overrides them."
                  : "These override school-wide defaults for classes in this grade."}
              </p>
            </div>
            {school.subjects.length === 0 ? (
              <p className="editor-helper-text">No subjects yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Periods / week</th>
                  </tr>
                </thead>
                <tbody>
                  {school.subjects.map((subj) => {
                    const scopeGradeId = defaultScopeId === "school" ? undefined : defaultScopeId;
                    const value = scopeGradeId
                      ? (defaults.find((d) => d.subjectId === subj.id && d.gradeLevelId === scopeGradeId)?.periodsPerWeek ?? 0)
                      : (defaults.find((d) => d.subjectId === subj.id && !d.gradeLevelId)?.periodsPerWeek ?? 0);
                    return (
                      <tr key={subj.id}>
                        <td>
                          <span className="timetable-subject-dot" style={{ background: subj.color }} />
                          {subj.name}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={value === 0 ? "" : value}
                            placeholder="0"
                            className="timetable-number-input"
                            onChange={(e) => setDefault(subj.id, scopeGradeId, Math.max(0, parseInt(e.target.value) || 0))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="timetable-defaults-apply-row">
              <button className="primary-action" type="button" onClick={applyDefaults}>
                Apply defaults to all classes
              </button>
              <span className="editor-helper-text">Overwrites existing period targets for all classes.</span>
            </div>
          </section>
        </div>
      ) : activeTab === "periods" ? (
        <div className="nested-editor-grid">
          <section className="sub-editor-panel">
            <h3>Class</h3>
            <div className="timetable-class-tabs">
              {school.classes.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  className={selectedClassId === cls.id ? "active-school-work-overview-menu-item" : "timetable-class-tab"}
                  onClick={() => setSelectedClassId(cls.id)}
                >
                  {cls.name}
                </button>
              ))}
              {school.classes.length === 0 ? <p className="editor-helper-text">No classes found.</p> : null}
            </div>
          </section>

          {selectedClassId ? (
            <section className="sub-editor-panel">
              <h3>Periods per week — {school.classes.find((c) => c.id === selectedClassId)?.name}</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Periods / week</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {school.subjects.map((subj) => {
                    const target = getPeriodTarget(selectedClassId, subj.id);
                    const placed = getPlacedCount(selectedClassId, subj.id);
                    return (
                      <tr key={subj.id}>
                        <td>
                          <span className="timetable-subject-dot" style={{ background: subj.color }} />
                          {subj.name}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={target === 0 ? "" : target}
                            placeholder="0"
                            className="timetable-number-input"
                            onChange={(e) => setPeriodTarget(selectedClassId, subj.id, Math.max(0, parseInt(e.target.value) || 0))}
                          />
                        </td>
                        <td className={placed > target && target > 0 ? "timetable-over-placed" : placed === target && target > 0 ? "timetable-fully-placed" : ""}>
                          {target > 0 ? `${placed} / ${target}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      ) : activeTab === "schedule" ? (
        <div className="timetable-schedule-shell">
          <div className="timetable-class-bar">
            {school.classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className={selectedClassId === cls.id ? "active-school-work-overview-menu-item" : "timetable-class-tab"}
                onClick={() => setSelectedClassId(cls.id)}
              >
                {cls.name}
              </button>
            ))}
          </div>

          {!selectedClassId ? (
            <div className="empty-editor-state"><h3>Select a class</h3><p>Choose a class above to view and edit its timetable.</p></div>
          ) : (
            <div className="timetable-schedule-layout">
              <div className="timetable-lesson-panel">
                <p className="timetable-lesson-panel-title">Unscheduled</p>
                {unscheduledLessons.length === 0 ? (
                  <p className="timetable-lesson-panel-empty">All lessons placed</p>
                ) : unscheduledLessons.map(({ classId, subjectId, remaining }) => {
                  const subj = school.subjects.find((s) => s.id === subjectId);
                  return Array.from({ length: remaining }, (_, i) => (
                    <div
                      key={`${subjectId}-${i}`}
                      className="timetable-lesson-chip"
                      style={{ "--chip-color": subj?.color ?? "#1f6857" } as React.CSSProperties}
                      draggable
                      onDragStart={() => setDragItem({ classId, subjectId })}
                      onDragEnd={() => setDragItem(null)}
                    >
                      {subj?.abbreviation ?? subj?.name ?? "?"}
                    </div>
                  ));
                })}
                <p className="timetable-lesson-panel-title" style={{ marginTop: 12 }}>Placed</p>
                {school.subjects.filter((subj) => getPlacedCount(selectedClassId, subj.id) > 0).map((subj) => {
                  const placed = getPlacedCount(selectedClassId, subj.id);
                  const target = getPeriodTarget(selectedClassId, subj.id);
                  return (
                    <div key={subj.id} className="timetable-placed-summary" style={{ "--chip-color": subj.color ?? "#1f6857" } as React.CSSProperties}>
                      <span className="timetable-placed-dot" />
                      <span>{subj.name}</span>
                      <span className="timetable-placed-count">{placed}{target > 0 ? ` / ${target}` : ""}</span>
                    </div>
                  );
                })}
              </div>

              <div className="timetable-grid-wrap">
                <div className="timetable-grid" style={{ "--tt-days": config.days.length } as React.CSSProperties}>
                  <div className="timetable-cell timetable-header-time" />
                  {config.days.map((day) => (
                    <div key={day} className="timetable-cell timetable-header-day">{day}</div>
                  ))}

                  {slotTimes.map((slot, slotIndex) => (
                    <>
                      {config.breaks.filter((b) => b.afterSlot === slotIndex - 1).map((brk) => (
                        <>
                          <div key={`break-label-${brk.id}`} className="timetable-cell timetable-break-label">{brk.name} ({brk.durationMinutes}m)</div>
                          {config.days.map((day) => (
                            <div key={`break-cell-${brk.id}-${day}`} className="timetable-cell timetable-break-cell" />
                          ))}
                        </>
                      ))}

                      <div key={`time-${slotIndex}`} className="timetable-cell timetable-time-label">
                        <span>{slot.start}</span>
                        <span className="timetable-time-end">{slot.end}</span>
                      </div>
                      {config.days.map((day) => {
                        const entry = getCellEntry(selectedClassId, day, slotIndex);
                        const subj = entry ? school.subjects.find((s) => s.id === entry.subjectId) : null;
                        return (
                          <div
                            key={`slot-${slotIndex}-${day}`}
                            className={`timetable-cell timetable-slot-cell${dragItem ? " timetable-slot-cell--droppable" : ""}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragItem) placeEntry(dragItem.classId, dragItem.subjectId, day, slotIndex);
                              setDragItem(null);
                            }}
                          >
                            {entry && subj ? (
                              <div
                                className="timetable-placed-chip"
                                style={{ "--chip-color": subj.color ?? "#1f6857" } as React.CSSProperties}
                                title={`${subj.name} — click to remove`}
                                onClick={() => removeEntry(selectedClassId, day, slotIndex)}
                                draggable
                                onDragStart={() => { removeEntry(selectedClassId, day, slotIndex); setDragItem({ classId: selectedClassId, subjectId: entry.subjectId }); }}
                                onDragEnd={() => setDragItem(null)}
                              >
                                {subj.abbreviation ?? subj.name}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="nested-editor-grid">
          <section className="sub-editor-panel">
            <h3>Save current draft as version</h3>
            <p className="editor-helper-text">Saving a version creates a snapshot of the current timetable. You can publish it to the website or restore it later.</p>
            <div className="timetable-version-save-row">
              <input
                type="text"
                className="text-input"
                placeholder={`Version ${versions.length + 1}`}
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
              />
              <button className="primary-action" type="button" onClick={saveVersion}>
                Save version
              </button>
            </div>
          </section>

          <section className="sub-editor-panel">
            <div className="timetable-defaults-header">
              <h3>Versions</h3>
              {publishedVersionId ? (
                <p className="editor-helper-text">
                  One version is currently live on the website.{" "}
                  <button type="button" className="timetable-unpublish-link" onClick={unpublishVersion}>Unpublish</button>
                </p>
              ) : (
                <p className="editor-helper-text">No version is published yet. Publish one to show the timetable on the school website.</p>
              )}
            </div>
            {versions.length === 0 ? (
              <p className="editor-helper-text">No saved versions yet.</p>
            ) : (
              <div className="timetable-version-list">
                {[...versions].reverse().map((version) => {
                  const isPublished = version.id === publishedVersionId;
                  return (
                    <div key={version.id} className={`timetable-version-row${isPublished ? " timetable-version-row--published" : ""}`}>
                      <div className="timetable-version-info">
                        <span className="timetable-version-name">{version.name}</span>
                        <span className="timetable-version-meta">
                          {new Date(version.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {isPublished ? <span className="timetable-published-badge">Live</span> : null}
                        </span>
                      </div>
                      <div className="timetable-version-actions">
                        {!isPublished ? (
                          <button className="secondary-action" type="button" onClick={() => publishVersion(version.id)}>
                            Publish
                          </button>
                        ) : null}
                        <button className="secondary-action" type="button" onClick={() => restoreVersion(version)}>
                          Restore
                        </button>
                        <button className="remove-button" type="button" onClick={() => deleteVersion(version.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
