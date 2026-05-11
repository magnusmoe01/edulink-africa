import { useEffect, useMemo, useRef, useState } from "react";
import { createUserWithEmailAndPassword, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailAndPassword, signInWithEmailLink, signOut, type User } from "firebase/auth";
import {
  ArrowLeft,
  Bold,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  HelpCircle,
  LogOut,
  Paperclip,
  ClipboardCheck,
  CheckSquare,
  CheckCircle2,
  Clock,
  CreditCard,
  Receipt,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Globe2,
  GraduationCap,
  Heading2,
  Image,
  ImagePlus,
  Italic,
  LayoutDashboard,
  Link2,
  List,
  ListOrdered,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  Quote,
  Search,
  Save,
  School as SchoolIcon,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAddressBook,
  faBook,
  faBookOpen,
  faCalendarDays,
  faChalkboardUser,
  faChartLine,
  faCircleInfo,
  faClipboardCheck,
  faClipboardList,
  faFileLines,
  faFolder,
  faFolderOpen,
  faGaugeHigh,
  faGlobe,
  faIdCard,
  faImage,
  faKey,
  faLayerGroup,
  faLink,
  faMessage,
  faNewspaper,
  faRulerCombined,
  faScaleBalanced,
  faSliders,
  faTags,
  faUser,
  faUserGraduate,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { SchoolChatPopup } from "./components/SchoolChatPopup";
import { sampleSchool } from "./data/sampleSchool";
import {
  defaultGlobalAboutConfig,
  defaultGlobalSchoolWorkConfig,
  getAdminProfile,
  getGlobalAboutConfig,
  getGlobalSchoolWorkConfig,
  getLocalSchool,
  getSchool,
  getSuperAdmins,
  listSchools,
  saveGlobalAboutConfig,
  saveGlobalSchoolWorkConfig,
  saveSchool,
  saveSuperAdminProfile,
  slugifySchoolName,
  deleteSchool,
  deleteSuperAdminProfile,
  updateSuperAdminProfile,
} from "./lib/schools";
import { auth, createAuthUser, hasFirebaseConfig } from "./lib/firebase";
import type { AboutCategory, AboutPage, AdminProfile, Assessment, AssessmentGrade, AssessmentScale, CalendarItem, ClassGroup, GlobalAboutConfig, GlobalAboutPage, GlobalSchoolWorkConfig, Guardian, NewsItem, PaymentComment, PaymentLineItem, PaymentRecord, Remark, RemarkCategory, ResourceFolder, School, SchoolChatMessage, SchoolGradeLevel, SchoolPayment, SchoolRemarkSettings, SchoolSubscription, SchoolWorkSettings, StaffMember, Student, Subject, SubjectClass, SubjectClassAnnouncement, SubjectResource, SubmissionFile, SupportTicket, Topic } from "./types";

type EditorSection = "profile" | "contact" | "about" | "news" | "calendar" | "staff" | "access" | "grades" | "classes" | "subjectClasses" | "subjects" | "students" | "schoolWork" | "loginSettings" | "billing";
type EditorCategory = "schoolPage" | "people" | "academics" | "schoolWork" | "settings" | "billing";

const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "1MB";
const MAX_FILE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_FILE_UPLOAD_LABEL = "5MB";
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const ACCEPTED_FILE_MIME_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
const schoolCache = new Map<string, School>();
let globalAboutCache: GlobalAboutConfig | null = null;
const EMAIL_LINK_STORAGE_KEY = "edulink-email-link-address";
const subjectColorOptions = [
  "#1f6857",
  "#2f6fbb",
  "#8f4bb8",
  "#c65353",
  "#c5872f",
  "#5d6b7a",
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#65a30d",
  "#16a34a",
  "#059669",
  "#0891b2",
  "#0284c7",
  "#4f46e5",
  "#9333ea",
  "#c026d3",
  "#e11d48",
  "#be123c",
  "#92400e",
  "#854d0e",
  "#3f6212",
  "#166534",
  "#115e59",
  "#1e40af",
  "#334155",
];

const editorSections: Array<{ id: EditorSection; label: string }> = [
  { id: "profile", label: "School profile" },
  { id: "contact", label: "Contact details" },
  { id: "about", label: "Website pages" },
  { id: "news", label: "News" },
  { id: "calendar", label: "Calendar" },
  { id: "staff", label: "Staff and administrators" },
  { id: "access", label: "Access" },
  { id: "grades", label: "Grades and years" },
  { id: "classes", label: "Classes" },
  { id: "subjectClasses", label: "Subject classes" },
  { id: "subjects", label: "Subjects" },
  { id: "students", label: "Students" },
  { id: "schoolWork", label: "Subject class pages" },
  { id: "loginSettings", label: "Login format" },
  { id: "billing", label: "Billing" },
];

const editorCategories: Array<{
  id: EditorCategory;
  label: string;
  description: string;
  sections: EditorSection[];
}> = [
  {
    id: "schoolPage",
    label: "School page",
    description: "Public website content, contact details, pages, news, and calendar.",
    sections: ["profile", "contact", "about", "news", "calendar"],
  },
  {
    id: "people",
    label: "People",
    description: "Staff, administrators, students, access rights, guardians, and learner records.",
    sections: ["staff", "students", "access"],
  },
  {
    id: "academics",
    label: "Academics",
    description: "Grades, classes, subject classes, and subject catalog.",
    sections: ["grades", "classes", "subjectClasses", "subjects"],
  },
  {
    id: "schoolWork",
    label: "School work",
    description: "Course materials and subject class work.",
    sections: ["schoolWork"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "School-level access and platform preferences.",
    sections: ["loginSettings"],
  },
  {
    id: "billing",
    label: "Billing",
    description: "Subscription plan, invoices, and payment history.",
    sections: ["billing"],
  },
];

type StaffCategory = NonNullable<StaffMember["categories"]>[number];
type SchoolWorkAccessLevel = "admin" | "teacher" | "viewer" | "student";
type SchoolWorkIdentity =
  | { role: "admin"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "teacher"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "viewer"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "student"; label: string; subjectClasses: SubjectClass[]; studentId: string };

type Route =
  | { view: "home" }
  | { view: "login" }
  | { view: "superadmin" }
  | { view: "schoolWorkPortal"; id: string }
  | { view: "about"; id: string }
  | { view: "aboutPage"; schoolId: string; pageSlug: string }
  | { view: "globalCategoryPage"; schoolId: string; categoryId: string }
  | { view: "news"; id: string }
  | { view: "newsPage"; schoolId: string; newsSlug: string }
  | { view: "studentsGuardians"; id: string }
  | { view: "school"; id: string }
  | { view: "admin"; id: string };

function parseRoute(): Route {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] === "login") {
    return { view: "login" };
  }
  if (segments[0] === "superadmin") {
    return { view: "superadmin" };
  }
  if (segments[0] && segments[1] === "admin") {
    return { view: "admin", id: segments[0] };
  }
  if (segments[0] && segments[1] === "schoolwork") {
    return { view: "schoolWorkPortal", id: segments[0] };
  }
  if (segments[0] && segments[1] === "about" && segments[2]) {
    return { view: "aboutPage", schoolId: segments[0], pageSlug: segments[2] };
  }
  if (segments[0] && segments[1] === "about") {
    return { view: "about", id: segments[0] };
  }
  if (segments[0] && segments[1] === "news" && segments[2]) {
    return { view: "newsPage", schoolId: segments[0], newsSlug: segments[2] };
  }
  if (segments[0] && segments[1] === "news") {
    return { view: "news", id: segments[0] };
  }
  if (segments[0] && segments[1] === "for-students-and-guardians") {
    return { view: "studentsGuardians", id: segments[0] };
  }
  if (segments[0] && segments[1]) {
    return { view: "globalCategoryPage", schoolId: segments[0], categoryId: segments[1] };
  }
  if (segments[0]) {
    return { view: "school", id: segments[0] };
  }
  return { view: "home" };
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function openInNewTab(path: string) {
  window.open(path, "_blank", "noopener,noreferrer");
}

function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (route.view === "admin") {
    return <AdminPage schoolId={route.id} />;
  }

  if (route.view === "schoolWorkPortal") {
    return <SchoolWorkPortalPage schoolId={route.id} />;
  }

  if (route.view === "school") {
    return <SchoolPage schoolId={route.id} />;
  }

  if (route.view === "about") {
    return <AboutPageView schoolId={route.id} />;
  }

  if (route.view === "aboutPage") {
    return <AboutSinglePageView schoolId={route.schoolId} pageSlug={route.pageSlug} />;
  }

  if (route.view === "globalCategoryPage") {
    return <GlobalCategoryPageView schoolId={route.schoolId} categoryId={route.categoryId} />;
  }

  if (route.view === "news") {
    return <NewsPage schoolId={route.id} />;
  }

  if (route.view === "newsPage") {
    return <NewsSinglePage schoolId={route.schoolId} newsSlug={route.newsSlug} />;
  }

  if (route.view === "studentsGuardians") {
    return <StudentsGuardiansPage schoolId={route.id} />;
  }

  if (route.view === "login") {
    return <LoginPage />;
  }

  if (route.view === "superadmin") {
    return <SuperAdminPage />;
  }

  return <LandingPage />;
}

function LandingPage() {
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [lmsDemoChooserOpen, setLmsDemoChooserOpen] = useState(false);

  const slug = useMemo(() => slugifySchoolName(schoolName) || "demo", [schoolName]);
  const demoStudent = sampleSchool.students[0];
  const websiteFeatures = [
    { icon: Globe2, title: "School website", text: "Publish a clean public site with profile text, hero images, values, leadership, and contact details." },
    { icon: FileText, title: "News and pages", text: "Share announcements, school pages, staff information, and guardian-facing updates from one editor." },
    { icon: CalendarDays, title: "Calendar", text: "Keep families aligned with term dates, events, meetings, exams, and school activities." },
  ];
  const lmsFeatures = [
    { icon: Folder, title: "Subject class spaces", text: "Create subject classes with teachers, students, folders, files, links, and learning resources." },
    { icon: ClipboardCheck, title: "Assignments and assessment", text: "Set tasks, collect submissions, record marks, and use global or school-specific assessment scales." },
    { icon: UserRound, title: "Teacher and student access", text: "Route admins, teachers, and students into the right workspace with role-aware SchoolWork views." },
  ];
  const platformPillars = [
    "Website content management",
    "SchoolWork LMS",
    "Staff, learners, and guardians",
    "Assessments and resources",
    "Admin dashboards",
    "Login controls",
  ];

  const openLmsDemoView = (view: "admin" | "student") => {
    setLmsDemoChooserOpen(false);
    if (view === "admin") {
      openInNewTab(`/${sampleSchool.id}/schoolwork?simulateRole=admin`);
      return;
    }

    const params = new URLSearchParams({ simulateRole: "student", simulateId: demoStudent?.id ?? "student-001" });
    openInNewTab(`/${sampleSchool.id}/schoolwork?${params.toString()}`);
  };

  const registerSchool = async () => {
    const normalizedEmail = adminEmail.trim().toLowerCase();

    if (!normalizedEmail.includes("@")) {
      setRegistrationStatus("Enter the email address for the school admin.");
      return;
    }

    if (!adminPassword || adminPassword.length < 6) {
      setRegistrationStatus("Enter a password with at least 6 characters.");
      return;
    }

    const nextSchool: School = {
      ...sampleSchool,
      id: slug,
      name: schoolName || sampleSchool.name,
      city: city || sampleSchool.city,
      country: country || sampleSchool.country,
      email: `office@${slug}.example`,
      adminEmails: [],
      showWebsite: true,
      staff: [{
        name: "School administrator",
        role: "Administrator",
        category: "Administration",
        categories: ["Administration"],
        email: normalizedEmail,
        canAccessAdminPage: true,
        accountDisabled: false,
        visibleOnHomePage: false,
        visibleOnStaffPage: false,
      }],
      gradeLevels: [],
      classes: [],
      students: [],
      subjects: [],
      subjectClasses: [],
      aboutCategories: [],
      aboutPages: [],
      updatedAt: new Date().toISOString(),
    };

    try {
      setRegistrationStatus("Creating school page...");

      // Create Firebase auth account if config is available
      if (hasFirebaseConfig && auth) {
        setRegistrationStatus("Creating admin account...");
        try {
          await createUserWithEmailAndPassword(auth, normalizedEmail, adminPassword);
        } catch (authError: unknown) {
          const err = authError as { code?: string };
          // If user already exists, that's okay - they can still use existing credentials
          if (err.code !== "auth/email-already-in-use") {
            console.warn("Could not create auth account:", authError);
          }
        }
      }

      await saveSchool(nextSchool);
      navigate(`/${nextSchool.id}/admin`);
    } catch (error) {
      setRegistrationStatus(error instanceof Error ? error.message : "Could not create school page");
    }
  };

  return (
    <main>
      <section className="platform-hero">
        <header className="topbar">
          <button className="brand-button" onClick={() => navigate("/")}>
            <img src="/edulink-logo.png" alt="EduLink Africa logo" style={{ height: 38, width: 38, marginRight: 8, borderRadius: 8, background: '#fff' }} />
            <span>EduLink Africa</span>
          </button>
          <nav className="topnav" aria-label="Primary navigation">
            <button onClick={() => navigate("/demo")}>View demo</button>
            <button onClick={() => navigate("/demo/admin")}>Admin demo</button>
            <button onClick={() => navigate("/login")}>Login</button>
          </nav>
        </header>

        <div className="platform-hero-grid">
          <div className="platform-copy">
            <p className="eyebrow">School websites and LMS for African communities</p>
            <h1>One place for your school website and daily learning.</h1>
            <p>
              EduLink gives each school a public website families can trust and a fully working LMS for
              teachers, students, resources, assignments, assessment, and school administration.
            </p>
            <div className="hero-actions">
              <button className="primary-action" type="button" onClick={() => navigate("/demo")}>
                <Globe2 size={18} />
                View school website
              </button>
              <div className="demo-choice">
                <button className="secondary-action" type="button" onClick={() => setLmsDemoChooserOpen((open) => !open)} aria-expanded={lmsDemoChooserOpen}>
                  <ClipboardCheck size={18} />
                  Open LMS demo
                </button>
                {lmsDemoChooserOpen ? (
                  <div className="demo-choice-menu" role="dialog" aria-label="Choose LMS demo view">
                    <button type="button" onClick={() => openLmsDemoView("admin")}>
                      <LayoutDashboard size={18} />
                      <span>
                        <strong>Admin view</strong>
                        <small>Open all subject classes and management tools.</small>
                      </span>
                    </button>
                    <button type="button" onClick={() => openLmsDemoView("student")}>
                      <UserRound size={18} />
                      <span>
                        <strong>Student view</strong>
                        <small>Open the learner workspace for {demoStudent ? `${demoStudent.firstName} ${demoStudent.lastName}` : "the demo student"}.</small>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="platform-pillars" aria-label="EduLink platform features">
              {platformPillars.map((pillar) => (
                <span key={pillar}>{pillar}</span>
              ))}
            </div>
          </div>

          <form
            className="register-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void registerSchool();
            }}
          >
            <div className="panel-heading">
              <SchoolIcon />
              <div>
                <h2>Register school</h2>
                <p>Create the school site and admin dashboard, then enable SchoolWork for classes.</p>
              </div>
            </div>
            <label>
              School name
              <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="e.g. Accra Hope School" />
            </label>
            <div className="split-fields">
              <label>
                City
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Accra" />
              </label>
              <label>
                Country
                <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Ghana" />
              </label>
            </div>
            <label>
              Admin email
              <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin@school.edu" type="email" />
            </label>
            <label>
              Admin password
              <input value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Minimum 6 characters" type="password" />
            </label>
            <div className="slug-preview">
              <Globe2 size={18} />
              <span>edulink.africa/{slug}</span>
            </div>
            {registrationStatus ? <p className="form-status">{registrationStatus}</p> : null}
            <button className="primary-action" type="submit">
              <LayoutDashboard size={18} />
              Create school platform
            </button>
          </form>
        </div>
      </section>

      <section className="template-preview">
        <div>
          <img src="/edulink-logo.png" alt="EduLink Africa logo" style={{ height: 90, width: 90, marginBottom: 24, borderRadius: 16, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }} />
          <p className="eyebrow">Website plus learning platform</p>
          <h2>A public front door connected to the work happening inside school.</h2>
          <p>
            The homepage supports everyday school communication, while SchoolWork gives teachers and learners
            the structure they need for lessons, resources, tasks, submissions, and assessment.
          </p>
        </div>
        <SchoolMiniPreview />
      </section>

      <section className="feature-band">
        <div className="marketing-section-heading">
          <p className="eyebrow">Public school website</p>
          <h2>Everything families need to find quickly.</h2>
          <p>Give every school a professional website that is simple for administrators to maintain.</p>
        </div>
        <div className="feature-grid">
          {websiteFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="feature-card" key={feature.title}>
                <Icon size={24} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="feature-band lms-band">
        <div className="marketing-section-heading">
          <p className="eyebrow">Fully working LMS</p>
          <h2>SchoolWork supports actual teaching, not just a brochure page.</h2>
          <p>Teachers can organize learning materials, manage subject classes, assess work, and give learners a focused place to study.</p>
        </div>
        <div className="feature-grid">
          {lmsFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="feature-card" key={feature.title}>
                <Icon size={24} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workflow-section">
        <div className="marketing-section-heading">
          <p className="eyebrow">Designed for school operations</p>
          <h2>Admins set the structure. Teachers run classes. Students see their work.</h2>
        </div>
        <div className="workflow-grid">
          <div>
            <ShieldCheck size={28} />
            <h3>Admin control</h3>
            <p>Configure school profile, users, grade levels, classes, subjects, pages, login methods, and assessment scales.</p>
          </div>
          <div>
            <Mail size={28} />
            <h3>Clear communication</h3>
            <p>Keep school news, calendar dates, contact details, staff visibility, and guardian information in one place.</p>
          </div>
          <div>
            <GraduationCap size={28} />
            <h3>Learning continuity</h3>
            <p>Students can access their subject classes, resources, assignments, grades, and feedback through the LMS portal.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [authMethod, setAuthMethod] = useState<"password" | "email-link">("password");
  const [mode, setMode] = useState<"sign-in" | "create-account">("sign-in");
  const [status, setStatus] = useState("Sign in with your EduLink admin account.");
  const normalizedEmail = email.trim().toLowerCase();
  const matchingSchool = schools.find((school) => getSchoolAdminEmails(school).includes(normalizedEmail));
  const loginSettings = matchingSchool?.loginSettings ?? { emailPasswordEnabled: true, emailLinkEnabled: false };
  const passwordLoginEnabled = !matchingSchool || loginSettings.emailPasswordEnabled;
  const emailLinkLoginEnabled = Boolean(matchingSchool && loginSettings.emailLinkEnabled);
  const isCompletingEmailLink = Boolean(hasFirebaseConfig && auth && isSignInWithEmailLink(auth, window.location.href));

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      return undefined;
    }

    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
      setAuthMethod("email-link");
      if (storedEmail) {
        setEmail(storedEmail);
        setStatus("Completing email link sign-in...");
        void signInWithEmailLink(auth, storedEmail, window.location.href)
          .then((credential) => {
            window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
            window.history.replaceState({}, "", "/login");
            return redirectSignedInUser(credential.user, setStatus);
          })
          .catch((error) => {
            setStatus(error instanceof Error ? error.message : "Could not complete email link sign-in");
          });
      } else {
        setStatus("Enter the same email address you used to request this sign-in link.");
      }
      return undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      if (user) {
        void redirectSignedInUser(user, setStatus);
      }
    });
  }, []);

  useEffect(() => {
    void listSchools().then(setSchools).catch(() => setSchools([]));
  }, []);

  useEffect(() => {
    if (!passwordLoginEnabled && emailLinkLoginEnabled) {
      setAuthMethod("email-link");
    }
  }, [emailLinkLoginEnabled, passwordLoginEnabled]);

  const submit = async () => {
    if (!hasFirebaseConfig || !auth) {
      navigate("/superadmin");
      return;
    }

    try {
      if (!normalizedEmail.includes("@")) {
        setStatus("Enter a valid email address.");
        return;
      }

      if (isCompletingEmailLink) {
        setStatus("Completing email link sign-in...");
        const credential = await signInWithEmailLink(auth, normalizedEmail, window.location.href);
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        window.history.replaceState({}, "", "/login");
        await redirectSignedInUser(credential.user, setStatus);
        return;
      }

      if (authMethod === "email-link") {
        if (!emailLinkLoginEnabled) {
          setStatus(matchingSchool ? "Email link sign-in is not enabled for this school." : "Enter a staff email with admin page access to use email link sign-in.");
          return;
        }
        setStatus("Sending sign-in link...");
        await sendSignInLinkToEmail(auth, normalizedEmail, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: true,
        });
        window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, normalizedEmail);
        setStatus("Check your email for the sign-in link.");
        return;
      }

      if (!passwordLoginEnabled) {
        setStatus("Username and password login is disabled for this school.");
        return;
      }

      setStatus(mode === "sign-in" ? "Signing in..." : "Creating account...");
      const credential =
        mode === "sign-in"
          ? await signInWithEmailAndPassword(auth, normalizedEmail, password)
          : await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await redirectSignedInUser(credential.user, setStatus);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign in");
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <button className="brand-button" onClick={() => navigate("/")}>
          <GraduationCap size={28} />
          <span>EduLink Africa</span>
        </button>
        <div>
          <p className="eyebrow">Admin access</p>
          <h1>Login</h1>
          <p>School admins go to their editor. Staff and students go to SchoolWork.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="login-methods" role="radiogroup" aria-label="Login format">
            <button
              className={authMethod === "password" ? "active-login-method" : ""}
              disabled={!passwordLoginEnabled}
              type="button"
              onClick={() => setAuthMethod("password")}
            >
              Username and password
            </button>
            <button
              className={authMethod === "email-link" ? "active-login-method" : ""}
              disabled={!emailLinkLoginEnabled && !isCompletingEmailLink}
              type="button"
              onClick={() => setAuthMethod("email-link")}
            >
              Email link
            </button>
          </div>
          <TextInput label="Email" value={email} onChange={setEmail} />
          {authMethod === "password" ? (
            <label className="field-label">
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
          ) : null}
          <p className="form-status">{status}</p>
          <button className="primary-action" type="submit">
            <LogIn size={18} />
            {isCompletingEmailLink ? "Complete sign-in" : authMethod === "email-link" ? "Send sign-in link" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          {authMethod === "password" ? (
            <button
              className="secondary-action login-mode-button"
              disabled={!passwordLoginEnabled}
              type="button"
              onClick={() => setMode((current) => (current === "sign-in" ? "create-account" : "sign-in"))}
            >
              {mode === "sign-in" ? "Create admin account" : "Use existing account"}
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}

async function redirectSignedInUser(user: User, setStatus: (status: string) => void) {
  const profile = await getAdminProfile(user.uid, user.email);

  if (profile?.superAdmin) {
    navigate("/superadmin");
    return;
  }

  if (profile && profile.schoolIds.length > 0) {
    navigate(`/${profile.schoolIds[0]}/admin`);
    return;
  }

  const normalizedEmail = user.email?.toLowerCase();
  if (normalizedEmail) {
    const schools = await listSchools();
    const matchingSchool = schools.find((school) => getSchoolAdminEmails(school).includes(normalizedEmail));
    if (matchingSchool) {
      navigate(`/${matchingSchool.id}/admin`);
      return;
    }

    const staffSchool = schools.find((school) => school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail && !isStaffAccountDisabled(member)));
    if (staffSchool) {
      navigate(`/${staffSchool.id}/schoolwork`);
      return;
    }

    if (schools.some((school) => school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail && isStaffAccountDisabled(member)))) {
      setStatus("This staff account is disabled.");
      return;
    }

    const studentSchool = schools.find((school) => school.students.some((student) => student.email?.toLowerCase() === normalizedEmail && !student.accountDisabled));
    if (studentSchool) {
      navigate(`/${studentSchool.id}/schoolwork`);
      return;
    }

    if (schools.some((school) => school.students.some((student) => student.email?.toLowerCase() === normalizedEmail && student.accountDisabled))) {
      setStatus("This student account is disabled.");
      return;
    }
  }

  setStatus("You are signed in, but this email is not registered for this school.");
}

function SchoolPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));

  useEffect(() => {
    void loadSchoolForPublicPage(schoolId, setSchool);
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="home" />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }

  return <SchoolTemplate school={school} currentPage="home" />;
}

function AboutPageView({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig | null>(() => globalAboutCache);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig()]).then(([remoteSchool, nextGlobalAbout]) => {
      const nextSchool = getLocalSchool(schoolId) ?? remoteSchool;
      schoolCache.set(schoolId, nextSchool);
      globalAboutCache = nextGlobalAbout;
      setSchool(nextSchool);
      setGlobalAbout(nextGlobalAbout);
    });
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="about" />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }
  if (!globalAbout) {
    return <SchoolLoadingPage school={school} currentPage="about" />;
  }

  const aboutPageGroups = buildAboutPageGroups(school, globalAbout);

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="about" />
      <section className="about-page-hero">
        <p className="eyebrow">{school.name}</p>
        <h1>About</h1>
        <p>{school.about}</p>
      </section>

      <section className="about-page-layout">
        {aboutPageGroups.map((group) => (
          <section className="about-category-section" key={group.id}>
            <div>
              <h2>{group.title}</h2>
            </div>
            <div className="about-page-list">
              {group.pages.length === 0 ? (
                <p>No pages in this category yet.</p>
              ) : (
                group.pages.map((page) => (
                  <a href={`/${schoolId}/about/${page.slug}`} className="about-page-card" key={page.id}>
                    <ChevronRight size={22} />
                    <span>{page.title}</span>
                  </a>
                ))
              )}
            </div>
          </section>
        ))}
      </section>

      <SchoolFooter school={school} />
    </main>
  );
}

