import type {
  SchoolPayment,
  PaymentLineItem,
  Assessment,
  SubjectResource,
  AssessmentScale,
  SchoolGradeLevel,
  School,
  SchoolSubscription,
} from "../types";

export function formatBillingPeriod(period: string): string {
  if (period.length === 4) return period;
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getDaysInMonthFn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getDaysInYear(year: number): number {
  return new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
}

export function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getPaidAmount(payment: SchoolPayment): number {
  return payment.records.reduce((sum, r) => sum + r.amount, 0);
}

export function computePaymentStatus(payment: SchoolPayment): SchoolPayment["status"] {
  const paid = getPaidAmount(payment);
  if (paid <= 0) return new Date(payment.dueDate) > new Date() ? "upcoming" : "outstanding";
  if (paid >= payment.totalAmount) return "paid";
  return "partial";
}

export function generatePayment(school: School, period: string): SchoolPayment | null {
  const sub = school.subscription;
  if (!sub || sub.plan === "free") return null;
  const isYearly = sub.interval === "yearly";
  const lineItems: PaymentLineItem[] = [];

  if (isYearly && period.length === 4) {
    const year = parseInt(period);
    const daysInYear = getDaysInYear(year);
    const periodStart = new Date(year, 0, 1);
    const periodEnd = new Date(year, 11, 31);
    if (sub.plan === "fixed" && sub.fixedPrice !== undefined) {
      lineItems.push({ description: `Fixed subscription — ${period}`, unitPrice: sub.fixedPrice, amount: sub.fixedPrice });
    } else if (sub.plan === "per-student" && sub.pricePerStudent !== undefined) {
      for (const student of school.students.filter((s) => !s.accountDisabled)) {
        const ea = student.enrolledAt ? new Date(student.enrolledAt) : null;
        if (!ea || ea <= periodStart) {
          lineItems.push({ description: `${student.firstName} ${student.lastName}`, unitPrice: sub.pricePerStudent, amount: sub.pricePerStudent });
        } else if (ea <= periodEnd) {
          const dayOfYear = Math.floor((ea.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1;
          const days = daysInYear - dayOfYear + 1;
          const amount = Math.round((sub.pricePerStudent * days / daysInYear) * 100) / 100;
          lineItems.push({ description: `${student.firstName} ${student.lastName} (${days}/${daysInYear} days)`, unitPrice: sub.pricePerStudent, days, daysInPeriod: daysInYear, amount });
        }
      }
    }
    const totalAmount = lineItems.reduce((sum, i) => sum + i.amount, 0);
    return { id: `payment-${period}-${Date.now()}`, period, dueDate: `${year + 1}-01-07`, status: "upcoming", totalAmount, lineItems, records: [], comments: [], generatedAt: new Date().toISOString() };
  }

  if (!isYearly && period.length === 7) {
    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const dim = getDaysInMonthFn(year, month);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month - 1, dim);
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    const dueDate = `${ny}-${String(nm).padStart(2, "0")}-07`;
    if (sub.plan === "fixed" && sub.fixedPrice !== undefined) {
      lineItems.push({ description: `Fixed subscription — ${formatBillingPeriod(period)}`, unitPrice: sub.fixedPrice, amount: sub.fixedPrice });
    } else if (sub.plan === "per-student" && sub.pricePerStudent !== undefined) {
      for (const student of school.students.filter((s) => !s.accountDisabled)) {
        const ea = student.enrolledAt ? new Date(student.enrolledAt) : null;
        if (!ea || ea <= periodStart) {
          lineItems.push({ description: `${student.firstName} ${student.lastName}`, unitPrice: sub.pricePerStudent, amount: sub.pricePerStudent });
        } else if (ea <= periodEnd) {
          const days = dim - ea.getDate() + 1;
          const amount = Math.round((sub.pricePerStudent * days / dim) * 100) / 100;
          lineItems.push({ description: `${student.firstName} ${student.lastName} (${days}/${dim} days)`, unitPrice: sub.pricePerStudent, days, daysInPeriod: dim, amount });
        }
      }
    }
    const totalAmount = lineItems.reduce((sum, i) => sum + i.amount, 0);
    return { id: `payment-${period}-${Date.now()}`, period, dueDate, status: "upcoming", totalAmount, lineItems, records: [], comments: [], generatedAt: new Date().toISOString() };
  }

  return null;
}

export function getCurrentPeriod(interval: "monthly" | "yearly"): string {
  const now = new Date();
  if (interval === "monthly") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return String(now.getFullYear());
}

export function formatAssessmentScaleSummary(scale: AssessmentScale) {
  if (scale.levels.length > 12) {
    const numericValues = scale.levels.map((level) => Number(level.value)).filter(Number.isFinite);
    if (numericValues.length >= 10) {
      return `${Math.min(...numericValues)}-${Math.max(...numericValues)} (${scale.levels.length} levels)`;
    }
    return `${scale.levels.length} levels`;
  }

  return scale.levels.map((level) => level.value).join(", ");
}

export function getProctorEventLabel(type: "page-hidden" | "window-blur" | "fullscreen-exit" | "cursor-left-page" | "cursor-entered-page") {
  if (type === "page-hidden") {
    return "Page was hidden";
  }
  if (type === "window-blur") {
    return "Browser focus left the test";
  }
  if (type === "cursor-left-page") {
    return "Cursor left the page";
  }
  if (type === "cursor-entered-page") {
    return "Cursor entered the page";
  }
  return "Fullscreen was exited";
}

export function getCursorOutsideSessions(events: NonNullable<NonNullable<SubjectResource["testSubmissions"]>[number]["proctorEvents"]>) {
  const sessions: Array<{ id: string; leftAt: string; enteredAt?: string }> = [];
  for (const event of events) {
    if (event.type === "cursor-left-page") {
      sessions.push({ id: event.id, leftAt: event.at });
    }
    if (event.type === "cursor-entered-page") {
      const openSession = [...sessions].reverse().find((session) => !session.enteredAt);
      if (openSession) {
        openSession.enteredAt = event.at;
      }
    }
  }
  return sessions;
}

export function getTestTimerLabel(test: SubjectResource) {
  if (test.timerMode === "duration") {
    return `${test.timerMinutes ?? 45} minutes from start`;
  }
  if (test.timerMode === "fixed-end") {
    return test.timerEndsAt ? `Until ${test.timerEndsAt}` : "Fixed end time not set";
  }
  return "No timer";
}

export function formatGradeLevel(gradeLevel?: SchoolGradeLevel) {
  if (!gradeLevel) {
    return "";
  }
  const grade = gradeLevel.grade || "Grade";
  return `${grade}${gradeLevel.year ? ` (${gradeLevel.year})` : ""}`;
}

export function formatSubjectClassGradeLevel(gradeLevel?: SchoolGradeLevel) {
  if (!gradeLevel) {
    return "";
  }
  const grade = gradeLevel.grade.trim();
  const gradeLabel = grade.toLowerCase().startsWith("grade ") ? grade : `Grade ${grade || "Grade"}`;
  return `${gradeLabel}${gradeLevel.year ? ` - ${gradeLevel.year}` : ""}`;
}

export function formatSchoolWorkClassTitle(value: string) {
  return value
    .replace(/^Grade\b/i, "Class")
    .replace(/ - Grade\b/gi, " - Class");
}

export function formatDate(date: string) {
  const parsed = parseDisplayDate(date);
  if (!parsed) {
    return date;
  }
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(parsed);
}

export function formatDateTime(date: string) {
  const parsed = parseDisplayDate(date);
  if (!parsed) {
    return date;
  }
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDateTimeWithSeconds(date: string) {
  const parsed = parseDisplayDate(date);
  if (!parsed) {
    return date;
  }
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatLastActive(date?: string) {
  if (!date) {
    return "Never opened";
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Never opened";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

export function parseDisplayDate(date: string) {
  if (!date) {
    return null;
  }
  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatAssessmentDate(assessment: Assessment) {
  const formattedDate = formatDate(assessment.date);
  if (!assessment.requiresTurnIn || !assessment.dueTime) {
    return formattedDate;
  }
  const dueDate = getAssessmentDueDate(assessment);
  if (!dueDate) {
    return formattedDate;
  }
  return `${formattedDate}, ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(dueDate)}`;
}

export function getAssessmentDueDate(assessment: Assessment) {
  if (!assessment.date || !assessment.dueTime) {
    return null;
  }
  const [year, month, day] = assessment.date.split("-").map(Number);
  const [hour, minute] = assessment.dueTime.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute);
}

export function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function parsePercentageInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getTextExcerpt(html: string, maxLength: number) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}
