import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Image,
  Link2,
  Paperclip,
  Plus,
  Save,
  School as SchoolIcon,
  Search,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faCalendarDays,
  faChartLine,
  faClipboardCheck,
  faMessage,
  faRulerCombined,
  faScaleBalanced,
  faTags,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { navigate } from "../lib/navigate";
import {
  mergeUnique,
  parsePercentageInput,
  formatDate,
  formatDateTime,
  formatDateTimeWithSeconds,
  formatDuration,
  formatLastActive,
  formatAssessmentScaleSummary,
  formatSchoolWorkClassTitle,
  getProctorEventLabel,
  getCursorOutsideSessions,
  getTestTimerLabel,
  formatAssessmentDate,
  getAssessmentDueDate,
  getTextExcerpt,
} from "../lib/utils";
import { SchoolWorkAccessLevel, getEffectiveRemarkCategories, REMARK_PARENTS } from "../lib/staffUtils";
import {
  AdminCardTitle,
  CheckboxInput,
  CheckboxGroup,
  DateInput,
  EditorPanel,
  ImageUpload,
  RegistrationModal,
  RichTextEditor,
  SelectInput,
  TextArea,
  TextInput,
  prepareImageUpload,
} from "./ui";
import { slugifySchoolName } from "../lib/schools";
import type {
  Assessment,
  AssessmentGrade,
  AssessmentScale,
  ClassGroup,
  CourseMaterial,
  Guardian,
  Remark,
  RemarkCategory,
  ResourceFolder,
  SchoolRemarkSettings,
  SchoolWorkSettings,
  Student,
  Subject,
  SubjectClass,
  SubjectClassAnnouncement,
  SubjectResource,
  SubmissionFile,
  TestQuestion,
  TestQuestionOption,
  TestSubmission,
  Topic,
} from "../types";

const MAX_FILE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_FILE_UPLOAD_LABEL = "5MB";
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const ACCEPTED_FILE_MIME_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];

function renderAssessmentScaleFields(scale: AssessmentScale, update: (scale: AssessmentScale) => void) {
  return (
    <>
      <div className="scale-heading">
        <TextInput label="Scale name" value={scale.name} onChange={(name) => update({ ...scale, name })} />
        <TextInput label="Scale id" value={scale.id} onChange={(id) => update({ ...scale, id: slugifySchoolName(id) })} />
      </div>
      <div className="assessment-level-list">
        {scale.levels.map((level, levelIndex) => {
          const isRequiredLevel = level.id === "excused" || level.id === "assessed";
          return (
            <div className="assessment-level-row" key={level.id}>
              <TextInput
                label="Value"
                value={level.value}
                onChange={(value) => update({ ...scale, levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, value } : item) })}
              />
              <TextInput
                label="Minimum %"
                value={String(level.minPercentage ?? 0)}
                onChange={(minPercentage) => update({ ...scale, levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, minPercentage: parsePercentageInput(minPercentage) } : item) })}
              />
              <TextInput
                label="Description"
                value={level.description ?? ""}
                onChange={(description) => update({ ...scale, levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, description } : item) })}
              />
              {isRequiredLevel ? <span className="required-scale-level-label">Required</span> : (
                <button
                  className="remove-button"
                  type="button"
                  onClick={() => update({ ...scale, levels: scale.levels.filter((_, index) => index !== levelIndex) })}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        className="secondary-action"
        type="button"
        onClick={() => update({ ...scale, levels: [...scale.levels.slice(0, -2), { id: `level-${Date.now()}`, value: "", minPercentage: 0, description: "" }, ...scale.levels.slice(-2)] })}
      >
        Add level
      </button>
    </>
  );
}