function AboutSinglePageView({ schoolId, pageSlug }: { schoolId: string; pageSlug: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig | null>(() => globalAboutCache);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig()]).then(([remoteSchool, nextGlobalAbout]) => {
      const nextSchool = getLocalSchool(schoolId) ?? remoteSchool;
      schoolCache.set(schoolId, nextSchool);
      globalAboutCache = nextGlobalAbout;
      setSchool(nextSchool);
      setGlobalAbout(nextGlobalAbout);
    });
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="about" />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }
  if (!globalAbout) {
    return <SchoolLoadingPage school={school} currentPage="about" />;
  }

  const globalPage = globalAbout.pages.find((item) => item.slug === pageSlug);
  const localPage = school.aboutPages?.find((p) => p.slug === pageSlug);

  if (globalPage?.kind === "staffDirectory") {
    const category = globalAbout.categories.find((item) => item.id === globalPage.categoryId);
    const staff = school.staff.filter(isVisibleOnStaffPage);
    const staffGroups = [
      { title: "Administration", staff: staff.filter((member) => hasStaffCategory(member, "Administration")) },
      { title: "Teachers", staff: staff.filter((member) => hasStaffCategory(member, "Teacher")) },
      { title: "Other", staff: staff.filter((member) => hasStaffCategory(member, "Other") && !hasStaffCategory(member, "Administration") && !hasStaffCategory(member, "Teacher")) },
    ];
    return (
      <main className="school-page">
        <SchoolHeader school={school} currentPage="about" />
        <section className="about-page-hero">
          <AboutBackButton schoolId={schoolId} />
          {category ? <p className="eyebrow">{category.title}</p> : null}
          <h1>{globalPage.title}</h1>
        </section>
        <section className="about-single-content">
          {localPage?.body ? <div className="about-single-body staff-directory-intro" dangerouslySetInnerHTML={{ __html: localPage.body }} /> : null}
          {staff.length === 0 ? (
            <div className="empty-public-state">
              <h2>No staff members published yet</h2>
              <p>This school has not published staff members for this page.</p>
            </div>
          ) : (
            staffGroups.map((group) => (
              group.staff.length > 0 ? (
                <section className="staff-directory-section" key={group.title}>
                  <h2>{group.title}</h2>
                  <div className="staff-directory-grid">
                    {group.staff.map((member) => (
                      <StaffCard member={member} key={`${member.name}-${member.role}`} />
                    ))}
                  </div>
                </section>
              ) : null
            ))
          )}
        </section>
        <SchoolFooter school={school} />
      </main>
    );
  }

  const page = globalPage ?? localPage;

  if (!page) {
    return (
      <main className="school-page">
        <SchoolHeader school={school} currentPage="about" />
        <section className="about-page-hero">
          <AboutBackButton schoolId={schoolId} />
          <p className="eyebrow">{school.name}</p>
          <h1>Page not found</h1>
          <p>The requested page could not be found.</p>
        </section>
        <SchoolFooter school={school} />
      </main>
    );
  }

  const category = globalPage
    ? globalAbout.categories.find((c) => c.id === page.categoryId)
    : school.aboutCategories?.find((c) => c.id === page.categoryId);

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="about" />
      {page.headerImage ? (
        <section className="about-single-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(12, 45, 45, 0.86), rgba(12, 45, 45, 0.3)), url(${page.headerImage})` }}>
          <div className="about-single-hero-content">
            <AboutBackButton schoolId={schoolId} />
            {category ? <p className="eyebrow">{category.title}</p> : null}
            <h1>{page.title}</h1>
          </div>
        </section>
      ) : (
        <section className="about-page-hero">
          <AboutBackButton schoolId={schoolId} />
          {category ? <p className="eyebrow">{category.title}</p> : null}
          <h1>{page.title}</h1>
        </section>
      )}
      <section className="about-single-content">
        <div className="about-single-body" dangerouslySetInnerHTML={{ __html: globalPage && localPage ? `${globalPage.body}${localPage.body}` : page.body }} />
      </section>
      <SchoolFooter school={school} />
    </main>
  );
}

function GlobalCategoryPageView({ schoolId, categoryId }: { schoolId: string; categoryId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig | null>(() => globalAboutCache);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig()]).then(([remoteSchool, nextGlobalAbout]) => {
      const nextSchool = getLocalSchool(schoolId) ?? remoteSchool;
      schoolCache.set(schoolId, nextSchool);
      globalAboutCache = nextGlobalAbout;
      setSchool(nextSchool);
      setGlobalAbout(nextGlobalAbout);
    });
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }
  if (!globalAbout) {
    return <SchoolLoadingPage school={school} />;
  }

  const globalCatMatch = globalAbout.categories.find((c) => c.id === categoryId);
  const schoolCatMatch = (school.aboutCategories ?? []).find((c) => c.id === categoryId);
  const category = globalCatMatch ?? schoolCatMatch;

  const globalSlugs = new Set(globalAbout.pages.map((p) => p.slug));
  const globalPages = globalAbout.pages.filter((p) => p.categoryId === categoryId);
  const schoolCategoryPages = (school.aboutPages ?? []).filter((p) => !globalSlugs.has(p.slug) && p.categoryId === categoryId);
  const allPages = globalCatMatch ? [...globalPages, ...schoolCategoryPages] : schoolCategoryPages;

  const contactPage = globalPages.find((p) => p.kind === "contact");

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage={categoryId} globalCategories={globalAbout.categories} />
      <section className="about-page-hero">
        <p className="eyebrow">{school.name}</p>
        <h1>{category?.title ?? categoryId}</h1>
      </section>

      {contactPage ? (
        <section className="about-single-content school-contact-section">
          <div className="school-contact-grid">
            <div className="school-contact-item">
              <h3>Address</h3>
              <p>{school.address}</p>
              <p>{school.city}, {school.country}</p>
            </div>
            <div className="school-contact-item">
              <h3>Phone</h3>
              <p><a href={`tel:${school.phone}`}>{school.phone}</a></p>
            </div>
            <div className="school-contact-item">
              <h3>Email</h3>
              <p><a href={`mailto:${school.email}`}>{school.email}</a></p>
            </div>
            {school.principal ? (
              <div className="school-contact-item">
                <h3>Principal</h3>
                <p>{school.principal}</p>
              </div>
            ) : null}
          </div>
          {contactPage.body ? (
            <div className="about-single-body" dangerouslySetInnerHTML={{ __html: contactPage.body }} />
          ) : null}
        </section>
      ) : allPages.length > 0 ? (
        <section className="about-page-layout">
          <section className="about-category-section">
            <div className="about-page-list">
              {allPages.map((page) => (
                <a href={`/${schoolId}/about/${page.slug}`} className="about-page-card" key={page.id}>
                  <ChevronRight size={22} />
                  <span>{page.title}</span>
                </a>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <section className="about-single-content">
          <div className="empty-public-state">
            <h2>No content yet</h2>
            <p>This section has no pages published yet.</p>
          </div>
        </section>
      )}

      <SchoolFooter school={school} />
    </main>
  );
}

function StudentsGuardiansPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));

  useEffect(() => {
    void loadSchoolForPublicPage(schoolId, setSchool);
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="students" />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="students" />
      <section className="about-page-hero">
        <p className="eyebrow">{school.name}</p>
        <h1>For students and guardians</h1>
        <p>Key updates, calendar dates, and contact information for families and learners.</p>
      </section>

      <section className="school-main-grid">
        <div className="main-column">
          <ContentSection title="News">
            <div className="news-list">
              {school.announcements.map((item) => (
                <article className="news-item" key={`${item.title}-${item.date}`}>
                  <time>{formatDate(item.date)}</time>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </ContentSection>
        </div>
        <aside className="side-column">
          <InfoPanel title="Calendar">
            <div className="calendar-list">
              {school.calendar.map((item) => (
                <div className="calendar-row" key={`${item.title}-${item.date}`}>
                  <CalendarDays size={18} />
                  <div>
                    <time>{formatDate(item.date)}</time>
                    <p>{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </InfoPanel>
        </aside>
      </section>

      <SchoolFooter school={school} />
    </main>
  );
}

function SchoolWorkPortalPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));
  const [globalSchoolWork, setGlobalSchoolWork] = useState<GlobalSchoolWorkConfig>(defaultGlobalSchoolWorkConfig);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubjectClassId, setActiveSubjectClassId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("subjectClassId"));

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalSchoolWorkConfig()]).then(([remoteSchool, nextGlobalSchoolWork]) => {
      const nextSchool = getLocalSchool(schoolId) ?? remoteSchool;
      schoolCache.set(schoolId, nextSchool);
      setSchool(nextSchool);
      setGlobalSchoolWork(nextGlobalSchoolWork);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      return undefined;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        return;
      }
      void getAdminProfile(nextUser.uid, nextUser.email).then(setProfile);
    });
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) {
      return undefined;
    }

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [accountMenuOpen]);

  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="students" />;
  }

  const identity = getSchoolWorkIdentity(school, user?.email ?? null, profile);
  const effectiveScales = getEffectiveAssessmentScales(school, globalSchoolWork);
  const selectedSubjectClass = identity?.subjectClasses.find((subjectClass) => subjectClass.id === activeSubjectClassId) ?? null;
  const isSimulating = new URLSearchParams(window.location.search).has("simulateRole");
  const simulateStudentIdParam = new URLSearchParams(window.location.search).get("simulateStudentId");

  const saveNextSubjectClass = async (nextSubjectClass: SubjectClass) => {
    const nextSchool = {
      ...school,
      subjectClasses: (school.subjectClasses ?? []).map((subjectClass) => subjectClass.id === nextSubjectClass.id ? nextSubjectClass : subjectClass),
    };
    setSchool(nextSchool);
    await saveSchool(nextSchool);
  };
  const saveNextSchoolWorkSettings = async (nextSettings: SchoolWorkSettings) => {
    const nextSchool = {
      ...school,
      schoolWorkSettings: nextSettings,
    };
    setSchool(nextSchool);
    await saveSchool(nextSchool);
  };
  const saveNextRemarks = async (nextRemarks: Remark[]) => {
    const nextSchool = { ...school, remarks: nextRemarks };
    setSchool(nextSchool);
    await saveSchool(nextSchool);
  };
  const saveNextStudent = async (student: Student) => {
    const nextSchool = { ...school, students: school.students.map((s) => s.id === student.id ? student : s) };
    setSchool(nextSchool);
    await saveSchool(nextSchool);
  };
  const saveNextChatMessages = async (nextMessages: SchoolChatMessage[]) => {
    const nextSchool = {
      ...school,
      chatMessages: nextMessages,
    };
    setSchool(nextSchool);
    await saveSchool(nextSchool);
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    navigate("/login");
  };
  const exitSimulation = () => {
    navigate(`/${school.id}/admin#schoolWork`);
  };
  const backToSubjectClasses = () => {
    setActiveSubjectClassId(null);
    window.history.replaceState({}, "", `/${school.id}/schoolwork${window.location.search.replace(/([?&])subjectClassId=[^&]*/g, "$1").replace(/[?&]$/, "").replace("?&", "?")}`);
  };
  const roleLabel = identity?.role ? identity.role.charAt(0).toUpperCase() + identity.role.slice(1) : "";

  const portalContent = !identity ? (
    <div className="empty-editor-state">
      <h3>No SchoolWork access</h3>
      <p>This account is not registered as a staff member or student at this school.</p>
    </div>
  ) : selectedSubjectClass ? (
    <div className="school-work-detail-shell">
      <SubjectClassWorkPage
        subjectClass={selectedSubjectClass}
        subjects={school.subjects}
        students={school.students}
        assessmentScales={effectiveScales}
        globalAssessmentScales={globalSchoolWork.assessmentScales}
        schoolWorkSettings={school.schoolWorkSettings}
        allSubjectClasses={school.subjectClasses ?? []}
        remarks={school.remarks ?? []}
        remarkSettings={school.remarkSettings}
        globalRemarkCategories={globalSchoolWork.remarkCategories ?? []}
        accessLevel={identity.role === "student" ? "student" : identity.role === "teacher" ? "teacher" : identity.role === "viewer" ? "viewer" : "admin"}
        activeStudentId={identity.role === "student" ? identity.studentId : undefined}
        initialSimulatedStudentId={simulateStudentIdParam}
        graderLabel={identity.label}
        onBack={backToSubjectClasses}
        onChange={saveNextSubjectClass}
        onSchoolWorkSettingsChange={saveNextSchoolWorkSettings}
        onRemarksChange={(nextRemarks) => void saveNextRemarks(nextRemarks)}
      />
    </div>
  ) : (
    <SchoolWorkOverview
      subjectClasses={identity.subjectClasses}
      subjects={school.subjects}
      classes={school.classes}
      students={school.students}
      role={identity.role === "admin" ? "admin" : identity.role === "teacher" ? "teacher" : identity.role === "viewer" ? "viewer" : "student"}
      participantLabel={identity.label}
      remarks={school.remarks ?? []}
      remarkSettings={school.remarkSettings}
      globalRemarkCategories={globalSchoolWork.remarkCategories ?? []}
      schoolWorkSettings={school.schoolWorkSettings}
      globalAssessmentScales={globalSchoolWork.assessmentScales ?? []}
      onOpen={setActiveSubjectClassId}
      onRemarksChange={(nextRemarks) => void saveNextRemarks(nextRemarks)}
      onStudentChange={(student) => void saveNextStudent(student)}
      onSchoolWorkSettingsChange={(nextSettings) => void saveNextSchoolWorkSettings(nextSettings)}
    />
  );

  if (isSimulating) {
    return (
      <main className="admin-page">
        <header className="admin-shell-header">
          <button className="brand-button" type="button" onClick={exitSimulation}>
            <GraduationCap size={28} />
            <span>{school.name}</span>
          </button>
          <div className="admin-actions">
            <span className="simulation-role-badge">Simulating as {identity?.label ?? "student"}</span>
            <button className="secondary-action admin-chat-button" type="button" onClick={() => setChatOpen(true)} aria-label="Open messages">
              <MessageCircle size={18} />
            </button>
            <button className="secondary-action" type="button" onClick={exitSimulation}>Exit simulation</button>
          </div>
        </header>
        {identity && chatOpen ? (
          <SchoolChatPopup
            school={school}
            identity={identity}
            messages={school.chatMessages ?? []}
            onClose={() => setChatOpen(false)}
            onMessagesChange={(messages) => void saveNextChatMessages(messages)}
          />
        ) : null}
        <div className="school-editor">
          <div className="editor-grid">
            {portalContent}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="school-page">
      <SchoolHeader
        school={school}
        currentPage="students"
        hideNav={Boolean(identity)}
        actions={identity ? (
          <div className="school-header-session">
            <button className="school-account-button chat-icon-button" type="button" onClick={() => setChatOpen(true)} aria-label="Open messages">
              <MessageCircle size={19} />
            </button>
            <div className="school-account-menu" ref={accountMenuRef}>
              <button
                className="school-account-button"
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <FontAwesomeIcon icon={faUser} />
                <span>{identity.label}</span>
              </button>
              {accountMenuOpen ? (
                <div className="school-account-dropdown" role="menu">
                  {hasFirebaseConfig && user ? <button type="button" role="menuitem" onClick={() => void logout()}>Sign out</button> : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : undefined}
      />
      {identity && chatOpen ? (
        <SchoolChatPopup
          school={school}
          identity={identity}
          messages={school.chatMessages ?? []}
          onClose={() => setChatOpen(false)}
          onMessagesChange={(messages) => void saveNextChatMessages(messages)}
        />
      ) : null}
      <div className="school-editor">
        {!identity || identity.role !== "student" ? (
          <div className="portal-heading">
            <div>
              <h1>{school.name}</h1>
              <p>{identity ? `${identity.label} · ${roleLabel}` : "Sign in with a staff or student account to view SchoolWork."}</p>
            </div>
            {hasFirebaseConfig ? (
              user ? <button className="secondary-action" type="button" onClick={() => void logout()}>Sign out</button> : (
                <button className="primary-action" type="button" onClick={() => navigate("/login")}>Login</button>
              )
            ) : null}
          </div>
        ) : null}
        <div className="editor-grid">
          {portalContent}
        </div>
      </div>
    </main>
  );
}

function NewsPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));

  useEffect(() => {
    void loadSchoolForPublicPage(schoolId, setSchool);
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="news" />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }

  const news = [...school.announcements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="news" />
      <section className="about-page-hero">
        <p className="eyebrow">{school.name}</p>
        <h1>News</h1>
        <p>All published news and updates from the school.</p>
      </section>

      <section className="news-page-layout">
        {news.length === 0 ? (
          <div className="empty-public-state">
            <h2>No news published yet</h2>
            <p>This school has not published any news items.</p>
          </div>
        ) : (
          <div className="news-page-list">
            {news.map((item) => (
              <a className="news-page-item" href={`/${school.id}/news/${getNewsSlug(item)}`} key={`${item.title}-${item.date}`}>
                {item.headerImage ? <div className="news-page-item-image" style={{ backgroundImage: `url(${item.headerImage})` }} /> : null}
                <time>{formatDate(item.date)}</time>
                <h2>{item.title}</h2>
                <p>{getTextExcerpt(item.body, 220)}</p>
              </a>
            ))}
          </div>
        )}
      </section>

      <SchoolFooter school={school} />
    </main>
  );
}

function NewsSinglePage({ schoolId, newsSlug }: { schoolId: string; newsSlug: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));

  useEffect(() => {
    void loadSchoolForPublicPage(schoolId, setSchool);
  }, [schoolId]);
  useSchoolDocumentBrand(school);

  if (!school) {
    return <PublicSchoolLoadingPage schoolId={schoolId} currentPage="news" />;
  }
  if (!shouldShowPublicSchoolWebsite(school)) {
    return <SchoolWebsiteHiddenRedirect />;
  }

  const newsItem = school.announcements.find((item) => getNewsSlug(item) === newsSlug);

  if (!newsItem) {
    return (
      <main className="school-page">
        <SchoolHeader school={school} currentPage="news" />
        <section className="about-page-hero">
          <button className="about-back-button" type="button" onClick={() => navigate(`/${school.id}/news`)}>
            <ChevronRight size={18} />
            Back to news
          </button>
          <p className="eyebrow">{school.name}</p>
          <h1>News not found</h1>
          <p>The requested news item could not be found.</p>
        </section>
        <SchoolFooter school={school} />
      </main>
    );
  }

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="news" />
      {newsItem.headerImage ? (
        <section className="about-single-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(12, 45, 45, 0.86), rgba(12, 45, 45, 0.3)), url(${newsItem.headerImage})` }}>
          <div className="about-single-hero-content">
            <button className="about-back-button" type="button" onClick={() => navigate(`/${school.id}/news`)}>
              <ChevronRight size={18} />
              Back to news
            </button>
            <p className="eyebrow">{formatDate(newsItem.date)}</p>
            <h1>{newsItem.title}</h1>
          </div>
        </section>
      ) : (
        <section className="about-page-hero">
          <button className="about-back-button" type="button" onClick={() => navigate(`/${school.id}/news`)}>
            <ChevronRight size={18} />
            Back to news
          </button>
          <p className="eyebrow">{formatDate(newsItem.date)}</p>
          <h1>{newsItem.title}</h1>
        </section>
      )}
      <section className="about-single-content">
        <div className="about-single-body" dangerouslySetInnerHTML={{ __html: newsItem.body }} />
      </section>
      <SchoolFooter school={school} />
    </main>
  );
}

