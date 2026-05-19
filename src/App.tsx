import { useEffect, useMemo, useRef, useState } from "react";
import { navigate, openInNewTab } from "./lib/navigate";
import { mergeUnique, splitCsv, parsePercentageInput, formatDate, formatDateTime, formatDateTimeWithSeconds, formatDuration, formatLastActive, formatKES, formatBillingPeriod, getPaidAmount, computePaymentStatus, generatePayment, getCurrentPeriod, formatAssessmentScaleSummary, formatGradeLevel, formatSubjectClassGradeLevel, formatSchoolWorkClassTitle, getProctorEventLabel, getCursorOutsideSessions, getTestTimerLabel, formatAssessmentDate, getAssessmentDueDate, getDaysInMonthFn, getDaysInYear, getTextExcerpt } from "./lib/utils";
import { StaffCategory, SchoolWorkAccessLevel, SchoolWorkIdentity, getStaffCategories, hasStaffCategory, staffCanAccessAdminPage, isStaffAccountDisabled, isStaffDeleted, isStaffPermanentlyRemoved, daysUntilPermanentRemoval, getStaffEmail, getStaffAdminEmails, getSchoolAdminEmails, canManageSchool, canTeachAnySubjectClass, canTeachSubjectClass, getSchoolWorkIdentity, isVisibleOnHomePage, isVisibleOnStaffPage, getEffectiveAssessmentScales, getEffectiveRemarkCategories, REMARK_PARENTS } from "./lib/staffUtils";
import { AdminCardTitle, EditorPanel, TextInput, DateInput, TextArea, CheckboxInput, CheckboxGroup, GuardianEditor, SelectInput, ImageUpload, RichTextEditor, RegistrationModal, AboutBackButton, ContentSection, InfoPanel, ContactLine, prepareImageUpload } from "./components/ui";
import { createUserWithEmailAndPassword, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailAndPassword, signInWithEmailLink, signOut, type User } from "firebase/auth";
import {
  ArrowLeft,
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
  Image,
  LayoutDashboard,
  Link2,
  List,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
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
import { PublishedTimetableView, TimetablePage } from "./components/Timetable";
import { SchoolHeader, PublicSchoolLoadingPage, useSchoolDocumentBrand, SchoolPage, AboutPageView, AboutSinglePageView, GlobalCategoryPageView, StudentsGuardiansPage, NewsPage, NewsSinglePage, LoadingScreen } from "./components/SchoolWebsite";
import { SchoolWorkOverview, SubjectClassWorkPage } from "./components/SchoolWork";
import { SuperAdminPage } from "./components/SuperAdmin";
import { GuardianPortalPage } from "./components/GuardianPortal";
import { SchoolEditor, EditorMenu, EditorSection, EditorCategory, editorCategories, getEditorStateFromHash, setEditorHash, getEditorCategoryForSection } from "./components/SchoolEditor";
import { schoolCache, getCachedSchool } from "./lib/schoolCache";
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
import type { AboutCategory, AboutPage, AdminProfile, Assessment, AssessmentGrade, AssessmentScale, CalendarItem, ClassGroup, GlobalAboutConfig, GlobalAboutPage, GlobalSchoolWorkConfig, Guardian, NewsItem, PaymentComment, PaymentLineItem, PaymentRecord, Remark, RemarkCategory, ResourceFolder, School, SchoolChatMessage, SchoolGradeLevel, SchoolPayment, SchoolRemarkSettings, SchoolSubscription, SchoolTimetable, SchoolWorkSettings, StaffMember, Student, Subject, SubjectClass, SubjectClassAnnouncement, SubjectResource, SubmissionFile, SupportTicket, Topic } from "./types";

type Route =
  | { view: "home" }
  | { view: "login" }
  | { view: "superadmin" }
  | { view: "schoolWorkPortal"; id: string }
  | { view: "guardianPortal"; id: string }
  | { view: "about"; id: string }
  | { view: "aboutPage"; schoolId: string; pageSlug: string }
  | { view: "globalCategoryPage"; schoolId: string; categoryId: string }
  | { view: "news"; id: string }
  | { view: "newsPage"; schoolId: string; newsSlug: string }
  | { view: "studentsGuardians"; id: string }
  | { view: "school"; id: string }
  | { view: "admin"; id: string };

const EMAIL_LINK_STORAGE_KEY = "edulink-email-link-address";

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
  if (segments[0] && segments[1] === "lms") {
    return { view: "schoolWorkPortal", id: segments[0] };
  }
  if (segments[0] && segments[1] === "guardian") {
    return { view: "guardianPortal", id: segments[0] };
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

  if (route.view === "guardianPortal") {
    return <GuardianPortalPage schoolId={route.id} />;
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
    { icon: UserRound, title: "Teacher and student access", text: "Route admins, teachers, and students into the right workspace with role-aware EduLink LMS views." },
  ];
  const platformPillars = [
    "Website content management",
    "EduLink LMS",
    "Staff, learners, and guardians",
    "Assessments and resources",
    "Admin dashboards",
    "Login controls",
  ];

  const openLmsDemoView = (view: "admin" | "student") => {
    setLmsDemoChooserOpen(false);
    if (view === "admin") {
      openInNewTab(`/${sampleSchool.id}/lms?simulateRole=admin`);
      return;
    }

    const params = new URLSearchParams({ simulateRole: "student", simulateId: demoStudent?.id ?? "student-001" });
    openInNewTab(`/${sampleSchool.id}/lms?${params.toString()}`);
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
                <p>Create the school site and admin dashboard, then enable EduLink LMS for classes.</p>
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
            The homepage supports everyday school communication, while EduLink LMS gives teachers and learners
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
          <h2>EduLink LMS supports actual teaching, not just a brochure page.</h2>
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
  const [checkingAuth, setCheckingAuth] = useState(Boolean(hasFirebaseConfig && auth));
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
      setCheckingAuth(false);
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
      } else {
        setCheckingAuth(false);
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

  if (checkingAuth) {
    return <LoadingScreen />;
  }

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
          <p>School admins go to their editor. Staff and students go to EduLink LMS.</p>
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

    const staffSchool = schools.find((school) => school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail && !isStaffAccountDisabled(member) && !isStaffDeleted(member)));
    if (staffSchool) {
      navigate(`/${staffSchool.id}/lms`);
      return;
    }

    if (schools.some((school) => school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail && (isStaffAccountDisabled(member) || isStaffDeleted(member))))) {
      setStatus("This staff account is disabled.");
      return;
    }

    const studentSchool = schools.find((school) => school.students.some((student) => student.email?.toLowerCase() === normalizedEmail && !student.accountDisabled));
    if (studentSchool) {
      navigate(`/${studentSchool.id}/lms`);
      return;
    }

    if (schools.some((school) => school.students.some((student) => student.email?.toLowerCase() === normalizedEmail && student.accountDisabled))) {
      setStatus("This student account is disabled.");
      return;
    }

    const guardianSchool = schools.find((school) =>
      school.students.some(
        (student) =>
          student.guardianEmail?.toLowerCase() === normalizedEmail ||
          student.guardians?.some((g) => g.email?.toLowerCase() === normalizedEmail),
      ),
    );
    if (guardianSchool) {
      navigate(`/${guardianSchool.id}/guardian`);
      return;
    }
  }

  setStatus("You are signed in, but this email is not registered for this school.");
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
  const saveNextAttendanceRecords = async (records: import("./types").AttendanceRecord[]) => {
    const nextSchool = { ...school, attendanceRecords: records };
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
    window.history.replaceState({}, "", `/${school.id}/lms${window.location.search.replace(/([?&])subjectClassId=[^&]*/g, "$1").replace(/[?&]$/, "").replace("?&", "?")}`);
  };
  const roleLabel = identity?.role ? identity.role.charAt(0).toUpperCase() + identity.role.slice(1) : "";

  const portalContent = !identity ? (
    <div className="empty-editor-state">
      <h3>No EduLink LMS access</h3>
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
        timetable={school.timetable}
        attendanceRecords={school.attendanceRecords ?? []}
        onBack={backToSubjectClasses}
        onChange={saveNextSubjectClass}
        onSchoolWorkSettingsChange={saveNextSchoolWorkSettings}
        onRemarksChange={(nextRemarks) => void saveNextRemarks(nextRemarks)}
        onAttendanceChange={(records) => void saveNextAttendanceRecords(records)}
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
      attendanceRecords={school.attendanceRecords ?? []}
      studentId={identity.role === "student" ? identity.studentId : undefined}
      examEntries={school.examTimetable?.entries ?? []}
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
              <p>{identity ? `${identity.label} · ${roleLabel}` : "Sign in with a staff or student account to view EduLink LMS."}</p>
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
      navigate(`/${school.id}/lms?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ simulateRole: role, simulateId: id });
      navigate(`/${school.id}/lms?${params.toString()}`);
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
          {saveStatus ? <span className="admin-save-status">{saveStatus}</span> : null}
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
              <EditorMenu
                activeCategory={activeCategory}
                activeSection={activeSection}
                onChange={openEditorCategory}
                hiddenCategories={(() => {
                  if (profile?.superAdmin) return [];
                  const hidden: EditorCategory[] = [];
                  if (school.platformAdminEmail && adminUser?.email?.toLowerCase() !== school.platformAdminEmail.toLowerCase()) {
                    hidden.push("settings");
                  }
                  const currentStaff = school.staff.find((m) => m.email?.toLowerCase() === adminUser?.email?.toLowerCase());
                  if (currentStaff?.allowedAdminCategories?.length) {
                    for (const cat of editorCategories) {
                      if (!currentStaff.allowedAdminCategories.includes(cat.id) && !hidden.includes(cat.id)) {
                        hidden.push(cat.id);
                      }
                    }
                  }
                  return hidden;
                })()}
              />
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
          isSuperAdmin={Boolean(profile?.superAdmin)}
          onSimulateStaff={(staffMember) => staffMember.email ? simulateSchoolWorkUser("staff", staffMember.email) : undefined}
          onSimulateStudent={(student) => simulateSchoolWorkUser("student", student.id)}
          onBack={() => setActiveSection(null)}
          onSectionChange={openEditorSection}
        />
      </section>
    </main>
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

export default App;