export function SchoolWorkOverview({
  subjectClasses,
  subjects,
  classes,
  students,
  role,
  participantLabel,
  remarks = [],
  remarkSettings,
  globalRemarkCategories = [],
  schoolWorkSettings,
  globalAssessmentScales = [],
  onOpen,
  onRemarksChange,
  onStudentChange,
  onSchoolWorkSettingsChange,
}: {
  subjectClasses: SubjectClass[];
  subjects: Subject[];
  classes: ClassGroup[];
  students: Student[];
  role?: SchoolWorkAccessLevel;
  participantLabel?: string;
  remarks?: Remark[];
  remarkSettings?: SchoolRemarkSettings;
  globalRemarkCategories?: RemarkCategory[];
  schoolWorkSettings?: SchoolWorkSettings;
  globalAssessmentScales?: AssessmentScale[];
  onOpen: (subjectClassId: string) => void;
  onRemarksChange?: (remarks: Remark[]) => void;
  onStudentChange?: (student: Student) => void;
  onSchoolWorkSettingsChange?: (settings: SchoolWorkSettings) => void;
}) {
  const [activeOverviewMenu, setActiveOverviewMenu] = useState<"subjects" | "contactTeacher" | "admin">("subjects");
  const [contactTeacherClassId, setContactTeacherClassId] = useState<string | null>(() => localStorage.getItem("edulink-contact-class"));
  const [scalePreviewId, setScalePreviewId] = useState<string | null>(null);

  const selectContactClass = (id: string | null) => {
    setContactTeacherClassId(id);
    if (id) localStorage.setItem("edulink-contact-class", id);
  };
  const [contactInfoMode, setContactInfoMode] = useState<"contact" | "remarks" | "gpa">("contact");
  const [contactStudentId, setContactStudentId] = useState<string | null>(null);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [guardianDraft, setGuardianDraft] = useState<Partial<Guardian>>({});
  const canViewContactTeacherClasses = role === "admin" || role === "teacher";
  const contactTeacherClasses = canViewContactTeacherClasses
    ? classes.filter((classGroup) => {
      if (!classGroup.teacher) return false;
      return role === "admin" || classGroup.teacher === participantLabel;
    })
    : [];
  const effectiveRemarkCategories = getEffectiveRemarkCategories(globalRemarkCategories, remarkSettings);

  const overviewMenu = canViewContactTeacherClasses ? (
    <nav className="school-work-overview-menu" aria-label="School work overview sections">
      <button
        className={activeOverviewMenu === "subjects" ? "active-school-work-overview-menu-item" : ""}
        type="button"
        onClick={() => { setActiveOverviewMenu("subjects"); setContactTeacherClassId(null); }}
      >
        Subject classes
      </button>
      <button
        className={activeOverviewMenu === "contactTeacher" ? "active-school-work-overview-menu-item" : ""}
        type="button"
        onClick={() => setActiveOverviewMenu("contactTeacher")}
      >
        Contact teacher
      </button>
      {role === "admin" ? (
        <button
          className={activeOverviewMenu === "admin" ? "active-school-work-overview-menu-item" : ""}
          type="button"
          onClick={() => { setActiveOverviewMenu("admin"); setContactTeacherClassId(null); }}
        >
          Admin
        </button>
      ) : null}
    </nav>
  ) : null;

  if (activeOverviewMenu === "admin" && role === "admin") {
    const effectiveSettings: SchoolWorkSettings = schoolWorkSettings ?? {
      enabledGlobalAssessmentScaleIds: globalAssessmentScales.map((s) => s.id),
      knownGlobalAssessmentScaleIds: globalAssessmentScales.map((s) => s.id),
      customAssessmentScales: [],
    };
    const allScalesForPreview = [...globalAssessmentScales, ...effectiveSettings.customAssessmentScales];
    const previewScale = scalePreviewId ? allScalesForPreview.find((s) => s.id === scalePreviewId) : null;
    return (
      <div className="school-work-overview">
        {overviewMenu}
        {previewScale ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setScalePreviewId(null)}>
            <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="scale-preview-title" onClick={(e) => e.stopPropagation()}>
              <div className="staff-modal-header">
                <h2 id="scale-preview-title">{previewScale.name}</h2>
                <button className="staff-modal-close" type="button" aria-label="Close" onClick={() => setScalePreviewId(null)}>×</button>
              </div>
              <div className="staff-modal-body">
                <div className="scale-preview-levels">
                  {previewScale.levels.map((level) => (
                    <div key={level.id} className="scale-preview-level-row">
                      <span className="scale-preview-level-value">{level.value}</span>
                      <span className="scale-preview-level-pct">≥ {level.minPercentage}%</span>
                      {level.description ? <span className="scale-preview-level-desc">{level.description}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}
        <div className="nested-editor-grid">
          <section className="sub-editor-panel">
            <h3>Assessment scales</h3>
            <div className="assessment-scale-toggle-list">
              {globalAssessmentScales.map((scale) => (
                <div className="assessment-scale-toggle" key={scale.id}>
                  <div className="assessment-scale-toggle-info">
                    <strong>{scale.name}</strong>
                    <small>{scale.levels.length} level{scale.levels.length === 1 ? "" : "s"}</small>
                    <button
                      className="scale-view-levels-btn"
                      type="button"
                      onClick={() => setScalePreviewId(scale.id)}
                    >
                      View levels
                    </button>
                  </div>
                  <CheckboxInput
                    label="Enabled"
                    checked={effectiveSettings.enabledGlobalAssessmentScaleIds.includes(scale.id)}
                    onChange={(checked) => onSchoolWorkSettingsChange?.({
                      ...effectiveSettings,
                      knownGlobalAssessmentScaleIds: globalAssessmentScales.map((item) => item.id),
                      enabledGlobalAssessmentScaleIds: checked
                        ? mergeUnique([...effectiveSettings.enabledGlobalAssessmentScaleIds, scale.id])
                        : effectiveSettings.enabledGlobalAssessmentScaleIds.filter((id) => id !== scale.id),
                    })}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="sub-editor-panel">
            <h3>Teacher permissions</h3>
            <label className="login-format-option">
              <div>
                <strong>Allow teachers to create custom assessment scales</strong>
                <small>When disabled, only admins can create assessment scales. Teachers can still use enabled global and school-level scales.</small>
              </div>
              <CheckboxInput
                label="Allowed"
                checked={!effectiveSettings.disableTeacherCustomScales}
                onChange={(checked) => onSchoolWorkSettingsChange?.({ ...effectiveSettings, disableTeacherCustomScales: !checked })}
              />
            </label>
          </section>

          <section className="sub-editor-panel">
            <h3>Custom assessment scales</h3>
            <div className="scale-editor-list">
              <button
                className="secondary-action repeater-add-button"
                type="button"
                onClick={() => onSchoolWorkSettingsChange?.({
                  ...effectiveSettings,
                  customAssessmentScales: [...effectiveSettings.customAssessmentScales, createCustomAssessmentScale()],
                })}
              >
                Add school assessment scale
              </button>
              {effectiveSettings.customAssessmentScales.length === 0 ? (
                <div className="empty-editor-state">
                  <h3>No school-specific scales yet</h3>
                  <p>Create a custom scale here if this school should use something besides the enabled global scales.</p>
                </div>
              ) : effectiveSettings.customAssessmentScales.map((scale, scaleIndex) => (
                <section className="sub-editor-panel assessment-scale-panel" key={scale.id}>
                  {renderAssessmentScaleFields(scale, (nextScale) => onSchoolWorkSettingsChange?.({
                    ...effectiveSettings,
                    customAssessmentScales: effectiveSettings.customAssessmentScales.map((item, index) => index === scaleIndex ? nextScale : item),
                  }))}
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => onSchoolWorkSettingsChange?.({
                      ...effectiveSettings,
                      customAssessmentScales: effectiveSettings.customAssessmentScales.filter((_, index) => index !== scaleIndex),
                    })}
                  >
                    Remove scale
                  </button>
                </section>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (activeOverviewMenu === "contactTeacher" && canViewContactTeacherClasses) {
    const effectiveContactClassId = contactTeacherClassId ?? (contactTeacherClasses.length === 1 ? contactTeacherClasses[0].id : null);
    const selectedClass = effectiveContactClassId ? contactTeacherClasses.find((c) => c.id === effectiveContactClassId) : null;
    const formatClassName = (name: string) => name.replace(/^Grade\s+/i, "Class ");
    const contactTeacherClassTabNav = contactTeacherClasses.length > 1 ? (
      <nav className="contact-teacher-class-tabs">
        {contactTeacherClasses.map((classGroup) => (
          <button
            key={classGroup.id}
            type="button"
            className={classGroup.id === effectiveContactClassId ? "contact-teacher-class-tab active-contact-teacher-tab" : "contact-teacher-class-tab"}
            onClick={() => { selectContactClass(classGroup.id); setContactStudentId(null); }}
          >
            {formatClassName(classGroup.name)}
          </button>
        ))}
      </nav>
    ) : null;
    if (selectedClass) {
      const classStudents = students.filter((s) => s.classId === selectedClass.id);
      const contactStudent = contactStudentId ? classStudents.find((s) => s.id === contactStudentId) : null;

      const getStudentGpa = (studentId: string) => {
        const enrolledClasses = subjectClasses.filter((sc) => sc.studentIds.includes(studentId));
        const allGrades: number[] = [];
        for (const sc of enrolledClasses) {
          for (const assessment of sc.assessments ?? []) {
            const grade = assessment.grades.find((g) => g.studentId === studentId);
            if (grade?.score !== undefined && grade.score !== "") {
              const pct = parseFloat(grade.score);
              if (!isNaN(pct)) allGrades.push(pct);
            }
          }
        }
        return allGrades.length > 0 ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length : null;
      };

      return (
        <div className="school-work-overview">
          {overviewMenu}
          {contactTeacherClassTabNav}
          <div className="status-followup-page">
            <div className="contact-teacher-class-heading">
              <div>
                <p className="eyebrow">Contact teacher</p>
                <h3>{formatClassName(selectedClass.name)}</h3>
              </div>
              <div className="contact-teacher-mode-tabs" role="group" aria-label="View mode">
                <button
                  className={contactInfoMode === "contact" ? "active-contact-mode-tab" : ""}
                  type="button"
                  onClick={() => { setContactInfoMode("contact"); setContactStudentId(null); }}
                >
                  Contact info
                </button>
                <button
                  className={contactInfoMode === "remarks" ? "active-contact-mode-tab" : ""}
                  type="button"
                  onClick={() => { setContactInfoMode("remarks"); setContactStudentId(null); }}
                >
                  Remarks
                </button>
                <button
                  className={contactInfoMode === "gpa" ? "active-contact-mode-tab" : ""}
                  type="button"
                  onClick={() => { setContactInfoMode("gpa"); setContactStudentId(null); }}
                >
                  Average GPA
                </button>
              </div>
            </div>
            {classStudents.length === 0 ? (
              <div className="empty-editor-state">
                <h3>No students in this class</h3>
              </div>
            ) : (
              <div className="contact-teacher-student-list">
                {classStudents.map((student) => {
                  const studentRemarks = remarks.filter((r) => r.studentId === student.id);
                  const gpa = getStudentGpa(student.id);
                  return (
                    <button
                      key={student.id}
                      className="contact-teacher-student-row"
                      type="button"
                      onClick={() => setContactStudentId(student.id)}
                    >
                      <span className="contact-teacher-student-name">{student.firstName} {student.lastName}</span>
                      {contactInfoMode === "remarks" ? (
                        <span className="contact-teacher-student-meta">{studentRemarks.length} remark{studentRemarks.length !== 1 ? "s" : ""}</span>
                      ) : contactInfoMode === "gpa" ? (
                        <span className="contact-teacher-student-meta">{gpa !== null ? `${gpa.toFixed(1)}%` : "No grades"}</span>
                      ) : (
                        <span className="contact-teacher-student-meta">{student.email || student.guardianEmail || "No contact on file"}</span>
                      )}
                      <ChevronRight size={16} className="contact-teacher-chevron" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {contactStudent ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setContactStudentId(null)}>
              <section
                className="staff-modal contact-teacher-student-modal"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="staff-modal-header">
                  <div>
                    <p className="eyebrow">{contactInfoMode === "contact" ? "Contact info" : contactInfoMode === "remarks" ? "Remarks" : "Average GPA"}</p>
                    <h2>{contactStudent.firstName} {contactStudent.lastName}</h2>
                  </div>
                  <button className="icon-action" type="button" onClick={() => setContactStudentId(null)} aria-label="Close">✕</button>
                </div>
                <div className="staff-modal-body">
                  {contactInfoMode === "contact" ? (
                    <div className="contact-info-grid">
                      {contactStudent.email ? <div className="contact-info-row"><span>Email</span><strong>{contactStudent.email}</strong></div> : null}
                      {contactStudent.dateOfBirth ? <div className="contact-info-row"><span>Date of birth</span><strong>{contactStudent.dateOfBirth}</strong></div> : null}
                      {contactStudent.gender ? <div className="contact-info-row"><span>Gender</span><strong>{contactStudent.gender}</strong></div> : null}
                      <div className="contact-info-section">
                        <div className="contact-guardians-header">
                          <h4>Guardians</h4>
                          {onStudentChange && editingGuardianId !== "new" ? (
                            <button className="secondary-action contact-add-guardian-btn" type="button" onClick={() => { setEditingGuardianId("new"); setGuardianDraft({}); }}>
                              <Plus size={14} /> Add guardian
                            </button>
                          ) : null}
                        </div>
                        {editingGuardianId === "new" ? (
                          <div className="contact-guardian-form">
                            <input className="inline-table-input" placeholder="Name *" value={guardianDraft.name ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, name: e.target.value }))} />
                            <input className="inline-table-input" placeholder="Relationship" value={guardianDraft.relationship ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, relationship: e.target.value }))} />
                            <input className="inline-table-input" placeholder="Phone" value={guardianDraft.phone ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, phone: e.target.value }))} />
                            <input className="inline-table-input" placeholder="Email" value={guardianDraft.email ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, email: e.target.value }))} />
                            <div className="contact-guardian-form-actions">
                              <button className="primary-action" type="button" onClick={() => {
                                if (!guardianDraft.name?.trim()) return;
                                const newGuardian: Guardian = { id: crypto.randomUUID(), name: guardianDraft.name.trim(), relationship: guardianDraft.relationship?.trim() || undefined, phone: guardianDraft.phone?.trim() || undefined, email: guardianDraft.email?.trim() || undefined };
                                onStudentChange?.({ ...contactStudent, guardians: [...(contactStudent.guardians ?? []), newGuardian] });
                                setEditingGuardianId(null);
                                setGuardianDraft({});
                              }}>Save</button>
                              <button className="remove-button" type="button" onClick={() => { setEditingGuardianId(null); setGuardianDraft({}); }}>Cancel</button>
                            </div>
                          </div>
                        ) : null}
                        {(contactStudent.guardians ?? []).length === 0 && !editingGuardianId ? (
                          <p className="contact-info-empty">No guardians on file.</p>
                        ) : (contactStudent.guardians ?? []).map((g) => (
                          <div key={g.id}>
                            {editingGuardianId === g.id ? (
                              <div className="contact-guardian-form">
                                <input className="inline-table-input" placeholder="Name *" value={guardianDraft.name ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, name: e.target.value }))} />
                                <input className="inline-table-input" placeholder="Relationship" value={guardianDraft.relationship ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, relationship: e.target.value }))} />
                                <input className="inline-table-input" placeholder="Phone" value={guardianDraft.phone ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, phone: e.target.value }))} />
                                <input className="inline-table-input" placeholder="Email" value={guardianDraft.email ?? ""} onChange={(e) => setGuardianDraft((d) => ({ ...d, email: e.target.value }))} />
                                <div className="contact-guardian-form-actions">
                                  <button className="primary-action" type="button" onClick={() => {
                                    if (!guardianDraft.name?.trim()) return;
                                    const updated: Guardian = { ...g, name: guardianDraft.name.trim(), relationship: guardianDraft.relationship?.trim() || undefined, phone: guardianDraft.phone?.trim() || undefined, email: guardianDraft.email?.trim() || undefined };
                                    onStudentChange?.({ ...contactStudent, guardians: (contactStudent.guardians ?? []).map((x) => x.id === g.id ? updated : x) });
                                    setEditingGuardianId(null);
                                    setGuardianDraft({});
                                  }}>Save</button>
                                  <button className="remove-button" type="button" onClick={() => { setEditingGuardianId(null); setGuardianDraft({}); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="contact-guardian-card">
                                <div className="contact-guardian-card-body">
                                  <strong>{g.name}</strong>
                                  {g.relationship ? <span>{g.relationship}</span> : null}
                                  {g.phone ? <span>{g.phone}</span> : null}
                                  {g.email ? <span>{g.email}</span> : null}
                                </div>
                                {onStudentChange ? (
                                  <div className="contact-guardian-card-actions">
                                    <button className="secondary-action" type="button" onClick={() => { setEditingGuardianId(g.id); setGuardianDraft({ name: g.name, relationship: g.relationship, phone: g.phone, email: g.email }); }}>Edit</button>
                                    <button className="remove-button" type="button" onClick={() => onStudentChange?.({ ...contactStudent, guardians: (contactStudent.guardians ?? []).filter((x) => x.id !== g.id) })}>Remove</button>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : contactInfoMode === "remarks" ? (
                    <div className="contact-remarks-list">
                      {remarks.filter((r) => r.studentId === contactStudent.id).length === 0 ? (
                        <p className="contact-info-empty">No remarks for this student.</p>
                      ) : (
                        remarks.filter((r) => r.studentId === contactStudent.id)
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((remark) => {
                            const cat = effectiveRemarkCategories.find((c) => c.id === remark.categoryId);
                            const sc = subjectClasses.find((c) => c.id === remark.subjectClassId);
                            const subj = sc ? subjects.find((s) => s.id === sc.subjectId) : null;
                            return (
                              <div className="remark-card" key={remark.id}>
                                <div className="remark-card-meta">
                                  {cat ? <span className="remark-category-badge">{cat.name}</span> : null}
                                  <span className="remark-source-label">{subj ? subj.name : "General"}</span>
                                  <span className="remark-time">{new Date(remark.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="remark-body">{remark.body}</p>
                              </div>
                            );
                          })
                      )}
                    </div>
                  ) : (
                    <div className="contact-gpa-list">
                      {subjectClasses.filter((sc) => sc.studentIds.includes(contactStudent.id)).length === 0 ? (
                        <p className="contact-info-empty">Student is not enrolled in any subject classes.</p>
                      ) : (
                        subjectClasses.filter((sc) => sc.studentIds.includes(contactStudent.id)).map((sc) => {
                          const subj = subjects.find((s) => s.id === sc.subjectId);
                          const graded = (sc.assessments ?? []).filter((a) => {
                            const g = a.grades.find((g) => g.studentId === contactStudent.id);
                            return g?.score !== undefined && g.score !== "";
                          });
                          const avg = graded.length > 0
                            ? graded.reduce((sum, a) => {
                              const g = a.grades.find((g) => g.studentId === contactStudent.id);
                              return sum + (parseFloat(g?.score ?? "0") || 0);
                            }, 0) / graded.length
                            : null;
                          return (
                            <div className="contact-gpa-row" key={sc.id}>
                              <span className="contact-gpa-subject">{subj?.name ?? sc.name}</span>
                              <span className="contact-gpa-value">{avg !== null ? `${avg.toFixed(1)}%` : "—"}</span>
                            </div>
                          );
                        })
                      )}
                      {(() => {
                        const gpa = getStudentGpa(contactStudent.id);
                        return gpa !== null ? (
                          <div className="contact-gpa-row contact-gpa-overall">
                            <span className="contact-gpa-subject">Overall average</span>
                            <strong className="contact-gpa-value">{gpa.toFixed(1)}%</strong>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      );
    }

    if (contactTeacherClasses.length === 0) {
      return (
        <div className="school-work-overview">
          {overviewMenu}
          <div className="empty-editor-state">
            <h3>No contact teacher classes</h3>
            <p>{role === "admin" ? "No classes have a contact teacher assigned." : "You are not assigned as contact teacher for any classes."}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="school-work-overview">
        {overviewMenu}
        <nav className="contact-teacher-class-tabs">
          {contactTeacherClasses.map((classGroup) => (
            <button
              key={classGroup.id}
              type="button"
              className={classGroup.id === contactTeacherClassId ? "contact-teacher-class-tab active-contact-teacher-tab" : "contact-teacher-class-tab"}
              onClick={() => { selectContactClass(classGroup.id); setContactStudentId(null); }}
            >
              {formatClassName(classGroup.name)}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  if (subjectClasses.length === 0) {
    return (
      <div className="school-work-overview">
        {overviewMenu}
        <div className="empty-editor-state">
          <h3>No subject classes available</h3>
          <p>Admins can access all subject classes. Teachers see subject classes where their staff email matches the assigned teacher.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="school-work-overview">
      {overviewMenu}
      <div className="school-work-card-grid">
        {subjectClasses.map((subjectClass) => {
          const subject = subjects.find((item) => item.id === subjectClass.subjectId);
          const mainClass = classes.find((item) => item.id === subjectClass.baseClassId);
          return (
            <button
              className="school-work-card"
              key={subjectClass.id}
              type="button"
              onClick={() => onOpen(subjectClass.id)}
              style={{ "--subject-card-color": subject?.color ?? "#1f6857" } as React.CSSProperties}
            >
              <AdminCardTitle icon={faBookOpen} title={subject?.name ?? subjectClass.name} />
              <span className="subject-card-teacher">
                <span className="subject-card-teacher-icon">
                  <FontAwesomeIcon icon={faUser} />
                </span>
                {subjectClass.teacherName || "No teacher assigned"}
              </span>
              <span>{mainClass ? formatSchoolWorkClassTitle(mainClass.name) : "Mixed classes"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const assessmentFormatOptions = [
  { value: "Written work", label: "Written work" },
  { value: "Quiz", label: "Quiz" },
  { value: "Project", label: "Project" },
  { value: "Oral presentation", label: "Oral presentation" },
  { value: "Practical task", label: "Practical task" },
  { value: "Portfolio", label: "Portfolio" },
];

function createAssessment(assessmentScales: AssessmentScale[], folderId?: string): Assessment {
  return {
    id: `assessment-${Date.now()}`,
    title: "New assessment",
    date: new Date().toISOString().slice(0, 10),
    dueTime: "15:00",
    requiresTurnIn: true,
    format: assessmentFormatOptions[0].value,
    scaleId: assessmentScales[0]?.id ?? "",
    ...(folderId ? { folderId } : {}),
    description: "",
    grades: [],
  };
}

function createTestResource(folderId?: string): SubjectResource {
  return {
    id: `resource-test-${Date.now()}`,
    type: "test",
    title: "New test",
    description: "",
    dueDate: new Date().toISOString().slice(0, 10),
    scaleId: "",
    gradingMode: "auto",
    publishResults: "after-review",
    lobbyEnabled: false,
    startsAt: "",
    timerMode: "none",
    timerMinutes: 45,
    timerEndsAt: "",
    autoSubmitOnTimerEnd: true,
    questions: [createTestQuestion("multiple-choice")],
    testSubmissions: [],
    createdAt: new Date().toISOString(),
    ...(folderId ? { folderId } : {}),
  };
}

function createTestQuestion(type: "multiple-choice" | "text"): NonNullable<SubjectResource["questions"]>[number] {
  return {
    id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    prompt: type === "multiple-choice" ? "New multiple choice question" : "New text question",
    marks: 1,
    allowMultipleCorrect: false,
    ...(type === "multiple-choice" ? {
      options: [
        { id: `option-${Date.now()}-1`, text: "Option 1", correct: true },
        { id: `option-${Date.now()}-2`, text: "Option 2", correct: false },
      ],
    } : {}),
  };
}

function createCustomAssessmentScale(): AssessmentScale {
  return {
    id: `custom-scale-${Date.now()}`,
    name: "New assessment scale",
    levels: [
      { id: `level-${Date.now()}-1`, value: "Excellent", minPercentage: 80 },
      { id: `level-${Date.now()}-2`, value: "Developing", minPercentage: 50 },
    ],
  };
}

function ensureAssessmentGrades(assessment: Assessment, students: Student[]) {
  const existingGrades = assessment.grades ?? [];
  return {
    ...assessment,
    grades: students.map((student) => existingGrades.find((grade) => grade.studentId === student.id) ?? { studentId: student.id }),
  };
}

function getAssessmentGradeDisplay(assessment: Assessment, scales: AssessmentScale[], studentId: string) {
  const grade = assessment.grades.find((item) => item.studentId === studentId);
  if (!grade) {
    return "-";
  }

  const scale = scales.find((item) => item.id === assessment.scaleId);
  const level = scale?.levels.find((item) => item.id === grade.levelId);
  return level?.value || "-";
}

function getStudentOverallGradeDisplay(assessments: Assessment[], scales: AssessmentScale[], studentId: string) {
  const numericGrades = assessments
    .map((assessment) => {
      const grade = assessment.grades.find((item) => item.studentId === studentId);
      const scale = scales.find((item) => item.id === assessment.scaleId);
      const level = scale?.levels.find((item) => item.id === grade?.levelId);
      const numericValue = Number(level?.value);
      return Number.isFinite(numericValue) ? numericValue : null;
    })
    .filter((value): value is number => value !== null);

  if (numericGrades.length === 0) {
    return "-";
  }

  const average = numericGrades.reduce((sum, value) => sum + value, 0) / numericGrades.length;
  return Number.isInteger(average) ? String(average) : average.toFixed(1);
}

function getTestAutoGrade(test: SubjectResource, submission: NonNullable<SubjectResource["testSubmissions"]>[number], scale?: AssessmentScale) {
  const questions = test.questions ?? [];
  const maxScore = questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
  const score = questions.reduce((sum, question) => {
    if (question.type !== "multiple-choice") {
      return sum;
    }
    const correctOptionIds = (question.options ?? []).filter((option) => option.correct).map((option) => option.id).sort();
    const answer = submission.answers[question.id];
    const answerIds = (Array.isArray(answer) ? answer : answer ? [answer] : []).sort();
    const isCorrect = correctOptionIds.length > 0 && correctOptionIds.length === answerIds.length && correctOptionIds.every((id, index) => id === answerIds[index]);
    return sum + (isCorrect ? Number(question.marks) || 0 : 0);
  }, 0);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const level = scale?.levels
    .slice()
    .sort((first, second) => second.minPercentage - first.minPercentage)
    .find((item) => percentage >= item.minPercentage);
  return { score, maxScore, percentage, level };
}

function getAssessmentStudentStatus(assessment: Assessment, grade?: AssessmentGrade) {
  if (grade?.levelId) {
    return "Graded";
  }
  if (assessment.requiresTurnIn) {
    return grade?.submitted ? "Submitted" : "Not submitted";
  }
  return "Not graded";
}

function AssessmentFields({
  assessment,
  scales,
  topics = [],
  onChange,
}: {
  assessment: Assessment;
  scales: AssessmentScale[];
  topics?: Topic[];
  onChange: (assessment: Assessment) => void;
}) {
  return (
    <>
      <TextInput label="Title" value={assessment.title} onChange={(title) => onChange({ ...assessment, title })} />
      <DateInput label={assessment.requiresTurnIn ? "Due date" : "Date"} value={assessment.date} onChange={(date) => onChange({ ...assessment, date })} />
      <CheckboxInput
        label="Students need to turn something in"
        checked={assessment.requiresTurnIn}
        onChange={(requiresTurnIn) => onChange({ ...assessment, requiresTurnIn })}
      />
      {assessment.requiresTurnIn ? (
        <label className="field-label">
          Due time
          <input type="time" value={assessment.dueTime ?? ""} onChange={(event) => onChange({ ...assessment, dueTime: event.target.value })} />
        </label>
      ) : null}
      <SelectInput
        label="Assessment format"
        value={assessment.format}
        options={assessmentFormatOptions}
        onChange={(format) => onChange({ ...assessment, format })}
      />
      <SelectInput
        label="Assessment scale"
        value={assessment.scaleId}
        options={scales.map((scale) => ({ value: scale.id, label: scale.name }))}
        onChange={(scaleId) => onChange({ ...assessment, scaleId })}
      />
      {topics.length > 0 ? (
        <div className="field-label">
          Topics
          <div className="assessment-topic-checklist">
            {topics.map((topic) => {
              const checked = (assessment.topicIds ?? []).includes(topic.id);
              return (
                <label key={topic.id} className="assessment-topic-check-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? (assessment.topicIds ?? []).filter((id) => id !== topic.id)
                        : [...(assessment.topicIds ?? []), topic.id];
                      onChange({ ...assessment, topicIds: next });
                    }}
                  />
                  {topic.name}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <CheckboxInput
        label="Hidden from students"
        checked={assessment.hidden ?? false}
        onChange={(hidden) => onChange({ ...assessment, hidden })}
      />
      <TextArea label="Description" value={assessment.description ?? ""} onChange={(description) => onChange({ ...assessment, description })} />
    </>
  );
}

function GradebookView({
  assessments,
  scales,
  students,
  onOpenAssessment,
}: {
  assessments: Assessment[];
  scales: AssessmentScale[];
  students: Student[];
  onOpenAssessment: (assessmentId: string) => void;
}) {
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const sortedAssessments = [...assessments].sort((first, second) => {
    const dateDifference = new Date(first.date).getTime() - new Date(second.date).getTime();
    return dateDifference || first.title.localeCompare(second.title);
  });
  const filteredStudents = students.filter((student) => `${student.firstName} ${student.lastName}`.toLowerCase().includes(studentSearch.trim().toLowerCase()));
  const selectedStudent = students.find((student) => student.id === selectedStudentId);

  if (selectedStudent) {
    return (
      <section className="assessment-record-page">
        <div className="assessment-record-heading">
          <div>
            <p className="eyebrow">Student grades</p>
            <h2>{selectedStudent.firstName} {selectedStudent.lastName}</h2>
          </div>
          <button className="assessment-back-link" type="button" onClick={() => setSelectedStudentId(null)}>
            <ArrowLeft size={16} />
            Back to assessment record
          </button>
        </div>
        <StudentGradebookView assessments={assessments} scales={scales} studentId={selectedStudent.id} />
      </section>
    );
  }

  return (
    <section className="assessment-record-page">
      <div className="assessment-record-heading">
        <h2>Assessment record</h2>
        <button className="icon-action assessment-record-menu-button" type="button" aria-label="Assessment record options">...</button>
      </div>
      <div className="assessment-record-search-row">
        <label className="assessment-record-search">
          <input placeholder="Search students" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
          <Search size={18} />
        </label>
      </div>
      {students.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No students in this subject class</h3>
          <p>Add students before reviewing grades.</p>
        </div>
      ) : sortedAssessments.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No assessments yet</h3>
          <p>Create assessments from Resources to build the gradebook.</p>
        </div>
      ) : (
        <>
          <div className="data-table-wrap assessment-record-table-wrap">
            <table className="data-table gradebook-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Overall average</th>
                  {sortedAssessments.map((assessment) => (
                    <th key={assessment.id}>
                      <button className="gradebook-assessment-button" type="button" onClick={() => onOpenAssessment(assessment.id)}>
                        <strong>{assessment.title}</strong>
                        <span>{formatDate(assessment.date)}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <button className="gradebook-student-button" type="button" onClick={() => setSelectedStudentId(student.id)}>
                        <strong>{student.firstName} {student.lastName}</strong>
                      </button>
                    </td>
                    <td>{getStudentOverallGradeDisplay(sortedAssessments, scales, student.id)}</td>
                    {sortedAssessments.map((assessment) => (
                      <td key={assessment.id}>
                        {getAssessmentGradeDisplay(assessment, scales, student.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function StudentGradebookView({
  assessments,
  scales,
  studentId,
}: {
  assessments: Assessment[];
  scales: AssessmentScale[];
  studentId?: string;
}) {
  const sortedAssessments = [...assessments].sort((first, second) => {
    const dateDifference = new Date(second.date).getTime() - new Date(first.date).getTime();
    return dateDifference || first.title.localeCompare(second.title);
  });

  if (!studentId) {
    return (
      <div className="empty-editor-state">
        <h3>No student selected</h3>
        <p>Sign in as a student to view grades and feedback.</p>
      </div>
    );
  }

  if (sortedAssessments.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No assessments yet</h3>
        <p>Grades and feedback will appear here when assessments are added.</p>
      </div>
    );
  }

  return (
    <section className="student-gradebook-page">
      {sortedAssessments.map((assessment) => {
        const grade = assessment.grades.find((item) => item.studentId === studentId);
        return (
          <article className="student-assessment-grade-card" key={assessment.id}>
            <div className="student-assessment-grade-heading">
              <h3>{assessment.title}</h3>
              <p>Grade: {getAssessmentGradeDisplay(assessment, scales, studentId)}</p>
              <time>Date: {formatDate(assessment.date)}</time>
            </div>
            <div className="student-assessment-feedback">
              <p><strong>Feedback:</strong> {grade?.feedback || "No feedback yet."}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AssessmentResourceDetail({
  assessment,
  scale,
  students,
  onEdit,
  onRemove,
  onGradeChange,
  mode = "grade",
  activeStudentId,
}: {
  assessment: Assessment;
  scale?: AssessmentScale;
  students: Student[];
  onEdit: () => void;
  onRemove: () => void;
  onGradeChange: (studentId: string, patch: Partial<AssessmentGrade>) => void;
  mode?: "grade" | "student-submit";
  activeStudentId?: string;
}) {
  const grades = ensureAssessmentGrades(assessment, students).grades;
  const isStudentSubmitMode = mode === "student-submit";
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(() => isStudentSubmitMode ? activeStudentId ?? students[0]?.id ?? null : null);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const selectedGrade = selectedStudent ? grades.find((grade) => grade.studentId === selectedStudent.id) ?? { studentId: selectedStudent.id } : null;
  const selectedGradeIsGraded = Boolean(selectedGrade?.levelId);
  const [draftText, setDraftText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<SubmissionFile[]>([]);
  const [studentSubmissionOpen, setStudentSubmissionOpen] = useState(false);
  const assessmentDueDate = getAssessmentDueDate(assessment);
  const submissionLocked = isStudentSubmitMode && assessment.requiresTurnIn && Boolean(assessmentDueDate && Date.now() > assessmentDueDate.getTime());

  useEffect(() => {
    setStudentSubmissionOpen(false);
    setDraftText("");
    setPendingFiles([]);
  }, [assessment.id, selectedStudentId]);

  const addSubmissionFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: SubmissionFile[] = await Promise.all(Array.from(fileList).map((file) => new Promise<SubmissionFile>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, type: file.type, dataUrl: e.target?.result as string });
      reader.readAsDataURL(file);
    })));
    setPendingFiles((current) => [...current, ...newFiles]);
  };

  const submitTurnIn = () => {
    if (!selectedStudent) return;
    if (submissionLocked) return;
    const allFiles = [...(selectedGrade?.submissionFiles ?? []), ...pendingFiles];
    onGradeChange(selectedStudent.id, {
      submitted: true,
      submissionText: draftText.trim() || selectedGrade?.submissionText,
      submissionFiles: allFiles.length > 0 ? allFiles : undefined,
    });
    setDraftText("");
    setPendingFiles([]);
    setStudentSubmissionOpen(false);
  };
  const uploadForSelectedStudent = () => {
    if (!selectedStudent) return;
    const allFiles = [...(selectedGrade?.submissionFiles ?? []), ...pendingFiles];
    onGradeChange(selectedStudent.id, {
      submitted: true,
      submissionText: draftText.trim() || selectedGrade?.submissionText,
      submissionFiles: allFiles.length > 0 ? allFiles : undefined,
    });
    setDraftText("");
    setPendingFiles([]);
  };
  const submissionControls = (submitLabel: string, onSubmit: () => void, disabled = false) => (
    <div className="student-turnin-form">
      <TextArea label="Write a comment (optional)" value={draftText} onChange={setDraftText} />
      <label className="field-label">
        Attach files (optional — PDF, Word, Excel)
        <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => void addSubmissionFiles(event.target.files)} />
      </label>
      {pendingFiles.length > 0 ? (
        <ul className="pending-file-list">
          {pendingFiles.map((file) => (
            <li key={file.id}>
              <span>{file.name}</span>
              <button type="button" className="remove-button" onClick={() => setPendingFiles((files) => files.filter((item) => item.id !== file.id))}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="student-submit-row">
        <button className="submit-assignment-btn" type="button" onClick={onSubmit} disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    </div>
  );

  return (
    <article className="resource-list-item resource-detail-card assessment-card">
      {(!selectedStudent || (isStudentSubmitMode && !studentSubmissionOpen)) ? (
        <>
          <div className="assessment-card-heading">
            <div>
              <p className="eyebrow">{assessment.format}</p>
              <div className="assessment-title-row">
                <h3>{assessment.title}</h3>
                {!isStudentSubmitMode ? (
                  <button className="assessment-title-link" type="button" onClick={onEdit}>
                    Open assessment
                  </button>
                ) : null}
              </div>
              <div className="assessment-meta-list">
                <p><FontAwesomeIcon icon={faCalendarDays} fixedWidth /><strong>{assessment.requiresTurnIn ? "Due date" : "Date"}:</strong> {formatAssessmentDate(assessment)}</p>
                <p><FontAwesomeIcon icon={faClipboardCheck} fixedWidth /><strong>Turn-in required:</strong> {assessment.requiresTurnIn ? "Yes" : "No"}</p>
                <p><FontAwesomeIcon icon={faRulerCombined} fixedWidth /><strong>Assessment scale:</strong> {scale?.name ?? "No scale"}</p>
              </div>
            </div>
            {!isStudentSubmitMode ? (
              <div className="resource-detail-actions">
                <button className="secondary-action" type="button" onClick={onEdit}>Edit</button>
                <button className="remove-button" type="button" onClick={onRemove}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          {assessment.description ? <p className="assessment-description">{assessment.description}</p> : null}
        </>
      ) : null}
      {students.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No students in this subject class</h3>
          <p>Add students before grading assessments.</p>
        </div>
      ) : (
        selectedStudent && selectedGrade ? (
          <section className="assessment-student-detail-page">
            {!isStudentSubmitMode ? <div className="editor-back-row">
              <button className="assessment-back-link" type="button" onClick={() => setSelectedStudentId(null)}>
                <ArrowLeft size={16} />
                Back to assessment
              </button>
            </div> : null}
            <section className="assessment-student-grading-panel">
              {isStudentSubmitMode && selectedGradeIsGraded ? (
                <div className="student-graded-assessment-summary">
                  <div className="student-grade-result">
                    <span className="student-grade-label">Grade</span>
                    <strong className="student-grade-value">{getAssessmentGradeDisplay(assessment, scale ? [scale] : [], selectedStudent.id)}</strong>
                  </div>
                  {selectedGrade.feedback ? (
                    <div className="student-grade-feedback">
                      <span className="student-grade-label">Feedback</span>
                      <p>{selectedGrade.feedback}</p>
                    </div>
                  ) : null}
                  <div className="student-grade-meta">
                    {selectedGrade.gradedBy ? <span>Graded by {selectedGrade.gradedBy}</span> : null}
                    {selectedGrade.gradedAt ? <span>{formatDateTime(selectedGrade.gradedAt)}</span> : null}
                  </div>
                </div>
              ) : isStudentSubmitMode ? (
                assessment.requiresTurnIn ? (
                  selectedGrade.submitted ? (
                    <div className="student-submission-content">
                      <div className="student-submit-row">
                        <span className="student-submitted-badge">Submitted</span>
                      </div>
                      {selectedGrade.submissionText ? <p className="submission-text-preview">{selectedGrade.submissionText}</p> : null}
                      {(selectedGrade.submissionFiles ?? []).map((file) => (
                        <a key={file.id} className="submission-file-link" href={file.dataUrl} download={file.name}>{file.name}</a>
                      ))}
                    </div>
                  ) : !studentSubmissionOpen ? (
                    submissionLocked ? (
                      <div className="student-submit-row student-submit-row-spaced">
                        <span className="student-submitted-badge student-not-graded-badge">Hand-in closed</span>
                      </div>
                    ) : (
                      <div className="student-submit-row student-submit-row-spaced">
                        <button className="submit-assignment-btn" type="button" onClick={() => setStudentSubmissionOpen(true)}>
                          Submit
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="student-turnin-form">
                      <div className="editor-back-row">
                        <button className="assessment-back-link" type="button" onClick={() => setStudentSubmissionOpen(false)}>
                          <ArrowLeft size={16} />
                          Back to assignment info
                        </button>
                      </div>
                      {submissionControls("Submit assignment", submitTurnIn, submissionLocked)}
                    </div>
                  )
                ) : (
                  <div className="student-submit-row">
                    <span className="student-submitted-badge student-not-graded-badge">Not graded yet</span>
                  </div>
                )
              ) : assessment.requiresTurnIn ? (
                <>
                  <SelectInput
                    label="Submission status"
                    value={selectedGrade.submitted ? "submitted" : "not-submitted"}
                    options={[
                      { value: "not-submitted", label: "Not submitted" },
                      { value: "submitted", label: "Submitted" },
                    ]}
                    onChange={(value) => onGradeChange(selectedStudent.id, { submitted: value === "submitted" })}
                  />
                  {selectedGrade.submissionText ? <p className="submission-text-preview">{selectedGrade.submissionText}</p> : null}
                  {(selectedGrade.submissionFiles ?? []).map((file) => (
                    <a key={file.id} className="submission-file-link" href={file.dataUrl} download={file.name}>{file.name}</a>
                  ))}
                  {submissionControls(selectedGrade.submitted ? "Update submission" : "Upload for student", uploadForSelectedStudent)}
                </>
              ) : null}
              {!isStudentSubmitMode ? <SelectInput
                label="Grade"
                value={selectedGrade.levelId ?? ""}
                options={[
                  { value: "", label: "Not graded" },
                  ...(scale?.levels ?? []).map((level) => ({ value: level.id, label: level.value })),
                ]}
                onChange={(levelId) => onGradeChange(selectedStudent.id, {
                  levelId: levelId || undefined,
                  ...(assessment.requiresTurnIn && levelId ? { submitted: true } : {}),
                })}
              /> : null}
              {!isStudentSubmitMode ? <TextArea
                label="Feedback"
                value={selectedGrade.feedback ?? ""}
                onChange={(feedback) => onGradeChange(selectedStudent.id, { feedback })}
              /> : selectedGrade.feedback && !selectedGradeIsGraded ? <p className="assessment-description">{selectedGrade.feedback}</p> : null}
            </section>
          </section>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table assessment-student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const grade = grades.find((item) => item.studentId === student.id) ?? { studentId: student.id };
                  const status = getAssessmentStudentStatus(assessment, grade);
                  return (
                    <tr
                      className={selectedStudentId === student.id ? "active-assessment-student-row" : ""}
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <td>
                        <button className="assessment-student-button" type="button" onClick={() => setSelectedStudentId(student.id)}>
                          <strong>{student.firstName} {student.lastName}</strong>
                        </button>
                      </td>
                      <td><span className={`assessment-status-badge assessment-status-${slugifySchoolName(status)}`}>{status}</span></td>
                      <td>{getAssessmentGradeDisplay(assessment, scale ? [scale] : [], student.id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </article>
  );
}

function TestResourceEditor({
  test,
  scales,
  onChange,
}: {
  test: SubjectResource;
  scales: AssessmentScale[];
  onChange: (patch: Partial<SubjectResource>) => void;
}) {
  const questions = test.questions ?? [];
  const [collapsedQuestions, setCollapsedQuestions] = useState<Set<string>>(() => new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsedQuestions((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const updateQuestion = (questionId: string, patch: Partial<NonNullable<SubjectResource["questions"]>[number]>) => {
    onChange({ questions: questions.map((question) => question.id === questionId ? { ...question, ...patch } : question) });
  };
  const updateOption = (questionId: string, optionId: string, patch: Partial<NonNullable<NonNullable<SubjectResource["questions"]>[number]["options"]>[number]>) => {
    onChange({
      questions: questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        return {
          ...question,
          options: (question.options ?? []).map((option) => option.id === optionId ? { ...option, ...patch } : option),
        };
      }),
    });
  };
  const addOption = (questionId: string) => {
    onChange({
      questions: questions.map((question) => question.id === questionId ? {
        ...question,
        options: [...(question.options ?? []), { id: `option-${Date.now()}`, text: "New option", correct: false }],
      } : question),
    });
  };

  return (
    <div className="test-editor">
      <div className="test-editor-settings">
        <div className="test-settings-card">
          <p className="eyebrow">Test details</p>
          <TextInput label="Title" value={test.title} onChange={(title) => onChange({ title })} />
          <TextArea label="Description" value={test.description ?? ""} onChange={(description) => onChange({ description })} />
          <DateInput label="Due date" value={test.dueDate ?? ""} onChange={(dueDate) => onChange({ dueDate })} />
          <SelectInput
            label="Assessment scale"
            value={test.scaleId ?? ""}
            options={[{ value: "", label: "No scale" }, ...scales.map((scale) => ({ value: scale.id, label: scale.name }))]}
            onChange={(scaleId) => onChange({ scaleId })}
          />
        </div>
        <div className="test-settings-card">
          <p className="eyebrow">Grading & timing</p>
          <SelectInput
            label="Grading"
            value={test.gradingMode ?? "auto"}
            options={[
              { value: "auto", label: "Auto grade multiple choice" },
              { value: "manual", label: "Manual grading" },
            ]}
            onChange={(gradingMode) => onChange({ gradingMode: gradingMode as SubjectResource["gradingMode"] })}
          />
          <SelectInput
            label="Publish results"
            value={test.publishResults ?? "after-review"}
            options={[
              { value: "immediately", label: "Immediately after submission" },
              { value: "after-review", label: "After teacher review" },
            ]}
            onChange={(publishResults) => onChange({ publishResults: publishResults as SubjectResource["publishResults"] })}
          />
          <CheckboxInput label="Use lobby so all students start together" checked={Boolean(test.lobbyEnabled)} onChange={(lobbyEnabled) => onChange({ lobbyEnabled })} />
          {test.lobbyEnabled ? (
            <label className="field-label">
              Scheduled start
              <input type="datetime-local" value={test.startsAt ?? ""} onChange={(event) => onChange({ startsAt: event.target.value })} />
            </label>
          ) : null}
          <div className="split-fields">
            <SelectInput
              label="Timer"
              value={test.timerMode ?? "none"}
              options={[
                { value: "none", label: "No timer" },
                { value: "duration", label: "Submit after minutes since start" },
                { value: "fixed-end", label: "Submit at a set time" },
              ]}
              onChange={(timerMode) => onChange({ timerMode: timerMode as SubjectResource["timerMode"] })}
            />
            {test.timerMode === "duration" ? (
              <label className="field-label">
                Minutes
                <input type="number" min="1" value={test.timerMinutes ?? 45} onChange={(event) => onChange({ timerMinutes: Number(event.target.value) || 1 })} />
              </label>
            ) : test.timerMode === "fixed-end" ? (
              <label className="field-label">
                End time
                <input type="datetime-local" value={test.timerEndsAt ?? ""} onChange={(event) => onChange({ timerEndsAt: event.target.value })} />
              </label>
            ) : <span />}
          </div>
          <CheckboxInput label="Auto-submit saved answers when time expires" checked={test.autoSubmitOnTimerEnd !== false} onChange={(autoSubmitOnTimerEnd) => onChange({ autoSubmitOnTimerEnd })} />
        </div>
      </div>
      <div className="test-question-list">
        <div className="test-question-actions">
          <h3>Questions <span className="test-question-count">{questions.length}</span></h3>
          <div className="test-question-add-actions">
            <button className="secondary-action" type="button" onClick={() => onChange({ questions: [...questions, createTestQuestion("multiple-choice")] })}>+ Multiple choice</button>
            <button className="secondary-action" type="button" onClick={() => onChange({ questions: [...questions, createTestQuestion("text")] })}>+ Text answer</button>
          </div>
        </div>
        {questions.length === 0 ? (
          <p className="form-status">No questions yet. Add multiple choice or text answer questions above.</p>
        ) : null}
        {questions.map((question, index) => {
          const isCollapsed = collapsedQuestions.has(question.id);
          const preview = question.prompt ? (question.prompt.length > 60 ? question.prompt.slice(0, 60) + "…" : question.prompt) : "No question text yet";
          return (
            <article className="test-question-card" key={question.id}>
              <div className="test-question-heading">
                <button className="test-question-collapse-btn" type="button" onClick={() => toggleCollapsed(question.id)}>
                  <span className="test-question-number">{index + 1}</span>
                  <span className="test-question-preview">
                    {isCollapsed ? preview : <strong>Question {index + 1}</strong>}
                  </span>
                  <ChevronRight size={16} className={`test-question-chevron${isCollapsed ? "" : " test-question-chevron-open"}`} />
                </button>
                <button className="remove-button" type="button" onClick={() => onChange({ questions: questions.filter((item) => item.id !== question.id) })}>Remove</button>
              </div>
              {!isCollapsed ? (
                <>
                  <TextArea label="Question" value={question.prompt} onChange={(prompt) => updateQuestion(question.id, { prompt })} />
                  <div className="split-fields">
                    <SelectInput
                      label="Question type"
                      value={question.type}
                      options={[
                        { value: "multiple-choice", label: "Multiple choice" },
                        { value: "text", label: "Text answer" },
                      ]}
                      onChange={(type) => updateQuestion(question.id, {
                        type: type as "multiple-choice" | "text",
                        ...(type === "multiple-choice" && !question.options?.length ? { options: createTestQuestion("multiple-choice").options } : {}),
                      })}
                    />
                    <label className="field-label">
                      Marks
                      <input type="number" min="0" step="0.5" value={question.marks ?? 1} onChange={(event) => updateQuestion(question.id, { marks: Number(event.target.value) || 0 })} />
                    </label>
                  </div>
                  {question.type === "multiple-choice" ? (
                    <>
                      <CheckboxInput label="Allow several correct answers" checked={Boolean(question.allowMultipleCorrect)} onChange={(allowMultipleCorrect) => updateQuestion(question.id, { allowMultipleCorrect })} />
                      <div className="test-option-list">
                        {(question.options ?? []).map((option, optIndex) => (
                          <div className="test-option-row" key={option.id}>
                            <span className="test-option-letter">{String.fromCharCode(65 + optIndex)}</span>
                            <TextInput label="Option" value={option.text} onChange={(text) => updateOption(question.id, option.id, { text })} />
                            <CheckboxInput label="Correct" checked={Boolean(option.correct)} onChange={(correct) => updateOption(question.id, option.id, { correct })} />
                            <button className="remove-button" type="button" onClick={() => updateQuestion(question.id, { options: (question.options ?? []).filter((item) => item.id !== option.id) })}>×</button>
                          </div>
                        ))}
                      </div>
                      <button className="secondary-action test-add-option-btn" type="button" onClick={() => addOption(question.id)}>+ Add option</button>
                    </>
                  ) : <p className="form-status">Text answers are saved for manual teacher review.</p>}
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TestResourceView({
  test,
  scale,
  accessLevel,
  activeStudentId,
  students,
  onBeginTest,
  onSubmissionChange,
  onSubmissionDelete,
}: {
  test: SubjectResource;
  scale?: AssessmentScale;
  accessLevel: SchoolWorkAccessLevel;
  activeStudentId?: string;
  students?: Student[];
  onBeginTest?: () => void;
  onSubmissionChange: (submission: NonNullable<SubjectResource["testSubmissions"]>[number]) => void;
  onSubmissionDelete?: (studentId: string) => void;
}) {
  const questions = test.questions ?? [];
  const cursorInsidePageRef = useRef(true);
  const existingSubmission = test.testSubmissions?.find((submission) => submission.studentId === activeStudentId);
  const [localSubmission, setLocalSubmission] = useState<NonNullable<SubjectResource["testSubmissions"]>[number]>(() => existingSubmission ?? {
    studentId: activeStudentId ?? "student",
    answers: {},
  });
  const latestSubmissionRef = useRef(localSubmission);
  const storageKey = `edulink-test-${test.id}-${activeStudentId ?? "student"}`;
  const submitted = Boolean(localSubmission.submittedAt);
  const testStarted = Boolean(localSubmission.startedAt);
  const isStudentTestActive = accessLevel === "student" && testStarted && !submitted;
  const scheduledStartDate = test.startsAt ? new Date(test.startsAt) : null;
  const scheduledStartReached = !scheduledStartDate || scheduledStartDate.getTime() <= Date.now();
  const shouldUseLobby = Boolean(test.lobbyEnabled) || Boolean(test.startsAt);
  const canStartFromLobby = scheduledStartReached;
  const timerDeadline = (() => {
    if (test.timerMode === "duration" && localSubmission.startedAt) {
      return new Date(new Date(localSubmission.startedAt).getTime() + (test.timerMinutes ?? 45) * 60_000);
    }
    if (test.timerMode === "fixed-end" && test.timerEndsAt) {
      return new Date(test.timerEndsAt);
    }
    return null;
  })();
  const cursorOutsideSessions = getCursorOutsideSessions(localSubmission.proctorEvents ?? []);

  useEffect(() => {
    if (!activeStudentId) {
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (stored && !existingSubmission?.submittedAt) {
      try {
        const parsed = JSON.parse(stored) as typeof localSubmission;
        if (parsed.submittedAt) {
          window.localStorage.removeItem(storageKey);
          return;
        }
        latestSubmissionRef.current = parsed;
        setLocalSubmission(parsed);
      } catch {
        // Ignore malformed local test backups.
      }
    }
  }, [activeStudentId, existingSubmission?.submittedAt, storageKey]);

  useEffect(() => {
    if (!timerDeadline || submitted || test.autoSubmitOnTimerEnd === false) {
      return undefined;
    }
    const delay = timerDeadline.getTime() - Date.now();
    if (delay <= 0) {
      submit(true);
      return undefined;
    }
    const timeout = window.setTimeout(() => submit(true), delay);
    return () => window.clearTimeout(timeout);
  }, [submitted, test.autoSubmitOnTimerEnd, timerDeadline?.getTime()]);

  const saveSubmission = (submission: typeof localSubmission) => {
    latestSubmissionRef.current = submission;
    setLocalSubmission(submission);
    window.localStorage.setItem(storageKey, JSON.stringify(submission));
    onSubmissionChange(submission);
  };
  const recordProctorEvent = (type: NonNullable<typeof localSubmission.proctorEvents>[number]["type"]) => {
    if (!activeStudentId || !isStudentTestActive) {
      return;
    }
    const now = new Date().toISOString();
    const event = {
      id: `proctor-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      at: now,
    };
    const currentSubmission = latestSubmissionRef.current;
    saveSubmission({
      ...currentSubmission,
      studentId: activeStudentId,
      lastSavedAt: now,
      proctorEvents: [...(currentSubmission.proctorEvents ?? []), event],
    });
  };
  const updateAnswer = (questionId: string, answer: string | string[]) => {
    if (!activeStudentId || submitted || (shouldUseLobby && !testStarted)) {
      return;
    }
    saveSubmission({
      ...localSubmission,
      studentId: activeStudentId,
      startedAt: localSubmission.startedAt ?? new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      answers: { ...localSubmission.answers, [questionId]: answer },
    });
  };
  const submit = (autoSubmitted = false) => {
    if (!activeStudentId) {
      return;
    }
    const autoGrade = test.gradingMode !== "manual" ? getTestAutoGrade(test, localSubmission, scale) : null;
    saveSubmission({
      ...localSubmission,
      studentId: activeStudentId,
      startedAt: localSubmission.startedAt ?? new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      autoSubmitted,
      ...(autoGrade ? {
        score: autoGrade.score,
        maxScore: autoGrade.maxScore,
        percentage: autoGrade.percentage,
        levelId: autoGrade.level?.id,
      } : {}),
    });
  };
  const startTest = () => {
    if (!activeStudentId || submitted) {
      return;
    }
    saveSubmission({
      ...localSubmission,
      studentId: activeStudentId,
      startedAt: localSubmission.startedAt ?? new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!isStudentTestActive) {
      return undefined;
    }
    cursorInsidePageRef.current = true;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordProctorEvent("page-hidden");
      }
    };
    const handleBlur = () => recordProctorEvent("window-blur");
    const handleMouseEnter = (event: MouseEvent) => {
      if (event.relatedTarget) {
        return;
      }
      if (!cursorInsidePageRef.current) {
        recordProctorEvent("cursor-entered-page");
      }
      cursorInsidePageRef.current = true;
    };
    const handleMouseLeave = (event: MouseEvent) => {
      if (event.relatedTarget) {
        return;
      }
      if (cursorInsidePageRef.current) {
        cursorInsidePageRef.current = false;
        recordProctorEvent("cursor-left-page");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mouseover", handleMouseEnter);
    window.addEventListener("mouseout", handleMouseLeave);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mouseover", handleMouseEnter);
      window.removeEventListener("mouseout", handleMouseLeave);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isStudentTestActive, localSubmission]);

  if (accessLevel !== "student") {
    return (
      <div className="test-summary">
        <p>{test.description || "No description yet."}</p>
        <div className="assessment-meta-list">
          <p><FontAwesomeIcon icon={faCalendarDays} fixedWidth /><strong>Due:</strong> {test.dueDate ? formatDate(test.dueDate) : "No due date"}</p>
          <p><FontAwesomeIcon icon={faRulerCombined} fixedWidth /><strong>Scale:</strong> {scale?.name ?? "No scale"}</p>
          <p><ClipboardCheck size={16} /><strong>Grading:</strong> {(test.gradingMode ?? "auto") === "auto" ? "Auto grading" : "Manual grading"}</p>
          <p><Clock size={16} /><strong>Timer:</strong> {getTestTimerLabel(test)}</p>
        </div>
        {onBeginTest ? (
          <button className="primary-action test-start-button" type="button" onClick={onBeginTest}>
            <ClipboardCheck size={16} />
            Begin test
          </button>
        ) : null}
        <TestSubmittedResults test={test} scale={scale} students={students} onSubmissionChange={onSubmissionChange} onSubmissionDelete={onSubmissionDelete} />
      </div>
    );
  }

  return (
    <div className={`test-taking-view${testStarted && !submitted ? " test-taking-active" : ""}`}>
      {!testStarted ? (
        <div className="test-lobby-card">
          <div className="test-lobby-icon">
            <ClipboardCheck size={32} />
          </div>
          <div className="test-lobby-content">
            <h3>{shouldUseLobby ? "Waiting in lobby" : test.title}</h3>
            {test.description ? <p>{test.description}</p> : null}
            <div className="assessment-meta-list">
              <p><FontAwesomeIcon icon={faCalendarDays} fixedWidth />{test.dueDate ? formatDate(test.dueDate) : "No due date"}</p>
              <p><ClipboardCheck size={14} />{questions.length} question{questions.length === 1 ? "" : "s"}</p>
              <p><Clock size={14} />{getTestTimerLabel(test)}</p>
            </div>
            <p className="test-lobby-notice">
              {scheduledStartDate && !scheduledStartReached
                ? `This test opens at ${formatDateTime(scheduledStartDate.toISOString())}.`
                : "Leaving the browser page during the test is recorded for teacher review."}
            </p>
            <button className="primary-action test-start-button" type="button" onClick={startTest} disabled={!canStartFromLobby}>
              <ClipboardCheck size={16} />
              {shouldUseLobby && !scheduledStartReached ? "Waiting..." : "Begin test"}
            </button>
          </div>
        </div>
      ) : null}
      {testStarted ? (
        <div className="test-active-meta">
          <p><Clock size={14} />{getTestTimerLabel(test)}</p>
          {timerDeadline ? <p><Clock size={14} />Auto-submit: {formatDateTime(timerDeadline.toISOString())}</p> : null}
          <p><Save size={14} />Autosave: {localSubmission.lastSavedAt ? formatDateTime(localSubmission.lastSavedAt) : "Not saved yet"}</p>
        </div>
      ) : null}
      {isStudentTestActive ? (
        <div className="test-submission-alerts" role="status">
          <strong>Activity registered</strong>
          <p>Your teacher can see when the cursor leaves or enters this page during the test.</p>
          {cursorOutsideSessions.length > 0 ? (
            cursorOutsideSessions.slice(-6).map((session) => (
              <p key={session.id}>
                <strong>Cursor left:</strong> {formatDateTimeWithSeconds(session.leftAt)}
                {" | "}
                <strong>Reentered:</strong> {session.enteredAt ? formatDateTimeWithSeconds(session.enteredAt) : "Not yet"}
                {" | "}
                <strong>Time outside:</strong> {session.enteredAt ? formatDuration(new Date(session.enteredAt).getTime() - new Date(session.leftAt).getTime()) : "Still outside"}
              </p>
            ))
          ) : (
            <p>No cursor leave/reenter events recorded yet.</p>
          )}
        </div>
      ) : null}
      {submitted && (test.publishResults === "immediately" || localSubmission.reviewed) && (test.gradingMode ?? "auto") === "auto" ? (() => {
        const result = getTestAutoGrade(test, localSubmission, scale);
        return <div className="student-graded-assessment-summary">
          <p><strong>Result:</strong> {result.score}/{result.maxScore} ({result.percentage}%)</p>
          <p><strong>Level:</strong> {result.level?.value ?? "No level"}</p>
        </div>;
      })() : submitted && test.publishResults === "after-review" ? (
        <p className="form-status">Submitted. Results will be published after review.</p>
      ) : null}
      {testStarted ? questions.map((question, index) => {
        const answer = localSubmission.answers[question.id];
        return (
          <article className="test-question-card" key={question.id}>
            <div className="test-question-header">
              <span className="test-question-number">{index + 1}</span>
              <div>
                <h4>{question.prompt}</h4>
                <span className="test-marks-badge">{question.marks ?? 1} mark{(question.marks ?? 1) === 1 ? "" : "s"}</span>
              </div>
            </div>
            {question.type === "multiple-choice" ? (
              <div className="test-answer-options">
                {(question.options ?? []).map((option, optIndex) => {
                  const selectedAnswers = Array.isArray(answer) ? answer : answer ? [answer] : [];
                  return (
                    <label className="test-answer-option-card" key={option.id}>
                      <span className="test-option-letter">{String.fromCharCode(65 + optIndex)}</span>
                      <input
                        type={question.allowMultipleCorrect ? "checkbox" : "radio"}
                        name={question.id}
                        checked={selectedAnswers.includes(option.id)}
                        disabled={submitted}
                        onChange={(event) => {
                          if (question.allowMultipleCorrect) {
                            updateAnswer(question.id, event.target.checked ? mergeUnique([...selectedAnswers, option.id]) : selectedAnswers.filter((id) => id !== option.id));
                          } else {
                            updateAnswer(question.id, option.id);
                          }
                        }}
                      />
                      <span>{option.text}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <TextArea label="Your answer" value={typeof answer === "string" ? answer : ""} onChange={(value) => updateAnswer(question.id, value)} />
            )}
          </article>
        );
      }) : null}
      {testStarted ? (
        <div className="test-submit-row">
          {submitted ? (
            <span className="test-submitted-badge"><ClipboardCheck size={16} /> Test submitted</span>
          ) : (
            <button className="primary-action test-submit-btn" type="button" onClick={() => submit(false)}>
              <ClipboardCheck size={16} />
              Submit test
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TestSubmittedResults({
  test,
  scale,
  students,
  onSubmissionChange,
  onSubmissionDelete,
}: {
  test: SubjectResource;
  scale?: AssessmentScale;
  students?: Student[];
  onSubmissionChange: (submission: NonNullable<SubjectResource["testSubmissions"]>[number]) => void;
  onSubmissionDelete?: (studentId: string) => void;
}) {
  const questions = test.questions ?? [];
  const submissions = test.testSubmissions ?? [];
  const submittedCount = submissions.filter((s) => s.submittedAt).length;
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);

  const previewSubmission = submissions.find((s) => s.studentId === "preview");

  type Row = { key: string; name: string; submission: NonNullable<SubjectResource["testSubmissions"]>[number] | null };
  const rows: Row[] = [
    ...(students ?? [])
      .slice()
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map((student) => ({
        key: student.id,
        name: `${student.firstName} ${student.lastName}`,
        submission: submissions.find((s) => s.studentId === student.id) ?? null,
      })),
    ...(previewSubmission ? [{ key: "preview", name: "Teacher preview", submission: previewSubmission }] : []),
  ];

  const deleteSubmission = (submission: NonNullable<SubjectResource["testSubmissions"]>[number], name: string) => {
    if (!onSubmissionDelete) return;
    const isInProgress = submission.startedAt && !submission.submittedAt;
    const message = isInProgress
      ? `${name} is currently in progress on this test. Deleting will erase all their answers and progress. This cannot be undone. Continue?`
      : `Delete the submitted result for ${name}? This cannot be undone.`;
    if (window.confirm(message)) {
      onSubmissionDelete(submission.studentId);
    }
  };

  return (
    <section className="test-question-list">
      <div>
        <h3>Student results</h3>
        <p className="form-status">{submittedCount} submitted · {rows.length} student{rows.length === 1 ? "" : "s"}</p>
      </div>
      {rows.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No students in this class</h3>
          <p>Add students to the class to track test results.</p>
        </div>
      ) : rows.map(({ key, name, submission }) => {
        const isOpen = openSubmissionId === key;
        const integrityEvents = submission?.proctorEvents ?? [];
        const hasIntegrityEvents = integrityEvents.length > 0;
        const statusLabel = submission?.submittedAt ? "Submitted" : submission?.startedAt ? "In progress" : "Not started";
        return (
          <article className="test-question-card test-result-row" key={key}>
            <div className="test-result-row-summary">
              <div>
                <h4>
                  {name}
                  {hasIntegrityEvents ? <TriangleAlert className="test-integrity-icon" size={18} aria-label="Test integrity alert" /> : null}
                </h4>
                <p className="form-status">
                  <strong>{statusLabel}</strong>
                  {submission?.submittedAt ? ` · Submitted ${formatDateTimeWithSeconds(submission.submittedAt)}` : submission?.lastSavedAt ? ` · Last saved ${formatDateTimeWithSeconds(submission.lastSavedAt)}` : ""}
                </p>
              </div>
              <div className="test-result-actions">
                {hasIntegrityEvents ? <span className="test-integrity-badge">{integrityEvents.length} integrity event{integrityEvents.length === 1 ? "" : "s"}</span> : null}
                {submission ? (
                  <button className="secondary-action" type="button" onClick={() => setOpenSubmissionId(isOpen ? null : key)}>
                    {isOpen ? "Close" : "Open"}
                  </button>
                ) : null}
              </div>
            </div>
            {isOpen && submission ? (
              <div className="test-result-detail">
                <div className="test-result-actions">
                  {submission.submittedAt ? (
                    <button className="secondary-action" type="button" onClick={() => onSubmissionChange({ ...submission, reviewed: true })}>
                      {submission.reviewed ? "Reviewed" : "Mark reviewed"}
                    </button>
                  ) : null}
                  {onSubmissionDelete ? (
                    <button className="remove-button" type="button" onClick={() => deleteSubmission(submission, name)}>
                      <Trash2 size={16} />
                      {submission.submittedAt ? "Delete result" : "Delete submission"}
                    </button>
                  ) : null}
                </div>
                {submission.submittedAt ? (test.gradingMode ?? "auto") === "auto" ? (() => {
                  const result = getTestAutoGrade(test, submission, scale);
                  return <p className="form-status">Auto grade: {result.score}/{result.maxScore} ({result.percentage}%){result.level ? ` · ${result.level.value}` : ""}</p>;
                })() : <p className="form-status">Manual grading required.</p> : (
                  <p className="form-status">This attempt has not been submitted yet.</p>
                )}
                {hasIntegrityEvents ? (
                  <div className="test-submission-alerts">
                    <strong>Test integrity alerts</strong>
                    {integrityEvents.map((event) => (
                      <p key={event.id}>{getProctorEventLabel(event.type)} at {formatDateTimeWithSeconds(event.at)}</p>
                    ))}
                  </div>
                ) : null}
                {questions.map((question) => {
                  const answer = submission.answers[question.id];
                  const optionLabels = Array.isArray(answer)
                    ? answer.map((optionId) => question.options?.find((option) => option.id === optionId)?.text ?? optionId).join(", ")
                    : question.options?.find((option) => option.id === answer)?.text ?? answer;
                  return (
                    <div className="test-review-answer" key={question.id}>
                      <strong>{question.prompt} ({question.marks ?? 1} mark{(question.marks ?? 1) === 1 ? "" : "s"})</strong>
                      <p>{optionLabels || "No answer"}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function RemarksView({
  students,
  allRemarks,
  categories,
  subjectClassId,
  subjectClassLabel,
  allSubjectClasses,
  subjects,
  canCreate,
  createdByLabel,
  onChange,
}: {
  students: Student[];
  allRemarks: Remark[];
  categories: RemarkCategory[];
  subjectClassId?: string;
  subjectClassLabel?: string;
  allSubjectClasses: SubjectClass[];
  subjects: Subject[];
  canCreate: boolean;
  createdByLabel?: string;
  onChange: (remarks: Remark[]) => void;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draftParentId, setDraftParentId] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null;
  const studentRemarks = selectedStudent
    ? allRemarks.filter((r) => r.studentId === selectedStudent.id)
    : [];

  const subTypesForParent = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  const getRemarkSourceLabel = (remark: Remark): string => {
    if (!remark.subjectClassId) return "General remark";
    if (remark.subjectClassLabel) return remark.subjectClassLabel;
    const sc = allSubjectClasses.find((c) => c.id === remark.subjectClassId);
    if (!sc) return "Subject class";
    const subject = subjects.find((s) => s.id === sc.subjectId);
    return subject ? `${subject.name} – ${sc.name}` : sc.name;
  };

  const addRemark = () => {
    if (!selectedStudent || !draftCategoryId) return;
    const newRemark: Remark = {
      id: `remark-${Date.now()}`,
      studentId: selectedStudent.id,
      categoryId: draftCategoryId,
      body: draftBody.trim() || undefined,
      subjectClassId,
      subjectClassLabel,
      createdAt: new Date().toISOString(),
      createdBy: createdByLabel,
    };
    onChange([...allRemarks, newRemark]);
    setDraftBody("");
    setDraftCategoryId("");
    setDraftParentId("");
  };

  const removeRemark = (remarkId: string) => {
    onChange(allRemarks.filter((r) => r.id !== remarkId));
  };

  if (selectedStudent) {
    const availableSubTypes = draftParentId ? subTypesForParent(draftParentId) : [];
    return (
      <div className="remarks-student-view">
        <div className="editor-back-row">
          <button type="button" className="school-work-back-link" onClick={() => setSelectedStudentId(null)}>
            <ArrowLeft size={16} />
            Back to students
          </button>
        </div>
        <div>
          <p className="eyebrow">Remarks</p>
          <h3>{selectedStudent.firstName} {selectedStudent.lastName}</h3>
        </div>
        {canCreate ? (
          <div className="remark-composer">
            <div className="remark-parent-selector">
              {REMARK_PARENTS.map((parent) => (
                <button
                  key={parent.id}
                  type="button"
                  className={`remark-parent-btn${draftParentId === parent.id ? " remark-parent-btn--active" : ""}`}
                  onClick={() => { setDraftParentId(parent.id); setDraftCategoryId(""); }}
                >
                  {parent.name}
                </button>
              ))}
            </div>
            {draftParentId ? (
              availableSubTypes.length === 0 ? (
                <p className="form-status">No types configured for this category. Add sub-types in settings.</p>
              ) : (
                <label className="field-label">
                  Type
                  <select className="field-input" value={draftCategoryId} onChange={(e) => setDraftCategoryId(e.target.value)}>
                    <option value="" disabled>Select a type</option>
                    {availableSubTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )
            ) : null}
            {draftCategoryId ? (
              <TextArea label="Comment (optional)" value={draftBody} onChange={setDraftBody} />
            ) : null}
            <button className="secondary-action" type="button" onClick={addRemark} disabled={!draftCategoryId}>
              Add remark
            </button>
          </div>
        ) : null}
        <div className="remark-list">
          {studentRemarks.length === 0 ? (
            <div className="empty-editor-state">
              <h3>No remarks yet</h3>
              <p>No remarks have been registered for this student.</p>
            </div>
          ) : studentRemarks.map((remark) => {
            const category = categories.find((c) => c.id === remark.categoryId);
            const parent = category?.parentId ? REMARK_PARENTS.find((p) => p.id === category.parentId) : null;
            return (
              <article className="remark-card" key={remark.id}>
                <div className="remark-card-meta">
                  {parent ? <span className={`remark-category-badge remark-parent-badge--${parent.id}`}>{parent.name}</span> : null}
                  {category ? <span className="remark-category-badge">{category.name}</span> : null}
                  <span className="remark-source-label">{getRemarkSourceLabel(remark)}</span>
                  <time className="remark-time">{formatDate(remark.createdAt)}</time>
                  {remark.createdBy ? <span className="remark-author">{remark.createdBy}</span> : null}
                </div>
                {remark.body ? <p className="remark-body">{remark.body}</p> : null}
                {canCreate ? (
                  <button className="remove-button" type="button" onClick={() => removeRemark(remark.id)}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="remarks-student-list">
      {students.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No students</h3>
          <p>There are no students in this subject class.</p>
        </div>
      ) : students.map((student) => {
        const count = allRemarks.filter((r) => r.studentId === student.id).length;
        return (
          <button key={student.id} className="remark-student-row" type="button" onClick={() => setSelectedStudentId(student.id)}>
            <strong>{student.firstName} {student.lastName}</strong>
            <span className="remark-student-count">{count > 0 ? `${count} remark${count === 1 ? "" : "s"}` : "No remarks"}</span>
            <ChevronRight size={16} className="remark-student-chevron" />
          </button>
        );
      })}
    </div>
  );
}

function TopicPerformanceView({
  topics,
  assessments,
  scales,
  students,
}: {
  topics: Topic[];
  assessments: Assessment[];
  scales: AssessmentScale[];
  students: Student[];
}) {
  const getTopicAvg = (studentId: string, topicId: string) => {
    const topicAssessments = assessments.filter((a) => (a.topicIds ?? []).includes(topicId));
    const scores: number[] = [];
    for (const a of topicAssessments) {
      const grade = a.grades.find((g) => g.studentId === studentId);
      if (grade?.score !== undefined && grade.score !== "") {
        const pct = parseFloat(grade.score);
        if (!isNaN(pct)) scores.push(pct);
      }
    }
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  };

  const getColor = (avg: number | null) => {
    if (avg === null) return "";
    if (avg >= 75) return "topic-cell-high";
    if (avg >= 50) return "topic-cell-mid";
    return "topic-cell-low";
  };

  if (topics.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No topics defined</h3>
        <p>Add topics in the Topics tab, then link assessments to topics.</p>
      </div>
    );
  }

  return (
    <div className="topic-performance-wrap">
      <div className="data-table-wrap">
        <table className="data-table topic-performance-table">
          <thead>
            <tr>
              <th>Student</th>
              {topics.map((t) => (
                <th key={t.id} className="topic-performance-topic-header">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td><strong>{student.firstName} {student.lastName}</strong></td>
                {topics.map((topic) => {
                  const avg = getTopicAvg(student.id, topic.id);
                  return (
                    <td key={topic.id} className={`topic-performance-cell ${getColor(avg)}`}>
                      {avg !== null ? `${avg.toFixed(0)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="topic-performance-legend">
        <span className="topic-legend-item topic-cell-high">≥75%</span>
        <span className="topic-legend-item topic-cell-mid">50–74%</span>
        <span className="topic-legend-item topic-cell-low">&lt;50%</span>
        <span className="topic-legend-item">— No data</span>
      </div>
    </div>
  );
}

function TopicSettings({
  topics,
  folders,
  resources,
  onChange,
  onCreateFolder,
}: {
  topics: Topic[];
  folders: ResourceFolder[];
  resources: SubjectResource[];
  onChange: (topics: Topic[]) => void;
  onCreateFolder: (name: string) => string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pick<Topic, "name" | "description" | "startDate" | "endDate" | "folderId">>({ name: "", description: "", startDate: "", endDate: "", folderId: "" });
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const emptyDraft = { name: "", description: "", startDate: "", endDate: "", folderId: "" };
  const startEdit = (topic: Topic) => { setEditingId(topic.id); setDraft({ name: topic.name, description: topic.description ?? "", startDate: topic.startDate ?? "", endDate: topic.endDate ?? "", folderId: topic.folderId ?? "" }); };
  const startNew = () => { setEditingId("new"); setDraft(emptyDraft); };
  const cancel = () => { setEditingId(null); setDraft(emptyDraft); setCreatingFolder(false); setNewFolderName(""); };

  const save = () => {
    if (!draft.name.trim()) return;
    let folderId: string | undefined = draft.folderId || undefined;
    if (creatingFolder && newFolderName.trim()) {
      folderId = onCreateFolder(newFolderName.trim());
    }
    const saved: Topic = {
      id: editingId === "new" ? `topic-${Date.now()}` : editingId!,
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
      folderId,
    };
    if (editingId === "new") {
      onChange([...topics, saved]);
    } else {
      onChange(topics.map((t) => t.id === editingId ? saved : t));
    }
    cancel();
  };

  const getTopicResources = (folderId?: string) => folderId ? resources.filter((r) => r.folderId === folderId) : [];
  const getFolderName = (folderId?: string) => folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null;
  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return null;
    const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
    if (startDate) return `From ${fmt(startDate)}`;
    return `Until ${fmt(endDate!)}`;
  };

  const modalOpen = editingId !== null;

  const modal = modalOpen ? (
    <div className="modal-backdrop" role="presentation" onClick={cancel}>
      <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="topic-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="staff-modal-header">
          <div>
            <p className="eyebrow">Topic</p>
            <h2 id="topic-modal-title">{editingId === "new" ? "Add topic" : "Edit topic"}</h2>
          </div>
          <button className="icon-action" type="button" onClick={cancel} aria-label="Close">✕</button>
        </div>
        <div className="staff-modal-body">
          <TextInput label="Topic name" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} />
          <TextInput label="Description (optional)" value={draft.description ?? ""} onChange={(description) => setDraft((d) => ({ ...d, description }))} />
          <div className="topic-date-row">
            <DateInput label="Start date" value={draft.startDate ?? ""} onChange={(startDate) => setDraft((d) => ({ ...d, startDate }))} />
            <DateInput label="End date" value={draft.endDate ?? ""} onChange={(endDate) => setDraft((d) => ({ ...d, endDate }))} />
          </div>
          {creatingFolder ? (
            <div className="topic-folder-row">
              <TextInput label="New folder name" value={newFolderName} onChange={setNewFolderName} />
              <button type="button" className="secondary-action topic-folder-alt-btn" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}>Use existing</button>
            </div>
          ) : (
            <div className="topic-folder-row">
              <label className="field-label topic-folder-select-label">
                Linked folder (optional)
                <select value={draft.folderId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, folderId: e.target.value }))}>
                  <option value="">— No folder —</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <button type="button" className="secondary-action topic-folder-alt-btn" onClick={() => setCreatingFolder(true)}>Create new folder</button>
            </div>
          )}
          <p className="topic-folder-hint">Linking a folder groups resources under this topic. Assessments and tests inside the folder inherit this topic automatically — unless they are manually linked to a different one. Topics can be used to track student progress per topic.</p>
        </div>
        <div className="staff-modal-actions">
          <button className="remove-button" type="button" onClick={cancel}>Cancel</button>
          <button className="primary-action" type="button" onClick={save}>Save topic</button>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      {modal}
      <div className="topic-settings">
        {topics.map((topic) => {
          const topicResources = getTopicResources(topic.folderId);
          const folderName = getFolderName(topic.folderId);
          const dateRange = formatDateRange(topic.startDate, topic.endDate);
          return (
            <div key={topic.id} className="topic-settings-row">
              <div className="topic-settings-info">
                <strong>{topic.name}</strong>
                {topic.description ? <span>{topic.description}</span> : null}
                {dateRange ? <span className="topic-date-range"><CalendarDays size={13} /> {dateRange}</span> : null}
                {folderName ? <span className="topic-folder-badge"><Folder size={13} /> {folderName}</span> : null}
                {topicResources.length > 0 ? (
                  <ul className="topic-resource-list">
                    {topicResources.map((r) => <li key={r.id}>{r.title}</li>)}
                  </ul>
                ) : null}
              </div>
              <div className="topic-settings-actions">
                <button className="secondary-action" type="button" onClick={() => startEdit(topic)}>Edit</button>
                <button className="remove-button" type="button" onClick={() => onChange(topics.filter((t) => t.id !== topic.id))}>Remove</button>
              </div>
            </div>
          );
        })}
        <button className="topic-settings-add-btn" type="button" onClick={startNew}>
          <Plus size={15} /> Add topic
        </button>
      </div>
    </>
  );
}

function SchoolWorkStatusCards({ onOpenGrades, onOpenRemarks, onOpenTopics, hasTopics }: { onOpenGrades: () => void; onOpenRemarks: () => void; onOpenTopics: () => void; hasTopics: boolean }) {
  return (
    <section className="school-work-section-menu">
      <div>
        <h3>Status and follow-up</h3>
        <p>Choose which status view you want to open.</p>
      </div>
      <div className="editor-section-card-grid">
        <button className="editor-section-card" type="button" onClick={onOpenGrades}>
          <AdminCardTitle icon={faChartLine} title="Grades" />
          <span>Open the assessment record for this subject class.</span>
        </button>
        <button className="editor-section-card" type="button" onClick={onOpenRemarks}>
          <AdminCardTitle icon={faMessage} title="Remarks" />
          <span>View and register remarks on students in this class.</span>
        </button>
        {hasTopics ? (
          <button className="editor-section-card" type="button" onClick={onOpenTopics}>
            <AdminCardTitle icon={faBookOpen} title="Topic performance" />
            <span>See how students are performing across different topics.</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SchoolWorkSettingsCards({ onOpenAssessmentScales, onOpenRemarkCategories }: { onOpenAssessmentScales: () => void; onOpenRemarkCategories: () => void }) {
  return (
    <section className="school-work-section-menu">
      <div>
        <h3>Settings</h3>
        <p>Choose which school work setting you want to manage.</p>
      </div>
      <div className="editor-section-card-grid">
        <button className="editor-section-card" type="button" onClick={onOpenAssessmentScales}>
          <AdminCardTitle icon={faScaleBalanced} title="Assessment scales" />
          <span>Manage global scale availability and school-specific scales.</span>
        </button>
        <button className="editor-section-card" type="button" onClick={onOpenRemarkCategories}>
          <AdminCardTitle icon={faTags} title="Remark categories" />
          <span>Control which remark categories are available and add school-specific ones.</span>
        </button>
      </div>
    </section>
  );
}

function SchoolWorkSubjectSettings({
  globalAssessmentScales,
  settings,
  accessLevel = "admin",
  onChange,
  onBack,
}: {
  globalAssessmentScales: AssessmentScale[];
  settings: SchoolWorkSettings;
  accessLevel?: "admin" | "teacher";
  onChange: (settings: SchoolWorkSettings) => void;
  onBack: () => void;
}) {
  const enabledGlobalIds = settings.enabledGlobalAssessmentScaleIds ?? [];
  const customScales = settings.customAssessmentScales ?? [];
  const canAddCustomScale = accessLevel === "admin" || !settings.disableTeacherCustomScales;
  const setCustomScale = (scaleIndex: number, scale: AssessmentScale) => {
    onChange({
      ...settings,
      customAssessmentScales: customScales.map((item, index) => index === scaleIndex ? scale : item),
    });
  };

  return (
    <section className="subject-overview-panel school-work-settings-panel">
      <button className="school-work-back-link" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to settings
      </button>
      <div className="subject-student-heading">
        <h3>Assessment scales</h3>
        <span>Assessment scales</span>
      </div>
      <div className="settings-scale-section">
        <h4>Global assessment scales</h4>
        <p>Global scales are managed by superadmins. Schools can disable scales they do not want to use.</p>
        {globalAssessmentScales.length === 0 ? (
          <div className="empty-editor-state">
            <h3>No global scales available</h3>
            <p>Add global scales from the superadmin settings.</p>
          </div>
        ) : (
          <div className="settings-scale-list">
            {globalAssessmentScales.map((scale) => (
              <article className="settings-scale-card readonly-scale-card" key={scale.id}>
                <div>
                  <h4>{scale.name}</h4>
                  <p>{formatAssessmentScaleSummary(scale)}</p>
                  <small>{scale.levels.map((level) => level.value).join(", ")}</small>
                </div>
                <CheckboxInput
                  label="Enabled"
                  checked={enabledGlobalIds.includes(scale.id)}
                  onChange={(checked) => onChange({
                    ...settings,
                    knownGlobalAssessmentScaleIds: globalAssessmentScales.map((item) => item.id),
                    enabledGlobalAssessmentScaleIds: checked
                      ? mergeUnique([...enabledGlobalIds, scale.id])
                      : enabledGlobalIds.filter((id) => id !== scale.id),
                  })}
                />
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="settings-scale-section">
        <div className="test-question-actions">
          <div>
            <h4>School assessment scales</h4>
            <p>Create scales that only this school uses.</p>
          </div>
          {canAddCustomScale ? (
            <button className="secondary-action" type="button" onClick={() => onChange({
              ...settings,
              customAssessmentScales: [...customScales, createCustomAssessmentScale()],
            })}>
              Add assessment scale
            </button>
          ) : (
            <span className="form-status">Disabled by admin</span>
          )}
        </div>
        {customScales.length === 0 ? (
          <div className="empty-editor-state">
            <h3>No school-specific scales yet</h3>
            <p>Add a custom scale if this school needs its own grading language.</p>
          </div>
        ) : (
          <div className="settings-scale-list">
            {customScales.map((scale, scaleIndex) => (
              <article className="settings-scale-card" key={scale.id}>
                <TextInput label="Scale name" value={scale.name} onChange={(name) => setCustomScale(scaleIndex, { ...scale, name })} />
                <TextInput label="Scale id" value={scale.id} onChange={(id) => setCustomScale(scaleIndex, { ...scale, id: slugifySchoolName(id) })} />
                <div className="test-question-actions">
                  <h4>Levels</h4>
                  <button className="secondary-action" type="button" onClick={() => setCustomScale(scaleIndex, {
                    ...scale,
                    levels: [...scale.levels, { id: `level-${Date.now()}`, value: "New level", minPercentage: 0 }],
                  })}>
                    Add level
                  </button>
                </div>
                {scale.levels.map((level, levelIndex) => (
                  <div className="assessment-level-row" key={level.id}>
                    <TextInput label="Value" value={level.value} onChange={(value) => setCustomScale(scaleIndex, {
                      ...scale,
                      levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, value } : item),
                    })} />
                    <label className="field-label">
                      Minimum percentage
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={level.minPercentage}
                        onChange={(event) => setCustomScale(scaleIndex, {
                          ...scale,
                          levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, minPercentage: Number(event.target.value) } : item),
                        })}
                      />
                    </label>
                    <button className="remove-button" type="button" onClick={() => setCustomScale(scaleIndex, {
                      ...scale,
                      levels: scale.levels.filter((_, index) => index !== levelIndex),
                    })}>
                      Remove level
                    </button>
                  </div>
                ))}
                <button className="remove-button" type="button" onClick={() => onChange({
                  ...settings,
                  customAssessmentScales: customScales.filter((_, index) => index !== scaleIndex),
                })}>
                  Remove scale
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SchoolWorkRemarkCategorySettings({
  globalRemarkCategories,
  remarkSettings,
  onChange,
  onBack,
}: {
  globalRemarkCategories: RemarkCategory[];
  remarkSettings: SchoolRemarkSettings;
  onChange: (settings: SchoolRemarkSettings) => void;
  onBack: () => void;
}) {
  const customCategories = remarkSettings.customCategories ?? [];
  const disabledIds = new Set(remarkSettings.disabledGlobalCategoryIds);

  const toggleGlobal = (id: string, enabled: boolean) => onChange({
    ...remarkSettings,
    disabledGlobalCategoryIds: enabled
      ? remarkSettings.disabledGlobalCategoryIds.filter((x) => x !== id)
      : [...remarkSettings.disabledGlobalCategoryIds, id],
  });

  return (
    <section className="subject-overview-panel school-work-settings-panel">
      <button className="school-work-back-link" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to settings
      </button>
      <div className="subject-student-heading">
        <h3>Remark categories</h3>
        <span>Remark categories</span>
      </div>
      {REMARK_PARENTS.map((parent) => {
        const globalChildren = globalRemarkCategories.filter((c) => c.parentId === parent.id);
        const customChildren = customCategories.filter((c) => c.parentId === parent.id);
        return (
          <div className="settings-scale-section" key={parent.id}>
            <h4>{parent.name}</h4>
            {globalChildren.length > 0 ? (
              <>
                <p>Global sub-types — enable or disable for this school.</p>
                <div className="settings-scale-list">
                  {globalChildren.map((cat) => (
                    <article className="settings-scale-card readonly-scale-card" key={cat.id}>
                      <div><span>{cat.name}</span></div>
                      <CheckboxInput
                        label="Enabled"
                        checked={!disabledIds.has(cat.id)}
                        onChange={(checked) => toggleGlobal(cat.id, checked)}
                      />
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="form-status">No global sub-types defined for {parent.name}.</p>
            )}
            <div className="test-question-actions" style={{ marginTop: "0.75rem" }}>
              <div>
                <strong>School-specific sub-types</strong>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={() => onChange({ ...remarkSettings, customCategories: [...customCategories, { id: `src-${Date.now()}`, name: "", parentId: parent.id }] })}
              >
                Add sub-type
              </button>
            </div>
            {customChildren.length === 0 ? (
              <p className="form-status">No school-specific sub-types yet.</p>
            ) : (
              <div className="remark-category-editor-list">
                {customChildren.map((cat) => (
                  <div className="remark-category-editor-row" key={cat.id}>
                    <TextInput
                      label="Sub-type name"
                      value={cat.name}
                      onChange={(name) => onChange({ ...remarkSettings, customCategories: customCategories.map((item) => item.id === cat.id ? { ...item, name } : item) })}
                    />
                    <button className="remove-button" type="button" onClick={() => onChange({ ...remarkSettings, customCategories: customCategories.filter((item) => item.id !== cat.id) })}>
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function SubjectClassWorkPage({
  subjectClass,
  subjects,
  students,
  assessmentScales,
  globalAssessmentScales = [],
  schoolWorkSettings,
  allSubjectClasses = [],
  remarks = [],
  remarkSettings,
  globalRemarkCategories = [],
  accessLevel = "admin",
  activeStudentId,
  initialSimulatedStudentId,
  graderLabel,
  onBack,
  onChange,
  onSchoolWorkSettingsChange,
  onRemarkSettingsChange,
  onRemarksChange,
}: {
  subjectClass: SubjectClass | null;
  subjects: Subject[];
  students: Student[];
  assessmentScales: AssessmentScale[];
  globalAssessmentScales?: AssessmentScale[];
  schoolWorkSettings?: SchoolWorkSettings;
  allSubjectClasses?: SubjectClass[];
  remarks?: Remark[];
  remarkSettings?: SchoolRemarkSettings;
  globalRemarkCategories?: RemarkCategory[];
  accessLevel?: SchoolWorkAccessLevel;
  activeStudentId?: string;
  initialSimulatedStudentId?: string | null;
  graderLabel?: string;
  onBack: () => void;
  onChange: (subjectClass: SubjectClass) => void;
  onSchoolWorkSettingsChange?: (settings: SchoolWorkSettings) => void | Promise<void>;
  onRemarkSettingsChange?: (settings: SchoolRemarkSettings) => void;
  onRemarksChange?: (remarks: Remark[]) => void;
}) {
  const [activeWorkTab, setActiveWorkTab] = useState<"overview" | "resources" | "status" | "topics" | "students" | "settings">("resources");
  const [activeSettingsSection, setActiveSettingsSection] = useState<"assessmentScales" | "remarkCategories" | null>(null);
  const [activeStatusSection, setActiveStatusSection] = useState<"grades" | "remarks" | "topics" | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState("root");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftFolderEdit, setDraftFolderEdit] = useState<Pick<ResourceFolder, "name" | "description">>({ name: "", description: "" });
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [showFolderResourcePicker, setShowFolderResourcePicker] = useState(false);
  const [newResourceType, setNewResourceType] = useState<SubjectResource["type"] | "assessment" | "folder" | null>(null);
  const [newResourceDraft, setNewResourceDraft] = useState<{ title: string; url: string; date: string; format: string; scaleId: string; topicIds: string[]; imageDataUrl: string }>({ title: "", url: "https://", date: new Date().toISOString().slice(0, 10), format: assessmentFormatOptions[0]?.value ?? "", scaleId: "", topicIds: [], imageDataUrl: "" });
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set(["root"]));
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null>(null);
  const [draftAnnouncement, setDraftAnnouncement] = useState<Pick<SubjectClassAnnouncement, "title" | "body">>({ title: "", body: "" });
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [confirmationAnnouncementId, setConfirmationAnnouncementId] = useState<string | null>(null);
  const [selectedGradeAssessmentId, setSelectedGradeAssessmentId] = useState<string | null>(null);
  const committedResources = useMemo(() => subjectClass?.resources ?? [], [subjectClass?.resources]);
  const committedResourceSignature = useMemo(() => JSON.stringify(committedResources), [committedResources]);
  const pendingResourceSaveSignature = useRef<string | null>(null);
  const recordedStudentOpenKey = useRef<string | null>(null);
  const [draftResources, setDraftResources] = useState<SubjectResource[]>(committedResources);
  const [hasUnsavedResourceChanges, setHasUnsavedResourceChanges] = useState(false);
  const [previewTest, setPreviewTest] = useState<SubjectResource | null>(null);
  const [previewSubmission, setPreviewSubmission] = useState<NonNullable<SubjectResource["testSubmissions"]>[number]>({ studentId: "preview", answers: {} });
  const [simulatedStudentId, setSimulatedStudentId] = useState<string | null>(initialSimulatedStudentId ?? null);

  useEffect(() => {
    const effectiveLevel = simulatedStudentId ? "student" : accessLevel;
    if (effectiveLevel === "student" && activeWorkTab !== "resources" && activeWorkTab !== "status") {
      setActiveWorkTab("resources");
    }
  }, [accessLevel, activeWorkTab, simulatedStudentId]);

  useEffect(() => {
    if (accessLevel !== "student" || !activeStudentId || !subjectClass) {
      return;
    }
    const openKey = `${subjectClass.id}:${activeStudentId}`;
    if (recordedStudentOpenKey.current === openKey) {
      return;
    }
    recordedStudentOpenKey.current = openKey;

    onChange({
      ...subjectClass,
      studentActivity: [
        ...(subjectClass.studentActivity ?? []).filter((activity) => activity.studentId !== activeStudentId),
        { studentId: activeStudentId, lastOpenedAt: new Date().toISOString() },
      ],
    });
  }, [accessLevel, activeStudentId, onChange, subjectClass]);

  useEffect(() => {
    if (hasUnsavedResourceChanges) {
      return;
    }

    if (pendingResourceSaveSignature.current && pendingResourceSaveSignature.current !== committedResourceSignature) {
      return;
    }

    pendingResourceSaveSignature.current = null;
    setDraftResources(committedResources);
  }, [committedResources, committedResourceSignature, hasUnsavedResourceChanges]);

  if (!subjectClass) {
    return (
      <div className="empty-editor-state">
        <h3>Subject class not found</h3>
        <button className="secondary-action" type="button" onClick={onBack}>Back</button>
      </div>
    );
  }

  const subject = subjects.find((item) => item.id === subjectClass.subjectId);
  const canGradeSchoolWork = accessLevel === "admin" || accessLevel === "teacher";
  const canManageSchoolWorkSettings = accessLevel === "admin" || accessLevel === "teacher";
  const effectiveSchoolWorkSettings = schoolWorkSettings ?? {
    enabledGlobalAssessmentScaleIds: globalAssessmentScales.map((scale) => scale.id),
    knownGlobalAssessmentScaleIds: globalAssessmentScales.map((scale) => scale.id),
    allowStudentMessaging: false,
    customAssessmentScales: [],
  };
  const announcements = subjectClass.announcements ?? [];
  const allAssessments = subjectClass.assessments ?? [];
  const subjectClassStudents = students.filter((student) => subjectClass.studentIds.includes(student.id));
  const isSimulatingStudent = Boolean(simulatedStudentId) && (accessLevel === "teacher" || accessLevel === "admin");
  const effectiveAccessLevel: SchoolWorkAccessLevel = isSimulatingStudent ? "student" : accessLevel;
  const assessments = effectiveAccessLevel === "student" ? allAssessments.filter((a) => !a.hidden) : allAssessments;
  const effectiveStudentId = isSimulatingStudent ? simulatedStudentId! : activeStudentId;
  const simulatedStudent = isSimulatingStudent ? subjectClassStudents.find((s) => s.id === simulatedStudentId) : null;
  const canCreateSchoolWork = effectiveAccessLevel === "admin" || effectiveAccessLevel === "teacher";
  const effectiveRemarkCategories = getEffectiveRemarkCategories(globalRemarkCategories, remarkSettings);
  const subjectClassLabel = (() => {
    const sub = subjects.find((s) => s.id === subjectClass.subjectId);
    return sub ? `${sub.name} – ${subjectClass.name}` : subjectClass.name;
  })();
  const studentActivity = subjectClass.studentActivity ?? [];
  const folders = subjectClass.resourceFolders ?? [];
  const resources = draftResources;
  const activeFolderId = selectedFolderId === "root" ? undefined : selectedFolderId;
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const selectedResource = resources.find((resource) => resource.id === selectedResourceId) ?? null;
  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? null;
  const selectedTreeFolderId = selectedResource
    ? (selectedResource.folderId ?? "root")
    : selectedAssessment
      ? (selectedAssessment.folderId ?? "root")
      : activeFolder
        ? activeFolder.id
        : "root";
  const oneLevelUpTargetId = selectedResource
    ? (selectedResource.folderId ?? "root")
    : selectedAssessment
      ? (selectedAssessment.folderId ?? "root")
      : activeFolder
        ? (activeFolder.parentId ?? "root")
        : null;
  const oneLevelUpTargetFolder = oneLevelUpTargetId && oneLevelUpTargetId !== "root"
    ? folders.find((folder) => folder.id === oneLevelUpTargetId)
    : null;
  const oneLevelUpLabel = oneLevelUpTargetId === "root" ? subjectClass.name : oneLevelUpTargetFolder?.name;
  const childFolders = folders.filter((folder) => (folder.parentId ?? "root") === selectedTreeFolderId);
  const folderResources = resources.filter((resource) => (resource.folderId ?? "root") === selectedTreeFolderId && (effectiveAccessLevel !== "student" || !resource.hidden));
  const folderAssessments = assessments.filter((assessment) => (assessment.folderId ?? "root") === selectedTreeFolderId);
  const updateFolders = (nextFolders: ResourceFolder[]) => onChange({ ...subjectClass, resourceFolders: nextFolders });
  const updateResources = (nextResources: SubjectResource[]) => onChange({ ...subjectClass, resources: nextResources });
  const updateAssessments = (nextAssessments: Assessment[]) => onChange({ ...subjectClass, assessments: nextAssessments });
  const openFolderEditor = (folder: ResourceFolder) => {
    setDraftFolderEdit({ name: folder.name, description: folder.description ?? "" });
    setEditingFolderId(folder.id);
  };
  const closeFolderEditor = () => {
    setEditingFolderId(null);
    setDraftFolderEdit({ name: "", description: "" });
  };
  const saveFolderEditor = () => {
    if (!editingFolderId) {
      return;
    }
    updateFolders(folders.map((folder) => folder.id === editingFolderId ? {
      ...folder,
      name: draftFolderEdit.name.trim() || "Untitled folder",
      description: draftFolderEdit.description?.trim() || undefined,
    } : folder));
    closeFolderEditor();
  };
  const updateAssessment = (assessmentId: string, patch: Partial<Assessment>) => {
    updateAssessments(assessments.map((assessment) => assessment.id === assessmentId ? ensureAssessmentGrades({ ...assessment, ...patch }, subjectClassStudents) : assessment));
  };
  const updateAssessmentGrade = (assessmentId: string, studentId: string, patch: Partial<AssessmentGrade>) => {
    const isGradingPatch = canGradeSchoolWork && ("levelId" in patch || "feedback" in patch);
    updateAssessments(assessments.map((assessment) => {
      if (assessment.id !== assessmentId) {
        return assessment;
      }
      const existingGrade = assessment.grades.find((grade) => grade.studentId === studentId) ?? { studentId };
      const nextGrade = {
        ...existingGrade,
        ...patch,
        ...(isGradingPatch ? { gradedAt: new Date().toISOString(), gradedBy: graderLabel ?? "Admin" } : {}),
      };
      return {
        ...assessment,
        grades: [
          ...assessment.grades.filter((grade) => grade.studentId !== studentId),
          nextGrade,
        ],
      };
    }));
  };
  const postAnnouncement = () => {
    if (!draftAnnouncement.title.trim() && !draftAnnouncement.body.trim()) {
      return;
    }
    onChange({
      ...subjectClass,
      announcements: [{
        id: `subject-announcement-${Date.now()}`,
        title: draftAnnouncement.title.trim() || "Announcement",
        body: draftAnnouncement.body.trim(),
        createdAt: new Date().toISOString(),
        readConfirmations: [],
      }, ...announcements],
    });
    setDraftAnnouncement({ title: "", body: "" });
    setAnnouncementModalOpen(false);
  };
  const removeAnnouncement = (announcementId: string) => {
    onChange({ ...subjectClass, announcements: announcements.filter((announcement) => announcement.id !== announcementId) });
  };
  const getAnnouncementConfirmations = (announcement: SubjectClassAnnouncement) => announcement.readConfirmations ?? [];
  const getAnnouncementConfirmationCount = (announcement: SubjectClassAnnouncement) => (
    new Set(getAnnouncementConfirmations(announcement).map((confirmation) => confirmation.studentId)).size
  );
  const hasConfirmedAnnouncement = (announcement: SubjectClassAnnouncement) => (
    Boolean(effectiveStudentId && getAnnouncementConfirmations(announcement).some((confirmation) => confirmation.studentId === effectiveStudentId))
  );
  const confirmAnnouncementRead = (announcementId: string) => {
    if (!effectiveStudentId) {
      return;
    }
    onChange({
      ...subjectClass,
      announcements: announcements.map((announcement) => {
        if (announcement.id !== announcementId || hasConfirmedAnnouncement(announcement)) {
          return announcement;
        }
        return {
          ...announcement,
          readConfirmations: [
            ...getAnnouncementConfirmations(announcement),
            { studentId: effectiveStudentId, confirmedAt: new Date().toISOString() },
          ],
        };
      }),
    });
  };
  const selectedConfirmationAnnouncement = confirmationAnnouncementId
    ? announcements.find((announcement) => announcement.id === confirmationAnnouncementId) ?? null
    : null;
  const confirmNavigation = (): boolean => {
    if (!editingResourceId || !hasUnsavedResourceChanges) return true;
    return window.confirm("You have unsaved changes that will be lost if you navigate away. Continue?");
  };
  const selectTreeFolder = (folderId: string) => {
    if (!confirmNavigation()) return;
    setSelectedFolderId(folderId);
    setSelectedResourceId(null);
    setSelectedAssessmentId(null);
    setEditingFolderId(null);
    setEditingResourceId(null);
    setEditingAssessmentId(null);
    setShowFolderResourcePicker(false);
    setNewResourceType(null);
    setExpandedFolderIds((current) => new Set(current).add(folderId));
  };
  const selectOrCollapseTreeFolder = (folderId: string) => {
    const isCurrentFolderSelected = !selectedResourceId && !selectedAssessmentId && selectedFolderId === folderId;
    if (isCurrentFolderSelected && expandedFolderIds.has(folderId)) {
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        next.delete(folderId);
        return next;
      });
      return;
    }
    selectTreeFolder(folderId);
  };
  const selectResource = (resource: SubjectResource) => {
    if (!confirmNavigation()) return;
    setSelectedFolderId(resource.folderId ?? "root");
    setSelectedResourceId(resource.id);
    setSelectedAssessmentId(null);
    setEditingFolderId(null);
    setEditingResourceId(null);
    setEditingAssessmentId(null);
    setShowFolderResourcePicker(false);
    setNewResourceType(null);
  };
  const selectAssessment = (assessment: Assessment) => {
    if (!confirmNavigation()) return;
    setSelectedFolderId(assessment.folderId ?? "root");
    setSelectedResourceId(null);
    setSelectedAssessmentId(assessment.id);
    setEditingFolderId(null);
    setEditingResourceId(null);
    setEditingAssessmentId(null);
    setShowFolderResourcePicker(false);
    setNewResourceType(null);
  };
  const toggleTreeFolder = (folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };
  const saveResourceChanges = () => {
    pendingResourceSaveSignature.current = JSON.stringify(draftResources);
    setDraftResources(draftResources);
    updateResources(draftResources);
    setHasUnsavedResourceChanges(false);
    setEditingResourceId(null);
  };
  const addFolder = () => {
    const folder: ResourceFolder = {
      id: `folder-${Date.now()}`,
      name: "New folder",
      ...(activeFolderId ? { parentId: activeFolderId } : {}),
    };
    updateFolders([...folders, folder]);
    setSelectedFolderId(folder.id);
    setShowFolderResourcePicker(false);
  };
  const openNewResourceDraft = (type: SubjectResource["type"] | "assessment" | "folder") => {
    if (!confirmNavigation()) return;
    setNewResourceDraft({ title: "", url: "https://", date: new Date().toISOString().slice(0, 10), format: assessmentFormatOptions[0]?.value ?? "", scaleId: assessmentScales[0]?.id ?? "", topicIds: [], imageDataUrl: "" });
    setNewResourceType(type);
    setSelectedResourceId(null);
    setSelectedAssessmentId(null);
    setEditingResourceId(null);
    setEditingAssessmentId(null);
    setShowFolderResourcePicker(false);
  };
  const cancelNewResource = () => setNewResourceType(null);
  const confirmNewResource = () => {
    const title = newResourceDraft.title.trim();
    if (newResourceType === "folder") {
      const folder: ResourceFolder = { id: `folder-${Date.now()}`, name: title || "New folder", ...(activeFolderId ? { parentId: activeFolderId } : {}) };
      updateFolders([...folders, folder]);
      setSelectedFolderId(folder.id);
      setNewResourceType(null);
      setShowFolderResourcePicker(false);
      return;
    }
    if (newResourceType === "assessment") {
      const base = createAssessment(assessmentScales, activeFolderId);
      const assessment = ensureAssessmentGrades({ ...base, title: title || base.title, date: newResourceDraft.date, format: newResourceDraft.format, scaleId: newResourceDraft.scaleId || base.scaleId, topicIds: newResourceDraft.topicIds.length > 0 ? newResourceDraft.topicIds : undefined }, subjectClassStudents);
      updateAssessments([...assessments, assessment]);
      setSelectedAssessmentId(assessment.id);
      setSelectedResourceId(null);
      setEditingAssessmentId(assessment.id);
      setNewResourceType(null);
      return;
    }
    if (newResourceType === "test") {
      const resource = { ...createTestResource(activeFolderId), title: title || "New test" };
      const nextResources = [...committedResources, resource];
      updateResources(nextResources);
      setDraftResources(nextResources);
      setSelectedResourceId(resource.id);
      setSelectedAssessmentId(null);
      setEditingResourceId(resource.id);
      setHasUnsavedResourceChanges(false);
      setNewResourceType(null);
      return;
    }
    const type = newResourceType!;
    const resource: SubjectResource = {
      id: `resource-${type}-${Date.now()}`,
      type,
      title: title || (type === "note" ? "New note" : type === "link" ? "New link" : type === "file" ? "New file" : "New picture"),
      createdAt: new Date().toISOString(),
      ...(activeFolderId ? { folderId: activeFolderId } : {}),
      ...(type === "note" ? { body: "" } : type === "link" ? { url: newResourceDraft.url || "https://" } : type === "file" ? { fileDataUrl: "", fileName: "", fileType: "" } : { imageDataUrl: "", description: "" }),
    };
    const nextResources = [...committedResources, resource];
    updateResources(nextResources);
    setDraftResources(nextResources);
    setSelectedResourceId(resource.id);
    setSelectedAssessmentId(null);
    setEditingResourceId(resource.id);
    setHasUnsavedResourceChanges(false);
    setNewResourceType(null);
  };
  const updateResource = (resourceId: string, patch: Partial<SubjectResource>) => {
    setDraftResources(resources.map((resource) => resource.id === resourceId ? { ...resource, ...patch } : resource));
    setHasUnsavedResourceChanges(true);
  };
  const autoSaveResource = (resourceId: string, patch: Partial<SubjectResource>) => {
    const nextResources = resources.map((resource) => resource.id === resourceId ? { ...resource, ...patch } : resource);
    setDraftResources(nextResources);
    pendingResourceSaveSignature.current = JSON.stringify(nextResources);
    updateResources(nextResources);
    setHasUnsavedResourceChanges(false);
  };
  const uploadPictureResourceImage = async (resourceId: string, file: File | undefined) => {
    if (!file) {
      return;
    }
    const imageDataUrl = await prepareImageUpload(file, { maxWidth: 1200, maxHeight: 900, quality: 0.84 });
    updateResource(resourceId, { imageDataUrl });
  };
  const uploadFileResource = async (resourceId: string, file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_FILE_MIME_TYPES.includes(file.type)) {
      alert("Unsupported file type. Please upload a PDF, Word, Excel, or PowerPoint file.");
      return;
    }
    if (file.size > MAX_FILE_UPLOAD_BYTES) {
      alert(`File must be ${MAX_FILE_UPLOAD_LABEL} or smaller.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateResource(resourceId, { fileDataUrl: String(reader.result), fileName: file.name, fileType: file.type });
    };
    reader.readAsDataURL(file);
  };
  const removeFolder = (folderId: string) => {
    const folderToRemove = folders.find((folder) => folder.id === folderId);
    const idsToRemove = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((folder) => {
        if (folder.parentId && idsToRemove.has(folder.parentId) && !idsToRemove.has(folder.id)) {
          idsToRemove.add(folder.id);
          changed = true;
        }
      });
    }
    const resourceCount = committedResources.filter((resource) => resource.folderId && idsToRemove.has(resource.folderId)).length;
    const assessmentCount = assessments.filter((assessment) => assessment.folderId && idsToRemove.has(assessment.folderId)).length;
    const childFolderCount = idsToRemove.size - 1;
    const deleteDetails = [
      childFolderCount ? `${childFolderCount} subfolder${childFolderCount === 1 ? "" : "s"}` : "",
      resourceCount ? `${resourceCount} resource${resourceCount === 1 ? "" : "s"}` : "",
      assessmentCount ? `${assessmentCount} assessment${assessmentCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(", ");
    const message = `Delete folder "${folderToRemove?.name ?? "this folder"}"?${deleteDetails ? ` This will also delete ${deleteDetails}.` : ""} This cannot be undone.`;
    if (!window.confirm(message)) {
      return;
    }
    const nextFolders = folders.filter((folder) => !idsToRemove.has(folder.id));
    const nextResources = committedResources.filter((resource) => !resource.folderId || !idsToRemove.has(resource.folderId));
    const nextAssessments = assessments.filter((assessment) => !assessment.folderId || !idsToRemove.has(assessment.folderId));
    onChange({
      ...subjectClass,
      resourceFolders: nextFolders,
      resources: nextResources,
      assessments: nextAssessments,
    });
    setDraftResources(nextResources);
    setHasUnsavedResourceChanges(false);
    setSelectedResourceId(null);
    setSelectedAssessmentId(null);
    setSelectedFolderId("root");
    setEditingFolderId(null);
    setShowFolderResourcePicker(false);
  };
  const removeResource = (resourceId: string) => {
    const resourceToRemove = committedResources.find((resource) => resource.id === resourceId);
    if (!window.confirm(`Delete resource "${resourceToRemove?.title ?? "this resource"}"? This cannot be undone.`)) {
      return false;
    }
    const nextResources = committedResources.filter((resource) => resource.id !== resourceId);
    updateResources(nextResources);
    setDraftResources(nextResources);
    setHasUnsavedResourceChanges(false);
    setShowFolderResourcePicker(false);
    return true;
  };
  const removeAssessment = (assessmentId: string) => {
    const assessmentToRemove = assessments.find((assessment) => assessment.id === assessmentId);
    if (!window.confirm(`Delete assessment "${assessmentToRemove?.title ?? "this assessment"}"? This cannot be undone.`)) {
      return;
    }
    updateAssessments(assessments.filter((assessment) => assessment.id !== assessmentId));
    setSelectedAssessmentId(null);
    setShowFolderResourcePicker(false);
  };
  const moveResourceToFolder = (resourceId: string, folderId: string) => {
    const nextFolderId = folderId === "root" ? undefined : folderId;
    const nextCommittedResources = committedResources.map((resource) => {
      if (resource.id !== resourceId) {
        return resource;
      }
      return { ...resource, folderId: nextFolderId };
    });
    const nextDraftResources = resources.map((resource) => {
      if (resource.id !== resourceId) {
        return resource;
      }
      return { ...resource, folderId: nextFolderId };
    });
    updateResources(nextCommittedResources);
    setDraftResources(nextDraftResources);
    if (selectedResourceId === resourceId) {
      setSelectedFolderId(folderId);
    }
    setExpandedFolderIds((current) => new Set(current).add(folderId));
    setDragTargetFolderId(null);
  };
  const moveAssessmentToFolder = (assessmentId: string, folderId: string) => {
    const nextFolderId = folderId === "root" ? undefined : folderId;
    updateAssessments(assessments.map((assessment) => {
      if (assessment.id !== assessmentId) {
        return assessment;
      }
      return { ...assessment, folderId: nextFolderId };
    }));
    if (selectedAssessmentId === assessmentId) {
      setSelectedFolderId(folderId);
    }
    setExpandedFolderIds((current) => new Set(current).add(folderId));
    setDragTargetFolderId(null);
  };
  const resourceTypePicker = (
    <div className="resource-type-grid">
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("folder")}>
        <Folder size={34} />
        <span>
          <strong>Folder</strong>
          <small>Organise content into a course structure.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("note")}>
        <FileText size={34} />
        <span>
          <strong>Note</strong>
          <small>Create simple text notes for learners.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("link")}>
        <Link2 size={34} />
        <span>
          <strong>Link</strong>
          <small>Add an external learning resource.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("picture")}>
        <Image size={34} />
        <span>
          <strong>Picture with description</strong>
          <small>Upload an image and add learner-facing context.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("assessment")}>
        <ClipboardCheck size={34} />
        <span>
          <strong>Assessment</strong>
          <small>Create work to grade students and provide feedback.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("test")}>
        <CheckSquare size={34} />
        <span>
          <strong>Test</strong>
          <small>Create timed questions with autosaved student answers.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => openNewResourceDraft("file")}>
        <Paperclip size={34} />
        <span>
          <strong>File</strong>
          <small>Upload a PDF, Word, Excel, or PowerPoint document.</small>
        </span>
      </button>
    </div>
  );
  const handleFolderDragOver = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTargetFolderId(folderId);
  };
  const handleFolderDrop = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain");
    if (itemId.startsWith("assessment:")) {
      moveAssessmentToFolder(itemId.replace("assessment:", ""), folderId);
      return;
    }
    const resourceId = itemId.replace("resource:", "");
    if (resourceId) {
      moveResourceToFolder(resourceId, folderId);
    }
  };
  const renderResourceTree = (parentId: string, depth = 0): React.ReactNode => {
    const children = folders.filter((folder) => (folder.parentId ?? "root") === parentId);
    const childResources = resources.filter((resource) => (resource.folderId ?? "root") === parentId);
    const childAssessments = assessments.filter((assessment) => (assessment.folderId ?? "root") === parentId);
    const isExpanded = expandedFolderIds.has(parentId);
    return (
      <>
        {isExpanded ? (
          <>
            {children.map((folder) => {
              const folderIsExpanded = expandedFolderIds.has(folder.id);
              const folderHasChildren = folders.some((childFolder) => (childFolder.parentId ?? "root") === folder.id)
                || resources.some((resource) => (resource.folderId ?? "root") === folder.id)
                || assessments.some((assessment) => (assessment.folderId ?? "root") === folder.id);
              return (
                <div key={folder.id}>
                  <div
                    className={[
                      "resource-tree-item",
                      !selectedResource && !selectedAssessment && selectedFolderId === folder.id ? "active-resource-tree-item" : "",
                      dragTargetFolderId === folder.id ? "active-resource-drop-target" : "",
                    ].filter(Boolean).join(" ")}
                    onDragLeave={() => setDragTargetFolderId(null)}
                    onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                    onDrop={(event) => handleFolderDrop(event, folder.id)}
                    style={{ "--tree-depth": depth } as React.CSSProperties}
                  >
                    <button
                      className="resource-tree-toggle"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTreeFolder(folder.id);
                      }}
                      aria-label={folderIsExpanded ? "Collapse folder" : "Expand folder"}
                      disabled={!folderHasChildren}
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button className="resource-tree-label" type="button" onClick={() => selectOrCollapseTreeFolder(folder.id)}>
                      <Folder size={16} />
                      <span>{folder.name}</span>
                    </button>
                  </div>
                  <div
                    className="resource-tree-group"
                    style={{ "--tree-depth": depth + 1 } as React.CSSProperties}
                  >
                    {renderResourceTree(folder.id, depth + 1)}
                  </div>
                </div>
              );
            })}
            {childResources.map((resource) => (
              <button
                className={[
                  "resource-tree-item resource-tree-resource",
                  selectedResourceId === resource.id ? "active-resource-tree-item" : "",
                  resource.hidden ? "resource-tree-item--hidden" : "",
                ].filter(Boolean).join(" ")}
                draggable
                key={resource.id}
                type="button"
                onClick={() => selectResource(resource)}
                onDragEnd={() => setDragTargetFolderId(null)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", `resource:${resource.id}`);
                }}
                style={{ "--tree-depth": depth } as React.CSSProperties}
              >
                <span className="resource-tree-spacer" />
                {resource.type === "note" ? <FileText size={16} /> : resource.type === "link" ? <Link2 size={16} /> : resource.type === "test" ? <CheckSquare size={16} /> : resource.type === "file" ? <Paperclip size={16} /> : <Image size={16} />}
                <span>{resource.title}</span>
                {resource.hidden ? (
                  <button className="resource-tree-hidden-btn" type="button" title="Hidden from students — click to show" onClick={(e) => { e.stopPropagation(); updateResource(resource.id, { hidden: false }); }}>
                    <EyeOff size={12} />
                  </button>
                ) : null}
              </button>
            ))}
            {childAssessments.map((assessment) => (
              <button
                className={[
                  "resource-tree-item resource-tree-resource",
                  selectedAssessmentId === assessment.id ? "active-resource-tree-item" : "",
                  assessment.hidden ? "resource-tree-item--hidden" : "",
                ].filter(Boolean).join(" ")}
                draggable
                key={assessment.id}
                type="button"
                onClick={() => selectAssessment(assessment)}
                onDragEnd={() => setDragTargetFolderId(null)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", `assessment:${assessment.id}`);
                }}
                style={{ "--tree-depth": depth } as React.CSSProperties}
              >
                <span className="resource-tree-spacer" />
                <ClipboardCheck size={16} />
                <span>{assessment.title}</span>
                {assessment.hidden ? (
                  <button className="resource-tree-hidden-btn" type="button" title="Hidden from students — click to show" onClick={(e) => { e.stopPropagation(); updateAssessment(assessment.id, { hidden: false }); }}>
                    <EyeOff size={12} />
                  </button>
                ) : null}
              </button>
            ))}
            {canCreateSchoolWork ? (
              <button
                className={[
                  "resource-tree-item resource-tree-add-resource",
                  showFolderResourcePicker && selectedFolderId === parentId && !selectedResourceId && !selectedAssessmentId ? "active-resource-tree-add-resource" : "",
                ].filter(Boolean).join(" ")}
                type="button"
                onClick={() => {
                  selectTreeFolder(parentId);
                  setShowFolderResourcePicker(true);
                }}
                style={{ "--tree-depth": depth } as React.CSSProperties}
              >
                <span className="resource-tree-spacer" />
                <Plus size={16} />
                <span>Add resource</span>
              </button>
            ) : null}
          </>
        ) : null}
      </>
    );
  };

  return (
    <div className="school-work-page">
      <div className="editor-back-row">
        <button className="school-work-back-link" type="button" onClick={() => { if (confirmNavigation()) onBack(); }}>
          <ArrowLeft size={16} />
          Back to subject classes
        </button>
        {(accessLevel === "teacher" || accessLevel === "admin") && subjectClassStudents.length > 0 ? (
          isSimulatingStudent ? (
            <button className="simulate-student-exit-btn" type="button" onClick={() => setSimulatedStudentId(null)}>
              <UserRound size={14} />
              <span>Viewing as {simulatedStudent?.firstName} {simulatedStudent?.lastName}</span>
              · Exit
            </button>
          ) : (
            <label className="simulate-student-label">
              <UserRound size={14} />
              <select className="simulate-student-select" value="" onChange={(e) => e.target.value && setSimulatedStudentId(e.target.value)}>
                <option value="">Simulate student</option>
                {subjectClassStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>
                ))}
              </select>
            </label>
          )
        ) : null}
      </div>
      <nav
        className="subject-work-nav"
        aria-label="Subject class sections"
        style={{ "--subject-nav-color": subject?.color ?? "#1f6857" } as React.CSSProperties}
      >
        <span className="subject-work-nav-title">
          <span className="subject-work-nav-icon">
            <SchoolIcon size={20} />
          </span>
          <strong>{formatSchoolWorkClassTitle(subjectClass.name)}</strong>
        </span>
        <span className="subject-work-nav-tabs">
          <button className={activeWorkTab === "overview" ? "active-subject-work-tab" : ""} type="button" onClick={() => { if (confirmNavigation()) setActiveWorkTab("overview"); }}>Overview</button>
          <button className={activeWorkTab === "resources" ? "active-subject-work-tab" : ""} type="button" onClick={() => { if (confirmNavigation()) setActiveWorkTab("resources"); }}>Resources</button>
          <button className={activeWorkTab === "topics" ? "active-subject-work-tab" : ""} type="button" onClick={() => { if (confirmNavigation()) setActiveWorkTab("topics"); }}>Topics</button>
          <button className={activeWorkTab === "status" ? "active-subject-work-tab" : ""} type="button" onClick={() => {
            if (!confirmNavigation()) return;
            setActiveWorkTab("status");
            setActiveStatusSection(null);
            setSelectedGradeAssessmentId(null);
          }}>Status and follow-up</button>
          {effectiveAccessLevel !== "student" ? <button className={activeWorkTab === "students" ? "active-subject-work-tab" : ""} type="button" onClick={() => { if (confirmNavigation()) setActiveWorkTab("students"); }}>Students</button> : null}
          {canManageSchoolWorkSettings && !isSimulatingStudent ? <button className={activeWorkTab === "settings" ? "active-subject-work-tab" : ""} type="button" onClick={() => {
            if (!confirmNavigation()) return;
            setActiveWorkTab("settings");
            setActiveSettingsSection(null);
          }}>Settings</button> : null}
        </span>
      </nav>
      {activeWorkTab === "overview" ? (
        <section className="subject-overview-panel">
          {effectiveAccessLevel !== "student" ? (
            <div className="subject-overview-actions">
              <h3>Announcements</h3>
              <button className="primary-action" type="button" onClick={() => setAnnouncementModalOpen(true)}>
                <Plus size={16} />
                Add announcement
              </button>
            </div>
          ) : null}
          <div className="subject-announcement-list">
            {announcements.length === 0 ? (
              <div className="empty-editor-state">
                <h3>No announcements yet</h3>
                {effectiveAccessLevel !== "student" ? <p>Post announcements for this subject class here.</p> : null}
              </div>
            ) : announcements.map((announcement) => (
              <article className="subject-announcement-card" key={announcement.id}>
                <div>
                  <h3>{announcement.title}</h3>
                  <time>{formatDate(announcement.createdAt)}</time>
                </div>
                <div className="announcement-body" dangerouslySetInnerHTML={{ __html: announcement.body }} />
                {effectiveAccessLevel !== "student" ? (
                  <div className="subject-announcement-actions">
                    <button className="secondary-action" type="button" onClick={() => setConfirmationAnnouncementId(announcement.id)}>
                      Confirmed by {getAnnouncementConfirmationCount(announcement)}/{subjectClassStudents.length} students
                    </button>
                    <button className="remove-button" type="button" onClick={() => removeAnnouncement(announcement.id)}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                ) : effectiveStudentId ? (
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={hasConfirmedAnnouncement(announcement)}
                    onClick={() => confirmAnnouncementRead(announcement.id)}
                  >
                    {hasConfirmedAnnouncement(announcement) ? "Read confirmed" : "Confirm read"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          {announcementModalOpen ? (
            <RegistrationModal
              title="Add announcement"
              eyebrow="Announcements"
              submitLabel="Post announcement"
              onClose={() => setAnnouncementModalOpen(false)}
              onSubmit={postAnnouncement}
            >
              <TextInput
                label="Title"
                value={draftAnnouncement.title}
                onChange={(title) => setDraftAnnouncement((current) => ({ ...current, title }))}
              />
              <RichTextEditor
                label="Announcement"
                value={draftAnnouncement.body}
                onChange={(body) => setDraftAnnouncement((current) => ({ ...current, body }))}
              />
            </RegistrationModal>
          ) : null}
          {selectedConfirmationAnnouncement ? (
            <div className="modal-backdrop" role="presentation">
              <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-confirmations-title">
                <div className="staff-modal-header">
                  <div>
                    <p className="eyebrow">Read confirmations</p>
                    <h2 id="announcement-confirmations-title">{selectedConfirmationAnnouncement.title}</h2>
                  </div>
                </div>
                <div className="staff-modal-body">
                  <div className="announcement-confirmation-list">
                    {subjectClassStudents.map((student) => {
                      const confirmation = getAnnouncementConfirmations(selectedConfirmationAnnouncement).find((item) => item.studentId === student.id);
                      return (
                        <div className="announcement-confirmation-row" key={student.id}>
                          <strong>{student.firstName} {student.lastName}</strong>
                          <span>{confirmation ? `Confirmed ${formatDateTime(confirmation.confirmedAt)}` : "Not confirmed"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="staff-modal-actions">
                  <button className="secondary-action" type="button" onClick={() => setConfirmationAnnouncementId(null)}>
                    Close
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : null}
      {activeWorkTab === "status" ? (
        <section className="status-followup-page">
          {effectiveAccessLevel === "student" ? (
            <StudentGradebookView assessments={assessments} scales={assessmentScales} studentId={effectiveStudentId} />
          ) : !activeStatusSection ? (
            <SchoolWorkStatusCards onOpenGrades={() => setActiveStatusSection("grades")} onOpenRemarks={() => setActiveStatusSection("remarks")} onOpenTopics={() => setActiveStatusSection("topics")} hasTopics={(subjectClass.topics ?? []).length > 0} />
          ) : activeStatusSection === "topics" ? (
            <>
              <button className="school-work-back-link" type="button" onClick={() => setActiveStatusSection(null)}>
                <ArrowLeft size={16} />
                Back to status and follow-up
              </button>
              <TopicPerformanceView
                topics={subjectClass.topics ?? []}
                assessments={assessments}
                scales={assessmentScales}
                students={subjectClassStudents}
              />
            </>
          ) : activeStatusSection === "remarks" ? (
            <>
              <button className="school-work-back-link" type="button" onClick={() => setActiveStatusSection(null)}>
                <ArrowLeft size={16} />
                Back to status and follow-up
              </button>
              <RemarksView
                students={subjectClassStudents}
                allRemarks={remarks}
                categories={effectiveRemarkCategories}
                subjectClassId={subjectClass.id}
                subjectClassLabel={subjectClassLabel}
                allSubjectClasses={allSubjectClasses}
                subjects={subjects}
                canCreate={canCreateSchoolWork}
                createdByLabel={graderLabel}
                onChange={onRemarksChange ?? (() => {})}
              />
            </>
          ) : (
            <>
              {selectedGradeAssessmentId ? (() => {
            const selectedAssessment = assessments.find((assessment) => assessment.id === selectedGradeAssessmentId);
            if (!selectedAssessment) {
              return (
                <div className="empty-editor-state">
                  <h3>Assessment not found</h3>
                  <button className="assessment-back-link" type="button" onClick={() => setSelectedGradeAssessmentId(null)}>
                    <ArrowLeft size={16} />
                    Back to assessment record
                  </button>
                </div>
              );
            }
            return (
              <div className="assessment-detail-page">
                <div className="editor-back-row">
                  <button className="assessment-back-link" type="button" onClick={() => setSelectedGradeAssessmentId(null)}>
                    <ArrowLeft size={16} />
                    Back to assessment record
                  </button>
                </div>
                <AssessmentResourceDetail
                  assessment={selectedAssessment}
                  scale={assessmentScales.find((scale) => scale.id === selectedAssessment.scaleId) ?? assessmentScales[0]}
                  students={subjectClassStudents}
                  onEdit={() => {
                    const assessmentIndex = assessments.findIndex((item) => item.id === selectedAssessment.id);
                    if (assessmentIndex >= 0) {
                      setSelectedAssessmentId(selectedAssessment.id);
                      setEditingAssessmentId(selectedAssessment.id);
                      setActiveWorkTab("resources");
                    }
                  }}
                  onRemove={() => {
                    updateAssessments(assessments.filter((assessment) => assessment.id !== selectedAssessment.id));
                    setSelectedGradeAssessmentId(null);
                  }}
                  onGradeChange={(studentId, patch) => updateAssessmentGrade(selectedAssessment.id, studentId, patch)}
                />
              </div>
            );
              })() : (
                <>
                  <button className="school-work-back-link" type="button" onClick={() => setActiveStatusSection(null)}>
                    <ArrowLeft size={16} />
                    Back to status and follow-up
                  </button>
                  <GradebookView
                    assessments={assessments}
                    scales={assessmentScales}
                    students={subjectClassStudents}
                    onOpenAssessment={setSelectedGradeAssessmentId}
                  />
                </>
              )}
            </>
          )}
        </section>
      ) : null}
      {activeWorkTab === "students" ? (
        <section className="subject-overview-panel">
          <div className="subject-student-heading">
            <h3>Students</h3>
            <span>{subjectClassStudents.length} student{subjectClassStudents.length === 1 ? "" : "s"}</span>
          </div>
          {subjectClassStudents.length === 0 ? (
            <div className="empty-editor-state">
              <h3>No students in this subject class</h3>
              <p>Add students to this subject class from the Classes section.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table subject-student-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectClassStudents.map((student) => (
                    <tr key={student.id}>
                      <td><strong>{student.firstName} {student.lastName}</strong></td>
                      <td>{student.gender || "Not set"}</td>
                      <td>{formatLastActive(studentActivity.find((activity) => activity.studentId === student.id)?.lastOpenedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
      {activeWorkTab === "settings" && canManageSchoolWorkSettings && !activeSettingsSection ? (
        <SchoolWorkSettingsCards
          onOpenAssessmentScales={() => setActiveSettingsSection("assessmentScales")}
          onOpenRemarkCategories={() => setActiveSettingsSection("remarkCategories")}
        />
      ) : null}
      {activeWorkTab === "settings" && canManageSchoolWorkSettings && activeSettingsSection === "assessmentScales" ? (
        <SchoolWorkSubjectSettings
          globalAssessmentScales={globalAssessmentScales}
          settings={effectiveSchoolWorkSettings}
          accessLevel={accessLevel === "teacher" ? "teacher" : "admin"}
          onChange={(settings) => void onSchoolWorkSettingsChange?.(settings)}
          onBack={() => setActiveSettingsSection(null)}
        />
      ) : null}
      {activeWorkTab === "settings" && canManageSchoolWorkSettings && activeSettingsSection === "remarkCategories" ? (
        <SchoolWorkRemarkCategorySettings
          globalRemarkCategories={globalRemarkCategories}
          remarkSettings={remarkSettings ?? { disabledGlobalCategoryIds: [], customCategories: [] }}
          onChange={(next) => onRemarkSettingsChange?.(next)}
          onBack={() => setActiveSettingsSection(null)}
        />
      ) : null}
      {activeWorkTab === "topics" && canManageSchoolWorkSettings ? (
        <section className="subject-overview-panel">
          <div className="topic-tab-header">
            <h3>Topics</h3>
            <p>Define topics for this subject class, set the time period they are taught, and link a folder so that resources inside it appear here. Link assessments to topics to track student performance.</p>
          </div>
          <TopicSettings
            topics={subjectClass.topics ?? []}
            folders={folders}
            resources={draftResources}
            onChange={(topics) => onChange({ ...subjectClass, topics })}
            onCreateFolder={(name) => {
              const newFolder: ResourceFolder = { id: `folder-${Date.now()}`, name };
              updateFolders([...folders, newFolder]);
              return newFolder.id;
            }}
          />
          {(subjectClass.topics ?? []).length > 0 ? (
            <div className="topic-performance-section">
              <h4>Student performance by topic</h4>
              <TopicPerformanceView
                topics={subjectClass.topics ?? []}
                assessments={assessments}
                scales={assessmentScales}
                students={subjectClassStudents}
              />
            </div>
          ) : null}
        </section>
      ) : null}
      {activeWorkTab === "resources" ? (
        <div className="resource-workspace">
        <aside className="resource-tree-panel">
          <div className="resource-tree-heading">
            <strong>Folders</strong>
            {canCreateSchoolWork ? <button className="icon-action" type="button" onClick={addFolder} aria-label="Add folder">
              <Plus size={16} />
            </button> : null}
          </div>
          <div
            className={[
              "resource-tree-item",
              !selectedResource && !selectedAssessment && selectedFolderId === "root" ? "active-resource-tree-item" : "",
              dragTargetFolderId === "root" ? "active-resource-drop-target" : "",
            ].filter(Boolean).join(" ")}
            onDragLeave={() => setDragTargetFolderId(null)}
            onDragOver={(event) => handleFolderDragOver(event, "root")}
            onDrop={(event) => handleFolderDrop(event, "root")}
            style={{ "--tree-depth": 0 } as React.CSSProperties}
          >
            <button
              className="resource-tree-toggle"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleTreeFolder("root");
              }}
              aria-label={expandedFolderIds.has("root") ? "Collapse root folder" : "Expand root folder"}
            >
              <ChevronRight size={14} />
            </button>
            <button className="resource-tree-label" type="button" onClick={() => selectOrCollapseTreeFolder("root")}>
              <Folder size={16} />
              <span>{subjectClass.name}</span>
            </button>
          </div>
          <div className="resource-tree-children">
            {renderResourceTree("root", 1)}
          </div>
        </aside>

        <section className="resource-main-panel">
          <div className="resource-main-heading">
            {!selectedResource && !selectedAssessment ? (
              <div>
                <p className="eyebrow">{activeFolder ? "Folder" : "Course root"}</p>
                {activeFolder ? (
                  <div className="resource-folder-readonly">
                    <h3>{activeFolder.name}</h3>
                    {activeFolder.description ? <p>{activeFolder.description}</p> : null}
                  </div>
                ) : (
                  <h3>{formatSchoolWorkClassTitle(subjectClass.name)}</h3>
                )}
              </div>
            ) : null}
            {canCreateSchoolWork && activeFolder && !selectedResource && !selectedAssessment ? (
              <div className="resource-detail-actions">
                <button className="secondary-action" type="button" onClick={() => openFolderEditor(activeFolder)}>
                  Edit
                </button>
                <button className="remove-button resource-remove-button" type="button" onClick={() => removeFolder(activeFolder.id)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            ) : null}
          </div>

          {newResourceType ? (
            <div className="new-resource-form">
              <div className="new-resource-form-header">
                <p className="eyebrow">New {newResourceType === "assessment" ? "assessment" : newResourceType === "folder" ? "folder" : newResourceType === "note" ? "note" : newResourceType === "link" ? "link" : newResourceType === "picture" ? "picture" : newResourceType === "test" ? "test" : "file"}</p>
                <h3>
                  {newResourceType === "folder" ? <Folder size={18} /> : newResourceType === "note" ? <FileText size={18} /> : newResourceType === "link" ? <Link2 size={18} /> : newResourceType === "picture" ? <Image size={18} /> : newResourceType === "assessment" ? <ClipboardCheck size={18} /> : newResourceType === "test" ? <CheckSquare size={18} /> : <Paperclip size={18} />}
                  {newResourceDraft.title.trim() || (newResourceType === "folder" ? "New folder" : newResourceType === "note" ? "New note" : newResourceType === "link" ? "New link" : newResourceType === "picture" ? "New picture" : newResourceType === "assessment" ? "New assessment" : newResourceType === "test" ? "New test" : "New file")}
                </h3>
              </div>
              <div className="new-resource-form-fields">
                {newResourceType !== "folder" && newResourceType !== "file" ? (
                  <TextInput label="Title" value={newResourceDraft.title} onChange={(title) => setNewResourceDraft((d) => ({ ...d, title }))} />
                ) : null}
                {newResourceType === "folder" ? (
                  <TextInput label="Folder name" value={newResourceDraft.title} onChange={(title) => setNewResourceDraft((d) => ({ ...d, title }))} />
                ) : null}
                {newResourceType === "link" ? (
                  <TextInput label="URL" value={newResourceDraft.url} onChange={(url) => setNewResourceDraft((d) => ({ ...d, url }))} />
                ) : null}
                {newResourceType === "assessment" ? (
                  <>
                    <DateInput label="Due date" value={newResourceDraft.date} onChange={(date) => setNewResourceDraft((d) => ({ ...d, date }))} />
                    <SelectInput label="Format" value={newResourceDraft.format} options={assessmentFormatOptions} onChange={(format) => setNewResourceDraft((d) => ({ ...d, format }))} />
                    <SelectInput label="Assessment scale" value={newResourceDraft.scaleId} options={assessmentScales.map((s) => ({ value: s.id, label: s.name }))} onChange={(scaleId) => setNewResourceDraft((d) => ({ ...d, scaleId }))} />
                    {(subjectClass.topics ?? []).length > 0 ? (
                      <div className="field-label">
                        Topics
                        <div className="assessment-topic-checklist">
                          {(subjectClass.topics ?? []).map((topic) => (
                            <label key={topic.id} className="assessment-topic-check-row">
                              <input type="checkbox" checked={newResourceDraft.topicIds.includes(topic.id)} onChange={() => setNewResourceDraft((d) => ({ ...d, topicIds: d.topicIds.includes(topic.id) ? d.topicIds.filter((id) => id !== topic.id) : [...d.topicIds, topic.id] }))} />
                              {topic.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="new-resource-form-actions">
                <button className="primary-action" type="button" onClick={confirmNewResource}>Create</button>
                <button className="secondary-action" type="button" onClick={cancelNewResource}>Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="resource-content-list" style={newResourceType ? { display: "none" } : undefined}>
            {selectedResource ? (
              <article className="resource-list-item resource-detail-card">
                <div className="resource-list-item-heading">
                  {selectedResource.type === "note" ? <FileText size={22} /> : selectedResource.type === "link" ? <Link2 size={22} /> : selectedResource.type === "test" ? <CheckSquare size={22} /> : selectedResource.type === "file" ? <Paperclip size={22} /> : <Image size={22} />}
                  <strong>{selectedResource.title}</strong>
                  {canCreateSchoolWork ? <div className="resource-detail-actions">
                    {editingResourceId === selectedResource.id ? (
                      <button className="secondary-action" type="button" onClick={!hasUnsavedResourceChanges ? () => setEditingResourceId(null) : saveResourceChanges}>
                        <Save size={16} />
                        Done
                      </button>
                    ) : (
                      <button className="secondary-action" type="button" onClick={() => setEditingResourceId(selectedResource.id)}>
                        Edit
                      </button>
                    )}
                    <button className="remove-button" type="button" onClick={() => {
                      if (removeResource(selectedResource.id)) {
                        setSelectedResourceId(null);
                        setEditingResourceId(null);
                      }
                    }}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div> : null}
                </div>
                {canCreateSchoolWork && editingResourceId === selectedResource.id ? (
                  <>
                    <TextInput label="Title" value={selectedResource.title} onChange={(title) => updateResource(selectedResource.id, { title })} />
                    {selectedResource.type === "test" ? (
                      <>
                        <TestResourceEditor test={selectedResource} scales={assessmentScales} onChange={(patch) => updateResource(selectedResource.id, patch)} />
                      </>
                    ) : selectedResource.type === "link" ? (
                      <TextInput label="URL" value={selectedResource.url ?? ""} onChange={(url) => updateResource(selectedResource.id, { url })} />
                    ) : selectedResource.type === "picture" ? (
                      <>
                        <label className="field-label">
                          Picture
                          <input type="file" accept="image/*" onChange={(event) => void uploadPictureResourceImage(selectedResource.id, event.target.files?.[0])} />
                        </label>
                        {selectedResource.imageDataUrl ? <img className="resource-picture-preview" src={selectedResource.imageDataUrl} alt="" /> : null}
                        <TextArea label="Description" value={selectedResource.description ?? ""} onChange={(description) => updateResource(selectedResource.id, { description })} />
                      </>
                    ) : selectedResource.type === "file" ? (
                      <>
                        <label className="field-label">
                          File <small style={{ fontWeight: 400, color: "#5d6862" }}>(PDF, Word, Excel, PowerPoint — max {MAX_FILE_UPLOAD_LABEL})</small>
                          <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={(event) => void uploadFileResource(selectedResource.id, event.target.files?.[0])} />
                        </label>
                        {selectedResource.fileName ? <p className="resource-file-name"><Paperclip size={14} /> {selectedResource.fileName}</p> : null}
                      </>
                    ) : (
                      <TextArea label="Note" value={selectedResource.body ?? ""} onChange={(body) => updateResource(selectedResource.id, { body })} />
                    )}
                    <div className="resource-edit-footer">
                      <CheckboxInput
                        label="Visible to students"
                        checked={!selectedResource.hidden}
                        onChange={(visible) => updateResource(selectedResource.id, { hidden: !visible })}
                      />
                    </div>
                  </>
                ) : (
                  <div className={selectedResource.type === "note" ? "resource-note-readonly" : "resource-readonly-content"}>
                    {selectedResource.type === "test" ? (
                      <>
                        <TestResourceView
                          test={selectedResource}
                          scale={assessmentScales.find((scale) => scale.id === selectedResource.scaleId)}
                          accessLevel={effectiveAccessLevel}
                          activeStudentId={effectiveStudentId}
                          students={subjectClassStudents}
                          onBeginTest={canCreateSchoolWork ? () => {
                            setPreviewTest({ ...selectedResource, lobbyEnabled: false });
                            setPreviewSubmission({ studentId: "preview", answers: {}, startedAt: new Date().toISOString(), lastSavedAt: new Date().toISOString() });
                          } : undefined}
                          onSubmissionChange={(submission) => {
                            const submissions = selectedResource.testSubmissions ?? [];
                            autoSaveResource(selectedResource.id, {
                              testSubmissions: [
                                ...submissions.filter((item) => item.studentId !== submission.studentId),
                                submission,
                              ],
                            });
                          }}
                          onSubmissionDelete={(studentId) => {
                            const submissions = selectedResource.testSubmissions ?? [];
                            autoSaveResource(selectedResource.id, {
                              testSubmissions: submissions.filter((submission) => submission.studentId !== studentId),
                            });
                          }}
                        />
                      </>
                    ) : selectedResource.type === "link" ? (
                      selectedResource.url ? <a href={selectedResource.url} target="_blank" rel="noreferrer">{selectedResource.url}</a> : <span>No URL added.</span>
                    ) : selectedResource.type === "picture" ? (
                      <div className="resource-picture-readonly">
                        {selectedResource.imageDataUrl ? <img src={selectedResource.imageDataUrl} alt="" /> : <span>No picture uploaded.</span>}
                        <p>{selectedResource.description || "No description yet."}</p>
                      </div>
                    ) : selectedResource.type === "file" ? (
                      selectedResource.fileDataUrl ? (
                        <a className="resource-file-download" href={selectedResource.fileDataUrl} download={selectedResource.fileName}>
                          <Paperclip size={18} />
                          {selectedResource.fileName || "Download file"}
                        </a>
                      ) : <span>No file uploaded yet.</span>
                    ) : (
                      <>
                        <h3>{selectedResource.title}</h3>
                        <p>{selectedResource.body || "No note content yet."}</p>
                      </>
                    )}
                  </div>
                )}
              </article>
            ) : selectedAssessment ? (
              editingAssessmentId === selectedAssessment.id && canGradeSchoolWork ? (
                <article className="resource-list-item resource-detail-card assessment-card">
                  <div className="resource-list-item-heading">
                    <ClipboardCheck size={22} />
                    <strong>{selectedAssessment.title}</strong>
                    <div className="resource-detail-actions">
                      <button className="secondary-action" type="button" onClick={() => setEditingAssessmentId(null)}>
                        <Save size={16} />
                        Done
                      </button>
                      <button className="remove-button" type="button" onClick={() => removeAssessment(selectedAssessment.id)}>
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                  <AssessmentFields
                    assessment={selectedAssessment}
                    scales={assessmentScales}
                    topics={subjectClass.topics ?? []}
                    onChange={(assessment) => updateAssessment(selectedAssessment.id, assessment)}
                  />
                </article>
              ) : (
                <AssessmentResourceDetail
                  assessment={selectedAssessment}
                  scale={assessmentScales.find((scale) => scale.id === selectedAssessment.scaleId) ?? assessmentScales[0]}
                  students={subjectClassStudents}
                  onEdit={() => canGradeSchoolWork ? setEditingAssessmentId(selectedAssessment.id) : undefined}
                  onRemove={() => canGradeSchoolWork ? removeAssessment(selectedAssessment.id) : undefined}
                  onGradeChange={(studentId, patch) => updateAssessmentGrade(selectedAssessment.id, studentId, patch)}
                  mode={effectiveAccessLevel === "student" ? "student-submit" : "grade"}
                  activeStudentId={effectiveStudentId}
                />
              )
            ) : (
              <>
                {oneLevelUpTargetId ? (
                  <div className="resource-save-row has-one-level-up">
                    <button className="resource-one-level-up" type="button" onClick={() => selectTreeFolder(oneLevelUpTargetId)}>
                      <ArrowLeft size={16} />
                      <span>One level up</span>
                    </button>
                  </div>
                ) : null}
                {canCreateSchoolWork && (showFolderResourcePicker || (childFolders.length === 0 && folderResources.length === 0 && folderAssessments.length === 0)) ? (
                  resourceTypePicker
                ) : (
                  <>
                    {childFolders.map((folder) => (
                      <article className="resource-list-item folder-resource-item" key={folder.id}>
                        <button type="button" onClick={() => selectTreeFolder(folder.id)}>
                          <Folder size={22} />
                          <strong>{folder.name}</strong>
                        </button>
                      </article>
                    ))}
                    {folderResources.map((resource) => (
                      <article className={`resource-list-item folder-resource-item resource-preview-item${resource.hidden ? " resource-hidden-item" : ""}`} key={resource.id}>
                        <button type="button" onClick={() => selectResource(resource)}>
                          {resource.type === "note" ? <FileText size={22} /> : resource.type === "link" ? <Link2 size={22} /> : resource.type === "test" ? <CheckSquare size={22} /> : <Image size={22} />}
                          <span>
                            <strong>{resource.title}</strong>
                            <small>
                              {resource.type === "link"
                                ? resource.url || "No URL added"
                                : resource.type === "test"
                                  ? `${resource.dueDate ? formatDate(resource.dueDate) : "No due date"} · ${resource.questions?.length ?? 0} questions`
                                : resource.type === "picture"
                                  ? resource.description || "No description yet"
                                  : resource.body || "No note content yet"}
                            </small>
                          </span>
                        </button>
                        {canCreateSchoolWork ? (
                          <button
                            className={`resource-visibility-toggle${resource.hidden ? " resource-visibility-toggle--hidden" : ""}`}
                            type="button"
                            title={resource.hidden ? "Hidden from students — click to show" : "Visible to students — click to hide"}
                            onClick={() => updateResource(resource.id, { hidden: !resource.hidden })}
                          >
                            {resource.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        ) : null}
                      </article>
                    ))}
                    {folderAssessments.map((assessment) => (
                      <article className={`resource-list-item folder-resource-item resource-preview-item${assessment.hidden ? " resource-hidden-item" : ""}`} key={assessment.id}>
                        <button type="button" onClick={() => selectAssessment(assessment)}>
                          <ClipboardCheck size={22} />
                          <span>
                            <strong>{assessment.title}</strong>
                            <small>{formatAssessmentDate(assessment)} · {assessment.format} · {assessment.requiresTurnIn ? "Turn-in required" : "No turn-in required"}</small>
                          </span>
                        </button>
                        {canCreateSchoolWork ? (
                          <button
                            className={`resource-visibility-toggle${assessment.hidden ? " resource-visibility-toggle--hidden" : ""}`}
                            type="button"
                            title={assessment.hidden ? "Hidden from students — click to show" : "Visible to students — click to hide"}
                            onClick={() => updateAssessment(assessment.id, { hidden: !assessment.hidden })}
                          >
                            {assessment.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </section>
        </div>
      ) : null}
      {editingFolderId ? (
        <div className="modal-backdrop" role="presentation">
          <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="folder-edit-title">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">Folder</p>
                <h2 id="folder-edit-title">Edit folder</h2>
              </div>
            </div>
            <div className="staff-modal-body">
              <TextInput
                label="Folder name"
                value={draftFolderEdit.name}
                onChange={(name) => setDraftFolderEdit((current) => ({ ...current, name }))}
              />
              <TextArea
                label="Folder description"
                value={draftFolderEdit.description ?? ""}
                onChange={(description) => setDraftFolderEdit((current) => ({ ...current, description }))}
              />
            </div>
            <div className="staff-modal-actions">
              <button className="secondary-action" type="button" onClick={closeFolderEditor}>
                Close
              </button>
              <button className="primary-action" type="button" onClick={saveFolderEditor}>
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {previewTest ? (
        <div className="modal-backdrop test-preview-backdrop" role="presentation">
          <section className="staff-modal wide-staff-modal test-preview-modal" role="dialog" aria-modal="true" aria-labelledby="test-preview-title">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">Test preview</p>
                <h2 id="test-preview-title">{previewTest.title}</h2>
              </div>
            </div>
            <div className="staff-modal-body">
              <TestResourceView
                test={{ ...previewTest, testSubmissions: [previewSubmission] }}
                scale={assessmentScales.find((scale) => scale.id === previewTest.scaleId)}
                accessLevel="student"
                activeStudentId="preview"
                onSubmissionChange={(submission) => {
                  setPreviewSubmission(submission);
                  const liveTest = resources.find((resource) => resource.id === previewTest.id) ?? previewTest;
                  const submissions = liveTest.testSubmissions ?? [];
                  const nextTest = {
                    ...liveTest,
                    testSubmissions: [
                      ...submissions.filter((item) => item.studentId !== submission.studentId),
                      submission,
                    ],
                  };
                  setPreviewTest(nextTest);
                  autoSaveResource(previewTest.id, { testSubmissions: nextTest.testSubmissions });
                }}
              />
            </div>
            <div className="staff-modal-actions">
              <button className="secondary-action" type="button" onClick={() => setPreviewTest(null)}>
                Close preview
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
