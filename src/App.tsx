import { useEffect, useMemo, useRef, useState } from "react";
import { createUserWithEmailAndPassword, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailAndPassword, signInWithEmailLink, signOut, type User } from "firebase/auth";
import {
  ArrowLeft,
  Bold,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
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
  Phone,
  Plus,
  Quote,
  Search,
  Save,
  School as SchoolIcon,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faClipboardCheck, faRulerCombined, faUser } from "@fortawesome/free-solid-svg-icons";
import { sampleSchool } from "./data/sampleSchool";
import {
  defaultGlobalAboutConfig,
  defaultGlobalSchoolWorkConfig,
  getAdminProfile,
  getGlobalAboutConfig,
  getGlobalSchoolWorkConfig,
  getLocalSchool,
  getSchool,
  listSchools,
  saveGlobalAboutConfig,
  saveGlobalSchoolWorkConfig,
  saveSchool,
  saveSuperAdminProfile,
  slugifySchoolName,
  deleteSchool
} from "./lib/schools";
import { hasFirebaseConfig } from "./lib/firebase";
import { auth } from "./lib/firebase";
import type { AboutCategory, AboutPage, AdminProfile, Assessment, AssessmentGrade, AssessmentScale, CalendarItem, ClassGroup, GlobalAboutConfig, GlobalAboutPage, GlobalSchoolWorkConfig, Guardian, NewsItem, ResourceFolder, School, SchoolGradeLevel, SchoolWorkSettings, StaffMember, Student, Subject, SubjectClass, SubjectClassAnnouncement, SubjectResource } from "./types";

type EditorSection = "profile" | "contact" | "about" | "news" | "calendar" | "staff" | "grades" | "classes" | "subjectClasses" | "subjects" | "students" | "schoolWork" | "schoolWorkSettings" | "loginSettings";
type EditorCategory = "schoolPage" | "people" | "academics" | "schoolWork" | "settings";