function SchoolTemplate({ school, currentPage }: { school: School; currentPage?: string }) {
  const mainColor = school.mainColor || "#18322e";
  const subColor = school.subColor || "#e0b44f";

  return (
    <main className="school-page" style={{ "--school-main": mainColor, "--school-sub": subColor } as React.CSSProperties}>
      <SchoolHeader school={school} currentPage={currentPage} />
      <section className="school-hero" style={{ backgroundImage: `linear-gradient(90deg, ${mainColor}e0, ${mainColor}80), url(${school.heroImage})` }}>
        <div className="school-hero-content">
          <p className="eyebrow">{school.type}</p>
          <h1>{school.name}</h1>
          <p>{school.tagline}</p>
        </div>
      </section>

      <section className="school-main-grid">
        <div className="main-column">
          <ContentSection title="News" action="All news" actionHref={`/${school.id}/news`}>
            <div className="news-list">
              {school.announcements.map((item) => (
                <a className="news-item" href={`/${school.id}/news/${getNewsSlug(item)}`} key={`${item.title}-${item.date}`}>
                  {item.headerImage ? <div className="news-item-image" style={{ backgroundImage: `url(${item.headerImage})` }} /> : null}
                  <time>{formatDate(item.date)}</time>
                  <h3>{item.title}</h3>
                  <p>{getTextExcerpt(item.body, 120)}</p>
                </a>
              ))}
            </div>
          </ContentSection>

          <ContentSection title="About our school">
            <p className="large-copy">{school.about}</p>
            <div className="values-row">
              {school.values.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          </ContentSection>

          <ContentSection title="Leadership and administration">
            <div className="staff-grid">
              {school.staff.filter(isVisibleOnHomePage).map((member) => (
                <StaffCard member={member} key={`${member.name}-${member.role}`} />
              ))}
            </div>
          </ContentSection>
        </div>

        <aside className="side-column">
          <InfoPanel title="Contact">
            <ContactLine icon={<MapPin size={18} />} label={`${school.address}, ${school.city}, ${school.country}`} />
            <ContactLine icon={<Phone size={18} />} label={school.phone} />
            <ContactLine icon={<Mail size={18} />} label={school.email} />
            <ContactLine icon={<UserRound size={18} />} label={`Principal: ${school.principal}`} />
          </InfoPanel>

          <InfoPanel title="Calendar">
            <div className="calendar-list">
              {school.calendar.map((item) => (
                <div className="calendar-row" key={`${item.title}-${item.date}`}>
                  <CalendarDays size={18} />
                  <div>
                    <time>{formatDate(item.date)}</time>
                    <p>{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </InfoPanel>
        </aside>
      </section>

      <SchoolFooter school={school} />
    </main>
  );
}

function AdminPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School>(() => getLocalSchool(schoolId) ?? { ...sampleSchool, id: schoolId });
  const [activeCategory, setActiveCategory] = useState<EditorCategory>(() => getEditorStateFromHash().category);
  const [activeSection, setActiveSection] = useState<EditorSection | null>(() => getEditorStateFromHash().section);
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(() => {
    const initialEditorState = getEditorStateFromHash();
    return initialEditorState.category !== "schoolWork" && initialEditorState.section !== "schoolWork";
  });
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig>(defaultGlobalAboutConfig);
  const [globalSchoolWork, setGlobalSchoolWork] = useState<GlobalSchoolWorkConfig>(defaultGlobalSchoolWorkConfig);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<"new" | "tickets">("new");
  const [draftSupportTicket, setDraftSupportTicket] = useState<Pick<SupportTicket, "subject" | "message">>({ subject: "", message: "" });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig(), getGlobalSchoolWorkConfig()]).then(([remoteSchool, nextGlobalAbout, nextGlobalSchoolWork]) => {
      setSchool(getLocalSchool(schoolId) ?? remoteSchool);
      setGlobalAbout(nextGlobalAbout);
      setGlobalSchoolWork(nextGlobalSchoolWork);
    });
  }, [schoolId]);

  useEffect(() => {
    const onHashChange = () => {
      const nextState = getEditorStateFromHash();
      setActiveCategory(nextState.category);
      setActiveSection(nextState.section);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isSchoolWorkAdminView = activeCategory === "schoolWork" || activeSection === "schoolWork";
  const previousSchoolWorkAdminView = useRef(isSchoolWorkAdminView);

  useEffect(() => {
    if (previousSchoolWorkAdminView.current === isSchoolWorkAdminView) {
      return;
    }
    previousSchoolWorkAdminView.current = isSchoolWorkAdminView;
    setAdminSidebarOpen(!isSchoolWorkAdminView);
  }, [isSchoolWorkAdminView]);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      return undefined;
    }
    return onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      if (!user) {
        setProfile(null);
        return;
      }
      void getAdminProfile(user.uid, user.email).then((nextProfile) => {
        setProfile(nextProfile);
      });
    });
  }, [schoolId]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const close = (event: PointerEvent) => {
      if (userMenuRef.current?.contains(event.target as Node)) return;
      setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [userMenuOpen]);

  useSchoolDocumentBrand(adminUser ? school : null);

  const submit = async () => {
    if (hasFirebaseConfig && (!adminUser || (!canManageSchool(profile, school.id, adminUser.email, school) && !canTeachAnySubjectClass(school, adminUser.email)))) {
      setSaveStatus("Sign in to save changes");
      return;
    }
    setSaveStatus("Saving...");
    await saveSchool(school);
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(null), 2000);
  };
  const saveNextSchool = async (nextSchool: School) => {
    if (hasFirebaseConfig && (!adminUser || (!canManageSchool(profile, nextSchool.id, adminUser.email, nextSchool) && !canTeachAnySubjectClass(nextSchool, adminUser.email)))) {
      setSaveStatus("Sign in to save changes");
      return;
    }
    setSchool(nextSchool);
    setSaveStatus("Saving...");
    await saveSchool(nextSchool);
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(null), 2000);
  };
  const saveNextChatMessages = async (nextMessages: SchoolChatMessage[]) => {
    await saveNextSchool({ ...school, chatMessages: nextMessages });
  };
  const submitSupportTicket = async () => {
    const subject = draftSupportTicket.subject.trim();
    const message = draftSupportTicket.message.trim();
    if (!subject || !message) {
      setSaveStatus("Add a support subject and message");
      return;
    }
    const ticket: SupportTicket = {
      id: `support-${Date.now()}`,
      subject,
      message,
      status: "open",
      createdAt: new Date().toISOString(),
      createdBy: adminUser?.email ?? profile?.email ?? "School admin",
    };
    await saveNextSchool({ ...school, supportTickets: [ticket, ...(school.supportTickets ?? [])] });
    setDraftSupportTicket({ subject: "", message: "" });
    setSupportOpen(false);
    setSaveStatus("Support ticket sent");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const logout = async () => {
    if (!auth) {
      return;
    }
    await signOut(auth);
  };
  const openEditorCategory = (category: EditorCategory) => {
    setActiveCategory(category);
    setActiveSection(null);
    setEditorHash(category);
  };
  const openEditorSection = (section: EditorSection) => {
    const category = getEditorCategoryForSection(section);
    setActiveCategory(category);
    setActiveSection(section);
    setEditorHash(category, section);
  };
  const simulateSchoolWorkUser = (role: "staff" | "student", id: string) => {
    if (role === "student") {
      const firstSubjectClass = (school.subjectClasses ?? []).find((subjectClass) => subjectClass.studentIds.includes(id));
      const params = new URLSearchParams({ simulateRole: "admin", simulateStudentId: id });
      if (firstSubjectClass) {
        params.set("subjectClassId", firstSubjectClass.id);
      }
      navigate(`/${school.id}/schoolwork?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ simulateRole: role, simulateId: id });
      navigate(`/${school.id}/schoolwork?${params.toString()}`);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-shell-header">
        <button className="brand-button" onClick={() => navigate("/")}>
          <GraduationCap size={28} />
          <span>EduLink Africa</span>
        </button>
        <div className="admin-actions">
          <button className="secondary-action admin-chat-button" onClick={() => setChatOpen(true)} aria-label="Open messages">
            <MessageCircle size={18} />
          </button>
          <button className="secondary-action" onClick={() => openInNewTab(`/${school.id}`)}>
            <ExternalLink size={15} />
            View website
          </button>
          <button className="secondary-action" onClick={() => { setSupportTab("new"); setSupportOpen(true); }}>
            <HelpCircle size={15} />
            Support
          </button>
          {!adminUser ? (
            <button className="secondary-action" onClick={() => navigate("/login")}>
              Login
            </button>
          ) : null}
          {hasFirebaseConfig && adminUser ? (
            <div className="admin-user-menu" ref={userMenuRef}>
              <button className="secondary-action admin-user-menu-trigger" onClick={() => setUserMenuOpen((o) => !o)}>
                <UserRound size={15} />
                <span className="admin-user-menu-label">{profile?.name ?? adminUser.email}</span>
                <ChevronDown size={13} />
              </button>
              {userMenuOpen ? (
                <div className="admin-user-menu-dropdown" role="menu">
                  <button role="menuitem" onClick={() => { setUserMenuOpen(false); void logout(); }}>
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {saveStatus ? <span className="admin-save-status">{saveStatus}</span> : null}
        </div>
      </header>
      {chatOpen ? (
        <SchoolChatPopup
          school={school}
          identity={{ role: "admin", label: "School admin", subjectClasses: school.subjectClasses ?? [] }}
          messages={school.chatMessages ?? []}
          onClose={() => setChatOpen(false)}
          onMessagesChange={(messages) => void saveNextChatMessages(messages)}
        />
      ) : null}
      {supportOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="staff-modal support-staff-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">Support</p>
                <h2 id="support-modal-title">Support</h2>
              </div>
            </div>
            <div className="support-modal-tabs">
              <button
                className={`support-modal-tab${supportTab === "new" ? " support-modal-tab-active" : ""}`}
                type="button"
                onClick={() => setSupportTab("new")}
              >
                New ticket
              </button>
              <button
                className={`support-modal-tab${supportTab === "tickets" ? " support-modal-tab-active" : ""}`}
                type="button"
                onClick={() => setSupportTab("tickets")}
              >
                My tickets
                {(school.supportTickets ?? []).length > 0 ? (
                  <span className="support-tab-count">{(school.supportTickets ?? []).length}</span>
                ) : null}
              </button>
            </div>
            {supportTab === "new" ? (
              <>
                <div className="staff-modal-body">
                  <TextInput
                    label="Subject"
                    value={draftSupportTicket.subject}
                    onChange={(subject) => setDraftSupportTicket((current) => ({ ...current, subject }))}
                  />
                  <TextArea
                    label="Message"
                    value={draftSupportTicket.message}
                    onChange={(message) => setDraftSupportTicket((current) => ({ ...current, message }))}
                  />
                </div>
                <div className="staff-modal-actions">
                  <button className="secondary-action" type="button" onClick={() => setSupportOpen(false)}>
                    Cancel
                  </button>
                  <button className="primary-action" type="button" onClick={() => void submitSupportTicket()}>
                    Send ticket
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="staff-modal-body">
                  {(school.supportTickets ?? []).length === 0 ? (
                    <div className="empty-editor-state">
                      <h3>No tickets yet</h3>
                      <p>Tickets you raise will appear here with their status and any responses.</p>
                    </div>
                  ) : (
                    <div className="support-ticket-list">
                      {[...(school.supportTickets ?? [])]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((ticket) => (
                          <article className="support-ticket-card" key={ticket.id}>
                            <div className="support-ticket-heading">
                              <div>
                                <h3>{ticket.subject}</h3>
                                <span>{formatDateTime(ticket.createdAt)}</span>
                              </div>
                              <span className={`support-ticket-status-badge support-ticket-status-badge-${ticket.status}`}>
                                {ticket.status === "open" ? "Open" : ticket.status === "in-progress" ? "In progress" : "Resolved"}
                              </span>
                            </div>
                            <p>{ticket.message}</p>
                            {ticket.response ? (
                              <div className="support-ticket-response">
                                <div className="support-ticket-response-meta">
                                  <strong>{ticket.respondedBy ?? "Support"}</strong>
                                  {ticket.respondedAt ? <span>{formatDateTime(ticket.respondedAt)}</span> : null}
                                </div>
                                <p>{ticket.response}</p>
                              </div>
                            ) : null}
                          </article>
                        ))}
                    </div>
                  )}
                </div>
                <div className="staff-modal-actions">
                  <button className="secondary-action" type="button" onClick={() => setSupportOpen(false)}>
                    Close
                  </button>
                  <button className="primary-action" type="button" onClick={() => setSupportTab("new")}>
                    New ticket
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <section className={`admin-layout ${isSchoolWorkAdminView && !adminSidebarOpen ? "admin-layout-sidebar-collapsed" : ""}`}>
        <aside className={`admin-left-rail ${isSchoolWorkAdminView && !adminSidebarOpen ? "admin-left-rail-collapsed" : ""}`}>
          {isSchoolWorkAdminView && !adminSidebarOpen ? (
            <button
              className="admin-sidebar-toggle"
              type="button"
              onClick={() => setAdminSidebarOpen(true)}
              aria-label="Open admin sidebar"
              title="Open admin sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          ) : (
            <>
              <div className="admin-sidebar">
                {isSchoolWorkAdminView ? (
                  <div className="admin-sidebar-action-row">
                    {profile?.superAdmin ? (
                      <button className="secondary-action admin-superadmin-shortcut" onClick={() => navigate("/superadmin")}>
                        Superadmin dashboard
                      </button>
                    ) : null}
                    <button
                      className="admin-sidebar-toggle"
                      type="button"
                      onClick={() => setAdminSidebarOpen(false)}
                      aria-label="Collapse admin sidebar"
                      title="Collapse admin sidebar"
                    >
                      <PanelLeftClose size={20} />
                    </button>
                  </div>
                ) : null}
                <h1>{school.name}</h1>
                <div className="status-box">
                  <span>Signed in</span>
                  <strong>{adminUser?.email ?? "Not signed in"}</strong>
                </div>
                {profile?.superAdmin && !isSchoolWorkAdminView ? (
                  <button className="secondary-action admin-wide-button" onClick={() => navigate("/superadmin")}>
                    Superadmin dashboard
                  </button>
                ) : null}
              </div>
              <EditorMenu activeCategory={activeCategory} activeSection={activeSection} onChange={openEditorCategory} />
            </>
          )}
        </aside>

        <SchoolEditor
          school={school}
          globalAbout={globalAbout}
          globalSchoolWork={globalSchoolWork}
          onChange={setSchool}
          onSubmit={submit}
          onAutoSave={saveNextSchool}
          activeCategory={activeCategory}
          activeSection={activeSection}
          currentUserEmail={adminUser?.email ?? null}
          canAccessAllSubjectClasses={canManageSchool(profile, school.id, adminUser?.email, school)}
          onSimulateStaff={(staffMember) => staffMember.email ? simulateSchoolWorkUser("staff", staffMember.email) : undefined}
          onSimulateStudent={(student) => simulateSchoolWorkUser("student", student.id)}
          onBack={() => setActiveSection(null)}
          onSectionChange={openEditorSection}
        />
      </section>
    </main>
  );
}

function SuperAdminPage() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig>(defaultGlobalAboutConfig);
  const [globalSchoolWork, setGlobalSchoolWork] = useState<GlobalSchoolWorkConfig>(defaultGlobalSchoolWorkConfig);
  const [superAdminView, setSuperAdminView] = useState<"schools" | "supportTickets" | "globalPages" | "schoolWorkSettings" | "superAdmins" | "subscriptions" | "payments">("schools");
  const [query, setQuery] = useState("");
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState("");
  const [newSuperAdminName, setNewSuperAdminName] = useState("");
  const [newSuperAdminPassword, setNewSuperAdminPassword] = useState("");
  const [superAdmins, setSuperAdmins] = useState<AdminProfile[]>([]);
  const [editingSuperAdminUid, setEditingSuperAdminUid] = useState<string | null>(null);
  const [editSuperAdminDraft, setEditSuperAdminDraft] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const [editingSchoolUrlId, setEditingSchoolUrlId] = useState<string | null>(null);
  const [schoolUrlDraft, setSchoolUrlDraft] = useState("");
  const [managingSchoolId, setManagingSchoolId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const close = (event: PointerEvent) => {
      if (userMenuRef.current?.contains(event.target as Node)) return;
      setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setProfile({ uid: "local", email: "local-admin@edulink.africa", schoolIds: [sampleSchool.id], superAdmin: true });
      void refreshSchools(setSchools, setStatus);
      void getGlobalAboutConfig().then(setGlobalAbout);
      void getGlobalSchoolWorkConfig().then(setGlobalSchoolWork);
      void getSuperAdmins().then(setSuperAdmins);
      return undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      if (!user) {
        setStatus("Sign in from /login to access superadmin tools");
        setProfile(null);
        return;
      }

      void getAdminProfile(user.uid, user.email).then((nextProfile) => {
        setProfile(nextProfile);
        if (!nextProfile?.superAdmin) {
          setStatus("This account is not a superadmin");
          return;
        }
        void refreshSchools(setSchools, setStatus);
        void getGlobalAboutConfig().then(setGlobalAbout);
        void getGlobalSchoolWorkConfig().then(setGlobalSchoolWork);
        void getSuperAdmins().then(setSuperAdmins);
      });
    });
  }, []);

  const filteredSchools = schools.filter((school) => {
    const haystack = `${school.name} ${school.id} ${school.city} ${school.country}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const supportTicketCount = schools.reduce((total, school) => total + (school.supportTickets ?? []).length, 0);

  const removeSchool = async (school: School) => {
  if (hasFirebaseConfig && !profile?.superAdmin) {
    setStatus("Only superadmins can delete schools");
    return;
  }

  if (!window.confirm(`Delete ${school.name}? This cannot be undone.`)) {
    return;
  }

  setStatus(`Deleting ${school.name}...`);

  try {
    await deleteSchool(school.id);
    await refreshSchools(setSchools, setStatus);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not delete school");
  }
};

  const saveGlobalAbout = async () => {
    if (hasFirebaseConfig && !profile?.superAdmin) {
      setStatus("Only superadmins can save global about pages");
      return;
    }
    setStatus("Saving global about pages...");
    await saveGlobalAboutConfig(globalAbout);
    setGlobalAbout(await getGlobalAboutConfig());
    setStatus("Global about pages saved");
  };

  const saveGlobalSchoolWork = async () => {
    if (hasFirebaseConfig && !profile?.superAdmin) {
      setStatus("Only superadmins can save schoolwork settings");
      return;
    }
    setStatus("Saving schoolwork settings...");
    await saveGlobalSchoolWorkConfig(globalSchoolWork);
    setGlobalSchoolWork(await getGlobalSchoolWorkConfig());
    setStatus("Schoolwork settings saved");
  };

  const addSuperAdmin = async () => {
    if (hasFirebaseConfig && !profile?.superAdmin) {
      setStatus("Only superadmins can add superadmins");
      return;
    }

    const normalizedEmail = newSuperAdminEmail.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      setStatus("Enter a valid email address");
      return;
    }

    const password = newSuperAdminPassword.trim();
    if (password && password.length < 6) {
      setStatus("Password must be at least 6 characters");
      return;
    }

    setStatus(`Adding ${normalizedEmail} as superadmin...`);
    try {
      if (password) {
        await createAuthUser(normalizedEmail, password);
      }
      await saveSuperAdminProfile(normalizedEmail, newSuperAdminName.trim() || undefined);
      setNewSuperAdminEmail("");
      setNewSuperAdminName("");
      setNewSuperAdminPassword("");
      const nextAdmins = await getSuperAdmins();
      setSuperAdmins(nextAdmins);
      setStatus(`${normalizedEmail} added as superadmin`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add superadmin");
    }
  };

  const startEditSuperAdmin = (admin: AdminProfile) => {
    setEditingSuperAdminUid(admin.uid);
    setEditSuperAdminDraft({ name: admin.name ?? "", email: admin.email ?? "" });
  };

  const startEditSchoolUrl = (school: School) => {
    setEditingSchoolUrlId(school.id);
    setSchoolUrlDraft(school.id);
  };

  const saveSchoolUrl = async (school: School) => {
    if (hasFirebaseConfig && !profile?.superAdmin) {
      setStatus("Only superadmins can update school URLs");
      return;
    }
    const nextId = slugifySchoolName(schoolUrlDraft);
    if (!nextId) {
      setStatus("Enter a valid URL slug");
      return;
    }
    if (nextId === school.id) {
      setEditingSchoolUrlId(null);
      return;
    }
    if (schools.some((item) => item.id === nextId)) {
      setStatus(`/${nextId} is already used by another school`);
      return;
    }
    setStatus(`Updating ${school.name} URL...`);
    try {
      await saveSchool({ ...school, id: nextId });
      await deleteSchool(school.id);
      setEditingSchoolUrlId(null);
      setSchoolUrlDraft("");
      await refreshSchools(setSchools, setStatus);
      setStatus(`School URL updated to /${nextId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update school URL");
    }
  };

  const saveSuperAdminEdit = async (oldEmail: string) => {
    const newEmail = editSuperAdminDraft.email.trim().toLowerCase();
    if (!newEmail.includes("@")) {
      setStatus("Enter a valid email address");
      return;
    }
    setStatus("Saving...");
    try {
      await updateSuperAdminProfile(oldEmail, newEmail, editSuperAdminDraft.name);
      setEditingSuperAdminUid(null);
      setSuperAdmins(await getSuperAdmins());
      setStatus("Superadmin updated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update superadmin");
    }
  };

  const removeSuperAdmin = async (admin: AdminProfile) => {
    if (!window.confirm(`Remove ${admin.name ?? admin.email} as superadmin? This cannot be undone.`)) return;
    setStatus("Removing superadmin...");
    try {
      await deleteSuperAdminProfile(admin.uid, admin.email);
      setSuperAdmins(await getSuperAdmins());
      setStatus("Superadmin removed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove superadmin");
    }
  };

  const updateSupportTicket = async (schoolId: string, ticketId: string, patch: Partial<SupportTicket>) => {
    if (hasFirebaseConfig && !profile?.superAdmin) {
      setStatus("Only superadmins can update support tickets");
      return;
    }
    const school = schools.find((item) => item.id === schoolId);
    if (!school) {
      setStatus("School not found");
      return;
    }
    const nextSchool = {
      ...school,
      supportTickets: (school.supportTickets ?? []).map((ticket) => ticket.id === ticketId ? {
        ...ticket,
        ...patch,
        updatedAt: new Date().toISOString(),
      } : ticket),
    };
    setStatus("Updating support ticket...");
    await saveSchool(nextSchool);
    await refreshSchools(setSchools, setStatus);
  };

  const updateSubscription = async (schoolId: string, subscription: SchoolSubscription) => {
    const school = schools.find((item) => item.id === schoolId);
    if (!school) return;
    await saveSchool({ ...school, subscription });
    await refreshSchools(setSchools, setStatus);
  };

  const updatePayment = async (schoolId: string, payment: SchoolPayment) => {
    const school = schools.find((item) => item.id === schoolId);
    if (!school) return;
    const existing = school.payments ?? [];
    const nextPayments = existing.some((p) => p.id === payment.id)
      ? existing.map((p) => (p.id === payment.id ? payment : p))
      : [...existing, payment];
    await saveSchool({ ...school, payments: nextPayments });
    await refreshSchools(setSchools, setStatus);
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    navigate("/login");
  };

  return (
    <main className="admin-page">
      <header className="admin-shell-header">
        <button className="brand-button" onClick={() => navigate("/")}>
          <GraduationCap size={28} />
          <span>EduLink Africa</span>
        </button>
        <div className="admin-actions">
          {!adminUser ? (
            <button className="secondary-action" onClick={() => navigate("/login")}>
              Login
            </button>
          ) : null}
          {adminUser ? (
            <div className="admin-user-menu" ref={userMenuRef}>
              <button className="secondary-action admin-user-menu-trigger" onClick={() => setUserMenuOpen((o) => !o)}>
                <UserRound size={15} />
                <span className="admin-user-menu-label">{profile?.name ?? adminUser.email}</span>
                <ChevronDown size={13} />
              </button>
              {userMenuOpen ? (
                <div className="admin-user-menu-dropdown" role="menu">
                  <button role="menuitem" onClick={() => { setUserMenuOpen(false); void logout(); }}>
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <section className="superadmin-layout">
        <aside className="superadmin-sidebar">
          <div className="panel-heading">
            <ShieldCheck />
            <div>
              <h1>Superadmin</h1>
              <p>Review every school and open the right experience.</p>
            </div>
          </div>
          <div className="status-box">
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div className="status-box">
            <span>Signed in</span>
            <strong>{profile?.name ?? adminUser?.email ?? profile?.email ?? "Not signed in"}</strong>
          </div>
          <nav className="superadmin-nav" aria-label="Superadmin sections">
            <button
              className={superAdminView === "schools" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("schools")}
            >
              <SchoolIcon size={18} />
              All schools
            </button>
            <button
              className={superAdminView === "supportTickets" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("supportTickets")}
            >
              <MessageCircle size={18} />
              Support tickets ({supportTicketCount})
            </button>
            <button
              className={superAdminView === "globalPages" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("globalPages")}
            >
              <LayoutDashboard size={18} />
              Global pages
            </button>
            <button
              className={superAdminView === "schoolWorkSettings" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("schoolWorkSettings")}
            >
              <ClipboardCheck size={18} />
              Schoolwork settings
            </button>
            <button
              className={superAdminView === "superAdmins" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("superAdmins")}
            >
              <ShieldCheck size={18} />
              Superadmins
            </button>
            <button
              className={superAdminView === "subscriptions" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("subscriptions")}
            >
              <CreditCard size={18} />
              Subscriptions
            </button>
            <button
              className={superAdminView === "payments" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("payments")}
            >
              <Receipt size={18} />
              Payments
            </button>
          </nav>
        </aside>

        <section className="superadmin-main">
          {superAdminView === "globalPages" ? (
            <GlobalAboutEditor config={globalAbout} onChange={setGlobalAbout} onSubmit={saveGlobalAbout} />
          ) : superAdminView === "schoolWorkSettings" ? (
            <GlobalSchoolWorkEditor config={globalSchoolWork} onChange={setGlobalSchoolWork} onSubmit={saveGlobalSchoolWork} />
          ) : superAdminView === "supportTickets" ? (
            <SupportTicketsPanel schools={schools} respondedBy={profile?.name ?? adminUser?.email ?? undefined} onUpdateTicket={(schoolId, ticketId, patch) => void updateSupportTicket(schoolId, ticketId, patch)} />
          ) : superAdminView === "subscriptions" ? (
            <SubscriptionsPanel schools={schools} onUpdate={updateSubscription} />
          ) : superAdminView === "payments" ? (
            <PaymentsPanel schools={schools} onUpdatePayment={(schoolId, payment) => updatePayment(schoolId, payment)} />
          ) : superAdminView === "superAdmins" ? (
            <EditorPanel title="Superadmins">
              {superAdmins.length > 0 ? (
                <div className="data-table-wrap">
                  <table className="data-table access-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {superAdmins.map((admin) => (
                        <tr key={admin.uid}>
                          {editingSuperAdminUid === admin.uid ? (
                            <>
                              <td><input className="inline-table-input" value={editSuperAdminDraft.name} onChange={(e) => setEditSuperAdminDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name" /></td>
                              <td><input className="inline-table-input" value={editSuperAdminDraft.email} onChange={(e) => setEditSuperAdminDraft((d) => ({ ...d, email: e.target.value }))} placeholder="Email" /></td>
                              <td className="table-actions-cell">
                                <button className="secondary-action" type="button" onClick={() => void saveSuperAdminEdit(admin.email ?? "")}>Save</button>
                                <button className="remove-button" type="button" onClick={() => setEditingSuperAdminUid(null)}>Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td><strong>{admin.name ?? "—"}</strong></td>
                              <td>{admin.email ?? "—"}</td>
                              <td className="table-actions-cell">
                                <button className="secondary-action" type="button" onClick={() => startEditSuperAdmin(admin)}>Edit</button>
                                <button className="remove-button" type="button" onClick={() => void removeSuperAdmin(admin)}>Remove</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="panel-heading global-about-heading">
                <div>
                  <p className="eyebrow">Add superadmin</p>
                  <p>They will be able to sign in with this email. Optionally set an initial password — otherwise they can create one via the login page.</p>
                </div>
              </div>
              <div className="create-school-box superadmin-add-box">
                <TextInput label="Name" value={newSuperAdminName} onChange={setNewSuperAdminName} />
                <TextInput label="Email" value={newSuperAdminEmail} onChange={setNewSuperAdminEmail} />
                <TextInput label="Password (optional)" value={newSuperAdminPassword} onChange={setNewSuperAdminPassword} />
                <button className="primary-action" type="button" onClick={() => void addSuperAdmin()}>
                  Add superadmin
                </button>
              </div>
            </EditorPanel>
          ) : (
            <>
              <div className="simulation-toolbar">
                <div>
                  <p className="eyebrow">Schools</p>
                  <h2>{filteredSchools.length} of {schools.length}</h2>
                  <p>Open a public website or simulate that school's admin dashboard.</p>
                </div>
                <label className="field-label superadmin-main-search">
                  Search schools
                  <span className="input-shell">
                    <Search size={18} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} />
                  </span>
                </label>
              </div>

              <section className="school-directory" aria-label="All schools">
                {status === "Loading..." ? (
                  <div className="school-directory-loading">
                    <span className="spinner" />
                  </div>
                ) : null}
                {filteredSchools.map((school) => (
                  <article className="school-directory-row" key={school.id}>
                    <div className="school-directory-main">
                      <span className="school-directory-icon">
                        {school.logoUrl ? (
                          <img src={school.logoUrl} alt={school.name} className="school-directory-logo" />
                        ) : (
                          <SchoolIcon size={22} />
                        )}
                      </span>
                      <div>
                        <h3>{school.name}</h3>
                        {editingSchoolUrlId === school.id ? (
                          <span className="school-directory-url-edit">
                            /
                            <input
                              value={schoolUrlDraft}
                              onChange={(event) => setSchoolUrlDraft(slugifySchoolName(event.target.value))}
                              aria-label={`URL slug for ${school.name}`}
                            />
                          </span>
                        ) : (
                          <span>/{school.id}</span>
                        )}
                      </div>
                    </div>
                    <div className="school-directory-meta">
                      <span>{school.city}, {school.country}</span>
                      <span>{school.staff.length} {school.staff.length === 1 ? "staff member" : "staff"} · {school.students.length} {school.students.length === 1 ? "student" : "students"}</span>
                    </div>
                    <div className="school-directory-actions">
                      <button className="secondary-action" type="button" onClick={() => openInNewTab(`/${school.id}`)}>
                        <Globe2 size={18} />
                        View website
                      </button>
                      <button className="primary-action" type="button" onClick={() => navigate(`/${school.id}/admin`)}>
                        <LayoutDashboard size={18} />
                        Simulate admin
                      </button>
                      <button
                        className={`secondary-action school-manage-btn${managingSchoolId === school.id ? " school-manage-btn-active" : ""}`}
                        type="button"
                        onClick={() => {
                          setManagingSchoolId(managingSchoolId === school.id ? null : school.id);
                          setEditingSchoolUrlId(null);
                        }}
                      >
                        Manage
                      </button>
                    </div>
                    {managingSchoolId === school.id ? (
                      <div className="school-manage-panel">
                        {editingSchoolUrlId === school.id ? (
                          <>
                            <span className="school-directory-url-edit">
                              /
                              <input
                                value={schoolUrlDraft}
                                onChange={(event) => setSchoolUrlDraft(slugifySchoolName(event.target.value))}
                                aria-label={`URL slug for ${school.name}`}
                              />
                            </span>
                            <button className="secondary-action" type="button" onClick={() => void saveSchoolUrl(school)}>
                              Save URL
                            </button>
                            <button className="remove-button" type="button" onClick={() => setEditingSchoolUrlId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="secondary-action" type="button" onClick={() => startEditSchoolUrl(school)}>
                            Edit URL
                          </button>
                        )}
                        <button className="remove-button" type="button" onClick={() => void removeSchool(school)}>
                          Delete school
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {filteredSchools.length === 0 ? (
                  <div className="empty-state">
                    <h3>No schools found</h3>
                    <p>Try another search term or create a new school.</p>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function SupportTicketsPanel({
  schools,
  respondedBy,
  onUpdateTicket,
}: {
  schools: School[];
  respondedBy?: string;
  onUpdateTicket: (schoolId: string, ticketId: string, patch: Partial<SupportTicket>) => void;
}) {
  const tickets = schools
    .flatMap((school) => (school.supportTickets ?? []).map((ticket) => ({ school, ticket })))
    .sort((first, second) => new Date(second.ticket.createdAt).getTime() - new Date(first.ticket.createdAt).getTime());
  const [openTicketKey, setOpenTicketKey] = useState<string | null>(null);
  const [draftResponses, setDraftResponses] = useState<Record<string, string>>({});

  const statusLabel = (status: SupportTicket["status"]) =>
    status === "open" ? "Open" : status === "in-progress" ? "In progress" : "Resolved";

  return (
    <EditorPanel title="Support tickets">
      {tickets.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No support tickets</h3>
          <p>Tickets raised by school admins will appear here.</p>
        </div>
      ) : (
        <div className="support-ticket-table">
          {tickets.map(({ school, ticket }) => {
            const draftKey = `${school.id}:${ticket.id}`;
            const isOpen = openTicketKey === draftKey;
            const responseDraft = draftResponses[draftKey] ?? ticket.response ?? "";
            return (
              <article key={draftKey} className={`support-ticket-row${isOpen ? " support-ticket-row--open" : ""}`}>
                <button
                  className="support-ticket-row-summary"
                  type="button"
                  onClick={() => setOpenTicketKey(isOpen ? null : draftKey)}
                  aria-expanded={isOpen}
                >
                  <span className={`support-ticket-status-dot support-ticket-status-dot--${ticket.status}`} />
                  <span className="support-ticket-subject">{ticket.subject}</span>
                  <span className="support-ticket-school">{school.name}</span>
                  <span className="support-ticket-status-label">{statusLabel(ticket.status)}</span>
                  <span className="support-ticket-time">{formatDateTime(ticket.createdAt)}</span>
                  <ChevronRight size={16} className={`support-ticket-chevron${isOpen ? " support-ticket-chevron--open" : ""}`} />
                </button>
                {isOpen ? (
                  <div className="support-ticket-detail">
                    <div className="support-ticket-meta">
                      <span>{ticket.createdBy || "School admin"}</span>
                      <label className="field-label support-ticket-status">
                        Status
                        <select
                          value={ticket.status}
                          onChange={(event) => onUpdateTicket(school.id, ticket.id, { status: event.target.value as SupportTicket["status"] })}
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </label>
                    </div>
                    <p className="support-ticket-message">{ticket.message}</p>
                    {ticket.response ? <p className="support-ticket-response"><strong>Previous response:</strong> {ticket.response}</p> : null}
                    <TextArea
                      label="Response note"
                      value={responseDraft}
                      onChange={(response) => setDraftResponses((current) => ({ ...current, [draftKey]: response }))}
                    />
                    <div className="support-ticket-actions">
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() => onUpdateTicket(school.id, ticket.id, { response: responseDraft.trim() || undefined, respondedBy: respondedBy, respondedAt: responseDraft.trim() ? new Date().toISOString() : undefined })}
                      >
                        Save response
                      </button>
                      <button className="secondary-action" type="button" onClick={() => navigate(`/${school.id}/admin`)}>
                        Open admin
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </EditorPanel>
  );
}

function SubscriptionsPanel({
  schools,
  onUpdate,
}: {
  schools: School[];
  onUpdate: (schoolId: string, subscription: SchoolSubscription) => Promise<void>;
}) {
  const freeCount = schools.filter((s) => !s.subscription || s.subscription.plan === "free").length;
  const paidCount = schools.filter((s) => s.subscription && s.subscription.plan !== "free").length;
  const totalMonthlyRevenue = schools.reduce((sum, s) => {
    if (!s.subscription) return sum;
    if (s.subscription.plan === "per-student" && s.subscription.pricePerStudent) {
      const price = s.subscription.interval === "yearly" ? s.subscription.pricePerStudent / 12 : s.subscription.pricePerStudent;
      return sum + s.students.filter((st) => !st.accountDisabled).length * price;
    }
    if (s.subscription.plan === "fixed" && s.subscription.fixedPrice) {
      return sum + (s.subscription.interval === "yearly" ? s.subscription.fixedPrice / 12 : s.subscription.fixedPrice);
    }
    return sum;
  }, 0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  const save = async (schoolId: string, subscription: SchoolSubscription) => {
    setSavingIds((prev) => new Set([...prev, schoolId]));
    try {
      await onUpdate(schoolId, subscription);
    } finally {
      setSavingIds((prev) => { const next = new Set(prev); next.delete(schoolId); return next; });
    }
  };

  return (
    <EditorPanel title="Subscriptions">
      <div className="subscription-summary-grid">
        <div className="subscription-summary-card">
          <span className="subscription-summary-label">Free plan</span>
          <strong className="subscription-summary-value">{freeCount}</strong>
          <span className="subscription-summary-sub">schools</span>
        </div>
        <div className="subscription-summary-card">
          <span className="subscription-summary-label">Paid plans</span>
          <strong className="subscription-summary-value">{paidCount}</strong>
          <span className="subscription-summary-sub">schools</span>
        </div>
        <div className="subscription-summary-card subscription-summary-revenue">
          <span className="subscription-summary-label">Monthly revenue</span>
          <strong className="subscription-summary-value">{formatKES(totalMonthlyRevenue)}</strong>
          <span className="subscription-summary-sub">estimated</span>
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table subscription-table">
          <thead>
            <tr>
              <th>School</th>
              <th>Students</th>
              <th>Plan</th>
              <th>Interval</th>
              <th>Price</th>
              <th>Period total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => {
              const sub = school.subscription ?? { plan: "free" as const };
              const isPaid = sub.plan !== "free";
              const interval = sub.interval ?? "monthly";
              const isSaving = savingIds.has(school.id);
              const draftPriceKey = school.id;
              const activeStudents = school.students.filter((s) => !s.accountDisabled).length;
              const periodTotal = sub.plan === "per-student" && sub.pricePerStudent
                ? activeStudents * sub.pricePerStudent
                : sub.plan === "fixed" && sub.fixedPrice ? sub.fixedPrice : 0;
              const priceField = sub.plan === "per-student" ? "pricePerStudent" : "fixedPrice";
              const priceValue = sub.plan === "per-student" ? sub.pricePerStudent : sub.plan === "fixed" ? sub.fixedPrice : undefined;
              const draftPrice = draftPrices[draftPriceKey] ?? String(priceValue ?? "");
              return (
                <tr key={school.id} className={isSaving ? "subscription-row-saving" : ""}>
                  <td>
                    <div>
                      <strong>{school.name}</strong>
                      <small className="subscription-school-id">/{school.id}</small>
                    </div>
                  </td>
                  <td>{activeStudents}</td>
                  <td>
                    <select
                      className="subscription-plan-select"
                      value={sub.plan}
                      disabled={isSaving}
                      onChange={(e) => {
                        const plan = e.target.value as SchoolSubscription["plan"];
                        void save(school.id, { plan, interval: sub.interval });
                      }}
                    >
                      <option value="free">Free</option>
                      <option value="fixed">Fixed price</option>
                      <option value="per-student">Per student</option>
                    </select>
                  </td>
                  <td>
                    {isPaid ? (
                      <select
                        className="subscription-plan-select"
                        value={interval}
                        disabled={isSaving}
                        onChange={(e) => void save(school.id, { ...sub, interval: e.target.value as "monthly" | "yearly" })}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    ) : <span className="subscription-na">—</span>}
                  </td>
                  <td>
                    {isPaid ? (
                      <div className="subscription-price-input-wrap">
                        <span className="subscription-currency">KES</span>
                        <input
                          className="subscription-price-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draftPrice}
                          placeholder="0.00"
                          disabled={isSaving}
                          onChange={(e) => setDraftPrices((prev) => ({ ...prev, [draftPriceKey]: e.target.value }))}
                          onBlur={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            setDraftPrices((prev) => { const next = { ...prev }; delete next[draftPriceKey]; return next; });
                            void save(school.id, { ...sub, [priceField]: price });
                          }}
                        />
                        <span className="subscription-per-label">{sub.plan === "per-student" ? `/ student / ${interval === "yearly" ? "yr" : "mo"}` : `/ ${interval === "yearly" ? "yr" : "mo"}`}</span>
                      </div>
                    ) : <span className="subscription-na">—</span>}
                  </td>
                  <td>
                    {isPaid && periodTotal > 0 ? (
                      <strong className="subscription-monthly-total">{formatKES(periodTotal)}</strong>
                    ) : <span className="subscription-na">—</span>}
                  </td>
                  <td className="subscription-saving-cell">
                    {isSaving ? <span className="subscription-saving-spinner" aria-label="Saving…" /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </EditorPanel>
  );
}

function InvoiceView({ school, payment }: { school: School; payment: SchoolPayment }) {
  const sub = school.subscription;
  const paidAmount = getPaidAmount(payment);
  const balance = payment.totalAmount - paidAmount;
  return (
    <div className="invoice-view">
      <div className="invoice-header">
        <div>
          <h2 className="invoice-title">Invoice</h2>
          <p className="invoice-period">{formatBillingPeriod(payment.period)}</p>
        </div>
        <div className="invoice-school-info">
          <strong>{school.name}</strong>
          {school.address ? <span>{school.address}</span> : null}
          {school.email ? <span>{school.email}</span> : null}
        </div>
      </div>
      <div className="invoice-meta">
        <span><strong>Invoice ID:</strong> {payment.id}</span>
        <span><strong>Due date:</strong> {payment.dueDate}</span>
        <span><strong>Plan:</strong> {sub?.plan === "fixed" ? "Fixed price" : sub?.plan === "per-student" ? "Per student" : "Free"}{sub?.interval ? ` (${sub.interval})` : ""}</span>
      </div>
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Unit price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {payment.lineItems.map((item, i) => (
            <tr key={i}>
              <td>{item.description}</td>
              <td>{formatKES(item.unitPrice)}</td>
              <td>{formatKES(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="invoice-total-row">
            <td colSpan={2}><strong>Total</strong></td>
            <td><strong>{formatKES(payment.totalAmount)}</strong></td>
          </tr>
          {paidAmount > 0 ? (
            <>
              <tr>
                <td colSpan={2}>Paid</td>
                <td>{formatKES(paidAmount)}</td>
              </tr>
              <tr className={balance > 0 ? "invoice-balance-due" : "invoice-balance-clear"}>
                <td colSpan={2}><strong>{balance > 0 ? "Balance due" : "Settled"}</strong></td>
                <td><strong>{formatKES(Math.abs(balance))}</strong></td>
              </tr>
            </>
          ) : null}
        </tfoot>
      </table>
      {payment.records.length > 0 ? (
        <div className="invoice-records">
          <h4>Payment records</h4>
          {payment.records.map((r) => (
            <div key={r.id} className="invoice-record-row">
              <span>{r.paidAt}</span>
              <span>{formatKES(r.amount)}</span>
              {r.note ? <span className="invoice-record-note">{r.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PaymentsPanel({
  schools,
  onUpdatePayment,
}: {
  schools: School[];
  onUpdatePayment: (schoolId: string, payment: SchoolPayment) => Promise<void>;
}) {
  const [filterStatus, setFilterStatus] = useState<"all" | SchoolPayment["status"]>("all");
  const [activePaymentKey, setActivePaymentKey] = useState<string | null>(null);
  const [newRecordAmount, setNewRecordAmount] = useState<Record<string, string>>({});
  const [newRecordNote, setNewRecordNote] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const allPayments = schools
    .flatMap((school) => (school.payments ?? []).map((p) => ({ school, payment: { ...p, status: computePaymentStatus(p) } })))
    .sort((a, b) => b.payment.period.localeCompare(a.payment.period));

  const filtered = filterStatus === "all" ? allPayments : allPayments.filter(({ payment }) => payment.status === filterStatus);

  const paidSchools = schools.filter((s) => s.subscription && s.subscription.plan !== "free");

  const doSave = async (schoolId: string, payment: SchoolPayment) => {
    const key = `${schoolId}:${payment.id}`;
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await onUpdatePayment(schoolId, payment);
    } finally {
      setSaving((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleGenerate = async (school: School) => {
    const interval = school.subscription?.interval ?? "monthly";
    const period = getCurrentPeriod(interval);
    const exists = (school.payments ?? []).some((p) => p.period === period);
    if (exists) { alert(`Payment for ${formatBillingPeriod(period)} already exists.`); return; }
    const payment = generatePayment(school, period);
    if (!payment) return;
    setGenerating((prev) => ({ ...prev, [school.id]: true }));
    try {
      await onUpdatePayment(school.id, payment);
    } finally {
      setGenerating((prev) => { const next = { ...prev }; delete next[school.id]; return next; });
    }
  };

  const statusLabel = (s: SchoolPayment["status"]) => s === "upcoming" ? "Upcoming" : s === "outstanding" ? "Outstanding" : s === "partial" ? "Partial" : "Paid";

  return (
    <EditorPanel title="Payments">
      <div className="payments-generate-row">
        <strong>Generate current period invoice:</strong>
        <div className="payments-generate-buttons">
          {paidSchools.map((school) => (
            <button
              key={school.id}
              className="secondary-action"
              type="button"
              disabled={generating[school.id]}
              onClick={() => void handleGenerate(school)}
            >
              {school.name}
            </button>
          ))}
          {paidSchools.length === 0 ? <span className="subscription-na">No paid schools</span> : null}
        </div>
      </div>
      <div className="payment-status-filter">
        {(["all", "upcoming", "outstanding", "partial", "paid"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={filterStatus === s ? "active-payment-filter" : "payment-filter-btn"}
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "All" : statusLabel(s)}
            <span className="payment-filter-count">
              {s === "all" ? allPayments.length : allPayments.filter((p) => p.payment.status === s).length}
            </span>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No payments</h3>
          <p>Generate invoices for paid schools using the buttons above.</p>
        </div>
      ) : (
        <div className="payment-list">
          {filtered.map(({ school, payment }) => {
            const key = `${school.id}:${payment.id}`;
            const isOpen = activePaymentKey === key;
            const isSaving = saving[key];
            const paidAmount = getPaidAmount(payment);
            const balance = payment.totalAmount - paidAmount;
            return (
              <article key={key} className={`payment-row${isOpen ? " payment-row--open" : ""}`}>
                <button className="payment-row-summary" type="button" onClick={() => setActivePaymentKey(isOpen ? null : key)} aria-expanded={isOpen}>
                  <span className={`payment-status-dot payment-status-dot--${payment.status}`} />
                  <span className="payment-school-name">{school.name}</span>
                  <span className="payment-period">{formatBillingPeriod(payment.period)}</span>
                  <span className="payment-amount">{formatKES(payment.totalAmount)}</span>
                  <span className={`payment-status-badge payment-status-badge--${payment.status}`}>{statusLabel(payment.status)}</span>
                  <span className="payment-due">Due {payment.dueDate}</span>
                  <ChevronRight size={16} className={`support-ticket-chevron${isOpen ? " support-ticket-chevron--open" : ""}`} />
                </button>
                {isOpen ? (
                  <div className="payment-detail">
                    <div className="payment-detail-columns">
                      <div className="payment-detail-left">
                        <InvoiceView school={school} payment={payment} />
                      </div>
                      <div className="payment-detail-right">
                        <div className="payment-actions-panel">
                          <h4>Status</h4>
                          <select
                            value={payment.status}
                            disabled={Boolean(isSaving)}
                            onChange={(e) => void doSave(school.id, { ...payment, status: e.target.value as SchoolPayment["status"] })}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="outstanding">Outstanding</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                        <div className="payment-actions-panel">
                          <h4>Register payment</h4>
                          {balance > 0 ? (
                            <>
                              <div className="subscription-price-input-wrap">
                                <span className="subscription-currency">KES</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="subscription-price-input"
                                  placeholder={balance.toFixed(2)}
                                  value={newRecordAmount[key] ?? ""}
                                  onChange={(e) => setNewRecordAmount((prev) => ({ ...prev, [key]: e.target.value }))}
                                />
                              </div>
                              <input
                                className="inline-table-input"
                                placeholder="Note (optional)"
                                value={newRecordNote[key] ?? ""}
                                onChange={(e) => setNewRecordNote((prev) => ({ ...prev, [key]: e.target.value }))}
                              />
                              <button
                                className="primary-action"
                                type="button"
                                disabled={Boolean(isSaving) || !newRecordAmount[key]}
                                onClick={() => {
                                  const amount = parseFloat(newRecordAmount[key] ?? "0") || 0;
                                  if (amount <= 0) return;
                                  const record: PaymentRecord = { id: `record-${Date.now()}`, paidAt: new Date().toISOString().slice(0, 10), amount, note: newRecordNote[key]?.trim() || undefined };
                                  const updated = { ...payment, records: [...payment.records, record] };
                                  const newStatus = computePaymentStatus(updated);
                                  setNewRecordAmount((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                  setNewRecordNote((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                  void doSave(school.id, { ...updated, status: newStatus });
                                }}
                              >
                                Record payment
                              </button>
                            </>
                          ) : <p className="payment-fully-paid">Fully paid</p>}
                        </div>
                        <div className="payment-actions-panel">
                          <h4>Comments</h4>
                          {(payment.comments ?? []).map((c) => (
                            <div key={c.id} className="payment-comment">
                              <span className="payment-comment-date">{c.createdAt.slice(0, 10)}</span>
                              <p>{c.body}</p>
                            </div>
                          ))}
                          <textarea
                            className="payment-comment-input"
                            placeholder="Add a comment…"
                            rows={2}
                            value={newComment[key] ?? ""}
                            onChange={(e) => setNewComment((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                          <button
                            className="secondary-action"
                            type="button"
                            disabled={Boolean(isSaving) || !newComment[key]?.trim()}
                            onClick={() => {
                              const body = newComment[key]?.trim();
                              if (!body) return;
                              const comment: PaymentComment = { id: `comment-${Date.now()}`, body, createdAt: new Date().toISOString() };
                              setNewComment((prev) => { const next = { ...prev }; delete next[key]; return next; });
                              void doSave(school.id, { ...payment, comments: [...(payment.comments ?? []), comment] });
                            }}
                          >
                            Add comment
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </EditorPanel>
  );
}

function SchoolBillingPanel({
  school,
  onUpdatePayment: _onUpdatePayment,
}: {
  school: School;
  onUpdatePayment: (payment: SchoolPayment) => void;
}) {
  const sub = school.subscription;
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const payments = (school.payments ?? [])
    .map((p) => ({ ...p, status: computePaymentStatus(p) }))
    .sort((a, b) => b.period.localeCompare(a.period));

  const planLabel = !sub || sub.plan === "free" ? "Free" : sub.plan === "fixed" ? "Fixed price" : "Per student";
  const interval = sub?.interval ?? "monthly";

  const statusLabel = (s: SchoolPayment["status"]) => s === "upcoming" ? "Upcoming" : s === "outstanding" ? "Outstanding" : s === "partial" ? "Partial paid" : "Paid";

  return (
    <EditorPanel title="Billing">
      <div className="nested-editor-grid">
        <section className="sub-editor-panel">
          <h3>Subscription</h3>
          <div className="billing-subscription-summary">
            <div className="billing-plan-row">
              <span className="billing-plan-label">Plan</span>
              <strong>{planLabel}</strong>
            </div>
            {sub && sub.plan !== "free" ? (
              <>
                <div className="billing-plan-row">
                  <span className="billing-plan-label">Billing interval</span>
                  <strong>{interval.charAt(0).toUpperCase() + interval.slice(1)}</strong>
                </div>
                {sub.plan === "fixed" && sub.fixedPrice !== undefined ? (
                  <div className="billing-plan-row">
                    <span className="billing-plan-label">Price</span>
                    <strong>{formatKES(sub.fixedPrice)} / {interval === "yearly" ? "year" : "month"}</strong>
                  </div>
                ) : null}
                {sub.plan === "per-student" && sub.pricePerStudent !== undefined ? (
                  <>
                    <div className="billing-plan-row">
                      <span className="billing-plan-label">Rate</span>
                      <strong>{formatKES(sub.pricePerStudent)} / student / {interval === "yearly" ? "year" : "month"}</strong>
                    </div>
                    <div className="billing-plan-row">
                      <span className="billing-plan-label">Active students</span>
                      <strong>{school.students.filter((s) => !s.accountDisabled).length}</strong>
                    </div>
                    <div className="billing-plan-row billing-plan-row-total">
                      <span className="billing-plan-label">Estimated per period</span>
                      <strong>{formatKES(school.students.filter((s) => !s.accountDisabled).length * sub.pricePerStudent!)}</strong>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <p className="editor-helper-text">Contact EduLink Africa to upgrade your subscription.</p>
            )}
          </div>
        </section>

        <section className="sub-editor-panel">
          <h3>Payments</h3>
          {payments.length === 0 ? (
            <div className="empty-editor-state">
              <h3>No invoices yet</h3>
              <p>Invoices will appear here when generated by EduLink Africa.</p>
            </div>
          ) : (
            <div className="billing-payment-list">
              {payments.map((payment) => {
                const paidAmount = getPaidAmount(payment);
                const isSelected = selectedPaymentId === payment.id;
                return (
                  <div key={payment.id} className={`billing-payment-row${isSelected ? " billing-payment-row--selected" : ""}`}>
                    <button className="billing-payment-row-btn" type="button" onClick={() => setSelectedPaymentId(isSelected ? null : payment.id)}>
                      <span className={`payment-status-dot payment-status-dot--${payment.status}`} />
                      <span className="billing-payment-period">{formatBillingPeriod(payment.period)}</span>
                      <span className="billing-payment-amount">{formatKES(payment.totalAmount)}</span>
                      <span className={`payment-status-badge payment-status-badge--${payment.status}`}>{statusLabel(payment.status)}</span>
                      <span className="billing-payment-due">Due {payment.dueDate}</span>
                      <ChevronRight size={15} className={`support-ticket-chevron${isSelected ? " support-ticket-chevron--open" : ""}`} />
                    </button>
                    {isSelected ? (
                      <div className="billing-invoice-expand">
                        <InvoiceView school={school} payment={payment} />
                        {payment.comments && payment.comments.length > 0 ? (
                          <div className="billing-payment-comments">
                            <h4>Comments</h4>
                            {payment.comments.map((c) => (
                              <div key={c.id} className="payment-comment">
                                <span className="payment-comment-date">{c.createdAt.slice(0, 10)}</span>
                                <p>{c.body}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {paidAmount > 0 && paidAmount < payment.totalAmount ? (
                          <p className="billing-payment-balance"><strong>Balance due: {formatKES(payment.totalAmount - paidAmount)}</strong></p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </EditorPanel>
  );
}

function GlobalAboutEditor({
  config,
  onChange,
  onSubmit,
}: {
  config: GlobalAboutConfig;
  onChange: (config: GlobalAboutConfig) => void;
  onSubmit: () => Promise<void>;
}) {
  const categories = config.categories ?? [];
  const pages = config.pages ?? [];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSubmit();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorPanel title="Global about pages">
      <div className="panel-heading global-about-heading">
        <div>
          <p>Global categories appear as navigation links in the school header. Pages in a category are shown on that category's page. Categories named "about" appear on the About page.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => void handleSave()} disabled={saving}>
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save global pages"}
        </button>
      </div>
      <div className="nested-editor-grid">
        <section className="sub-editor-panel">
          <h3>Global categories</h3>
          <Repeater
            items={categories}
            addLabel="Add global category"
            createItem={(): AboutCategory => ({ id: `global-category-${Date.now()}`, title: "New global category" })}
            onChange={(items) => {
              const validIds = new Set(items.map((item) => item.id));
              onChange({
                ...config,
                categories: items,
                pages: pages.map((page) => ({
                  ...page,
                  categoryId: validIds.has(page.categoryId) ? page.categoryId : items[0]?.id ?? "",
                })),
              });
            }}
            renderItem={(item, update) => (
              <>
                <TextInput label="Category id" value={item.id} onChange={(value) => update({ ...item, id: slugifySchoolName(value) })} />
                <TextInput label="Category title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
              </>
            )}
          />
        </section>

        <section className="sub-editor-panel">
          <h3>Global pages</h3>
          {categories.length === 0 ? (
            <div className="empty-editor-state">
              <h3>Create a global category first</h3>
              <p>Global pages must belong to a category.</p>
            </div>
          ) : (
            <Repeater
              items={pages}
              addLabel="Add global page"
              createItem={(): GlobalAboutPage => ({
                id: `global-page-${Date.now()}`,
                categoryId: categories[0].id,
                title: "New global page",
                slug: "",
                headerImage: "",
                body: "",
                kind: "richText",
              })}
              onChange={(items) => onChange({ ...config, pages: items })}
              renderItem={(item, update) => (
                <>
                  <SelectInput
                    label="Page type"
                    value={item.kind ?? "richText"}
                    options={[
                      { value: "richText", label: "Rich text page" },
                      { value: "staffDirectory", label: "Staff directory" },
                      { value: "contact", label: "Contact info (shows school contact details)" },
                    ]}
                    onChange={(value) => update({ ...item, kind: value as GlobalAboutPage["kind"] })}
                  />
                  <TextInput
                    label="Page title"
                    value={item.title}
                    onChange={(value) => update({ ...item, title: value, slug: item.slug || slugifySchoolName(value) })}
                  />
                  <TextInput label="URL slug" value={item.slug} onChange={(value) => update({ ...item, slug: slugifySchoolName(value) })} />
                  <SelectInput
                    label="Category"
                    value={item.categoryId}
                    options={categories.map((category) => ({ value: category.id, label: category.title }))}
                    onChange={(value) => update({ ...item, categoryId: value })}
                  />
                  {item.kind === "staffDirectory" || item.kind === "contact" ? null : (
                    <>
                      <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
                      <RichTextEditor label="Page content" value={item.body} onChange={(value) => update({ ...item, body: value })} />
                    </>
                  )}
                </>
              )}
            />
          )}
        </section>
      </div>
    </EditorPanel>
  );
}

const REMARK_PARENTS: RemarkCategory[] = [
  { id: "conduct", name: "Conduct" },
  { id: "behavior", name: "Behavior" },
];

function GlobalSchoolWorkEditor({
  config,
  onChange,
  onSubmit,
}: {
  config: GlobalSchoolWorkConfig;
  onChange: (config: GlobalSchoolWorkConfig) => void;
  onSubmit: () => Promise<void>;
}) {
  const [activeSection, setActiveSection] = useState<"assessmentScales" | "remarkCategories" | null>(null);
  const scales = config.assessmentScales ?? [];
  const remarkCategories = config.remarkCategories ?? [];
  const updateScale = (scaleIndex: number, scale: AssessmentScale) => {
    onChange({
      ...config,
      assessmentScales: scales.map((item, index) => index === scaleIndex ? scale : item),
    });
  };

  return (
    <EditorPanel title="Schoolwork settings">
      <div className="panel-heading global-about-heading">
        <div>
          <p>Manage global assessment scales and remark categories available to all schools.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => void onSubmit()}>
          <Save size={18} />
          Save settings
        </button>
      </div>
      {activeSection === null ? (
        <div className="editor-section-card-grid">
          <button className="editor-section-card" type="button" onClick={() => setActiveSection("assessmentScales")}>
            <AdminCardTitle icon={faScaleBalanced} title="Assessment scales" />
            <span>Manage global default assessment scales available to every school.</span>
          </button>
          <button className="editor-section-card" type="button" onClick={() => setActiveSection("remarkCategories")}>
            <AdminCardTitle icon={faTags} title="Remark categories" />
            <span>Manage global categories for teacher remarks on students.</span>
          </button>
        </div>
      ) : activeSection === "assessmentScales" ? (
        <>
          <button className="school-work-back-link" type="button" onClick={() => setActiveSection(null)}>
            <ArrowLeft size={16} />
            Back to settings
          </button>
          <div className="scale-editor-list">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => onChange({
                ...config,
                assessmentScales: [
                  ...scales,
                  {
                    id: `scale-${Date.now()}`,
                    name: "New assessment scale",
                    levels: [
                      { id: `level-${Date.now()}-1`, value: "3", minPercentage: 80, description: "" },
                      { id: `level-${Date.now()}-2`, value: "2", minPercentage: 50, description: "" },
                      { id: `level-${Date.now()}-3`, value: "1", minPercentage: 0, description: "" },
                      { id: "excused", value: "Excused", minPercentage: 0, description: "" },
                      { id: "assessed", value: "Assessed", minPercentage: 0, description: "" },
                    ],
                  },
                ],
              })}
            >
              Add assessment scale
            </button>
            {scales.map((scale, scaleIndex) => (
              <section className="sub-editor-panel assessment-scale-panel" key={scale.id}>
                <div className="scale-heading">
                  <TextInput
                    label="Scale name"
                    value={scale.name}
                    onChange={(name) => updateScale(scaleIndex, { ...scale, name })}
                  />
                  <TextInput
                    label="Scale id"
                    value={scale.id}
                    onChange={(id) => updateScale(scaleIndex, { ...scale, id: slugifySchoolName(id) })}
                  />
                </div>
                <div className="assessment-level-table-wrap">
                  <table className="assessment-level-table">
                    <thead>
                      <tr>
                        <th>Value</th>
                        <th>Minimum %</th>
                        <th>Description</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scale.levels.map((level, levelIndex) => (
                        <tr key={level.id}>
                          <td>
                            <input
                              aria-label="Value"
                              value={level.value}
                              onChange={(event) => updateScale(scaleIndex, {
                                ...scale,
                                levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, value: event.target.value } : item),
                              })}
                            />
                          </td>
                          <td>
                            <input
                              aria-label="Minimum percentage"
                              value={String(level.minPercentage ?? 0)}
                              onChange={(event) => updateScale(scaleIndex, {
                                ...scale,
                                levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, minPercentage: parsePercentageInput(event.target.value) } : item),
                              })}
                            />
                          </td>
                          <td>
                            <input
                              aria-label="Description"
                              value={level.description ?? ""}
                              onChange={(event) => updateScale(scaleIndex, {
                                ...scale,
                                levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, description: event.target.value } : item),
                              })}
                            />
                          </td>
                          <td>
                            <button
                              className="remove-button"
                              type="button"
                              onClick={() => updateScale(scaleIndex, { ...scale, levels: scale.levels.filter((_, index) => index !== levelIndex) })}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="scale-actions">
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => updateScale(scaleIndex, {
                      ...scale,
                      levels: [...scale.levels, { id: `level-${Date.now()}`, value: "", minPercentage: 0, description: "" }],
                    })}
                  >
                    Add level
                  </button>
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => onChange({ ...config, assessmentScales: scales.filter((_, index) => index !== scaleIndex) })}
                  >
                    Remove scale
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="school-work-back-link" type="button" onClick={() => setActiveSection(null)}>
            <ArrowLeft size={16} />
            Back to settings
          </button>
          <div className="panel-heading global-about-heading">
            <div>
              <p>Global sub-types available to all schools under the built-in Conduct and Behavior categories. Schools can disable individual sub-types or add their own.</p>
            </div>
          </div>
          {REMARK_PARENTS.map((parent) => {
            const children = remarkCategories.filter((c) => c.parentId === parent.id);
            return (
              <section className="sub-editor-panel assessment-scale-panel" key={parent.id}>
                <div className="scale-heading">
                  <h4>{parent.name}</h4>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => onChange({ ...config, remarkCategories: [...remarkCategories, { id: `rc-${Date.now()}`, name: "", parentId: parent.id }] })}
                  >
                    Add sub-type
                  </button>
                </div>
                {children.length === 0 ? (
                  <p className="empty-editor-state" style={{ margin: 0 }}>No sub-types yet. Add one above.</p>
                ) : (
                  <div className="remark-category-editor-list">
                    {children.map((cat) => (
                      <div className="remark-category-editor-row" key={cat.id}>
                        <TextInput
                          label="Sub-type name"
                          value={cat.name}
                          onChange={(name) => onChange({ ...config, remarkCategories: remarkCategories.map((item) => item.id === cat.id ? { ...item, name } : item) })}
                        />
                        <button className="remove-button" type="button" onClick={() => onChange({ ...config, remarkCategories: remarkCategories.filter((item) => item.id !== cat.id) })}>
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </EditorPanel>
  );
}

function ReadOnlyGlobalAbout({
  config,
  schoolPages,
  onLocalPageChange,
}: {
  config: GlobalAboutConfig;
  schoolPages: AboutPage[];
  onLocalPageChange: (page: AboutPage) => void;
}) {
  return (
    <section className="readonly-global-about">
      <div>
        <h3>Global categories and pages</h3>
        <p>Global categories and pages are managed by superadmin. You can add school-specific content to each global page.</p>
      </div>
      <div className="readonly-global-about-grid">
        {config.categories.map((category) => {
          const pages = config.pages.filter((page) => page.categoryId === category.id);
          return (
            <article className="readonly-global-about-card" key={category.id}>
              <h4>{category.title}</h4>
              {pages.length === 0 ? (
                <p>No global pages in this category.</p>
              ) : (
                <ul>
                  {pages.map((page) => (
                    <li key={page.id}>
                      <span>{page.title}</span>
                      <small>/{page.slug}</small>
                      <RichTextEditor
                        label={page.kind === "staffDirectory" ? "Local description above staff" : "Local content for this page"}
                        value={schoolPages.find((item) => item.slug === page.slug)?.body ?? ""}
                        onChange={(body) => {
                          const existingPage = schoolPages.find((item) => item.slug === page.slug);
                          onLocalPageChange({
                            id: existingPage?.id ?? `local-global-page-${page.slug}`,
                            categoryId: page.categoryId,
                            title: page.title,
                            slug: page.slug,
                            headerImage: existingPage?.headerImage ?? "",
                            body,
                          });
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SchoolEditor({
  school,
  globalAbout,
  globalSchoolWork,
  onChange,
  onSubmit,
  onAutoSave,
  activeCategory,
  activeSection,
  currentUserEmail,
  canAccessAllSubjectClasses,
  onSimulateStaff,
  onSimulateStudent,
  onBack,
  onSectionChange,
}: {
  school: School;
  globalAbout?: GlobalAboutConfig;
  globalSchoolWork?: GlobalSchoolWorkConfig;
  onChange: (school: School) => void;
  onSubmit: () => Promise<void>;
  onAutoSave?: (school: School) => Promise<void>;
  activeCategory: EditorCategory;
  activeSection: EditorSection | null;
  currentUserEmail?: string | null;
  canAccessAllSubjectClasses?: boolean;
  onSimulateStaff?: (staffMember: StaffMember) => void;
  onSimulateStudent?: (student: Student) => void;
  onBack: () => void;
  onSectionChange: (section: EditorSection) => void;
}) {
  const createStaffMember = (): StaffMember => ({
    name: "Staff name",
    role: "Role",
    category: "Teacher",
    categories: ["Teacher"],
    visibleOnHomePage: true,
    visibleOnStaffPage: true,
    accountDisabled: false,
  });
  const classes = school.classes ?? [];
  const gradeLevels = school.gradeLevels ?? [];
  const gradeOptions = [
    { value: "", label: "Select grade and year" },
    ...gradeLevels.map((gradeLevel) => ({ value: gradeLevel.id, label: formatGradeLevel(gradeLevel) })),
  ];
  const subjectClassGradeOptions = [
    { value: "", label: "Select grade and year" },
    ...gradeLevels.map((gradeLevel) => ({ value: gradeLevel.id, label: formatSubjectClassGradeLevel(gradeLevel) })),
  ];
  const getGradeLevel = (gradeLevelId?: string) => gradeLevels.find((gradeLevel) => gradeLevel.id === gradeLevelId);
  const createGradeLevel = (): SchoolGradeLevel => ({ id: `grade-${Date.now()}`, grade: "", year: String(new Date().getFullYear()) });
  const createClassGroup = (): ClassGroup => {
    const gradeLevel = gradeLevels[0];
    return { id: `class-${Date.now()}`, name: "New class", gradeLevelId: gradeLevel?.id ?? "", grade: gradeLevel?.grade ?? "", teacher: "" };
  };
  const students = school.students ?? [];
  const subjects = school.subjects ?? [];
  const subjectClasses = school.subjectClasses ?? [];
  const schoolWorkSettings = school.schoolWorkSettings ?? {
    enabledGlobalAssessmentScaleIds: globalSchoolWork?.assessmentScales.map((scale) => scale.id) ?? [],
    knownGlobalAssessmentScaleIds: globalSchoolWork?.assessmentScales.map((scale) => scale.id) ?? [],
    allowStudentMessaging: false,
    customAssessmentScales: [],
  };
  const loginSettings = school.loginSettings ?? {
    emailPasswordEnabled: true,
    emailLinkEnabled: false,
  };
  const effectiveAssessmentScales = [
    ...(globalSchoolWork?.assessmentScales.filter((scale) => schoolWorkSettings.enabledGlobalAssessmentScaleIds.includes(scale.id)) ?? []),
    ...(schoolWorkSettings.customAssessmentScales ?? []),
  ];
  const accessibleSubjectClasses = subjectClasses.filter((subjectClass) => canAccessAllSubjectClasses || canTeachSubjectClass(school, subjectClass, currentUserEmail));
  const [activeWorkSubjectClassId, setActiveWorkSubjectClassId] = useState<string | null>(null);
  const aboutCategories = school.aboutCategories ?? [];
  const aboutPages = school.aboutPages ?? [];
  const createStudent = (): Student => ({
    id: `student-${Date.now()}`,
    firstName: "",
    lastName: "",
    classId: "",
    email: "",
    photoUrl: "",
    dateOfBirth: "",
    enrolledAt: new Date().toISOString().slice(0, 10),
    gender: "",
    description: "",
    guardians: [],
    accountDisabled: false,
  });
  const createNewsItem = (): NewsItem => ({
    id: `news-${Date.now()}`,
    title: "New announcement",
    slug: "",
    date: "2026-05-01",
    headerImage: "",
    body: "<p>Announcement details</p>",
  });
  const createCalendarItem = (): CalendarItem => ({ title: "School event", date: "2026-05-01" });
  const [newsModalIndex, setNewsModalIndex] = useState<number | null | undefined>(undefined);
  const [calendarModalIndex, setCalendarModalIndex] = useState<number | null | undefined>(undefined);
  const [staffModalIndex, setStaffModalIndex] = useState<number | null | undefined>(undefined);
  const [gradeLevelModalIndex, setGradeLevelModalIndex] = useState<number | null | undefined>(undefined);
  const [classModalIndex, setClassModalIndex] = useState<number | null | undefined>(undefined);
  const [subjectClassModalIndex, setSubjectClassModalIndex] = useState<number | null | undefined>(undefined);
  const [subjectModalIndex, setSubjectModalIndex] = useState<number | null | undefined>(undefined);
  const [studentModalIndex, setStudentModalIndex] = useState<number | null | undefined>(undefined);
  const [draftNews, setDraftNews] = useState<NewsItem>(() => createNewsItem());
  const [draftCalendar, setDraftCalendar] = useState<CalendarItem>(() => createCalendarItem());
  const [draftStaff, setDraftStaff] = useState<StaffMember>(() => createStaffMember());
  const [draftGradeLevel, setDraftGradeLevel] = useState<SchoolGradeLevel>(() => createGradeLevel());
  const [draftClass, setDraftClass] = useState<ClassGroup>(() => createClassGroup());
  const [draftStudent, setDraftStudent] = useState<Student>(() => createStudent());
  const [draftStudentSubjectClassIds, setDraftStudentSubjectClassIds] = useState<string[]>([]);
  const [draftStudentUseGradeSubjectClasses, setDraftStudentUseGradeSubjectClasses] = useState(false);
  const [subjectClassSearch, setSubjectClassSearch] = useState("");
  const [draftSubject, setDraftSubject] = useState<Subject>(() => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  }));
  const createSchoolAssessmentScale = (): AssessmentScale => ({
    id: `school-scale-${Date.now()}`,
    name: "New school assessment scale",
    levels: [
      { id: `level-${Date.now()}-1`, value: "3", minPercentage: 80, description: "" },
      { id: `level-${Date.now()}-2`, value: "2", minPercentage: 50, description: "" },
      { id: `level-${Date.now()}-3`, value: "1", minPercentage: 0, description: "" },
      { id: "excused", value: "Excused", minPercentage: 0, description: "" },
      { id: "assessed", value: "Assessed", minPercentage: 0, description: "" },
    ],
  });
  const updateSchool = (nextSchool: School) => {
    onChange(nextSchool);
    void onAutoSave?.(nextSchool);
  };
  const setField = <K extends keyof School>(field: K, value: School[K]) => {
    updateSchool({ ...school, [field]: value });
  };
  const updateSchoolWorkSettings = (nextSettings: SchoolWorkSettings) => setField("schoolWorkSettings", nextSettings);
  const updateRemarkSettings = (next: SchoolRemarkSettings) => setField("remarkSettings", next);
  const globalRemarkCategories = globalSchoolWork?.remarkCategories ?? [];

  const createSubject = (): Subject => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  });
  const getAutomaticSubjectClassName = (
    subjectId: string,
    baseClassId?: string,
    gradeLevelId?: string,
    subjectList: Subject[] = subjects,
    classList: ClassGroup[] = classes,
    gradeLevelList: SchoolGradeLevel[] = gradeLevels,
  ) => {
    const subjectName = subjectList.find((subject) => subject.id === subjectId)?.name;
    const className = classList.find((classGroup) => classGroup.id === baseClassId)?.name;
    const gradeLabel = formatSubjectClassGradeLevel(gradeLevelList.find((gradeLevel) => gradeLevel.id === gradeLevelId));
    if (subjectName && className) {
      return `${subjectName} - ${className}`;
    }
    if (subjectName && gradeLabel) {
      return `${subjectName} - ${gradeLabel}`;
    }
    return subjectName || className || (gradeLabel ? `Grade ${gradeLabel}` : "New subject class");
  };
  const withAutomaticSubjectClassName = (
    subjectClass: SubjectClass,
    subjectList: Subject[] = subjects,
    classList: ClassGroup[] = classes,
    gradeLevelList: SchoolGradeLevel[] = gradeLevels,
  ): SubjectClass => subjectClass.nameOverride
    ? subjectClass
    : {
      ...subjectClass,
      name: getAutomaticSubjectClassName(subjectClass.subjectId, subjectClass.baseClassId, subjectClass.gradeLevelId, subjectList, classList, gradeLevelList),
    };
  const updateAutomaticSubjectClassNames = (
    nextSubjectClasses: SubjectClass[],
    subjectList: Subject[] = subjects,
    classList: ClassGroup[] = classes,
    gradeLevelList: SchoolGradeLevel[] = gradeLevels,
  ) => nextSubjectClasses.map((subjectClass) => withAutomaticSubjectClassName(subjectClass, subjectList, classList, gradeLevelList));
  const createSubjectClass = (): SubjectClass => {
    const baseClass = classes[0];
    const subjectId = subjects[0]?.id ?? "";
    const baseClassId = baseClass?.id ?? "";
    const gradeLevelId = baseClass?.gradeLevelId ?? "";
    return {
      id: `subject-class-${Date.now()}`,
      name: getAutomaticSubjectClassName(subjectId, baseClassId, gradeLevelId),
      nameOverride: false,
      subjectId,
      gradeLevelId,
      baseClassId,
      teacherName: "",
      studentIds: [],
    };
  };
  const [draftSubjectClass, setDraftSubjectClass] = useState<SubjectClass>(() => createSubjectClass());
  const staffOptions = [
    { value: "", label: "Select staff member" },
    ...school.staff.map((member) => ({ value: member.name, label: `${member.name} - ${member.role}` })),
  ];
  const staffCategoryOptions: Array<{ value: StaffCategory; label: string }> = [
    { value: "Teacher", label: "Teacher" },
    { value: "Administration", label: "Administration" },
    { value: "Other", label: "Other" },
  ];
  const renderStaffFields = (item: StaffMember, update: (item: StaffMember) => void) => (
    <>
      <TextInput label="Name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <CheckboxGroup
        label="Categories"
        values={getStaffCategories(item)}
        options={staffCategoryOptions}
        onChange={(categories) => {
          const nextCategories = categories as StaffCategory[];
          update({
            ...item,
            categories: nextCategories,
            category: nextCategories[0] as StaffMember["category"] | undefined,
            canAccessAdminPage: item.canAccessAdminPage ?? nextCategories.includes("Administration"),
          });
        }}
      />
      <CheckboxInput
        label="Access admin page"
        checked={staffCanAccessAdminPage(item)}
        onChange={(checked) => update({ ...item, canAccessAdminPage: checked, accountDisabled: checked ? false : item.accountDisabled ?? false })}
      />
      <CheckboxInput
        label="Disable account"
        checked={isStaffAccountDisabled(item)}
        disabled={staffCanAccessAdminPage(item)}
        onChange={(checked) => update({ ...item, accountDisabled: checked })}
      />
      <TextInput label="Description" value={item.role} onChange={(value) => update({ ...item, role: value })} />
      <TextInput label="Phone" value={item.phone ?? ""} onChange={(value) => update({ ...item, phone: value })} />
      <TextInput label="Email" value={item.email ?? ""} onChange={(value) => update({ ...item, email: value })} />
      <StaffImageUpload photoUrl={item.photoUrl ?? ""} onChange={(photoUrl) => update({ ...item, photoUrl })} />
      <div className="checkbox-row">
        <CheckboxInput
          label="Visible on home page"
          checked={item.visibleOnHomePage ?? true}
          onChange={(checked) => update({ ...item, visibleOnHomePage: checked })}
        />
        <CheckboxInput
          label="Visible on staff page"
          checked={item.visibleOnStaffPage ?? true}
          onChange={(checked) => update({ ...item, visibleOnStaffPage: checked })}
        />
      </div>
    </>
  );
  const renderGradeLevelFields = (item: SchoolGradeLevel, update: (item: SchoolGradeLevel) => void) => (
    <>
      <TextInput
        label="Grade"
        value={item.grade}
        onChange={(grade) => update({ ...item, grade, id: slugifyGradeLevel(grade, item.year) })}
      />
      <TextInput
        label="Year"
        value={item.year}
        onChange={(year) => update({ ...item, year, id: slugifyGradeLevel(item.grade, year) })}
      />
    </>
  );
  const renderClassFields = (item: ClassGroup, update: (item: ClassGroup) => void) => (
    <>
      <TextInput label="Main class name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <SelectInput
        label="Grade and year"
        value={item.gradeLevelId ?? ""}
        options={gradeOptions}
        onChange={(gradeLevelId) => {
          const gradeLevel = getGradeLevel(gradeLevelId);
          update({ ...item, gradeLevelId, grade: gradeLevel?.grade ?? "" });
        }}
      />
      <SelectInput
        label="Class teacher"
        value={item.teacher ?? ""}
        options={staffOptions}
        onChange={(value) => update({ ...item, teacher: value })}
      />
    </>
  );
  const renderNewsFields = (item: NewsItem, update: (item: NewsItem) => void) => (
    <>
      <TextInput
        label="Title"
        value={item.title}
        onChange={(value) => update({ ...item, title: value, slug: item.slug || slugifySchoolName(value) })}
      />
      <TextInput label="URL slug" value={item.slug ?? ""} onChange={(value) => update({ ...item, slug: slugifySchoolName(value) })} />
      <DateInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
      <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
      <RichTextEditor label="Body" value={item.body} onChange={(value) => update({ ...item, body: value })} />
    </>
  );
  const renderCalendarFields = (item: CalendarItem, update: (item: CalendarItem) => void) => (
    <>
      <TextInput label="Title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
      <DateInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
    </>
  );
  const renderSubjectFields = (item: Subject, update: (item: Subject) => void) => (
    <>
      <TextInput label="Subject name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <TextInput
        label="Abbreviation"
        value={item.abbreviation ?? ""}
        onChange={(value) => update({ ...item, abbreviation: value.toUpperCase().slice(0, 8) })}
      />
      <SubjectColorPicker value={item.color ?? subjectColorOptions[0]} onChange={(color) => update({ ...item, color })} />
    </>
  );
  const renderSubjectClassFields = (item: SubjectClass, update: (item: SubjectClass) => void) => {
    const selectedStudents = students.filter((student) => item.studentIds.includes(student.id));
    const baseClassStudents = students.filter((student) => student.classId === item.baseClassId);
    const updateNameIfAutomatic = (next: SubjectClass) => update(withAutomaticSubjectClassName(next));

    return (
      <>
        <TextInput
          label="Subject class name"
          value={item.nameOverride ? item.name : getAutomaticSubjectClassName(item.subjectId, item.baseClassId, item.gradeLevelId)}
          onChange={(value) => update({ ...item, name: value, nameOverride: true })}
          disabled={!item.nameOverride}
        />
        <button
          className="secondary-action"
          type="button"
          onClick={() => update(item.nameOverride
            ? withAutomaticSubjectClassName({ ...item, nameOverride: false })
            : { ...item, nameOverride: true, name: item.name || getAutomaticSubjectClassName(item.subjectId, item.baseClassId, item.gradeLevelId) })}
        >
          {item.nameOverride ? "Use standard class name" : "Override standard class name"}
        </button>
        <SelectInput
          label="Subject"
          value={item.subjectId}
          options={[
            { value: "", label: "Select subject" },
            ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
          ]}
          onChange={(value) => {
            updateNameIfAutomatic({
              ...item,
              subjectId: value,
            });
          }}
        />
        <SelectInput
          label="Based on main class"
          value={item.baseClassId ?? ""}
          options={[
            { value: "", label: "Mixed classes" },
            ...classes.map((classGroup) => ({ value: classGroup.id, label: classGroup.name })),
          ]}
          onChange={(value) => {
            const classGroup = classes.find((currentClass) => currentClass.id === value);
            const gradeLevelId = classGroup?.gradeLevelId ?? item.gradeLevelId ?? "";
            updateNameIfAutomatic({
              ...item,
              baseClassId: value,
              gradeLevelId,
            });
          }}
        />
        <SelectInput
          label="Grade and year"
          value={item.gradeLevelId ?? ""}
          options={subjectClassGradeOptions}
          onChange={(gradeLevelId) => updateNameIfAutomatic({
            ...item,
            gradeLevelId,
          })}
        />
        <SelectInput
          label="Teacher"
          value={item.teacherName ?? ""}
          options={staffOptions}
          onChange={(value) => update({ ...item, teacherName: value })}
        />
        <CheckboxGroup
          label="Students in subject class"
          allowSelectAll
          options={students.map((student) => {
            const classGroup = classes.find((currentClass) => currentClass.id === student.classId);
            return {
              value: student.id,
              label: `${student.firstName} ${student.lastName}${classGroup ? ` - ${classGroup.name}` : ""}`,
            };
          })}
          values={item.studentIds}
          onChange={(studentIds) => update({ ...item, studentIds })}
        />
        <div className="subject-summary">
          <strong>{selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"} selected</strong>
          <span>{baseClassStudents.length} student{baseClassStudents.length === 1 ? "" : "s"} currently in the selected main class</span>
        </div>
      </>
    );
  };
  const getStudentSubjectClassIds = (studentId: string) => subjectClasses
    .filter((subjectClass) => subjectClass.studentIds.includes(studentId))
    .map((subjectClass) => subjectClass.id);
  const getRelevantSubjectClassIds = (classId: string, useGrade: boolean) => {
    const selectedClass = classes.find((classGroup) => classGroup.id === classId);
    const selectedGradeLevelId = selectedClass?.gradeLevelId;
    const selectedGrade = selectedClass?.grade?.trim();
    return subjectClasses
      .filter((subjectClass) => {
        if (!classId) {
          return false;
        }
        if (!useGrade) {
          return subjectClass.baseClassId === classId;
        }
        if (selectedGradeLevelId) {
          return subjectClass.gradeLevelId === selectedGradeLevelId;
        }
        if (!selectedGrade) {
          return subjectClass.baseClassId === classId;
        }
        const subjectBaseClass = classes.find((classGroup) => classGroup.id === subjectClass.baseClassId);
        return subjectBaseClass?.grade?.trim() === selectedGrade;
      })
      .map((subjectClass) => subjectClass.id);
  };
  const setDraftStudentClass = (classId: string) => {
    setDraftStudent((current) => ({ ...current, classId }));
    setDraftStudentSubjectClassIds(getRelevantSubjectClassIds(classId, draftStudentUseGradeSubjectClasses));
  };
  const setDraftStudentGradeMode = (useGrade: boolean) => {
    setDraftStudentUseGradeSubjectClasses(useGrade);
    setDraftStudentSubjectClassIds(getRelevantSubjectClassIds(draftStudent.classId, useGrade));
  };
  const saveDraftStudent = () => {
    const nextStudents = studentModalIndex === null
      ? [...students, draftStudent]
      : students.map((student, index) => index === studentModalIndex ? draftStudent : student);
    const nextSubjectClassIds = new Set(draftStudentSubjectClassIds);
    updateSchool({
      ...school,
      students: nextStudents,
      subjectClasses: subjectClasses.map((subjectClass) => ({
        ...subjectClass,
        studentIds: nextSubjectClassIds.has(subjectClass.id)
          ? mergeUnique([...subjectClass.studentIds, draftStudent.id])
          : subjectClass.studentIds.filter((studentId) => studentId !== draftStudent.id),
      })),
    });
    setStudentModalIndex(undefined);
  };
  const renderStudentFields = (item: Student, update: (item: Student) => void) => (
    <div className="student-modal-grid">
      <div className="student-modal-main">
        <div className="split-fields">
          <TextInput label="First name" value={item.firstName} onChange={(value) => update({ ...item, firstName: value })} />
          <TextInput label="Last name" value={item.lastName} onChange={(value) => update({ ...item, lastName: value })} />
        </div>
        <TextInput label="Student login email" value={item.email ?? ""} onChange={(value) => update({ ...item, email: value.trim().toLowerCase() })} />
        <CheckboxInput
          label="Disable account"
          checked={Boolean(item.accountDisabled)}
          onChange={(checked) => update({ ...item, accountDisabled: checked })}
        />
        <ImageUpload label="Student image" value={item.photoUrl ?? ""} onChange={(photoUrl) => update({ ...item, photoUrl })} variant="strictSquare" />
        <SelectInput
          label="Class"
          value={item.classId}
          options={[
            { value: "", label: "Select class" },
            ...classes.map((classGroup) => ({ value: classGroup.id, label: classGroup.name })),
          ]}
          onChange={setDraftStudentClass}
        />
        <CheckboxInput
          label="Add to subject classes for all classes in this grade"
          checked={draftStudentUseGradeSubjectClasses}
          onChange={setDraftStudentGradeMode}
        />
        <div className="split-fields">
          <DateInput label="Date of birth" value={item.dateOfBirth ?? ""} onChange={(value) => update({ ...item, dateOfBirth: value })} />
          <SelectInput
            label="Gender"
            value={item.gender ?? ""}
            options={[
              { value: "", label: "Select gender" },
              { value: "Female", label: "Female" },
              { value: "Male", label: "Male" },
              { value: "Other", label: "Other" },
              { value: "Prefer not to say", label: "Prefer not to say" },
            ]}
            onChange={(value) => update({ ...item, gender: value })}
          />
        </div>
        <TextArea label="Description (optional)" value={item.description ?? ""} onChange={(value) => update({ ...item, description: value })} />
        <GuardianEditor guardians={item.guardians ?? []} onChange={(guardians) => update({ ...item, guardians })} />
      </div>
      <SubjectClassStudentPicker
        classes={classes}
        subjects={subjects}
        subjectClasses={subjectClasses}
        search={subjectClassSearch}
        selectedIds={draftStudentSubjectClassIds}
        onSearchChange={setSubjectClassSearch}
        onSelectedIdsChange={setDraftStudentSubjectClassIds}
      />
    </div>
  );
  const renderAssessmentScaleFields = (scale: AssessmentScale, update: (scale: AssessmentScale) => void) => (
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
                onChange={(value) => update({
                  ...scale,
                  levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, value } : item),
                })}
              />
              <TextInput
                label="Minimum %"
                value={String(level.minPercentage ?? 0)}
                onChange={(minPercentage) => update({
                  ...scale,
                  levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, minPercentage: parsePercentageInput(minPercentage) } : item),
                })}
              />
              <TextInput
                label="Description"
                value={level.description ?? ""}
                onChange={(description) => update({
                  ...scale,
                  levels: scale.levels.map((item, index) => index === levelIndex ? { ...item, description } : item),
                })}
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
        onClick={() => update({
          ...scale,
          levels: [...scale.levels.slice(0, -2), { id: `level-${Date.now()}`, value: "", minPercentage: 0, description: "" }, ...scale.levels.slice(-2)],
        })}
      >
        Add level
      </button>
    </>
  );
  const globalCategories = globalAbout?.categories ?? [];
  const globalPageSlugs = new Set(globalAbout?.pages.map((page) => page.slug) ?? []);
  const editableAboutPages = aboutPages.filter((page) => !globalPageSlugs.has(page.slug));
  const editableAboutCategoryOptions = [
    ...globalCategories.map((category) => ({ value: category.id, label: `${category.title} (global)` })),
    ...aboutCategories.map((category) => ({ value: category.id, label: category.title })),
  ];
  const defaultAboutCategoryId = aboutCategories[0]?.id ?? globalCategories[0]?.id ?? "";
  const activeCategoryInfo = editorCategories.find((category) => category.id === activeCategory) ?? editorCategories[0];
  const isSchoolWorkPage = activeSection === "schoolWork" || (activeCategory === "schoolWork" && !activeSection);
  const showSchoolWorkOverview = isSchoolWorkPage && !activeWorkSubjectClassId;

  return (
    <form
      className="school-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="editor-grid">
        {!activeSection && activeCategory !== "schoolWork" ? (
          <EditorSectionCards
            category={activeCategoryInfo}
            onSelect={onSectionChange}
            extraContent={activeCategory === "schoolPage" ? (
              <div className="school-website-visibility-bar">
                <div>
                  <strong>School website</strong>
                  <small>{school.showWebsite !== false ? "Visible to the public" : "Hidden — not visible to the public"}</small>
                </div>
                <CheckboxInput
                  label="Show school website"
                  checked={school.showWebsite !== false}
                  onChange={(checked) => setField("showWebsite", checked)}
                />
              </div>
            ) : undefined}
          />
        ) : activeSection && activeSection !== "schoolWork" ? (
          <div className="editor-back-row">
            <button className="secondary-action" type="button" onClick={onBack}>
              Back
            </button>
          </div>
        ) : null}
        {showSchoolWorkOverview ? (
          <SchoolWorkOverview
            subjectClasses={accessibleSubjectClasses}
            subjects={subjects}
            classes={classes}
            students={students}
            role={canAccessAllSubjectClasses ? "admin" : "teacher"}
            participantLabel={school.staff.find((member) => member.email?.toLowerCase() === currentUserEmail?.toLowerCase())?.name}
            remarks={school.remarks ?? []}
            remarkSettings={school.remarkSettings}
            globalRemarkCategories={globalRemarkCategories}
            schoolWorkSettings={schoolWorkSettings}
            globalAssessmentScales={globalSchoolWork?.assessmentScales ?? []}
            onOpen={(subjectClassId) => setActiveWorkSubjectClassId(subjectClassId)}
            onRemarksChange={(nextRemarks) => setField("remarks", nextRemarks)}
            onStudentChange={(student) => setField("students", students.map((s) => s.id === student.id ? student : s))}
            onSchoolWorkSettingsChange={updateSchoolWorkSettings}
          />
        ) : null}
        {activeSection === "profile" ? (
          <EditorPanel title="School profile">
            <div className="profile-field-table">
              <div className="profile-field-row">
                <div className="profile-field-description">
                  <strong>URL slug</strong>
                  <small>Contact support to change the school URL.</small>
                </div>
                <span className="input-shell">
                  <input value={school.id} readOnly aria-label="URL slug" className="readonly-slug-input" />
                </span>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>School name</strong></div>
                <span className="input-shell">
                  <input value={school.name} onChange={(event) => setField("name", event.target.value)} aria-label="School name" />
                </span>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>School type</strong></div>
                <span className="input-shell">
                  <input value={school.type} onChange={(event) => setField("type", event.target.value)} aria-label="School type" />
                </span>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Tagline</strong></div>
                <span className="input-shell">
                  <input value={school.tagline} onChange={(event) => setField("tagline", event.target.value)} aria-label="Tagline" />
                </span>
              </div>
              <div className="profile-field-row profile-field-row-tall">
                <div className="profile-field-description"><strong>About</strong></div>
                <textarea value={school.about} onChange={(event) => setField("about", event.target.value)} rows={5} aria-label="About" />
              </div>
              <div className="profile-field-row profile-field-row-tall">
                <div className="profile-field-description"><strong>School logo</strong></div>
                <ImageUpload label="School logo" value={school.logoUrl ?? ""} onChange={(logoUrl) => setField("logoUrl", logoUrl)} variant="logo" hideLabel />
              </div>
              <div className="profile-field-row profile-field-row-tall">
                <div className="profile-field-description"><strong>Hero image</strong></div>
                <ImageUpload label="Hero image" value={school.heroImage} onChange={(heroImage) => setField("heroImage", heroImage)} variant="hero" hideLabel />
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Main color</strong></div>
                <div className="color-input-wrapper">
                  <div className="color-preview" style={{ background: school.mainColor ?? "#18322e" }} />
                  <input type="color" value={school.mainColor ?? "#18322e"} onChange={(event) => setField("mainColor", event.target.value)} aria-label="Main color" />
                </div>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Sub color</strong></div>
                <div className="color-input-wrapper">
                  <div className="color-preview" style={{ background: school.subColor ?? "#e0b44f" }} />
                  <input type="color" value={school.subColor ?? "#e0b44f"} onChange={(event) => setField("subColor", event.target.value)} aria-label="Sub color" />
                </div>
              </div>
              <div className="profile-field-row">
                <div className="profile-field-description"><strong>Values</strong><small>Comma separated</small></div>
                <span className="input-shell">
                  <input value={school.values.join(", ")} onChange={(event) => setField("values", splitCsv(event.target.value))} aria-label="Values, comma separated" />
                </span>
              </div>
            </div>
          </EditorPanel>
        ) : null}

        {activeSection === "billing" ? (
          <SchoolBillingPanel
            school={school}
            onUpdatePayment={(payment) => {
              const existing = school.payments ?? [];
              const nextPayments = existing.some((p) => p.id === payment.id)
                ? existing.map((p) => (p.id === payment.id ? payment : p))
                : [...existing, payment];
              setField("payments", nextPayments);
            }}
          />
        ) : null}

        {activeSection === "loginSettings" ? (
          <EditorPanel title="Settings">
            <div className="nested-editor-grid">
              <section className="sub-editor-panel">
                <h3>Login format</h3>
                <p className="editor-helper-text">Choose which sign-in methods are available for staff with admin page access.</p>
                <div className="login-format-list">
                  <label className="login-format-option">
                    <div>
                      <strong>Username and password</strong>
                      <small>Admins sign in with their email address and password.</small>
                    </div>
                    <CheckboxInput
                      label="Enabled"
                      checked={loginSettings.emailPasswordEnabled}
                      onChange={(checked) => setField("loginSettings", { ...loginSettings, emailPasswordEnabled: checked })}
                    />
                  </label>
                  <label className="login-format-option">
                    <div>
                      <strong>Email link</strong>
                      <small>Admins receive a passwordless sign-in link by email.</small>
                    </div>
                    <CheckboxInput
                      label="Enabled"
                      checked={loginSettings.emailLinkEnabled}
                      onChange={(checked) => setField("loginSettings", { ...loginSettings, emailLinkEnabled: checked })}
                    />
                  </label>
                </div>
              </section>
              <section className="sub-editor-panel">
                <h3>Messages</h3>
                <p className="editor-helper-text">Control who students can contact in school chat.</p>
                <label className="login-format-option">
                  <div>
                    <strong>Student-to-student messages</strong>
                    <small>When disabled, students can message teachers and admins, but not other students.</small>
                  </div>
                  <CheckboxInput
                    label="Enabled"
                    checked={Boolean(schoolWorkSettings.allowStudentMessaging)}
                    onChange={(allowStudentMessaging) => updateSchoolWorkSettings({ ...schoolWorkSettings, allowStudentMessaging })}
                  />
                </label>
              </section>
            </div>
          </EditorPanel>
        ) : null}

        {activeSection === "contact" ? (
          <EditorPanel title="Contact details">
            <div className="split-fields">
              <TextInput label="City" value={school.city} onChange={(value) => setField("city", value)} />
              <TextInput label="Country" value={school.country} onChange={(value) => setField("country", value)} />
            </div>
            <TextInput label="Address" value={school.address} onChange={(value) => setField("address", value)} />
            <TextInput label="Phone" value={school.phone} onChange={(value) => setField("phone", value)} />
            <TextInput label="Email" value={school.email} onChange={(value) => setField("email", value)} />
            <TextInput label="Principal" value={school.principal} onChange={(value) => setField("principal", value)} />
          </EditorPanel>
        ) : null}

        {activeSection === "about" ? (
          <EditorPanel title="Website pages">
            <p className="website-pages-description">
              All pages shown on your school website, organized by category. Global categories and pages are managed by the superadmin.
              School categories appear as navigation links in the header.
            </p>
            {[
              ...globalCategories.map((cat) => ({ ...cat, isGlobal: true as const })),
              ...aboutCategories.map((cat) => ({ ...cat, isGlobal: false as const })),
            ].map((category) => {
              const catGlobalPages = category.isGlobal
                ? (globalAbout?.pages ?? []).filter((p) => p.categoryId === category.id)
                : [];
              const catSchoolPages = editableAboutPages.filter((p) => p.categoryId === category.id);
              return (
                <section className="website-pages-category" key={category.id}>
                  <div className="website-pages-category-header">
                    {category.isGlobal ? (
                      <>
                        <h3>{category.title}</h3>
                        <span className="website-pages-global-badge">Global</span>
                      </>
                    ) : (
                      <>
                        <TextInput
                          label="Category name"
                          value={category.title}
                          onChange={(title) => setField("aboutCategories", aboutCategories.map((c) => c.id === category.id ? { ...c, title } : c))}
                        />
                        <button
                          className="remove-button"
                          type="button"
                          onClick={() => {
                            const remaining = aboutCategories.filter((c) => c.id !== category.id);
                            const fallbackId = remaining[0]?.id ?? globalCategories[0]?.id ?? "";
                            updateSchool({
                              ...school,
                              aboutCategories: remaining,
                              aboutPages: aboutPages.map((page) => ({
                                ...page,
                                categoryId: page.categoryId === category.id ? fallbackId : page.categoryId,
                              })),
                            });
                          }}
                        >
                          Remove category
                        </button>
                      </>
                    )}
                  </div>
                  {catGlobalPages.map((page) => (
                    <article className="website-pages-global-page" key={page.id}>
                      <div className="website-pages-global-page-meta">
                        <strong>{page.title}</strong>
                        <small>/{page.slug}</small>
                      </div>
                      {page.kind === "contact" ? (
                        <p className="website-pages-contact-note">Shows your school's contact information automatically.</p>
                      ) : (
                        <RichTextEditor
                          label={page.kind === "staffDirectory" ? "Local description above staff directory" : "Additional school content (shown on this page)"}
                          value={aboutPages.find((item) => item.slug === page.slug)?.body ?? ""}
                          onChange={(body) => {
                            const existing = aboutPages.find((item) => item.slug === page.slug);
                            const updated: AboutPage = {
                              id: existing?.id ?? `local-global-page-${page.slug}`,
                              categoryId: page.categoryId,
                              title: page.title,
                              slug: page.slug,
                              headerImage: existing?.headerImage ?? "",
                              body,
                            };
                            const idx = aboutPages.findIndex((item) => item.slug === page.slug);
                            setField("aboutPages", idx >= 0
                              ? aboutPages.map((item, i) => i === idx ? updated : item)
                              : [...aboutPages, updated]);
                          }}
                        />
                      )}
                    </article>
                  ))}
                  <Repeater
                    items={catSchoolPages}
                    addLabel="Add page"
                    createItem={(): AboutPage => ({
                      id: `about-page-${Date.now()}`,
                      categoryId: category.id,
                      title: "New page",
                      slug: "",
                      headerImage: "",
                      body: "",
                    })}
                    onChange={(items) => {
                      const globalLocalPages = aboutPages.filter((p) => globalPageSlugs.has(p.slug));
                      const otherPages = editableAboutPages.filter((p) => p.categoryId !== category.id);
                      setField("aboutPages", [...globalLocalPages, ...otherPages, ...items]);
                    }}
                    renderItem={(item, update) => (
                      <>
                        <TextInput
                          label="Page title"
                          value={item.title}
                          onChange={(value) => update({ ...item, title: value, slug: item.slug || value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })}
                        />
                        <TextInput label="URL slug" value={item.slug} onChange={(value) => update({ ...item, slug: value })} />
                        <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
                        <RichTextEditor label="Page content" value={item.body} onChange={(value) => update({ ...item, body: value })} />
                      </>
                    )}
                  />
                </section>
              );
            })}
            <button
              className="secondary-action"
              type="button"
              onClick={() => setField("aboutCategories", [...aboutCategories, { id: `about-category-${Date.now()}`, title: "New category" }])}
            >
              Add category
            </button>
          </EditorPanel>
        ) : null}

        {activeSection === "news" ? (
          <EditorPanel title="News">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => {
                setDraftNews(createNewsItem());
                setNewsModalIndex(null);
              }}
            >
              Add news
            </button>
            <NewsTable
              news={school.announcements}
              onEdit={(item, index) => {
                setDraftNews(item);
                setNewsModalIndex(index);
              }}
              onRemove={(index) => setField("announcements", school.announcements.filter((_, currentIndex) => currentIndex !== index))}
            />
            {newsModalIndex !== undefined ? (
              <RegistrationModal
                title={newsModalIndex === null ? "Create news" : "Edit news"}
                eyebrow="News"
                submitLabel={newsModalIndex === null ? "Add news" : "Save news"}
                onClose={() => setNewsModalIndex(undefined)}
                onSubmit={() => {
                  setField("announcements", newsModalIndex === null
                    ? [...school.announcements, draftNews]
                    : school.announcements.map((item, index) => index === newsModalIndex ? draftNews : item));
                  setNewsModalIndex(undefined);
                }}
              >
                {renderNewsFields(draftNews, setDraftNews)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "calendar" ? (
          <EditorPanel title="Calendar">
            <div className="calendar-editor-layout">
              <div className="calendar-editor-main">
                <button
                  className="secondary-action repeater-add-button"
                  type="button"
                  onClick={() => {
                    setDraftCalendar(createCalendarItem());
                    setCalendarModalIndex(null);
                  }}
                >
                  Add event
                </button>
                <CalendarTable
                  items={school.calendar}
                  onEdit={(item, index) => {
                    setDraftCalendar(item);
                    setCalendarModalIndex(index);
                  }}
                  onRemove={(index) => setField("calendar", school.calendar.filter((_, currentIndex) => currentIndex !== index))}
                />
              </div>
              <CalendarAdminPreview items={school.calendar} />
            </div>
            {calendarModalIndex !== undefined ? (
              <RegistrationModal
                title={calendarModalIndex === null ? "Create event" : "Edit event"}
                eyebrow="Calendar"
                submitLabel={calendarModalIndex === null ? "Add event" : "Save event"}
                onClose={() => setCalendarModalIndex(undefined)}
                onSubmit={() => {
                  setField("calendar", calendarModalIndex === null
                    ? [...school.calendar, draftCalendar]
                    : school.calendar.map((item, index) => index === calendarModalIndex ? draftCalendar : item));
                  setCalendarModalIndex(undefined);
                }}
              >
                {renderCalendarFields(draftCalendar, setDraftCalendar)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "staff" ? (
          <EditorPanel title="Staff and administrators">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => {
                setDraftStaff(createStaffMember());
                setStaffModalIndex(null);
              }}
            >
              Add staff member
            </button>
            <StaffTable
              staff={school.staff}
              onEdit={(member, index) => {
                setDraftStaff(member);
                setStaffModalIndex(index);
              }}
              onSimulate={onSimulateStaff}
              onRemove={(index) => {
                const nextStaff = school.staff.filter((_, currentIndex) => currentIndex !== index);
                updateSchool({
                  ...school,
                  adminEmails: getStaffAdminEmails(nextStaff),
                  staff: nextStaff,
                });
              }}
            />
            {staffModalIndex !== undefined ? (
              <RegistrationModal
                title={staffModalIndex === null ? "Register staff member" : "Edit staff member"}
                eyebrow="Staff"
                submitLabel={staffModalIndex === null ? "Add staff member" : "Save staff member"}
                onClose={() => setStaffModalIndex(undefined)}
                onSubmit={() => {
                  const nextDraftStaff = staffCanAccessAdminPage(draftStaff)
                    ? { ...draftStaff, accountDisabled: false }
                    : draftStaff;
                  const nextStaff = staffModalIndex === null
                    ? [...school.staff, nextDraftStaff]
                    : school.staff.map((member, index) => index === staffModalIndex ? nextDraftStaff : member);
                  updateSchool({
                    ...school,
                    adminEmails: getStaffAdminEmails(nextStaff),
                    staff: nextStaff,
                  });
                  setStaffModalIndex(undefined);
                }}
              >
                {renderStaffFields(draftStaff, setDraftStaff)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "access" ? (
          <EditorPanel title="Access">
            <AccessOverview
              school={school}
              classes={classes}
              staff={school.staff}
              students={students}
              subjectClasses={subjectClasses}
              subjects={subjects}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "grades" || activeSection === "classes" || activeSection === "subjectClasses" ? (
          <EditorPanel title={activeSection === "grades" ? "Grades and years" : activeSection === "subjectClasses" ? "Subject classes" : "Classes"}>
            <div className="classes-editor-layout">
              {activeSection === "grades" ? <section className="sub-editor-panel class-management-panel">
                <div className="section-heading class-management-heading">
                  <h3>Grades and years</h3>
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => {
                      setDraftGradeLevel(createGradeLevel());
                      setGradeLevelModalIndex(null);
                    }}
                  >
                    Add grade
                  </button>
                </div>
                <GradeLevelTable
                  gradeLevels={gradeLevels}
                  classes={classes}
                  subjectClasses={subjectClasses}
                  onEdit={(gradeLevel, index) => {
                    setDraftGradeLevel(gradeLevel);
                    setGradeLevelModalIndex(index);
                  }}
                  onRemove={(index) => {
                    const removedGradeLevelId = gradeLevels[index]?.id;
                    updateSchool({
                      ...school,
                      gradeLevels: gradeLevels.filter((_, currentIndex) => currentIndex !== index),
                      classes: classes.map((classGroup) => classGroup.gradeLevelId === removedGradeLevelId ? { ...classGroup, gradeLevelId: "", grade: "" } : classGroup),
                      subjectClasses: updateAutomaticSubjectClassNames(subjectClasses.map((subjectClass) => subjectClass.gradeLevelId === removedGradeLevelId ? { ...subjectClass, gradeLevelId: "" } : subjectClass), subjects, classes, gradeLevels.filter((_, currentIndex) => currentIndex !== index)),
                    });
                  }}
                />
              </section> : null}
              {activeSection === "classes" ? <section className="sub-editor-panel class-management-panel">
                <div className="section-heading class-management-heading">
                  <h3>Classes</h3>
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => {
                      setDraftClass(createClassGroup());
                      setClassModalIndex(null);
                    }}
                  >
                    Add main class
                  </button>
                </div>
                <ClassTable
                  classes={classes}
                  gradeLevels={gradeLevels}
                  students={students}
                  subjectClasses={subjectClasses}
                  onEdit={(classGroup, index) => {
                    setDraftClass(classGroup);
                    setClassModalIndex(index);
                  }}
                  onRemove={(index) => {
                    const nextClasses = classes.filter((_, currentIndex) => currentIndex !== index);
                    const validIds = new Set(nextClasses.map((classGroup) => classGroup.id));
                    updateSchool({
                      ...school,
                      classes: nextClasses,
                      students: students.map((student) => ({
                        ...student,
                        classId: validIds.has(student.classId) ? student.classId : nextClasses[0]?.id ?? "",
                      })),
                      subjectClasses: updateAutomaticSubjectClassNames(subjectClasses.map((subjectClass) => ({
                        ...subjectClass,
                        baseClassId: subjectClass.baseClassId && validIds.has(subjectClass.baseClassId) ? subjectClass.baseClassId : "",
                      })), subjects, nextClasses, gradeLevels),
                    });
                  }}
                />
              </section> : null}
              {activeSection === "subjectClasses" ? <section className="sub-editor-panel class-management-panel">
                <div className="section-heading class-management-heading">
                  <h3>Subject classes</h3>
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => {
                      setDraftSubjectClass(createSubjectClass());
                      setSubjectClassModalIndex(null);
                    }}
                    disabled={subjects.length === 0}
                  >
                    Add subject class
                  </button>
                </div>
                {subjects.length === 0 ? (
                  <div className="empty-editor-state">
                    <h3>Add a subject first</h3>
                    <p>Subject classes need a subject. Students can be added later and can come from multiple main classes.</p>
                  </div>
                ) : (
                  <SubjectClassTable
                    classes={classes}
                    gradeLevels={gradeLevels}
                    subjectClasses={subjectClasses}
                    subjects={subjects}
                    onEdit={(subjectClass, index) => {
                      setDraftSubjectClass(subjectClass);
                      setSubjectClassModalIndex(index);
                    }}
                    onRemove={(index) => setField("subjectClasses", subjectClasses.filter((_, currentIndex) => currentIndex !== index))}
                  />
                )}
              </section> : null}
            </div>
            {gradeLevelModalIndex !== undefined ? (
              <RegistrationModal
                title={gradeLevelModalIndex === null ? "Create grade" : "Edit grade"}
                eyebrow="Grades"
                submitLabel={gradeLevelModalIndex === null ? "Add grade" : "Save grade"}
                onClose={() => setGradeLevelModalIndex(undefined)}
                onSubmit={() => {
                  const nextGradeLevels = gradeLevelModalIndex === null
                    ? [...gradeLevels, draftGradeLevel]
                    : gradeLevels.map((current, currentIndex) => currentIndex === gradeLevelModalIndex ? draftGradeLevel : current);
                  const previousGradeLevelId = gradeLevelModalIndex === null ? null : gradeLevels[gradeLevelModalIndex]?.id;
                  updateSchool({
                    ...school,
                    gradeLevels: nextGradeLevels,
                    classes: previousGradeLevelId
                      ? classes.map((classGroup) => classGroup.gradeLevelId === previousGradeLevelId ? { ...classGroup, gradeLevelId: draftGradeLevel.id, grade: draftGradeLevel.grade } : classGroup)
                      : classes,
                    subjectClasses: updateAutomaticSubjectClassNames(previousGradeLevelId
                      ? subjectClasses.map((subjectClass) => subjectClass.gradeLevelId === previousGradeLevelId ? { ...subjectClass, gradeLevelId: draftGradeLevel.id } : subjectClass)
                      : subjectClasses, subjects, classes, nextGradeLevels),
                  });
                  setGradeLevelModalIndex(undefined);
                }}
              >
                {renderGradeLevelFields(draftGradeLevel, setDraftGradeLevel)}
              </RegistrationModal>
            ) : null}
            {classModalIndex !== undefined ? (
              <RegistrationModal
                title={classModalIndex === null ? "Create main class" : "Edit main class"}
                eyebrow="Classes"
                submitLabel={classModalIndex === null ? "Add class" : "Save class"}
                onClose={() => setClassModalIndex(undefined)}
                onSubmit={() => {
                  const nextClasses = classModalIndex === null
                    ? [...classes, draftClass]
                    : classes.map((current, currentIndex) => (currentIndex === classModalIndex ? draftClass : current));
                  const validIds = new Set(nextClasses.map((classGroup) => classGroup.id));
                  if (classModalIndex === null) {
                    updateSchool({ ...school, classes: nextClasses });
                  } else {
                    updateSchool({
                      ...school,
                      classes: nextClasses,
                      students: students.map((student) => ({
                        ...student,
                        classId: validIds.has(student.classId) ? student.classId : nextClasses[0]?.id ?? "",
                      })),
                      subjectClasses: updateAutomaticSubjectClassNames(subjectClasses.map((subjectClass) => ({
                        ...subjectClass,
                        baseClassId: subjectClass.baseClassId && validIds.has(subjectClass.baseClassId) ? subjectClass.baseClassId : "",
                      })), subjects, nextClasses, gradeLevels),
                    });
                  }
                  setClassModalIndex(undefined);
                }}
              >
                {renderClassFields(draftClass, setDraftClass)}
              </RegistrationModal>
            ) : null}
            {subjectClassModalIndex !== undefined ? (
              <RegistrationModal
                title={subjectClassModalIndex === null ? "Create subject class" : "Edit subject class"}
                eyebrow="Subject classes"
                submitLabel={subjectClassModalIndex === null ? "Create subject class" : "Save subject class"}
                onClose={() => setSubjectClassModalIndex(undefined)}
                onSubmit={() => {
                  setField("subjectClasses", subjectClassModalIndex === null
                    ? [...subjectClasses, withAutomaticSubjectClassName(draftSubjectClass)]
                    : subjectClasses.map((item, index) => index === subjectClassModalIndex ? withAutomaticSubjectClassName(draftSubjectClass) : item));
                  setSubjectClassModalIndex(undefined);
                }}
              >
                {renderSubjectClassFields(draftSubjectClass, setDraftSubjectClass)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "subjects" ? (
          <EditorPanel title="Subjects">
            <button
              className="secondary-action repeater-add-button"
              type="button"
              onClick={() => {
                setDraftSubject(createSubject());
                setSubjectModalIndex(null);
              }}
            >
              Add subject
            </button>
            <SubjectTable
              subjects={subjects}
              subjectClasses={subjectClasses}
              onEdit={(item, index) => {
                setDraftSubject(item);
                setSubjectModalIndex(index);
              }}
              onRemove={(index) => {
                const removedSubjectId = subjects[index]?.id;
                const nextSchool = {
                  ...school,
                  subjects: subjects.filter((_, currentIndex) => currentIndex !== index),
                  subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.subjectId !== removedSubjectId),
                };
                onChange(nextSchool);
                void onAutoSave?.(nextSchool);
              }}
            />
            {subjectModalIndex !== undefined ? (
              <RegistrationModal
                title={subjectModalIndex === null ? "Create subject" : "Edit subject"}
                eyebrow="Subjects"
                submitLabel={subjectModalIndex === null ? "Add subject" : "Save subject"}
                onClose={() => setSubjectModalIndex(undefined)}
                onSubmit={() => {
                  const nextSubjects = subjectModalIndex === null
                    ? [...subjects, draftSubject]
                    : subjects.map((item, index) => index === subjectModalIndex ? draftSubject : item);
                  updateSchool({
                    ...school,
                    subjects: nextSubjects,
                    subjectClasses: updateAutomaticSubjectClassNames(subjectClasses, nextSubjects, classes, gradeLevels),
                  });
                  setSubjectModalIndex(undefined);
                }}
              >
                {renderSubjectFields(draftSubject, setDraftSubject)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}


        {isSchoolWorkPage && activeWorkSubjectClassId ? (
          <div className="school-work-detail-shell">
            <SubjectClassWorkPage
              subjectClass={subjectClasses.find((item) => item.id === activeWorkSubjectClassId) ?? null}
              subjects={subjects}
              students={students}
              assessmentScales={effectiveAssessmentScales}
              globalAssessmentScales={globalSchoolWork?.assessmentScales ?? []}
              schoolWorkSettings={schoolWorkSettings}
              allSubjectClasses={subjectClasses}
              remarks={school.remarks ?? []}
              remarkSettings={school.remarkSettings}
              globalRemarkCategories={globalRemarkCategories}
              accessLevel="admin"
              graderLabel="Admin"
              onBack={() => setActiveWorkSubjectClassId(null)}
              onChange={(nextSubjectClass) => setField("subjectClasses", subjectClasses.map((item) => item.id === nextSubjectClass.id ? nextSubjectClass : item))}
              onSchoolWorkSettingsChange={updateSchoolWorkSettings}
              onRemarkSettingsChange={updateRemarkSettings}
              onRemarksChange={(nextRemarks) => setField("remarks", nextRemarks)}
            />
          </div>
        ) : null}

        {activeSection === "students" ? (
          <EditorPanel title="Students">
            {classes.length === 0 ? (
              <div className="empty-editor-state">
                <h3>Create a class first</h3>
                <p>Students must belong to a class. Add at least one class before adding students.</p>
                <button className="primary-action" type="button" onClick={() => onSectionChange("classes")}>
                  Go to classes
                </button>
              </div>
            ) : (
              <>
                <button
                  className="secondary-action repeater-add-button"
                  type="button"
                  onClick={() => {
                    const nextStudent = createStudent();
                    setDraftStudent(nextStudent);
                    setDraftStudentUseGradeSubjectClasses(false);
                    setDraftStudentSubjectClassIds([]);
                    setSubjectClassSearch("");
                    setStudentModalIndex(null);
                  }}
                >
                  Add student
                </button>
                <StudentTable
                  students={students}
                  classes={classes}
                  onSimulate={onSimulateStudent}
                  onEdit={(student, index) => {
                    setDraftStudent(student);
                    setDraftStudentUseGradeSubjectClasses(false);
                    setDraftStudentSubjectClassIds(getStudentSubjectClassIds(student.id));
                    setSubjectClassSearch("");
                    setStudentModalIndex(index);
                  }}
                  onRemove={(index) => {
                    const removedStudentId = students[index]?.id;
                    updateSchool({
                      ...school,
                      students: students.filter((_, currentIndex) => currentIndex !== index),
                      subjectClasses: removedStudentId
                        ? subjectClasses.map((subjectClass) => ({
                          ...subjectClass,
                          studentIds: subjectClass.studentIds.filter((studentId) => studentId !== removedStudentId),
                        }))
                        : subjectClasses,
                    });
                  }}
                />
                {studentModalIndex !== undefined ? (
                  <RegistrationModal
                    title={studentModalIndex === null ? "Add student" : "Edit student"}
                    eyebrow="Students"
                    submitLabel={studentModalIndex === null ? "Add student" : "Save student"}
                    wide
                    onClose={() => setStudentModalIndex(undefined)}
                    onSubmit={saveDraftStudent}
                  >
                    {renderStudentFields(draftStudent, setDraftStudent)}
                  </RegistrationModal>
                ) : null}
              </>
            )}
          </EditorPanel>
        ) : null}
      </div>
    </form>
  );
}

function EditorMenu({
  activeCategory,
  activeSection,
  onChange,
}: {
  activeCategory: EditorCategory;
  activeSection: EditorSection | null;
  onChange: (category: EditorCategory) => void;
}) {
  return (
    <nav className="editor-menu" aria-label="School admin categories">
      {editorCategories.map((category) => (
        <button
          className={activeCategory === category.id ? "active-editor-section" : ""}
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
        >
          <span>{category.label}</span>
          <small>{activeSection && category.sections.includes(activeSection) ? getEditorSectionLabel(activeSection) : category.description}</small>
        </button>
      ))}
    </nav>
  );
}

function EditorSectionCards({
  category,
  onSelect,
  extraContent,
}: {
  category: (typeof editorCategories)[number];
  onSelect: (section: EditorSection) => void;
  extraContent?: React.ReactNode;
}) {
  return (
    <section className="editor-section-picker">
      <div>
        <p className="eyebrow">{category.label}</p>
        <h2>{category.label}</h2>
        <p>{category.description}</p>
      </div>
      {extraContent}
      <div className="editor-section-card-grid">
        {category.sections.map((section) => (
          <button className="editor-section-card" key={section} type="button" onClick={() => onSelect(section)}>
            <AdminCardTitle icon={getEditorSectionIcon(section)} title={getEditorSectionLabel(section)} />
            {getEditorSectionExample(section) ? <small>{getEditorSectionExample(section)}</small> : null}
            <span>{getEditorSectionDescription(section)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function getEditorSectionLabel(section: EditorSection) {
  return editorSections.find((item) => item.id === section)?.label ?? section;
}

function AdminCardTitle({ icon, title }: { icon: IconDefinition; title: string }) {
  return (
    <strong className="admin-card-title">
      <FontAwesomeIcon icon={icon} fixedWidth />
      <span>{title}</span>
    </strong>
  );
}

function getEditorSectionIcon(section: EditorSection): IconDefinition {
  const icons: Record<EditorSection, IconDefinition> = {
    profile: faIdCard,
    contact: faAddressBook,
    about: faCircleInfo,
    news: faNewspaper,
    calendar: faCalendarDays,
    staff: faUsers,
    access: faKey,
    grades: faLayerGroup,
    classes: faChalkboardUser,
    subjectClasses: faBookOpen,
    subjects: faBook,
    students: faUserGraduate,
    schoolWork: faFolderOpen,
    loginSettings: faGaugeHigh,
    billing: faScaleBalanced,
  };
  return icons[section];
}

function getEditorSectionExample(section: EditorSection) {
  const examples: Partial<Record<EditorSection, string>> = {
    grades: "Grade 8",
    classes: "Class 8A",
    subjectClasses: "Mathematics - 8A",
    subjects: "Mathematics",
  };
  return examples[section];
}

function getEditorCategoryForSection(section: EditorSection) {
  return editorCategories.find((category) => category.sections.includes(section))?.id ?? "schoolPage";
}

function getEditorStateFromHash(): { category: EditorCategory; section: EditorSection | null } {
  const [categoryValue, sectionValue] = window.location.hash.replace(/^#/, "").split("/");
  const category = editorCategories.some((item) => item.id === categoryValue) ? categoryValue as EditorCategory : "schoolPage";
  const section = editorSections.some((item) => item.id === sectionValue) ? sectionValue as EditorSection : null;

  if (section && getEditorCategoryForSection(section) !== category) {
    return { category: getEditorCategoryForSection(section), section };
  }

  return { category, section };
}

function setEditorHash(category: EditorCategory, section?: EditorSection) {
  const nextHash = section ? `#${category}/${section}` : `#${category}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function getEditorSectionDescription(section: EditorSection) {
  const descriptions: Record<EditorSection, string> = {
    profile: "School identity, colors, headline text, and hero image.",
    contact: "Address, phone, email, location, and principal details.",
    about: "About page categories, pages, and rich content.",
    news: "School news articles and announcements.",
    calendar: "Important school dates and events.",
    staff: "Staff profiles, administrator access, visibility, and contact details.",
    access: "Overview of users, roles, pages, and SchoolWork access.",
    grades: "Register grade levels and school years.",
    classes: "Main class groups and class teachers.",
    subjectClasses: "Subject class groups with teachers and students.",
    subjects: "Subject catalog, abbreviations, and display colors.",
    schoolWork: "Course materials and assignments for subject classes.",
    loginSettings: "Choose username/password and email link sign-in options.",
    students: "Student records, guardians, and class assignments.",
    billing: "Subscription plan, invoices, and payment history.",
  };
  return descriptions[section];
}

function StudentTable({
  students,
  classes,
  onSimulate,
  onEdit,
  onRemove,
}: {
  students: Student[];
  classes: ClassGroup[];
  onSimulate?: (student: Student) => void;
  onEdit: (student: Student, index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [infoStudent, setInfoStudent] = useState<Student | null>(null);
  const [missingFieldFilter, setMissingFieldFilter] = useState("all");

  if (students.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No students yet</h3>
        <p>Add a student to start building the student list.</p>
      </div>
    );
  }

  const getClassName = (classId: string) => classes.find((classGroup) => classGroup.id === classId)?.name ?? "No class";
  const getGuardianSummary = (student: Student) => {
    const guardians = student.guardians ?? [];
    if (guardians.length === 0) {
      return "No guardians";
    }
    return guardians.map((guardian) => [guardian.name, guardian.relationship].filter(Boolean).join(" - ")).join(", ");
  };
  const missingFieldOptions = [
    { value: "all", label: "All students" },
    { value: "class", label: "Without class" },
    { value: "email", label: "Without login email" },
    { value: "photo", label: "Without photo" },
    { value: "dateOfBirth", label: "Without date of birth" },
    { value: "gender", label: "Without gender" },
    { value: "guardians", label: "Without guardians" },
    { value: "description", label: "Without description" },
  ];
  const studentRows = students
    .map((student, index) => ({ student, index }))
    .filter(({ student }) => {
      if (missingFieldFilter === "all") {
        return true;
      }
      if (missingFieldFilter === "class") {
        return !student.classId || !classes.some((classGroup) => classGroup.id === student.classId);
      }
      if (missingFieldFilter === "email") {
        return !student.email?.trim();
      }
      if (missingFieldFilter === "photo") {
        return !student.photoUrl?.trim();
      }
      if (missingFieldFilter === "dateOfBirth") {
        return !student.dateOfBirth?.trim();
      }
      if (missingFieldFilter === "gender") {
        return !student.gender?.trim();
      }
      if (missingFieldFilter === "guardians") {
        return (student.guardians ?? []).length === 0;
      }
      if (missingFieldFilter === "description") {
        return !student.description?.trim();
      }
      return true;
    });

  return (
    <div className="student-table-panel">
      <div className="student-table-filter-row">
        <label className="field-label">
          Filter
          <select value={missingFieldFilter} onChange={(event) => setMissingFieldFilter(event.target.value)}>
            {missingFieldOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <span>{studentRows.length} of {students.length} student{students.length === 1 ? "" : "s"}</span>
      </div>
      {studentRows.length === 0 ? (
        <div className="empty-editor-state">
          <h3>No students match this filter</h3>
          <p>Choose another missing-field filter to see more students.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map(({ student, index }) => (
                <tr key={student.id || `${student.firstName}-${student.lastName}-${index}`}>
                  <td>
                    <strong>{student.firstName} {student.lastName}</strong>
                    {student.accountDisabled ? <span>Account disabled</span> : null}
                  </td>
                  <td>{getClassName(student.classId)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="secondary-action" type="button" onClick={() => setInfoStudent(student)}>
                        View more info
                      </button>
                      {onSimulate ? (
                        <button className="secondary-action" type="button" onClick={() => onSimulate(student)} disabled={student.accountDisabled}>
                          Simulate
                        </button>
                      ) : null}
                      <button className="secondary-action" type="button" onClick={() => onEdit(student, index)}>
                        Edit
                      </button>
                      <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {infoStudent ? (
        <div className="modal-backdrop" role="presentation">
          <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="student-info-title">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">Student</p>
                <h2 id="student-info-title">{infoStudent.firstName} {infoStudent.lastName}</h2>
              </div>
            </div>
            <div className="staff-modal-body student-info-modal-body">
              {infoStudent.photoUrl ? <img className="student-info-photo" src={infoStudent.photoUrl} alt="" /> : null}
              <div className="student-info-list">
                <p><strong>Class:</strong> {getClassName(infoStudent.classId)}</p>
                <p><strong>Date of birth:</strong> {infoStudent.dateOfBirth ? formatDate(infoStudent.dateOfBirth) : "Not set"}</p>
                <p><strong>Gender:</strong> {infoStudent.gender || "Not set"}</p>
                <p><strong>Email:</strong> {infoStudent.email || "No login email"}</p>
                <p><strong>Account:</strong> {infoStudent.accountDisabled ? "Disabled" : "Active"}</p>
                <p><strong>Guardians:</strong> {getGuardianSummary(infoStudent)}</p>
                <p><strong>Description:</strong> {infoStudent.description || "No description"}</p>
                <p><strong>Student ID:</strong> {infoStudent.id}</p>
              </div>
            </div>
            <div className="staff-modal-actions">
              <button className="secondary-action" type="button" onClick={() => setInfoStudent(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SubjectClassStudentPicker({
  classes,
  subjects,
  subjectClasses,
  search,
  selectedIds,
  onSearchChange,
  onSelectedIdsChange,
}: {
  classes: ClassGroup[];
  subjects: Subject[];
  subjectClasses: SubjectClass[];
  search: string;
  selectedIds: string[];
  onSearchChange: (search: string) => void;
  onSelectedIdsChange: (selectedIds: string[]) => void;
}) {
  const selectedSet = new Set(selectedIds);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSubjectClasses = subjectClasses.filter((subjectClass) => {
    const subject = subjects.find((item) => item.id === subjectClass.subjectId);
    const classGroup = classes.find((item) => item.id === subjectClass.baseClassId);
    const haystack = `${subjectClass.name} ${subject?.name ?? ""} ${classGroup?.name ?? ""} ${classGroup?.grade ?? ""} ${subjectClass.teacherName ?? ""}`.toLowerCase();
    return !normalizedSearch || haystack.includes(normalizedSearch);
  });

  return (
    <aside className="student-subject-class-picker">
      <div>
        <h3>Subject classes</h3>
        <p>{selectedIds.length} selected</p>
      </div>
      <TextInput label="Search subject classes" value={search} onChange={onSearchChange} icon={<Search size={18} />} />
      <div className="student-subject-class-actions">
        <button
          className="secondary-action"
          type="button"
          onClick={() => onSelectedIdsChange(mergeUnique([...selectedIds, ...filteredSubjectClasses.map((subjectClass) => subjectClass.id)]))}
        >
          Select shown
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() => onSelectedIdsChange(selectedIds.filter((id) => !filteredSubjectClasses.some((subjectClass) => subjectClass.id === id)))}
        >
          Clear shown
        </button>
      </div>
      <div className="student-subject-class-list">
        {filteredSubjectClasses.length === 0 ? (
          <div className="empty-editor-state">
            <h3>No subject classes found</h3>
            <p>Try another search term.</p>
          </div>
        ) : filteredSubjectClasses.map((subjectClass) => {
          const subject = subjects.find((item) => item.id === subjectClass.subjectId);
          const classGroup = classes.find((item) => item.id === subjectClass.baseClassId);
          return (
            <label className="student-subject-class-option" key={subjectClass.id}>
              <input
                type="checkbox"
                checked={selectedSet.has(subjectClass.id)}
                onChange={(event) => {
                  onSelectedIdsChange(event.target.checked
                    ? mergeUnique([...selectedIds, subjectClass.id])
                    : selectedIds.filter((id) => id !== subjectClass.id));
                }}
              />
              <span>
                <strong>{subjectClass.name}</strong>
                <small>{subject?.name ?? "No subject"}{classGroup ? ` - ${classGroup.name}${classGroup.grade ? `, Grade ${classGroup.grade}` : ""}` : " - Mixed classes"}</small>
              </span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}

function GradeLevelTable({
  gradeLevels,
  classes,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  gradeLevels: SchoolGradeLevel[];
  classes: ClassGroup[];
  subjectClasses: SubjectClass[];
  onEdit: (gradeLevel: SchoolGradeLevel, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (gradeLevels.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No grades registered</h3>
        <p>Add grades with a year before creating classes and subject classes.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table grade-level-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>Year</th>
            <th>Main classes</th>
            <th>Subject classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {gradeLevels.map((gradeLevel, index) => (
            <tr key={gradeLevel.id}>
              <td><strong>{gradeLevel.grade || "Not set"}</strong></td>
              <td>{gradeLevel.year || "Not set"}</td>
              <td>{classes.filter((classGroup) => classGroup.gradeLevelId === gradeLevel.id).length}</td>
              <td>{subjectClasses.filter((subjectClass) => subjectClass.gradeLevelId === gradeLevel.id).length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(gradeLevel, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassTable({
  classes,
  gradeLevels,
  students,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  classes: ClassGroup[];
  gradeLevels: SchoolGradeLevel[];
  students: Student[];
  subjectClasses: SubjectClass[];
  onEdit: (classGroup: ClassGroup, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No main classes yet</h3>
        <p>Add main classes like 8A and 8B before assigning students.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table class-table">
        <thead>
          <tr>
            <th>Main class</th>
            <th>Grade</th>
            <th>Class teacher</th>
            <th>Students</th>
            <th>Subject classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classGroup, index) => (
            <tr key={classGroup.id}>
              <td>
                <strong>{classGroup.name}</strong>
                <span>{classGroup.id}</span>
              </td>
              <td>{formatGradeLevel(gradeLevels.find((gradeLevel) => gradeLevel.id === classGroup.gradeLevelId)) || classGroup.grade || "Not set"}</td>
              <td>{classGroup.teacher || "Not assigned"}</td>
              <td>{students.filter((student) => student.classId === classGroup.id).length}</td>
              <td>{subjectClasses.filter((subjectClass) => subjectClass.baseClassId === classGroup.id).length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(classGroup, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectClassTable({
  classes,
  gradeLevels,
  subjectClasses,
  subjects,
  onEdit,
  onRemove,
}: {
  classes: ClassGroup[];
  gradeLevels: SchoolGradeLevel[];
  subjectClasses: SubjectClass[];
  subjects: Subject[];
  onEdit: (subjectClass: SubjectClass, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (subjectClasses.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No subject classes yet</h3>
        <p>Add a subject class to create a course group such as Math for 8A or a mixed student group.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table subject-class-table">
        <thead>
          <tr>
            <th>Subject class</th>
            <th>Subject</th>
            <th>Grade/year</th>
            <th>Main class</th>
            <th>Teacher</th>
            <th>Students</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjectClasses.map((subjectClass, index) => (
            <tr key={subjectClass.id}>
              <td>
                <strong>{subjectClass.name}</strong>
                <span>{subjectClass.id}</span>
              </td>
              <td>{subjects.find((subject) => subject.id === subjectClass.subjectId)?.name ?? "No subject"}</td>
              <td>{formatGradeLevel(gradeLevels.find((gradeLevel) => gradeLevel.id === subjectClass.gradeLevelId)) || "Not set"}</td>
              <td>{classes.find((classGroup) => classGroup.id === subjectClass.baseClassId)?.name ?? "Mixed classes"}</td>
              <td>{subjectClass.teacherName || "Not assigned"}</td>
              <td>{subjectClass.studentIds.length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(subjectClass, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffTable({
  staff,
  onSimulate,
  onEdit,
  onRemove,
}: {
  staff: StaffMember[];
  onSimulate?: (member: StaffMember) => void;
  onEdit: (member: StaffMember, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (staff.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No staff members yet</h3>
        <p>Add staff members to publish profiles and assign teachers.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table staff-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Description</th>
            <th>Contact</th>
            <th>Visibility</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member, index) => (
            <tr key={`${member.name}-${index}`}>
              <td>
                <strong>{member.name}</strong>
                {member.photoUrl ? <span>Photo uploaded</span> : <span>No photo</span>}
              </td>
              <td>
                <span>{getStaffCategories(member).join(", ")}</span>
                {staffCanAccessAdminPage(member) ? <span>Admin page access</span> : null}
                {isStaffAccountDisabled(member) ? <span>Account disabled</span> : null}
              </td>
              <td>{member.role || "No description"}</td>
              <td>
                {member.phone ? <span>{member.phone}</span> : null}
                {member.email ? <span>{member.email}</span> : null}
                {!member.phone && !member.email ? "No contact" : null}
              </td>
              <td>
                <span>{member.visibleOnHomePage === false ? "Hidden from home" : "Home page"}</span>
                <span>{member.visibleOnStaffPage === false ? "Hidden from staff page" : "Staff page"}</span>
              </td>
              <td>
                <div className="table-actions">
                  {onSimulate ? (
                    <button className="secondary-action" type="button" onClick={() => onSimulate(member)} disabled={!member.email || isStaffAccountDisabled(member)}>
                      Simulate
                    </button>
                  ) : null}
                  <button className="secondary-action" type="button" onClick={() => onEdit(member, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessOverview({
  school,
  classes,
  staff,
  students,
  subjectClasses,
  subjects,
}: {
  school: School;
  classes: ClassGroup[];
  staff: StaffMember[];
  students: Student[];
  subjectClasses: SubjectClass[];
  subjects: Subject[];
}) {
  const adminEmails = getSchoolAdminEmails(school);
  const allowStudentMessaging = Boolean(school.schoolWorkSettings?.allowStudentMessaging);
  const getSubjectClassLabel = (subjectClass: SubjectClass) => {
    const subject = subjects.find((item) => item.id === subjectClass.subjectId);
    return subject?.name ?? subjectClass.name;
  };
  const getClassLabel = (classGroup: ClassGroup) => classGroup.grade ? `${classGroup.name} - Grade ${classGroup.grade}` : classGroup.name;
  const formatList = (items: string[], emptyLabel: string) => items.length ? items.join(", ") : emptyLabel;
  const staffRows = staff.map((member) => {
    const categories = getStaffCategories(member);
    const isTeacher = categories.includes("Teacher");
    const isAdmin = Boolean(member.email && adminEmails.map((email) => email.toLowerCase()).includes(member.email.toLowerCase()));
    const accountDisabled = isStaffAccountDisabled(member);
    const taughtSubjectClasses = subjectClasses.filter((subjectClass) => subjectClass.teacherName === member.name).map(getSubjectClassLabel);
    const contactTeacherClasses = classes.filter((classGroup) => classGroup.teacher === member.name).map(getClassLabel);
    const access = [
      isAdmin ? "Admin dashboard" : "",
      isAdmin ? "All SchoolWork subject classes" : isTeacher ? `Teacher SchoolWork: ${formatList(taughtSubjectClasses, "no assigned subject classes")}` : "SchoolWork viewer access",
      contactTeacherClasses.length ? `Contact teacher: ${contactTeacherClasses.join(", ")}` : "",
      "School chat",
      "Public website pages",
    ].filter(Boolean);
    return {
      id: `staff-${member.email || member.name}`,
      name: member.name,
      role: isAdmin ? "School admin" : categories.join(", "),
      signIn: accountDisabled ? `${member.email || "No login email"} (disabled)` : member.email || "No login email",
      access: accountDisabled ? ["Account disabled"] : access,
    };
  });
  const studentRows = students.map((student) => {
    const studentSubjectClasses = subjectClasses.filter((subjectClass) => subjectClass.studentIds.includes(student.id)).map(getSubjectClassLabel);
    const classGroup = classes.find((item) => item.id === student.classId);
    return {
      id: `student-${student.id}`,
      name: `${student.firstName} ${student.lastName}`,
      role: "Student",
      signIn: student.accountDisabled ? `${student.email || "No login email"} (disabled)` : student.email || "No login email",
      access: student.accountDisabled ? ["Account disabled"] : [
        `SchoolWork: ${formatList(studentSubjectClasses, "no subject classes")}`,
        "Grades and feedback",
        `School chat with teachers/admins${allowStudentMessaging ? " and students" : ""}`,
        classGroup ? `Main class: ${classGroup.name}` : "No main class",
      ],
    };
  });
  const staffAdminEmails = new Set(staff.map((member) => member.email?.toLowerCase()).filter(Boolean));
  const standaloneAdminRows = adminEmails
    .filter((email) => !staffAdminEmails.has(email.toLowerCase()))
    .map((email) => ({
      id: `admin-${email}`,
      name: email,
      role: "School admin",
      signIn: email,
      access: ["Admin dashboard", "All SchoolWork subject classes", "School chat", "Public website pages"],
    }));
  const rows = [...standaloneAdminRows, ...staffRows, ...studentRows];

  return (
    <div className="access-overview">
      <section className="access-summary-grid">
        <article className="access-summary-card">
          <AdminCardTitle icon={faGlobe} title="Public website" />
          <span>Everyone can view published school pages, about pages, news, calendar, staff, and student/guardian information pages.</span>
        </article>
        <article className="access-summary-card">
          <AdminCardTitle icon={faGaugeHigh} title="Admin dashboard" />
          <span>Staff with admin page access can edit school content, people, academics, settings, and all SchoolWork areas.</span>
        </article>
        <article className="access-summary-card">
          <AdminCardTitle icon={faBookOpen} title="SchoolWork" />
          <span>Admins see all subject classes. Teachers see assigned subject classes. Students see subject classes they belong to.</span>
        </article>
        <article className="access-summary-card">
          <AdminCardTitle icon={faMessage} title="School chat" />
          <span>Students can contact teachers and admins{allowStudentMessaging ? ", and student-to-student messaging is enabled." : ". Student-to-student messaging is disabled."}</span>
        </article>
      </section>
      <div className="data-table-wrap">
        <table className="data-table access-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Sign-in</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.name}</strong></td>
                <td>{row.role}</td>
                <td>{row.signIn}</td>
                <td>{row.access.join(" | ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewsTable({
  news,
  onEdit,
  onRemove,
}: {
  news: NewsItem[];
  onEdit: (item: NewsItem, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (news.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No news yet</h3>
        <p>Add news items to publish updates on the school website.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table news-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Slug</th>
            <th>Image</th>
            <th>Excerpt</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {news.map((item, index) => (
            <tr key={item.id || `${item.title}-${index}`}>
              <td><strong>{item.title}</strong></td>
              <td>{formatDate(item.date)}</td>
              <td>{item.slug || getNewsSlug(item)}</td>
              <td>{item.headerImage ? "Image set" : "No image"}</td>
              <td>{getTextExcerpt(item.body, 120) || "No body"}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(item, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarTable({
  items,
  onEdit,
  onRemove,
}: {
  items: CalendarItem[];
  onEdit: (item: CalendarItem, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No calendar events yet</h3>
        <p>Add events to show important dates on the school website.</p>
      </div>
    );
  }

  const sorted = items.map((item, index) => ({ item, index })).sort((a, b) => b.item.date.localeCompare(a.item.date));

  return (
    <div className="data-table-wrap calendar-table-wrap">
      <table className="data-table calendar-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ item, index }) => (
            <tr key={`${item.title}-${item.date}-${index}`}>
              <td><strong>{item.title}</strong></td>
              <td>{formatDate(item.date)}</td>
              <td>
                <div className="table-actions calendar-table-actions">
                  <button className="calendar-edit-action" type="button" onClick={() => onEdit(item, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarAdminPreview({ items }: { items: CalendarItem[] }) {
  return (
    <aside className="calendar-admin-preview" aria-label="Calendar website preview">
      <div className="mini-preview-label">Website preview</div>
      <InfoPanel title="Calendar">
        {items.length === 0 ? (
          <div className="empty-editor-state calendar-preview-empty">
            <h3>No events yet</h3>
            <p>Add events to preview the public calendar list.</p>
          </div>
        ) : (
          <div className="calendar-list">
            {items.map((item) => (
              <div className="calendar-row" key={`${item.title}-${item.date}`}>
                <CalendarDays size={18} />
                <div>
                  <time>{formatDate(item.date)}</time>
                  <p>{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </InfoPanel>
    </aside>
  );
}

function SubjectTable({
  subjects,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  subjects: Subject[];
  subjectClasses: SubjectClass[];
  onEdit: (item: Subject, index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (subjects.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No subjects yet</h3>
        <p>Add subjects before creating subject classes.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table subject-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Abbreviation</th>
            <th>Color</th>
            <th>Subject classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject, index) => (
            <tr key={subject.id}>
              <td>
                <strong>{subject.name}</strong>
                <span>{subject.id}</span>
              </td>
              <td>{subject.abbreviation}</td>
              <td>
                <span className="table-color-swatch" style={{ background: subject.color }} />
                {subject.color}
              </td>
              <td>{subjectClasses.filter((subjectClass) => subjectClass.subjectId === subject.id).length}</td>
              <td>
                <div className="table-actions">
                  <button className="secondary-action" type="button" onClick={() => onEdit(subject, index)}>
                    Edit
                  </button>
                  <button className="remove-button" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="field-label subject-color-field">
      <span>Subject color</span>
      <div className="subject-color-options">
        {subjectColorOptions.map((color) => (
          <button
            className={value === color ? "active-subject-color" : ""}
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{ "--subject-color": color } as React.CSSProperties}
            aria-label={`Select ${color}`}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="subject-color-selected">
        <span style={{ background: value }} />
        <strong>{value}</strong>
      </div>
    </div>
  );
}

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

function SchoolWorkOverview({
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
    const activeGlobalScales = globalAssessmentScales.filter((s) => effectiveSettings.enabledGlobalAssessmentScaleIds.includes(s.id));
    const allActiveScales = [...activeGlobalScales, ...effectiveSettings.customAssessmentScales];
    return (
      <div className="school-work-overview">
        {overviewMenu}
        {allActiveScales.length > 0 ? (
          <div className="admin-scale-card-grid">
            {allActiveScales.map((scale) => (
              <div key={scale.id} className="admin-scale-card">
                <div className="admin-scale-card-header">
                  <strong>{scale.name}</strong>
                  {effectiveSettings.customAssessmentScales.some((s) => s.id === scale.id) ? (
                    <span className="admin-scale-card-tag">Custom</span>
                  ) : (
                    <span className="admin-scale-card-tag admin-scale-card-tag--global">Global</span>
                  )}
                </div>
                <div className="admin-scale-levels">
                  {scale.levels.map((level) => (
                    <div key={level.id} className="admin-scale-level-row">
                      <span className="admin-scale-level-value">{level.value}</span>
                      <span className="admin-scale-level-pct">≥ {level.minPercentage}%</span>
                      {level.description ? <span className="admin-scale-level-desc">{level.description}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="nested-editor-grid">
          <section className="sub-editor-panel">
            <h3>Assessment scales</h3>
            <div className="assessment-scale-toggle-list">
              {globalAssessmentScales.map((scale) => (
                <label className="assessment-scale-toggle" key={scale.id}>
                  <div>
                    <strong>{scale.name}</strong>
                    <small>{formatAssessmentScaleSummary(scale)}</small>
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
                </label>
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
              <h3>{assessment.title}</h3>
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

function getEffectiveRemarkCategories(globalCategories: RemarkCategory[], remarkSettings?: SchoolRemarkSettings): RemarkCategory[] {
  const disabled = new Set(remarkSettings?.disabledGlobalCategoryIds ?? []);
  return [
    ...globalCategories.filter((c) => !disabled.has(c.id)),
    ...(remarkSettings?.customCategories ?? []),
  ];
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

function SubjectClassWorkPage({
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

function canManageSchool(profile: AdminProfile | null, schoolId: string, userEmail?: string | null, school?: School) {
  if (profile?.superAdmin || profile?.schoolIds.includes(schoolId)) {
    return true;
  }

  const normalizedEmail = userEmail?.toLowerCase();
  return Boolean(normalizedEmail && school && getSchoolAdminEmails(school).includes(normalizedEmail));
}

function canTeachAnySubjectClass(school: School, userEmail?: string | null) {
  return (school.subjectClasses ?? []).some((subjectClass) => canTeachSubjectClass(school, subjectClass, userEmail));
}

function canTeachSubjectClass(school: School, subjectClass: SubjectClass, userEmail?: string | null) {
  const normalizedEmail = userEmail?.toLowerCase();
  if (!normalizedEmail || !subjectClass.teacherName) {
    return false;
  }
  return school.staff.some((member) => (
    member.email?.toLowerCase() === normalizedEmail
    && member.name === subjectClass.teacherName
    && hasStaffCategory(member, "Teacher")
    && !isStaffAccountDisabled(member)
  ));
}

function getStaffCategories(member: StaffMember): StaffCategory[] {
  const categories = member.categories?.length ? member.categories : [member.category ?? "Other"];
  return mergeUnique(categories) as StaffCategory[];
}

function hasStaffCategory(member: StaffMember, category: StaffCategory) {
  return getStaffCategories(member).includes(category);
}

function staffCanAccessAdminPage(member: StaffMember) {
  return member.canAccessAdminPage ?? hasStaffCategory(member, "Administration");
}

function isStaffAccountDisabled(member: StaffMember) {
  return Boolean(member.accountDisabled) && !staffCanAccessAdminPage(member);
}

function getStaffEmail(member?: StaffMember) {
  return member?.email?.trim().toLowerCase() ?? "";
}

function getStaffAdminEmails(staff: StaffMember[]) {
  return mergeUnique(staff.filter(staffCanAccessAdminPage).map(getStaffEmail).filter(Boolean));
}

function getSchoolAdminEmails(school: School) {
  return getStaffAdminEmails(school.staff ?? []);
}

function getSchoolWorkIdentity(school: School, userEmail: string | null, profile: AdminProfile | null): SchoolWorkIdentity | null {
  const params = new URLSearchParams(window.location.search);
  const simulateRole = params.get("simulateRole");
  const simulateId = params.get("simulateId");
  const subjectClasses = school.subjectClasses ?? [];
  const isDemoSchool = school.id === sampleSchool.id;
  const canSimulate = !hasFirebaseConfig || isDemoSchool || canManageSchool(profile, school.id, userEmail, school);

  if (canSimulate && simulateRole === "admin") {
    return {
      role: "admin",
      label: "School admin",
      subjectClasses,
    };
  }

  if (canSimulate && simulateRole === "staff" && simulateId) {
    const staffMember = school.staff.find((member) => member.email?.toLowerCase() === simulateId.toLowerCase());
    if (staffMember && !isStaffAccountDisabled(staffMember)) {
      const isTeacher = hasStaffCategory(staffMember, "Teacher");
      return {
        role: isTeacher ? "teacher" : "viewer",
        label: staffMember.name,
        subjectClasses: isTeacher
          ? subjectClasses.filter((subjectClass) => subjectClass.teacherName === staffMember.name)
          : subjectClasses,
      };
    }
  }

  if (canSimulate && simulateRole === "student" && simulateId) {
    const student = school.students.find((item) => item.id === simulateId);
    if (student && !student.accountDisabled) {
      return {
        role: "student",
        label: `${student.firstName} ${student.lastName}`,
        studentId: student.id,
        subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.studentIds.includes(student.id)),
      };
    }
  }

  if (isDemoSchool && !simulateRole) {
    return {
      role: "admin",
      label: "School admin",
      subjectClasses,
    };
  }

  if (profile?.superAdmin) {
    return {
      role: "admin",
      label: "Superadmin",
      subjectClasses,
    };
  }

  const normalizedEmail = userEmail?.toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  if (getSchoolAdminEmails(school).includes(normalizedEmail)) {
    return {
      role: "admin",
      label: "School admin",
      subjectClasses,
    };
  }

  const staffMember = school.staff.find((member) => member.email?.toLowerCase() === normalizedEmail);
  if (staffMember && !isStaffAccountDisabled(staffMember)) {
    const isTeacher = hasStaffCategory(staffMember, "Teacher");
    return {
      role: isTeacher ? "teacher" : "viewer",
      label: staffMember.name,
      subjectClasses: isTeacher
        ? subjectClasses.filter((subjectClass) => subjectClass.teacherName === staffMember.name)
        : subjectClasses,
    };
  }

  const student = school.students.find((item) => item.email?.toLowerCase() === normalizedEmail);
  if (student && !student.accountDisabled) {
    return {
      role: "student",
      label: `${student.firstName} ${student.lastName}`,
      studentId: student.id,
      subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.studentIds.includes(student.id)),
    };
  }

  return null;
}

function getEffectiveAssessmentScales(school: School, globalSchoolWork: GlobalSchoolWorkConfig) {
  const settings = school.schoolWorkSettings ?? {
    enabledGlobalAssessmentScaleIds: globalSchoolWork.assessmentScales.map((scale) => scale.id),
    knownGlobalAssessmentScaleIds: globalSchoolWork.assessmentScales.map((scale) => scale.id),
    allowStudentMessaging: false,
    customAssessmentScales: [],
  };
  return [
    ...globalSchoolWork.assessmentScales.filter((scale) => settings.enabledGlobalAssessmentScaleIds.includes(scale.id)),
    ...settings.customAssessmentScales,
  ];
}

function getProctorEventLabel(type: "page-hidden" | "window-blur" | "fullscreen-exit" | "cursor-left-page" | "cursor-entered-page") {
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

function getCursorOutsideSessions(events: NonNullable<NonNullable<SubjectResource["testSubmissions"]>[number]["proctorEvents"]>) {
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

function getTestTimerLabel(test: SubjectResource) {
  if (test.timerMode === "duration") {
    return `${test.timerMinutes ?? 45} minutes from start`;
  }
  if (test.timerMode === "fixed-end") {
    return test.timerEndsAt ? `Until ${test.timerEndsAt}` : "Fixed end time not set";
  }
  return "No timer";
}

function formatBillingPeriod(period: string): string {
  if (period.length === 4) return period;
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDaysInMonthFn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDaysInYear(year: number): number {
  return new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
}

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPaidAmount(payment: SchoolPayment): number {
  return payment.records.reduce((sum, r) => sum + r.amount, 0);
}

function computePaymentStatus(payment: SchoolPayment): SchoolPayment["status"] {
  const paid = getPaidAmount(payment);
  if (paid <= 0) return new Date(payment.dueDate) > new Date() ? "upcoming" : "outstanding";
  if (paid >= payment.totalAmount) return "paid";
  return "partial";
}

function generatePayment(school: School, period: string): SchoolPayment | null {
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

function getCurrentPeriod(interval: "monthly" | "yearly"): string {
  const now = new Date();
  if (interval === "monthly") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return String(now.getFullYear());
}

function formatAssessmentScaleSummary(scale: AssessmentScale) {
  if (scale.levels.length > 12) {
    const numericValues = scale.levels.map((level) => Number(level.value)).filter(Number.isFinite);
    if (numericValues.length >= 10) {
      return `${Math.min(...numericValues)}-${Math.max(...numericValues)} (${scale.levels.length} levels)`;
    }
    return `${scale.levels.length} levels`;
  }

  return scale.levels.map((level) => level.value).join(", ");
}

function formatGradeLevel(gradeLevel?: SchoolGradeLevel) {
  if (!gradeLevel) {
    return "";
  }
  const grade = gradeLevel.grade || "Grade";
  return `${grade}${gradeLevel.year ? ` (${gradeLevel.year})` : ""}`;
}

function formatSubjectClassGradeLevel(gradeLevel?: SchoolGradeLevel) {
  if (!gradeLevel) {
    return "";
  }
  const grade = gradeLevel.grade.trim();
  const gradeLabel = grade.toLowerCase().startsWith("grade ") ? grade : `Grade ${grade || "Grade"}`;
  return `${gradeLabel}${gradeLevel.year ? ` - ${gradeLevel.year}` : ""}`;
}

function formatSchoolWorkClassTitle(value: string) {
  return value
    .replace(/^Grade\b/i, "Class")
    .replace(/ - Grade\b/gi, " - Class");
}

function slugifyGradeLevel(grade: string, year: string) {
  const slug = slugifySchoolName(`${grade}-${year}`);
  return slug ? `grade-${slug}` : `grade-${Date.now()}`;
}

function isVisibleOnHomePage(member: StaffMember) {
  return member.visibleOnHomePage !== false;
}

function isVisibleOnStaffPage(member: StaffMember) {
  return member.visibleOnStaffPage !== false;
}

function buildAboutPageGroups(school: School, globalAbout: GlobalAboutConfig) {
  const globalSlugs = new Set(globalAbout.pages.map((page) => page.slug));
  const schoolPages = (school.aboutPages ?? []).filter((page) => !globalSlugs.has(page.slug));
  const globalCategoryIds = new Set(globalAbout.categories.map((category) => category.id));

  return [
    ...globalAbout.categories.map((category) => ({
      id: `global-${category.id}`,
      title: category.title,
      pages: [
        ...globalAbout.pages.filter((page) => page.categoryId === category.id),
        ...schoolPages.filter((page) => page.categoryId === category.id),
      ],
    })),
    ...(school.aboutCategories ?? []).map((category) => ({
      id: category.id,
      title: category.title,
      pages: schoolPages.filter((page) => page.categoryId === category.id && !globalCategoryIds.has(page.categoryId)),
    })),
  ];
}

function getNewsSlug(item: NewsItem) {
  return item.slug || slugifySchoolName(item.title);
}

function getCachedSchool(schoolId: string) {
  const localSchool = getLocalSchool(schoolId);
  if (localSchool) {
    schoolCache.set(schoolId, localSchool);
    return localSchool;
  }
  return schoolCache.get(schoolId) ?? null;
}

async function loadSchoolForPublicPage(schoolId: string, setSchool: (school: School) => void) {
  const remoteSchool = await getSchool(schoolId);
  const nextSchool = getLocalSchool(schoolId) ?? remoteSchool;
  schoolCache.set(schoolId, nextSchool);
  setSchool(nextSchool);
}

function getTextExcerpt(html: string, maxLength: number) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

async function refreshSchools(
  setSchools: (schools: School[]) => void,
  setStatus: (status: string) => void,
) {
  const nextSchools = await listSchools();
  setSchools(nextSchools);
  setStatus(`${nextSchools.length} school${nextSchools.length === 1 ? "" : "s"} loaded`);
}

function useSchoolDocumentBrand(school: School | null) {
  useEffect(() => {
    if (!school) {
      setDocumentBrand();
      return undefined;
    }

    const title = school.name || "School";
    const logoUrl = school.logoUrl;
    let cancelled = false;

    if (logoUrl) {
      compositeOnWhite(logoUrl, 64).then((dataUrl) => {
        if (!cancelled) setDocumentBrand(title, dataUrl);
      });
    } else {
      setDocumentBrand(title);
    }

    return () => {
      cancelled = true;
      setDocumentBrand();
    };
  }, [school]);
}

function compositeOnWhite(src: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(src);
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

function setDocumentBrand(title = "EduLink Africa", faviconHref = "/edulink-logo.png") {
  document.title = title;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.type = "image/png";
  favicon.href = faviconHref;
}

function SchoolHeader({
  school,
  currentPage,
  hideNav = false,
  actions,
  globalCategories,
}: {
  school: School;
  currentPage?: string;
  hideNav?: boolean;
  actions?: React.ReactNode;
  globalCategories?: AboutCategory[];
}) {
  const [loadedCategories, setLoadedCategories] = useState<AboutCategory[]>(() => globalAboutCache?.categories ?? []);
  useEffect(() => {
    if (!globalAboutCache) {
      void getGlobalAboutConfig().then((config) => {
        globalAboutCache = config;
        setLoadedCategories(config.categories);
      });
    }
  }, []);
  const globalCats = globalCategories ?? loadedCategories;
  const schoolCats = school.aboutCategories ?? [];
  const globalCatIds = new Set(globalCats.map((c) => c.id));
  const allNavCategories = [
    ...globalCats.filter((c) => c.id !== "about" && c.id !== "global-about"),
    ...schoolCats.filter((c) => !globalCatIds.has(c.id)),
  ];

  const getCategoryHref = (cat: AboutCategory) => `/${school.id}/${cat.id}`;

  return (
    <header className="school-header">
      <button className="school-brand" onClick={() => navigate(`/${school.id}`)}>
        {school.logoUrl ? <img className="school-brand-logo" src={school.logoUrl} alt="" /> : <SchoolIcon size={30} />}
        <span>{school.name}</span>
      </button>
      {hideNav ? actions : <nav className="school-nav" aria-label="School navigation">
        <a href={`/${school.id}`} className={currentPage === "home" ? "active" : ""}>Home</a>
        <a href={`/${school.id}/about`} className={currentPage === "about" ? "active" : ""}>About</a>
        <a href={`/${school.id}/for-students-and-guardians`} className={currentPage === "students" ? "active" : ""}>For students and guardians</a>
        {allNavCategories.map((cat) => (
          <a key={cat.id} href={getCategoryHref(cat)} className={currentPage === cat.id ? "active" : ""}>{cat.title}</a>
        ))}
        <a href={`/${school.id}/schoolwork`} className="school-lms-login-button">LMS login</a>
      </nav>}
    </header>
  );
}

function AboutBackButton({ schoolId }: { schoolId: string }) {
  return (
    <button className="about-back-button" type="button" onClick={() => navigate(`/${schoolId}/about`)}>
      <ChevronRight size={18} />
      Back to about
    </button>
  );
}

function ContentSection({ title, action, actionHref, children }: { title: string; action?: string; actionHref?: string; children: React.ReactNode }) {
  return (
    <section className="content-section" id={title.toLowerCase().split(" ")[0]}>
      <div className="section-heading">
        <h2>{title}</h2>
        {action ? (
          <button type="button" onClick={() => actionHref ? navigate(actionHref) : undefined}>
            {action}
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-panel" id={title.toLowerCase()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ContactLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="contact-line">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StaffCard({ member }: { member: StaffMember }) {
  return (
    <article className="staff-card">
      <div className="staff-avatar">
        {member.photoUrl ? <img src={member.photoUrl} alt="" /> : <UserRound size={24} />}
      </div>
      <h3>{member.name}</h3>
      <p>{member.role}</p>
      {member.phone ? <span>{member.phone}</span> : null}
      {member.email ? <span>{member.email}</span> : null}
    </article>
  );
}

function SchoolFooter({ school }: { school: School }) {
  return (
    <footer className="school-footer">
      <div>
        <h2>{school.name}</h2>
        <p className="school-footer-powered">Powered by EduLink Africa</p>
        <p>{school.address}, {school.city}, {school.country}</p>
      </div>
      <div>
        <p>Phone: {school.phone}</p>
        <p>Email: {school.email}</p>
        <p>Principal: {school.principal}</p>
      </div>
    </footer>
  );
}

function EditorPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="editor-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange, icon, disabled }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="field-label">
      {label}
      <span className="input-shell">
        {icon}
        <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} />
    </label>
  );
}

function CheckboxInput({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  onChange,
  allowSelectAll = false,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  allowSelectAll?: boolean;
}) {
  const valueSet = new Set(values);
  const optionValues = options.map((option) => option.value);
  const allSelected = optionValues.length > 0 && optionValues.every((value) => valueSet.has(value));

  return (
    <fieldset className="checkbox-group">
      <legend>{label}</legend>
      {allowSelectAll ? (
        <div className="checkbox-group-actions">
          <CheckboxInput
            label="Select all"
            checked={allSelected}
            onChange={(checked) => onChange(checked ? mergeUnique([...values, ...optionValues]) : values.filter((value) => !optionValues.includes(value)))}
          />
        </div>
      ) : null}
      <div>
        {options.map((option) => (
          <CheckboxInput
            key={option.value}
            label={option.label}
            checked={valueSet.has(option.value)}
            onChange={(checked) => {
              onChange(checked ? mergeUnique([...values, option.value]) : values.filter((value) => value !== option.value));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function GuardianEditor({ guardians, onChange }: { guardians: Guardian[]; onChange: (guardians: Guardian[]) => void }) {
  return (
    <section className="guardian-editor">
      <div className="guardian-editor-heading">
        <h3>Guardians</h3>
        <button
          className="secondary-action"
          type="button"
          onClick={() => onChange([...guardians, { id: `guardian-${Date.now()}`, name: "", email: "", phone: "", relationship: "" }])}
        >
          Add guardian
        </button>
      </div>
      {guardians.length === 0 ? (
        <p>No guardians registered yet.</p>
      ) : (
        <div className="guardian-list">
          {guardians.map((guardian, index) => (
            <div className="guardian-card" key={guardian.id}>
              <TextInput
                label="Guardian name"
                value={guardian.name}
                onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, name: value } : item))}
              />
              <div className="split-fields">
                <TextInput
                  label="Relationship"
                  value={guardian.relationship ?? ""}
                  onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, relationship: value } : item))}
                />
                <TextInput
                  label="Phone"
                  value={guardian.phone ?? ""}
                  onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, phone: value } : item))}
                />
              </div>
              <TextInput
                label="Email"
                value={guardian.email ?? ""}
                onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, email: value } : item))}
              />
              <button className="remove-button" type="button" onClick={() => onChange(guardians.filter((_, currentIndex) => currentIndex !== index))}>
                Remove guardian
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RegistrationModal({
  title,
  eyebrow,
  submitLabel,
  wide = false,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  eyebrow: string;
  submitLabel: string;
  wide?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className={`staff-modal ${wide ? "wide-staff-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
        <div className="staff-modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="staff-modal-title">{title}</h2>
          </div>
        </div>
        <div className="staff-modal-body">
          {children}
        </div>
        <div className="staff-modal-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" type="button" onClick={onSubmit}>
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function ImageUpload({
  label,
  value,
  onChange,
  variant = "wide",
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: "wide" | "square" | "hero" | "logo" | "strictSquare";
  hideLabel?: boolean;
}) {
  const [status, setStatus] = useState(
    variant === "logo"
      ? `Choose a square logo up to ${MAX_IMAGE_UPLOAD_LABEL}.`
      : variant === "strictSquare"
        ? `Choose a square image up to ${MAX_IMAGE_UPLOAD_LABEL}.`
        : `Choose an image up to ${MAX_IMAGE_UPLOAD_LABEL}.`,
  );

  const uploadImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setStatus("Preparing image...");
    try {
      const nextImage = await prepareImageUpload(file,
        variant === "logo" || variant === "strictSquare"
          ? { requireSquare: true, maxWidth: 512, maxHeight: 512, quality: 0.88, format: "png" as const }
          : variant === "square"
            ? { cropSquare: true, maxWidth: 512, maxHeight: 512, quality: 0.82 }
            : { maxWidth: 1600, maxHeight: 900, quality: 0.84 });
      onChange(nextImage);
      setStatus("Image uploaded successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  return (
    <div className="field-label image-upload-field">
      {hideLabel ? null : <span>{label}</span>}
      <div className="image-upload-control">
        <div className={`image-upload-preview ${variant === "square" || variant === "logo" || variant === "strictSquare" ? "square-image-preview" : ""} ${variant === "hero" ? "hero-image-preview" : ""}`}>
          {value ? <img src={value} alt="" /> : <ImagePlus size={24} />}
        </div>
        <div>
          <input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          <p>{status}</p>
          {value ? (
            <button className="remove-button" type="button" onClick={() => onChange("")}>
              Remove image
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StaffImageUpload({ photoUrl, onChange }: { photoUrl: string; onChange: (photoUrl: string) => void }) {
  return <ImageUpload label="Staff image" value={photoUrl} onChange={onChange} variant="square" />;
}

function RichTextEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageStatus, setImageStatus] = useState("");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) {
      return;
    }
    editor.innerHTML = value;
  }, [value]);

  const syncValue = () => {
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  const insertImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setImageStatus("Preparing image...");
    try {
      const imageUrl = await prepareImageUpload(file, { maxWidth: 1200, maxHeight: 900, quality: 0.84 });
      runCommand("insertHTML", `<figure><img src="${escapeHtmlAttribute(imageUrl)}" alt="" /></figure><p><br></p>`);
      setImageStatus("Image inserted.");
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  return (
    <div className="field-label rich-text-field">
      <span>{label}</span>
      <div className="rich-text-toolbar" aria-label={`${label} formatting controls`}>
        <button type="button" onClick={() => runCommand("formatBlock", "h2")} title="Heading">
          <Heading2 size={18} />
        </button>
        <button type="button" onClick={() => runCommand("bold")} title="Bold">
          <Bold size={18} />
        </button>
        <button type="button" onClick={() => runCommand("italic")} title="Italic">
          <Italic size={18} />
        </button>
        <button type="button" onClick={() => runCommand("insertUnorderedList")} title="Bullet list">
          <List size={18} />
        </button>
        <button type="button" onClick={() => runCommand("insertOrderedList")} title="Numbered list">
          <ListOrdered size={18} />
        </button>
        <button type="button" onClick={() => runCommand("formatBlock", "blockquote")} title="Quote">
          <Quote size={18} />
        </button>
        <button type="button" onClick={() => runCommand("formatBlock", "p")} title="Paragraph">
          P
        </button>
        <button type="button" onClick={() => imageInputRef.current?.click()} title="Image">
          <ImagePlus size={18} />
        </button>
        <input
          ref={imageInputRef}
          className="rich-text-image-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            void insertImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {imageStatus ? <p className="rich-text-status">{imageStatus}</p> : null}
      <div
        ref={editorRef}
        className="rich-text-editor"
        contentEditable
        suppressContentEditableWarning
        onBlur={syncValue}
        onInput={syncValue}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function prepareImageUpload(
  file: File,
  {
    maxWidth,
    maxHeight,
    quality,
    cropSquare = false,
    requireSquare = false,
    format = "jpeg",
  }: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    cropSquare?: boolean;
    requireSquare?: boolean;
    format?: "jpeg" | "png";
  },
) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      reject(new Error(`Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        if (requireSquare && image.width !== image.height) {
          reject(new Error("Logo image must be square."));
          return;
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Could not resize image"));
          return;
        }

        if (cropSquare) {
          const size = Math.min(maxWidth, maxHeight);
          const sourceSize = Math.min(image.width, image.height);
          const sourceX = (image.width - sourceSize) / 2;
          const sourceY = (image.height - sourceSize) / 2;

          canvas.width = size;
          canvas.height = size;
          context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
          resolve(canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", quality));
          return;
        }

        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", quality));
      };
      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function Repeater<T extends NewsItem | CalendarItem | StaffMember | ClassGroup | Student | Subject | SubjectClass | AboutCategory | AboutPage | GlobalAboutPage>({
  items,
  onChange,
  renderItem,
  createItem,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (item: T) => void) => React.ReactNode;
  createItem: () => T;
  addLabel: string;
}) {
  return (
    <div className="repeater">
      <button className="secondary-action repeater-add-button" type="button" onClick={() => onChange([...items, createItem()])}>
        {addLabel}
      </button>
      {items.map((item, index) => (
        <div className="repeater-item" key={index}>
          {renderItem(item, (nextItem) => onChange(items.map((current, currentIndex) => (currentIndex === index ? nextItem : current))))}
          <button className="remove-button" type="button" onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function SchoolMiniPreview() {
  return (
    <div className="mini-preview" aria-label="School page preview">
      <div className="mini-top" />
      <div className="mini-hero" />
      <div className="mini-grid">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <LoadingContent />
    </main>
  );
}

function SchoolWebsiteHiddenRedirect() {
  useEffect(() => {
    navigate("/login");
  }, []);

  return <LoadingScreen />;
}

function shouldShowPublicSchoolWebsite(school: School) {
  return school.showWebsite !== false;
}

function PublicSchoolLoadingPage({ schoolId, currentPage }: { schoolId: string; currentPage?: string }) {
  const loadingSchool = getCachedSchool(schoolId) ?? getLocalSchool(schoolId) ?? {
    ...sampleSchool,
    id: schoolId,
    name: "",
    tagline: "",
    heroImage: "",
    showWebsite: true,
  };

  return <SchoolLoadingPage school={loadingSchool} currentPage={currentPage} />;
}

function SchoolLoadingPage({ school, currentPage }: { school: School; currentPage?: string }) {
  const mainColor = school.mainColor || "#18322e";
  const subColor = school.subColor || "#e0b44f";

  return (
    <main className="school-page" style={{ "--school-main": mainColor, "--school-sub": subColor } as React.CSSProperties}>
      <SchoolHeader school={school} currentPage={currentPage} />
      <section className="school-loading-section">
        <LoadingContent />
      </section>
      <SchoolFooter school={school} />
    </main>
  );
}

function LoadingContent() {
  return (
    <div className="loading-content">
      <GraduationCap size={36} />
      <p>Loading school page...</p>
    </div>
  );
}

function formatDate(date: string) {
  const parsed = parseDisplayDate(date);
  if (!parsed) {
    return date;
  }
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(parsed);
}

function formatDateTime(date: string) {
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

function formatDateTimeWithSeconds(date: string) {
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

function getAssessmentDueDate(assessment: Assessment) {
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

function formatAssessmentDate(assessment: Assessment) {
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

function parseDisplayDate(date: string) {
  if (!date) {
    return null;
  }
  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatLastActive(date?: string) {
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

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parsePercentageInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default App;