const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "1MB";
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
  { id: "about", label: "About" },
  { id: "news", label: "News" },
  { id: "calendar", label: "Calendar" },
  { id: "staff", label: "Staff" },
  { id: "grades", label: "Grades and years" },
  { id: "classes", label: "Classes" },
  { id: "subjectClasses", label: "Subject classes" },
  { id: "subjects", label: "Subjects" },
  { id: "students", label: "Students" },
  { id: "schoolWorkSettings", label: "School work settings" },
  { id: "schoolWork", label: "Subject class pages" },
  { id: "loginSettings", label: "Login format" },
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
    description: "Staff members, students, guardians, and learner records.",
    sections: ["staff", "students"],
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
    description: "Assessment scales, course materials, and subject class work.",
    sections: ["schoolWorkSettings", "schoolWork"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "School-level access and platform preferences.",
    sections: ["loginSettings"],
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

  const slug = useMemo(() => slugifySchoolName(schoolName) || "demo", [schoolName]);

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
      adminEmails: [normalizedEmail],
      showWebsite: true,
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
          
            <p className="eyebrow">School websites for African communities</p>
            <h1>Register a school page and manage the content in one place.</h1>
            <p>
              Each school receives a clean public website with news, calendar, contact details, leadership,
              images, and profile text that administrators can update from a focused dashboard.
            </p>
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
                <p>Create a managed page using the standard EduLink template.</p>
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
              Create page
            </button>
          </form>
        </div>
      </section>

      <section className="template-preview">
        <div>
            <img src="/edulink-logo.png" alt="EduLink Africa logo" style={{ height: 90, width: 90, marginBottom: 24, borderRadius: 16, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }} />
          <p className="eyebrow">Standard school template</p>
          <h2>Inspired by practical municipal school websites.</h2>
          <p>
            The design prioritizes quick contact information, prominent news, calendar dates, profile text,
            and a dependable footer so families find what they need fast.
          </p>
        </div>
        <SchoolMiniPreview />
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
  const matchingSchool = schools.find((school) => school.adminEmails?.map((adminEmail) => adminEmail.toLowerCase()).includes(normalizedEmail));
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
          setStatus(matchingSchool ? "Email link sign-in is not enabled for this school." : "Enter a registered school admin email to use email link sign-in.");
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
          <TextInput label="Email" value={email} onChange={setEmail} />
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
    const matchingSchool = schools.find((school) => school.adminEmails?.map((adminEmail) => adminEmail.toLowerCase()).includes(normalizedEmail));
    if (matchingSchool) {
      navigate(`/${matchingSchool.id}/admin`);
      return;
    }

    const staffSchool = schools.find((school) => school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail));
    if (staffSchool) {
      navigate(`/${staffSchool.id}/schoolwork`);
      return;
    }

    const studentSchool = schools.find((school) => school.students.some((student) => student.email?.toLowerCase() === normalizedEmail));
    if (studentSchool) {
      navigate(`/${studentSchool.id}/schoolwork`);
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

  const saveNextSubjectClass = async (nextSubjectClass: SubjectClass) => {
    const nextSchool = {
      ...school,
      subjectClasses: (school.subjectClasses ?? []).map((subjectClass) => subjectClass.id === nextSubjectClass.id ? nextSubjectClass : subjectClass),
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

  return (
    <main className="school-page">
      <SchoolHeader
        school={school}
        currentPage="students"
        hideNav={Boolean(identity)}
        actions={identity ? (
          <div className="school-header-session">
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
                  {isSimulating ? <button type="button" role="menuitem" onClick={exitSimulation}>Exit simulation</button> : null}
                  {hasFirebaseConfig && user ? <button type="button" role="menuitem" onClick={() => void logout()}>Sign out</button> : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : undefined}
      />
      <section className="school-work-portal">
        {!identity || identity.role !== "student" ? <div className="portal-heading">
          <div>
            <p className="eyebrow">SchoolWork</p>
            <h1>{school.name}</h1>
            <p>{identity ? `${identity.label} · ${identity.role}` : "Sign in with a staff or student account to view SchoolWork."}</p>
          </div>
          {hasFirebaseConfig ? (
            user ? <button className="secondary-action" type="button" onClick={() => void logout()}>Sign out</button> : (
              <button className="primary-action" type="button" onClick={() => navigate("/login")}>Login</button>
            )
          ) : null}
        </div> : null}
        {!identity ? (
          <div className="empty-editor-state">
            <h3>No SchoolWork access</h3>
            <p>This account is not registered as a staff member or student at this school.</p>
          </div>
        ) : selectedSubjectClass ? (
          <SubjectClassWorkPage
            subjectClass={selectedSubjectClass}
            subjects={school.subjects}
            students={school.students}
            assessmentScales={effectiveScales}
            accessLevel={identity.role === "student" ? "student" : identity.role === "teacher" ? "teacher" : identity.role === "viewer" ? "viewer" : "admin"}
            activeStudentId={identity.role === "student" ? identity.studentId : undefined}
            graderLabel={identity.label}
            onBack={backToSubjectClasses}
            onChange={saveNextSubjectClass}
          />
        ) : (
          <SchoolWorkOverview
            subjectClasses={identity.subjectClasses}
            subjects={school.subjects}
            classes={school.classes}
            students={school.students}
            onOpen={setActiveSubjectClassId}
          />
        )}
      </section>
      {identity?.role === "student" || identity?.role === "teacher" ? null : <SchoolFooter school={school} />}
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
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig>(defaultGlobalAboutConfig);
  const [globalSchoolWork, setGlobalSchoolWork] = useState<GlobalSchoolWorkConfig>(defaultGlobalSchoolWorkConfig);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

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
    const params = new URLSearchParams({ simulateRole: role, simulateId: id });
    if (role === "student") {
      const firstSubjectClass = (school.subjectClasses ?? []).find((subjectClass) => subjectClass.studentIds.includes(id));
      if (firstSubjectClass) {
        params.set("subjectClassId", firstSubjectClass.id);
      }
    }
    navigate(`/${school.id}/schoolwork?${params.toString()}`);
  };

  return (
    <main className="admin-page">
      <header className="admin-shell-header">
        <button className="brand-button" onClick={() => navigate("/")}>
          <GraduationCap size={28} />
          <span>EduLink Africa</span>
        </button>
        <div className="admin-actions">
          <button className="secondary-action" onClick={() => openInNewTab(`/${school.id}`)}>
            View page
          </button>
          {!adminUser ? (
            <button className="secondary-action" onClick={() => navigate("/login")}>
              Login
            </button>
          ) : null}
          {hasFirebaseConfig && adminUser ? (
            <button className="secondary-action" onClick={() => void logout()}>
              Sign out
            </button>
          ) : null}
          {saveStatus ? <span className="admin-save-status">{saveStatus}</span> : null}
        </div>
      </header>

      <section className="admin-layout">
        <aside className="admin-left-rail">
          <div className="admin-sidebar">
            <h1>{school.name}</h1>
            <div className="status-box">
              <span>Signed in</span>
              <strong>{adminUser?.email ?? "Not signed in"}</strong>
            </div>
            {profile?.superAdmin ? (
              <button className="secondary-action admin-wide-button" onClick={() => navigate("/superadmin")}>
                Superadmin dashboard
              </button>
            ) : null}
          </div>
          <EditorMenu activeCategory={activeCategory} activeSection={activeSection} onChange={openEditorCategory} />
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
  const [superAdminView, setSuperAdminView] = useState<"schools" | "globalPages" | "schoolWorkSettings" | "superAdmins">("schools");
  const [query, setQuery] = useState("");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState("");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setProfile({ uid: "local", email: "local-admin@edulink.africa", schoolIds: [sampleSchool.id], superAdmin: true });
      void refreshSchools(setSchools, setStatus);
      void getGlobalAboutConfig().then(setGlobalAbout);
      void getGlobalSchoolWorkConfig().then(setGlobalSchoolWork);
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
      });
    });
  }, []);

  const filteredSchools = schools.filter((school) => {
    const haystack = `${school.name} ${school.id} ${school.city} ${school.country}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const createSchool = async () => {
    const id = slugifySchoolName(newSchoolName);
    if (!id) {
      setStatus("Enter a school name before creating");
      return;
    }
    const nextSchool: School = {
      ...sampleSchool,
      id,
      name: newSchoolName,
      email: `office@${id}.example`,
      adminEmails: [],
      showWebsite: true,
      gradeLevels: [],
      classes: [],
      students: [],
      subjects: [],
      subjectClasses: [],
      aboutCategories: [],
      aboutPages: [],
      updatedAt: new Date().toISOString(),
    };
    setStatus("Creating school...");
    await saveSchool(nextSchool);
    setNewSchoolName("");
    await refreshSchools(setSchools, setStatus);
  };

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

    setStatus(`Adding ${normalizedEmail} as superadmin...`);
    try {
      await saveSuperAdminProfile(normalizedEmail);
      setNewSuperAdminEmail("");
      setStatus(`${normalizedEmail} can now sign in as a superadmin`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add superadmin");
    }
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
            <button className="secondary-action" onClick={() => void logout()}>
              Sign out
            </button>
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
            <strong>{adminUser?.email ?? profile?.email ?? "Not signed in"}</strong>
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
          </nav>
          {superAdminView === "schools" ? (
            <>
              <label className="field-label search-field">
                Search schools
                <span className="input-shell">
                  <Search size={18} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} />
                </span>
              </label>
              <div className="create-school-box">
                <TextInput label="Create school" value={newSchoolName} onChange={setNewSchoolName} />
                <button className="primary-action" type="button" onClick={() => void createSchool()}>
                  Create
                </button>
              </div>
            </>
          ) : null}
        </aside>

        <section className="superadmin-main">
          {superAdminView === "globalPages" ? (
            <GlobalAboutEditor config={globalAbout} onChange={setGlobalAbout} onSubmit={saveGlobalAbout} />
          ) : superAdminView === "schoolWorkSettings" ? (
            <GlobalSchoolWorkEditor config={globalSchoolWork} onChange={setGlobalSchoolWork} onSubmit={saveGlobalSchoolWork} />
          ) : superAdminView === "superAdmins" ? (
            <EditorPanel title="Superadmins">
              <div className="panel-heading global-about-heading">
                <div>
                  <p>Add another platform superadmin by email. They must sign in with this exact email address.</p>
                </div>
              </div>
              <div className="create-school-box superadmin-add-box">
                <TextInput label="Superadmin email" value={newSuperAdminEmail} onChange={setNewSuperAdminEmail} />
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
              </div>

              <section className="school-directory" aria-label="All schools">
                {filteredSchools.map((school) => (
                  <article className="school-directory-row" key={school.id}>
                    <div className="school-directory-main">
                      <span className="school-directory-icon">
                        <SchoolIcon size={22} />
                      </span>
                      <div>
                        <h3>{school.name}</h3>
                        <p>{school.type}</p>
                        <span>/{school.id}</span>
                      </div>
                    </div>
                    <div className="school-directory-meta">
                      <span>{school.city}, {school.country}</span>
                      <span>{school.adminEmails.length ? school.adminEmails.join(", ") : "No admin email"}</span>
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
                        className="remove-button"
                        type="button"
                        onClick={() => void removeSchool(school)}
                      >
                        Delete
                      </button>
                    </div>
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

  return (
    <EditorPanel title="Global about pages">
      <div className="panel-heading global-about-heading">
        <div>
          <p>These categories and pages are shown on every school's About page.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => void onSubmit()}>
          <Save size={18} />
          Save global pages
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
                  {item.kind === "staffDirectory" ? null : (
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

function GlobalSchoolWorkEditor({
  config,
  onChange,
  onSubmit,
}: {
  config: GlobalSchoolWorkConfig;
  onChange: (config: GlobalSchoolWorkConfig) => void;
  onSubmit: () => Promise<void>;
}) {
  const scales = config.assessmentScales ?? [];
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
          <p>Global default assessment scales are available to every school when teachers create assessments.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => void onSubmit()}>
          <Save size={18} />
          Save settings
        </button>
      </div>
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
  });
  const classes = school.classes ?? [];
  const gradeLevels = school.gradeLevels ?? [];
  const gradeOptions = [
    { value: "", label: "Select grade and year" },
    ...gradeLevels.map((gradeLevel) => ({ value: gradeLevel.id, label: formatGradeLevel(gradeLevel) })),
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
    gender: "",
    description: "",
    guardians: [],
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

  const createSubject = (): Subject => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  });
  const createSubjectClass = (): SubjectClass => ({
    id: `subject-class-${Date.now()}`,
    name: "New subject class",
    subjectId: "",
    gradeLevelId: "",
    baseClassId: "",
    teacherName: "",
    studentIds: [],
  });
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
        onChange={(categories) => update({ ...item, categories: categories as StaffCategory[], category: categories[0] as StaffMember["category"] | undefined })}
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
      <TextInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
      <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
      <RichTextEditor label="Body" value={item.body} onChange={(value) => update({ ...item, body: value })} />
    </>
  );
  const renderCalendarFields = (item: CalendarItem, update: (item: CalendarItem) => void) => (
    <>
      <TextInput label="Title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
      <TextInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
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
    const getSubjectClassName = (subjectId: string, gradeLevelId: string | undefined) => {
      const subjectName = subjects.find((subject) => subject.id === subjectId)?.name;
      const gradeLabel = formatGradeLevel(getGradeLevel(gradeLevelId));
      if (subjectName && gradeLabel) {
        return `${subjectName} - Grade ${gradeLabel}`;
      }
      return subjectName || (gradeLabel ? `Grade ${gradeLabel}` : "New subject class");
    };

    return (
      <>
        <TextInput label="Subject class name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
        <SelectInput
          label="Subject"
          value={item.subjectId}
          options={[
            { value: "", label: "Select subject" },
            ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
          ]}
          onChange={(value) => {
            update({
              ...item,
              subjectId: value,
              name: getSubjectClassName(value, item.gradeLevelId),
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
            update({
              ...item,
              baseClassId: value,
              gradeLevelId,
              name: getSubjectClassName(item.subjectId, gradeLevelId),
            });
          }}
        />
        <SelectInput
          label="Grade and year"
          value={item.gradeLevelId ?? ""}
          options={gradeOptions}
          onChange={(gradeLevelId) => update({
            ...item,
            gradeLevelId,
            name: getSubjectClassName(item.subjectId, gradeLevelId),
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
          <TextInput label="Date of birth" value={item.dateOfBirth ?? ""} onChange={(value) => update({ ...item, dateOfBirth: value })} />
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
          <EditorSectionCards category={activeCategoryInfo} onSelect={onSectionChange} />
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
            onOpen={(subjectClassId) => setActiveWorkSubjectClassId(subjectClassId)}
          />
        ) : null}
        {activeSection === "profile" ? (
          <EditorPanel title="School profile">
            <TextInput label="URL slug" value={school.id} onChange={(value) => setField("id", slugifySchoolName(value))} />
            <TextInput label="School name" value={school.name} onChange={(value) => setField("name", value)} />
            <TextInput label="School type" value={school.type} onChange={(value) => setField("type", value)} />
            <TextInput label="Tagline" value={school.tagline} onChange={(value) => setField("tagline", value)} />
            <TextArea label="About" value={school.about} onChange={(value) => setField("about", value)} />
            <CheckboxInput
              label="Show school website"
              checked={school.showWebsite ?? true}
              onChange={(checked) => setField("showWebsite", checked)}
            />
            <ImageUpload label="School logo" value={school.logoUrl ?? ""} onChange={(logoUrl) => setField("logoUrl", logoUrl)} variant="logo" />
            <ImageUpload label="Hero image" value={school.heroImage} onChange={(heroImage) => setField("heroImage", heroImage)} variant="hero" />
            <div className="split-fields">
              {/* MAIN COLOR */}
              <label className="field-label color-field">
                Main color
                <div className="color-input-wrapper">
                  <div
                    className="color-preview"
                    style={{ background: school.mainColor ?? "#18322e" }}
                  />
                  <input
                    type="color"
                    value={school.mainColor ?? "#18322e"}
                    onChange={(e) => setField("mainColor", e.target.value)}
                  />
                </div>
              </label>

              {/* SUB COLOR */}
              <label className="field-label color-field">
                Sub color
                <div className="color-input-wrapper">
                  <div
                    className="color-preview"
                    style={{ background: school.subColor ?? "#e0b44f" }}
                  />
                  <input
                    type="color"
                    value={school.subColor ?? "#e0b44f"}
                    onChange={(e) => setField("subColor", e.target.value)}
                  />
                </div>
              </label>
            </div>
            <TextInput label="Values, comma separated" value={school.values.join(", ")} onChange={(value) => setField("values", splitCsv(value))} />
            <TextInput
              label="Admin emails, comma separated"
              value={(school.adminEmails ?? []).join(", ")}
              onChange={(value) => setField("adminEmails", splitCsv(value).map((item) => item.toLowerCase()))}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "loginSettings" ? (
          <EditorPanel title="Settings">
            <div className="nested-editor-grid">
              <section className="sub-editor-panel">
                <h3>Login format</h3>
                <p className="editor-helper-text">Choose which sign-in methods are available for this school's registered admin emails.</p>
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
          <EditorPanel title="About">
            {globalAbout ? (
              <ReadOnlyGlobalAbout
                config={globalAbout}
                schoolPages={aboutPages}
                onLocalPageChange={(page) => {
                  const existingIndex = aboutPages.findIndex((item) => item.slug === page.slug);
                  setField("aboutPages", existingIndex >= 0
                    ? aboutPages.map((item, index) => index === existingIndex ? page : item)
                    : [...aboutPages, page]);
                }}
              />
            ) : null}
            <div className="nested-editor-grid">
              <section className="sub-editor-panel">
                <h3>Categories</h3>
                <Repeater
                  items={aboutCategories}
                  addLabel="Add category"
                  createItem={(): AboutCategory => ({ id: `about-category-${Date.now()}`, title: "New category" })}
                  onChange={(items) => {
                    const validIds = new Set(items.map((item) => item.id));
                    const validGlobalIds = new Set(globalCategories.map((item) => item.id));
                    updateSchool({
                      ...school,
                      aboutCategories: items,
                      aboutPages: aboutPages.map((page) => ({
                        ...page,
                        categoryId: validIds.has(page.categoryId) || validGlobalIds.has(page.categoryId)
                          ? page.categoryId
                          : items[0]?.id ?? globalCategories[0]?.id ?? "",
                      })),
                    });
                  }}
                  renderItem={(item, update) => (
                    <TextInput label="Category title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
                  )}
                />
              </section>

              <section className="sub-editor-panel">
                <h3>Pages</h3>
                {editableAboutCategoryOptions.length === 0 ? (
                  <div className="empty-editor-state">
                    <h3>Create a category first</h3>
                    <p>About pages must belong to a category. Add a school category or ask a superadmin to create a global category.</p>
                  </div>
                ) : (
                  <Repeater
                    items={editableAboutPages}
                    addLabel="Add page"
                    createItem={(): AboutPage => ({
                      id: `about-page-${Date.now()}`,
                      categoryId: defaultAboutCategoryId,
                      title: "New page",
                      slug: "",
                      headerImage: "",
                      body: "",
                    })}
                    onChange={(items) => setField("aboutPages", [
                      ...aboutPages.filter((page) => globalPageSlugs.has(page.slug)),
                      ...items,
                    ])}
                    renderItem={(item, update) => (
                      <>
                        <TextInput label="Page title" value={item.title} onChange={(value) => update({ ...item, title: value, slug: item.slug || value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} />
                        <TextInput label="URL slug" value={item.slug} onChange={(value) => update({ ...item, slug: value })} />
                        <SelectInput
                          label="Category"
                          value={item.categoryId}
                          options={editableAboutCategoryOptions}
                          onChange={(value) => update({ ...item, categoryId: value })}
                        />
                        <ImageUpload label="Header image" value={item.headerImage ?? ""} onChange={(headerImage) => update({ ...item, headerImage })} />
                        <RichTextEditor label="Page content" value={item.body} onChange={(value) => update({ ...item, body: value })} />
                      </>
                    )}
                  />
                )}
              </section>
            </div>
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
          <EditorPanel title="Staff">
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
              onRemove={(index) => setField("staff", school.staff.filter((_, currentIndex) => currentIndex !== index))}
            />
            {staffModalIndex !== undefined ? (
              <RegistrationModal
                title={staffModalIndex === null ? "Register staff member" : "Edit staff member"}
                eyebrow="Staff"
                submitLabel={staffModalIndex === null ? "Add staff member" : "Save staff member"}
                onClose={() => setStaffModalIndex(undefined)}
                onSubmit={() => {
                  setField("staff", staffModalIndex === null
                    ? [...school.staff, draftStaff]
                    : school.staff.map((member, index) => index === staffModalIndex ? draftStaff : member));
                  setStaffModalIndex(undefined);
                }}
              >
                {renderStaffFields(draftStaff, setDraftStaff)}
              </RegistrationModal>
            ) : null}
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
                      subjectClasses: subjectClasses.map((subjectClass) => subjectClass.gradeLevelId === removedGradeLevelId ? { ...subjectClass, gradeLevelId: "" } : subjectClass),
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
                      subjectClasses: subjectClasses.map((subjectClass) => ({
                        ...subjectClass,
                        baseClassId: subjectClass.baseClassId && validIds.has(subjectClass.baseClassId) ? subjectClass.baseClassId : "",
                      })),
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
                    subjectClasses: previousGradeLevelId
                      ? subjectClasses.map((subjectClass) => subjectClass.gradeLevelId === previousGradeLevelId ? { ...subjectClass, gradeLevelId: draftGradeLevel.id } : subjectClass)
                      : subjectClasses,
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
                      subjectClasses: subjectClasses.map((subjectClass) => ({
                        ...subjectClass,
                        baseClassId: subjectClass.baseClassId && validIds.has(subjectClass.baseClassId) ? subjectClass.baseClassId : "",
                      })),
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
                    ? [...subjectClasses, draftSubjectClass]
                    : subjectClasses.map((item, index) => index === subjectClassModalIndex ? draftSubjectClass : item));
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
                  setField("subjects", subjectModalIndex === null
                    ? [...subjects, draftSubject]
                    : subjects.map((item, index) => index === subjectModalIndex ? draftSubject : item));
                  setSubjectModalIndex(undefined);
                }}
              >
                {renderSubjectFields(draftSubject, setDraftSubject)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "schoolWorkSettings" ? (
          <EditorPanel title="School work settings">
            <div className="nested-editor-grid">
              <section className="sub-editor-panel">
                <h3>Assessment scales</h3>
                <div className="assessment-scale-toggle-list">
                  {(globalSchoolWork?.assessmentScales ?? []).map((scale) => (
                    <label className="assessment-scale-toggle" key={scale.id}>
                      <div>
                        <strong>{scale.name}</strong>
                        <small>{formatAssessmentScaleSummary(scale)}</small>
                      </div>
                      <CheckboxInput
                        label="Enabled"
                        checked={schoolWorkSettings.enabledGlobalAssessmentScaleIds.includes(scale.id)}
                        onChange={(checked) => updateSchoolWorkSettings({
                          ...schoolWorkSettings,
                          enabledGlobalAssessmentScaleIds: checked
                            ? mergeUnique([...schoolWorkSettings.enabledGlobalAssessmentScaleIds, scale.id])
                            : schoolWorkSettings.enabledGlobalAssessmentScaleIds.filter((id) => id !== scale.id),
                        })}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="sub-editor-panel">
                <h3>Custom assessment scales</h3>
                <div className="scale-editor-list">
                  <button
                    className="secondary-action repeater-add-button"
                    type="button"
                    onClick={() => updateSchoolWorkSettings({
                      ...schoolWorkSettings,
                      customAssessmentScales: [...schoolWorkSettings.customAssessmentScales, createSchoolAssessmentScale()],
                    })}
                  >
                    Add school assessment scale
                  </button>
                  {schoolWorkSettings.customAssessmentScales.length === 0 ? (
                    <div className="empty-editor-state">
                      <h3>No school-specific scales yet</h3>
                      <p>Create a custom scale here if this school should use something besides the enabled global scales.</p>
                    </div>
                  ) : schoolWorkSettings.customAssessmentScales.map((scale, scaleIndex) => (
                    <section className="sub-editor-panel assessment-scale-panel" key={scale.id}>
                      {renderAssessmentScaleFields(scale, (nextScale) => updateSchoolWorkSettings({
                        ...schoolWorkSettings,
                        customAssessmentScales: schoolWorkSettings.customAssessmentScales.map((item, index) => index === scaleIndex ? nextScale : item),
                      }))}
                      <button
                        className="remove-button"
                        type="button"
                        onClick={() => updateSchoolWorkSettings({
                          ...schoolWorkSettings,
                          customAssessmentScales: schoolWorkSettings.customAssessmentScales.filter((_, index) => index !== scaleIndex),
                        })}
                      >
                        Remove scale
                      </button>
                    </section>
                  ))}
                </div>
              </section>
            </div>
          </EditorPanel>
        ) : null}

        {isSchoolWorkPage && activeWorkSubjectClassId ? (
          <div className="school-work-detail-shell">
            <SubjectClassWorkPage
              subjectClass={subjectClasses.find((item) => item.id === activeWorkSubjectClassId) ?? null}
              subjects={subjects}
              students={students}
              assessmentScales={effectiveAssessmentScales}
              accessLevel="admin"
              graderLabel="Admin"
              onBack={() => setActiveWorkSubjectClassId(null)}
              onChange={(nextSubjectClass) => setField("subjectClasses", subjectClasses.map((item) => item.id === nextSubjectClass.id ? nextSubjectClass : item))}
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
}: {
  category: (typeof editorCategories)[number];
  onSelect: (section: EditorSection) => void;
}) {
  return (
    <section className="editor-section-picker">
      <div>
        <p className="eyebrow">{category.label}</p>
        <h2>{category.label}</h2>
        <p>{category.description}</p>
      </div>
      <div className="editor-section-card-grid">
        {category.sections.map((section) => (
          <button className="editor-section-card" key={section} type="button" onClick={() => onSelect(section)}>
            <strong>{getEditorSectionLabel(section)}</strong>
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
    staff: "Staff profiles, visibility, and contact details.",
    grades: "Register grade levels and school years.",
    classes: "Main class groups and class teachers.",
    subjectClasses: "Subject class groups with teachers and students.",
    subjects: "Subject catalog, abbreviations, and display colors.",
    schoolWorkSettings: "Enable global assessment scales and create school-specific ones.",
    schoolWork: "Course materials and assignments for subject classes.",
    loginSettings: "Choose username/password and email link sign-in options.",
    students: "Student records, guardians, and class assignments.",
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

  return (
    <div className="data-table-wrap">
      <table className="data-table student-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Class</th>
            <th>Date of birth</th>
            <th>Gender</th>
            <th>Email</th>
            <th>Guardians</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={student.id || `${student.firstName}-${student.lastName}-${index}`}>
              <td>
                <strong>{student.firstName} {student.lastName}</strong>
                {student.photoUrl ? <img className="student-table-photo" src={student.photoUrl} alt="" /> : null}
                <span>{student.id}</span>
              </td>
              <td>{getClassName(student.classId)}</td>
              <td>{student.dateOfBirth || "Not set"}</td>
              <td>{student.gender || "Not set"}</td>
              <td>{student.email || "No login email"}</td>
              <td>{getGuardianSummary(student)}</td>
              <td>{student.description || "No description"}</td>
              <td>
                <div className="table-actions">
                  {onSimulate ? (
                    <button className="secondary-action" type="button" onClick={() => onSimulate(student)}>
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
              <td>{getStaffCategories(member).join(", ")}</td>
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
                    <button className="secondary-action" type="button" onClick={() => onSimulate(member)} disabled={!member.email}>
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
              <td>{item.date}</td>
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

  return (
    <div className="data-table-wrap">
      <table className="data-table calendar-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.title}-${item.date}-${index}`}>
              <td><strong>{item.title}</strong></td>
              <td>{item.date}</td>
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

function SchoolWorkOverview({
  subjectClasses,
  subjects,
  classes,
  students,
  onOpen,
}: {
  subjectClasses: SubjectClass[];
  subjects: Subject[];
  classes: ClassGroup[];
  students: Student[];
  onOpen: (subjectClassId: string) => void;
}) {
  if (subjectClasses.length === 0) {
    return (
      <div className="empty-editor-state">
        <h3>No subject classes available</h3>
        <p>Admins can access all subject classes. Teachers see subject classes where their staff email matches the assigned teacher.</p>
      </div>
    );
  }

  return (
    <div className="school-work-card-grid">
      {subjectClasses.map((subjectClass) => {
        const subject = subjects.find((item) => item.id === subjectClass.subjectId);
        const mainClass = classes.find((item) => item.id === subjectClass.baseClassId);
        const studentCount = students.filter((student) => subjectClass.studentIds.includes(student.id)).length;
        return (
          <button
            className="school-work-card"
            key={subjectClass.id}
            type="button"
            onClick={() => onOpen(subjectClass.id)}
            style={{ "--subject-card-color": subject?.color ?? "#1f6857" } as React.CSSProperties}
          >
            <strong>{subject?.name ?? subjectClass.name}</strong>
            <span>{subjectClass.teacherName || "No teacher assigned"}</span>
            <span>{mainClass ? `${mainClass.name}${mainClass.grade ? ` · Grade ${mainClass.grade}` : ""}` : "Mixed classes"}</span>
            <small>{studentCount} student{studentCount === 1 ? "" : "s"} · {subjectClass.assessments?.length ?? 0} assessments · {subjectClass.resources?.length ?? 0} resources</small>
          </button>
        );
      })}
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
    requiresTurnIn: true,
    format: assessmentFormatOptions[0].value,
    scaleId: assessmentScales[0]?.id ?? "",
    ...(folderId ? { folderId } : {}),
    description: "",
    grades: [],
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
  onChange,
}: {
  assessment: Assessment;
  scales: AssessmentScale[];
  onChange: (assessment: Assessment) => void;
}) {
  return (
    <>
      <TextInput label="Title" value={assessment.title} onChange={(title) => onChange({ ...assessment, title })} />
      <TextInput label="Date" value={assessment.date} onChange={(date) => onChange({ ...assessment, date })} />
      <CheckboxInput
        label="Students need to turn something in"
        checked={assessment.requiresTurnIn}
        onChange={(requiresTurnIn) => onChange({ ...assessment, requiresTurnIn })}
      />
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
  const sortedAssessments = [...assessments].sort((first, second) => {
    const dateDifference = new Date(first.date).getTime() - new Date(second.date).getTime();
    return dateDifference || first.title.localeCompare(second.title);
  });
  const filteredStudents = students.filter((student) => `${student.firstName} ${student.lastName}`.toLowerCase().includes(studentSearch.trim().toLowerCase()));

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
                        <span>{assessment.date}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td><strong>{student.firstName} {student.lastName}</strong></td>
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
              <strong>Grade: {getAssessmentGradeDisplay(assessment, scales, studentId)}</strong>
              <time>Date: {assessment.date}</time>
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

  return (
    <article className="resource-list-item resource-detail-card assessment-card">
      <div className="assessment-card-heading">
        <div>
          <p className="eyebrow">{assessment.format}</p>
          <h3>{assessment.title}</h3>
          <div className="assessment-meta-list">
            <p><FontAwesomeIcon icon={faCalendarDays} fixedWidth /><strong>Date:</strong> {assessment.date}</p>
            <p><FontAwesomeIcon icon={faClipboardCheck} fixedWidth /><strong>Turn-in required:</strong> {assessment.requiresTurnIn ? "Yes" : "No"}</p>
            <p><FontAwesomeIcon icon={faRulerCombined} fixedWidth /><strong>Assessment scale:</strong> {scale?.name ?? "No scale"}</p>
          </div>
        </div>
        {!isStudentSubmitMode ? <div className="resource-detail-actions">
          <button className="secondary-action" type="button" onClick={onEdit}>Edit</button>
          <button className="remove-button" type="button" onClick={onRemove}>
            <Trash2 size={16} />
            Delete
          </button>
        </div> : null}
      </div>
      {assessment.description ? <p className="assessment-description">{assessment.description}</p> : null}
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
              <div>
                <p className="eyebrow">{getAssessmentStudentStatus(assessment, selectedGrade)}</p>
                <h3>{selectedStudent.firstName} {selectedStudent.lastName}</h3>
              </div>
              {isStudentSubmitMode && selectedGradeIsGraded ? (
                <div className="student-graded-assessment-summary">
                  <p><strong>Grade:</strong> {getAssessmentGradeDisplay(assessment, scale ? [scale] : [], selectedStudent.id)}</p>
                  <p><strong>Feedback:</strong> {selectedGrade.feedback || "No feedback yet."}</p>
                  <p><strong>Graded by:</strong> {selectedGrade.gradedBy || "Not recorded"}</p>
                  <p><strong>Graded:</strong> {selectedGrade.gradedAt ? formatDateTime(selectedGrade.gradedAt) : "Not recorded"}</p>
                </div>
              ) : isStudentSubmitMode ? (
                assessment.requiresTurnIn ? (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => onGradeChange(selectedStudent.id, { submitted: true })}
                    disabled={selectedGrade.submitted === true}
                  >
                    {selectedGrade.submitted ? "Submitted" : "Submit assignment"}
                  </button>
                ) : <p className="form-status">This assignment does not require a turn-in.</p>
              ) : assessment.requiresTurnIn ? (
                <SelectInput
                  label="Submission status"
                  value={selectedGrade.submitted ? "submitted" : "not-submitted"}
                  options={[
                    { value: "not-submitted", label: "Not submitted" },
                    { value: "submitted", label: "Submitted" },
                  ]}
                  onChange={(value) => onGradeChange(selectedStudent.id, { submitted: value === "submitted" })}
                />
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

function SubjectClassWorkPage({
  subjectClass,
  subjects,
  students,
  assessmentScales,
  accessLevel = "admin",
  activeStudentId,
  graderLabel,
  onBack,
  onChange,
}: {
  subjectClass: SubjectClass | null;
  subjects: Subject[];
  students: Student[];
  assessmentScales: AssessmentScale[];
  accessLevel?: SchoolWorkAccessLevel;
  activeStudentId?: string;
  graderLabel?: string;
  onBack: () => void;
  onChange: (subjectClass: SubjectClass) => void;
}) {
  const [activeWorkTab, setActiveWorkTab] = useState<"overview" | "resources" | "status" | "students">("resources");
  const [selectedFolderId, setSelectedFolderId] = useState("root");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [showFolderResourcePicker, setShowFolderResourcePicker] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set(["root"]));
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null>(null);
  const [draftAnnouncement, setDraftAnnouncement] = useState<Pick<SubjectClassAnnouncement, "title" | "body">>({ title: "", body: "" });
  const [assessmentModalIndex, setAssessmentModalIndex] = useState<number | null | undefined>(undefined);
  const [draftAssessment, setDraftAssessment] = useState<Assessment>(() => createAssessment(assessmentScales));
  const [selectedGradeAssessmentId, setSelectedGradeAssessmentId] = useState<string | null>(null);
  const [activeStatusView, setActiveStatusView] = useState<"assessmentRecord">("assessmentRecord");
  const committedResources = useMemo(() => subjectClass?.resources ?? [], [subjectClass?.resources]);
  const committedResourceSignature = useMemo(() => JSON.stringify(committedResources), [committedResources]);
  const pendingResourceSaveSignature = useRef<string | null>(null);
  const recordedStudentOpenKey = useRef<string | null>(null);
  const [draftResources, setDraftResources] = useState<SubjectResource[]>(committedResources);
  const [hasUnsavedResourceChanges, setHasUnsavedResourceChanges] = useState(false);

  useEffect(() => {
    if (accessLevel === "student" && activeWorkTab !== "resources" && activeWorkTab !== "status") {
      setActiveWorkTab("resources");
    }
  }, [accessLevel, activeWorkTab]);

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
  const canCreateSchoolWork = accessLevel === "admin" || accessLevel === "teacher";
  const canGradeSchoolWork = accessLevel === "admin" || accessLevel === "teacher";
  const announcements = subjectClass.announcements ?? [];
  const assessments = subjectClass.assessments ?? [];
  const subjectClassStudents = students.filter((student) => subjectClass.studentIds.includes(student.id));
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
  const folderResources = resources.filter((resource) => (resource.folderId ?? "root") === selectedTreeFolderId);
  const folderAssessments = assessments.filter((assessment) => (assessment.folderId ?? "root") === selectedTreeFolderId);
  const updateFolders = (nextFolders: ResourceFolder[]) => onChange({ ...subjectClass, resourceFolders: nextFolders });
  const updateResources = (nextResources: SubjectResource[]) => onChange({ ...subjectClass, resources: nextResources });
  const updateAssessments = (nextAssessments: Assessment[]) => onChange({ ...subjectClass, assessments: nextAssessments });
  const saveDraftAssessment = () => {
    const assessmentWithGrades = ensureAssessmentGrades(draftAssessment, subjectClassStudents);
    updateAssessments(assessmentModalIndex === null
      ? [...assessments, assessmentWithGrades]
      : assessments.map((assessment, index) => index === assessmentModalIndex ? assessmentWithGrades : assessment));
    setAssessmentModalIndex(undefined);
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
      }, ...announcements],
    });
    setDraftAnnouncement({ title: "", body: "" });
  };
  const removeAnnouncement = (announcementId: string) => {
    onChange({ ...subjectClass, announcements: announcements.filter((announcement) => announcement.id !== announcementId) });
  };
  const selectTreeFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    setSelectedResourceId(null);
    setSelectedAssessmentId(null);
    setEditingFolderId(null);
    setEditingResourceId(null);
    setShowFolderResourcePicker(false);
    setExpandedFolderIds((current) => new Set(current).add(folderId));
  };
  const selectResource = (resource: SubjectResource) => {
    setSelectedFolderId(resource.folderId ?? "root");
    setSelectedResourceId(resource.id);
    setSelectedAssessmentId(null);
    setEditingFolderId(null);
    setEditingResourceId(null);
    setShowFolderResourcePicker(false);
  };
  const selectAssessment = (assessment: Assessment) => {
    setSelectedFolderId(assessment.folderId ?? "root");
    setSelectedResourceId(null);
    setSelectedAssessmentId(assessment.id);
    setEditingFolderId(null);
    setEditingResourceId(null);
    setShowFolderResourcePicker(false);
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
  const addResource = (type: SubjectResource["type"]) => {
    const resource: SubjectResource = {
      id: `resource-${type}-${Date.now()}`,
      type,
      title: type === "note" ? "New note" : type === "link" ? "New link" : "New picture",
      createdAt: new Date().toISOString(),
      ...(activeFolderId ? { folderId: activeFolderId } : {}),
      ...(type === "note" ? { body: "" } : type === "link" ? { url: "https://" } : { imageDataUrl: "", description: "" }),
    };
    const nextResources = [...committedResources, resource];
    updateResources(nextResources);
    setDraftResources(nextResources);
    setHasUnsavedResourceChanges(false);
    setShowFolderResourcePicker(false);
  };
  const updateResource = (resourceId: string, patch: Partial<SubjectResource>) => {
    setDraftResources(resources.map((resource) => resource.id === resourceId ? { ...resource, ...patch } : resource));
    setHasUnsavedResourceChanges(true);
  };
  const uploadPictureResourceImage = async (resourceId: string, file: File | undefined) => {
    if (!file) {
      return;
    }
    const imageDataUrl = await prepareImageUpload(file, { maxWidth: 1200, maxHeight: 900, quality: 0.84 });
    updateResource(resourceId, { imageDataUrl });
  };
  const removeFolder = (folderId: string) => {
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
    updateFolders(folders.filter((folder) => !idsToRemove.has(folder.id)));
    const nextResources = committedResources.filter((resource) => !resource.folderId || !idsToRemove.has(resource.folderId));
    const nextAssessments = assessments.filter((assessment) => !assessment.folderId || !idsToRemove.has(assessment.folderId));
    updateResources(nextResources);
    updateAssessments(nextAssessments);
    setDraftResources(nextResources);
    setHasUnsavedResourceChanges(false);
    setSelectedAssessmentId(null);
    setSelectedFolderId("root");
    setShowFolderResourcePicker(false);
  };
  const removeResource = (resourceId: string) => {
    const nextResources = committedResources.filter((resource) => resource.id !== resourceId);
    updateResources(nextResources);
    setDraftResources(nextResources);
    setHasUnsavedResourceChanges(false);
    setShowFolderResourcePicker(false);
  };
  const removeAssessment = (assessmentId: string) => {
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
  const addAssessmentResource = () => {
    const assessment = createAssessment(assessmentScales, activeFolderId);
    updateAssessments([...assessments, ensureAssessmentGrades(assessment, subjectClassStudents)]);
    setSelectedAssessmentId(assessment.id);
    setSelectedResourceId(null);
    setShowFolderResourcePicker(false);
  };
  const resourceTypePicker = (
    <div className="resource-type-grid">
      <button className="resource-type-card" type="button" onClick={addFolder}>
        <Folder size={34} />
        <span>
          <strong>Folder</strong>
          <small>Organise content into a course structure.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => addResource("note")}>
        <FileText size={34} />
        <span>
          <strong>Note</strong>
          <small>Create simple text notes for learners.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => addResource("link")}>
        <Link2 size={34} />
        <span>
          <strong>Link</strong>
          <small>Add an external learning resource.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={() => addResource("picture")}>
        <Image size={34} />
        <span>
          <strong>Picture with description</strong>
          <small>Upload an image and add learner-facing context.</small>
        </span>
      </button>
      <button className="resource-type-card" type="button" onClick={addAssessmentResource}>
        <ClipboardCheck size={34} />
        <span>
          <strong>Assessment</strong>
          <small>Create work to grade students and provide feedback.</small>
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
                    <button className="resource-tree-label" type="button" onClick={() => selectTreeFolder(folder.id)}>
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
                {resource.type === "note" ? <FileText size={16} /> : <Link2 size={16} />}
                <span>{resource.title}</span>
              </button>
            ))}
            {childAssessments.map((assessment) => (
              <button
                className={[
                  "resource-tree-item resource-tree-resource",
                  selectedAssessmentId === assessment.id ? "active-resource-tree-item" : "",
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
              </button>
            ))}
            {canCreateSchoolWork && (parentId !== "root" || (children.length === 0 && childResources.length === 0 && childAssessments.length === 0)) ? (
              <button
                className="resource-tree-item resource-tree-add-resource"
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
        <button className="school-work-back-link" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to subject classes
        </button>
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
          <strong>{subjectClass.name}</strong>
        </span>
        <span className="subject-work-nav-tabs">
          {accessLevel !== "student" ? <button className={activeWorkTab === "overview" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("overview")}>Overview</button> : null}
          <button className={activeWorkTab === "resources" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("resources")}>Resources</button>
          <button className={activeWorkTab === "status" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("status")}>Status and follow-up</button>
          {accessLevel !== "student" ? <button className={activeWorkTab === "students" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("students")}>Students</button> : null}
        </span>
        <span className="subject-work-nav-spacer" aria-hidden="true" />
      </nav>
      {activeWorkTab === "overview" ? (
        <section className="subject-overview-panel">
          <div className="subject-announcement-composer">
            <h3>Announcements</h3>
            <TextInput
              label="Title"
              value={draftAnnouncement.title}
              onChange={(title) => setDraftAnnouncement((current) => ({ ...current, title }))}
            />
            <TextArea
              label="Announcement"
              value={draftAnnouncement.body}
              onChange={(body) => setDraftAnnouncement((current) => ({ ...current, body }))}
            />
            <button className="secondary-action" type="button" onClick={postAnnouncement}>
              Post announcement
            </button>
          </div>
          <div className="subject-announcement-list">
            {announcements.length === 0 ? (
              <div className="empty-editor-state">
                <h3>No announcements yet</h3>
                <p>Post announcements for this subject class here.</p>
              </div>
            ) : announcements.map((announcement) => (
              <article className="subject-announcement-card" key={announcement.id}>
                <div>
                  <h3>{announcement.title}</h3>
                  <time>{formatDate(announcement.createdAt)}</time>
                </div>
                <p>{announcement.body}</p>
                <button className="remove-button" type="button" onClick={() => removeAnnouncement(announcement.id)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {activeWorkTab === "status" ? (
        <section className="status-followup-page">
          {accessLevel === "student" ? (
            <StudentGradebookView assessments={assessments} scales={assessmentScales} studentId={activeStudentId} />
          ) : (
            <>
              <nav className="status-followup-menu" aria-label="Status and follow-up sections">
                <button
                  className={activeStatusView === "assessmentRecord" && !selectedGradeAssessmentId ? "active-status-followup-menu-item" : ""}
                  type="button"
                  onClick={() => {
                    setActiveStatusView("assessmentRecord");
                    setSelectedGradeAssessmentId(null);
                  }}
                >
                  Assessment record
                </button>
              </nav>
              {selectedGradeAssessmentId ? (() => {
            const selectedAssessment = assessments.find((assessment) => assessment.id === selectedGradeAssessmentId);
            if (!selectedAssessment) {
              return (
                <div className="empty-editor-state">
                  <h3>Assessment not found</h3>
                  <button className="secondary-action" type="button" onClick={() => setSelectedGradeAssessmentId(null)}>Back to assessment record</button>
                </div>
              );
            }
            return (
              <div className="assessment-detail-page">
                <div className="editor-back-row">
                  <button className="secondary-action" type="button" onClick={() => setSelectedGradeAssessmentId(null)}>
                    Back to assessment record
                  </button>
                </div>
                <AssessmentResourceDetail
                  assessment={selectedAssessment}
                  scale={assessmentScales.find((scale) => scale.id === selectedAssessment.scaleId) ?? assessmentScales[0]}
                  students={subjectClassStudents}
                  onEdit={() => {
                    const assessmentIndex = assessments.findIndex((item) => item.id === selectedAssessment.id);
                    setDraftAssessment(ensureAssessmentGrades(selectedAssessment, subjectClassStudents));
                    setAssessmentModalIndex(assessmentIndex >= 0 ? assessmentIndex : null);
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
                <GradebookView
                  assessments={assessments}
                  scales={assessmentScales}
                  students={subjectClassStudents}
                  onOpenAssessment={setSelectedGradeAssessmentId}
                />
              )}
            </>
          )}
        </section>
      ) : null}
      {assessmentModalIndex !== undefined ? (
        <RegistrationModal
          title={assessmentModalIndex === null ? "Create assessment" : "Edit assessment"}
          eyebrow="Assessment"
          submitLabel={assessmentModalIndex === null ? "Create assessment" : "Save assessment"}
          onClose={() => setAssessmentModalIndex(undefined)}
          onSubmit={saveDraftAssessment}
        >
          <AssessmentFields
            assessment={draftAssessment}
            scales={assessmentScales}
            onChange={setDraftAssessment}
          />
        </RegistrationModal>
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
            <button className="resource-tree-label" type="button" onClick={() => selectTreeFolder("root")}>
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
                  editingFolderId === activeFolder.id ? (
                    <div className="resource-folder-fields">
                      <input
                        className="resource-folder-title-input"
                        value={activeFolder.name}
                        onChange={(event) => updateFolders(folders.map((folder) => folder.id === activeFolder.id ? { ...folder, name: event.target.value } : folder))}
                      />
                      <TextArea
                        label="Folder description"
                        value={activeFolder.description ?? ""}
                        onChange={(description) => updateFolders(folders.map((folder) => folder.id === activeFolder.id ? { ...folder, description } : folder))}
                      />
                    </div>
                  ) : (
                    <div className="resource-folder-readonly">
                      <h3>{activeFolder.name}</h3>
                      {activeFolder.description ? <p>{activeFolder.description}</p> : null}
                    </div>
                  )
                ) : (
                  <h3>{subjectClass.name}</h3>
                )}
              </div>
            ) : null}
            {canCreateSchoolWork && activeFolder && !selectedResource && !selectedAssessment ? (
              <div className="resource-detail-actions">
                {editingFolderId === activeFolder.id ? (
                  <button className="secondary-action" type="button" onClick={() => setEditingFolderId(null)}>
                    Done
                  </button>
                ) : (
                  <button className="secondary-action" type="button" onClick={() => setEditingFolderId(activeFolder.id)}>
                    Edit
                  </button>
                )}
                <button className="remove-button resource-remove-button" type="button" onClick={() => removeFolder(activeFolder.id)}>
                  <Trash2 size={16} />
                  Delete folder
                </button>
              </div>
            ) : null}
          </div>

          <div className="resource-content-list">
            {selectedResource ? (
              <article className="resource-list-item resource-detail-card">
                <div className="resource-list-item-heading">
                  {selectedResource.type === "note" ? <FileText size={22} /> : selectedResource.type === "link" ? <Link2 size={22} /> : <Image size={22} />}
                  {selectedResource.type === "note" && editingResourceId !== selectedResource.id ? <span /> : <strong>{selectedResource.title}</strong>}
                  {canCreateSchoolWork ? <div className="resource-detail-actions">
                    {editingResourceId === selectedResource.id ? (
                      <button className="secondary-action" type="button" onClick={saveResourceChanges} disabled={!hasUnsavedResourceChanges}>
                        <Save size={16} />
                        Save
                      </button>
                    ) : (
                      <button className="secondary-action" type="button" onClick={() => setEditingResourceId(selectedResource.id)}>
                        Edit
                      </button>
                    )}
                    <button className="remove-button" type="button" onClick={() => {
                      removeResource(selectedResource.id);
                      setSelectedResourceId(null);
                      setEditingResourceId(null);
                    }}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div> : null}
                </div>
                {canCreateSchoolWork && editingResourceId === selectedResource.id ? (
                  <>
                    <TextInput label="Title" value={selectedResource.title} onChange={(title) => updateResource(selectedResource.id, { title })} />
                    {selectedResource.type === "link" ? (
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
                    ) : (
                      <TextArea label="Note" value={selectedResource.body ?? ""} onChange={(body) => updateResource(selectedResource.id, { body })} />
                    )}
                  </>
                ) : (
                  <div className={selectedResource.type === "note" ? "resource-note-readonly" : "resource-readonly-content"}>
                    {selectedResource.type === "link" ? (
                      selectedResource.url ? <a href={selectedResource.url} target="_blank" rel="noreferrer">{selectedResource.url}</a> : <span>No URL added.</span>
                    ) : selectedResource.type === "picture" ? (
                      <div className="resource-picture-readonly">
                        {selectedResource.imageDataUrl ? <img src={selectedResource.imageDataUrl} alt="" /> : <span>No picture uploaded.</span>}
                        <p>{selectedResource.description || "No description yet."}</p>
                      </div>
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
              <AssessmentResourceDetail
                assessment={selectedAssessment}
                scale={assessmentScales.find((scale) => scale.id === selectedAssessment.scaleId) ?? assessmentScales[0]}
                students={subjectClassStudents}
                onEdit={() => {
                  if (!canGradeSchoolWork) {
                    return;
                  }
                  const assessmentIndex = assessments.findIndex((assessment) => assessment.id === selectedAssessment.id);
                  setDraftAssessment(ensureAssessmentGrades(selectedAssessment, subjectClassStudents));
                  setAssessmentModalIndex(assessmentIndex >= 0 ? assessmentIndex : null);
                }}
                onRemove={() => canGradeSchoolWork ? removeAssessment(selectedAssessment.id) : undefined}
                onGradeChange={(studentId, patch) => updateAssessmentGrade(selectedAssessment.id, studentId, patch)}
                mode={accessLevel === "student" ? "student-submit" : "grade"}
                activeStudentId={activeStudentId}
              />
            ) : (
              <>
                {oneLevelUpTargetId || canCreateSchoolWork ? (
                  <div className={`resource-save-row ${oneLevelUpTargetId ? "has-one-level-up" : ""}`}>
                    {oneLevelUpTargetId ? (
                      <button className="resource-one-level-up" type="button" onClick={() => selectTreeFolder(oneLevelUpTargetId)}>
                        <ArrowLeft size={16} />
                        <span>One level up</span>
                        {oneLevelUpLabel ? <small>{oneLevelUpLabel}</small> : null}
                      </button>
                    ) : <span />}
                    {canCreateSchoolWork ? (
                      <button className="secondary-action" type="button" onClick={saveResourceChanges} disabled={!hasUnsavedResourceChanges}>
                        <Save size={16} />
                        Save resource changes
                      </button>
                    ) : null}
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
                      <article className="resource-list-item folder-resource-item resource-preview-item" key={resource.id}>
                        <button type="button" onClick={() => selectResource(resource)}>
                          {resource.type === "note" ? <FileText size={22} /> : resource.type === "link" ? <Link2 size={22} /> : <Image size={22} />}
                          <span>
                            <strong>{resource.title}</strong>
                            <small>
                              {resource.type === "link"
                                ? resource.url || "No URL added"
                                : resource.type === "picture"
                                  ? resource.description || "No description yet"
                                  : resource.body || "No note content yet"}
                            </small>
                          </span>
                        </button>
                      </article>
                    ))}
                    {folderAssessments.map((assessment) => (
                      <article className="resource-list-item folder-resource-item resource-preview-item" key={assessment.id}>
                        <button type="button" onClick={() => selectAssessment(assessment)}>
                          <ClipboardCheck size={22} />
                          <span>
                            <strong>{assessment.title}</strong>
                            <small>{assessment.date} · {assessment.format} · {assessment.requiresTurnIn ? "Turn-in required" : "No turn-in required"}</small>
                          </span>
                        </button>
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
    </div>
  );
}

function canManageSchool(profile: AdminProfile | null, schoolId: string, userEmail?: string | null, school?: School) {
  if (profile?.superAdmin || profile?.schoolIds.includes(schoolId)) {
    return true;
  }

  const normalizedEmail = userEmail?.toLowerCase();
  return Boolean(normalizedEmail && school?.adminEmails?.map((adminEmail) => adminEmail.toLowerCase()).includes(normalizedEmail));
}

function canTeachAnySubjectClass(school: School, userEmail?: string | null) {
  return (school.subjectClasses ?? []).some((subjectClass) => canTeachSubjectClass(school, subjectClass, userEmail));
}

function canTeachSubjectClass(school: School, subjectClass: SubjectClass, userEmail?: string | null) {
  const normalizedEmail = userEmail?.toLowerCase();
  if (!normalizedEmail || !subjectClass.teacherName) {
    return false;
  }
  return school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail && member.name === subjectClass.teacherName && hasStaffCategory(member, "Teacher"));
}

function getStaffCategories(member: StaffMember): StaffCategory[] {
  const categories = member.categories?.length ? member.categories : [member.category ?? "Other"];
  return mergeUnique(categories) as StaffCategory[];
}

function hasStaffCategory(member: StaffMember, category: StaffCategory) {
  return getStaffCategories(member).includes(category);
}

function getSchoolWorkIdentity(school: School, userEmail: string | null, profile: AdminProfile | null): SchoolWorkIdentity | null {
  const params = new URLSearchParams(window.location.search);
  const simulateRole = params.get("simulateRole");
  const simulateId = params.get("simulateId");
  const subjectClasses = school.subjectClasses ?? [];
  const canSimulate = !hasFirebaseConfig || canManageSchool(profile, school.id, userEmail, school);

  if (canSimulate && simulateRole === "staff" && simulateId) {
    const staffMember = school.staff.find((member) => member.email?.toLowerCase() === simulateId.toLowerCase());
    if (staffMember) {
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
    if (student) {
      return {
        role: "student",
        label: `${student.firstName} ${student.lastName}`,
        studentId: student.id,
        subjectClasses: subjectClasses.filter((subjectClass) => subjectClass.studentIds.includes(student.id)),
      };
    }
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

  const staffMember = school.staff.find((member) => member.email?.toLowerCase() === normalizedEmail);
  if (staffMember) {
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
  if (student) {
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
    customAssessmentScales: [],
  };
  return [
    ...globalSchoolWork.assessmentScales.filter((scale) => settings.enabledGlobalAssessmentScaleIds.includes(scale.id)),
    ...settings.customAssessmentScales,
  ];
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
  const schoolName = school?.name;
  const schoolLogoUrl = school?.logoUrl;

  useEffect(() => {
    if (!schoolName) {
      setDocumentBrand();
      return;
    }

    setDocumentBrand(schoolName, schoolLogoUrl);
    return () => setDocumentBrand();
  }, [schoolLogoUrl, schoolName]);
}

function setDocumentBrand(title = "EduLink Africa", faviconHref = "/edulink-logo.png") {
  document.title = title;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.type = faviconHref.startsWith("data:") ? faviconHref.slice(5, faviconHref.indexOf(";")) || "image/png" : "image/png";
  favicon.href = faviconHref;
}

function SchoolHeader({
  school,
  currentPage,
  hideNav = false,
  actions,
}: {
  school: School;
  currentPage?: string;
  hideNav?: boolean;
  actions?: React.ReactNode;
}) {
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
        <a href="#contact" className={currentPage === "contact" ? "active" : ""}>Contact</a>
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

function TextInput({ label, value, onChange, icon }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode }) {
  return (
    <label className="field-label">
      {label}
      <span className="input-shell">
        {icon}
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
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

function CheckboxInput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
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
          <button className="secondary-action" type="button" onClick={onClose}>
            Close
          </button>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: "wide" | "square" | "hero" | "logo" | "strictSquare";
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
          ? { requireSquare: true, maxWidth: 512, maxHeight: 512, quality: 0.88 }
          : variant === "square"
            ? { cropSquare: true, maxWidth: 512, maxHeight: 512, quality: 0.82 }
            : { maxWidth: 1600, maxHeight: 900, quality: 0.84 });
      onChange(nextImage);
      setStatus("Image ready. Save changes to publish it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  return (
    <div className="field-label image-upload-field">
      <span>{label}</span>
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
  }: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    cropSquare?: boolean;
    requireSquare?: boolean;
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
          resolve(canvas.toDataURL("image/jpeg", quality));
          return;
        }

        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL("image/jpeg", quality));
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
    name: "School page",
    tagline: "",
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
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
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
