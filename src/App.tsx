import { useEffect, useMemo, useRef, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  Bold,
  CalendarDays,
  ChevronRight,
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
import { sampleSchool } from "./data/sampleSchool";
import {
  defaultGlobalAboutConfig,
  getAdminProfile,
  getGlobalAboutConfig,
  getLocalSchool,
  getSchool,
  listSchools,
  saveGlobalAboutConfig,
  saveSchool,
  slugifySchoolName,
  deleteSchool
} from "./lib/schools";
import { hasFirebaseConfig } from "./lib/firebase";
import { auth } from "./lib/firebase";
import type { AboutCategory, AboutPage, AdminProfile, CalendarItem, ClassGroup, GlobalAboutConfig, GlobalAboutPage, Guardian, NewsItem, ResourceFolder, School, StaffMember, Student, Subject, SubjectClass, SubjectClassAnnouncement, SubjectResource } from "./types";

type EditorSection = "profile" | "contact" | "about" | "news" | "calendar" | "staff" | "classes" | "subjects" | "students" | "schoolWork";
type EditorCategory = "schoolPage" | "people" | "academics" | "schoolWork";

const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "1MB";
const schoolCache = new Map<string, School>();
let globalAboutCache: GlobalAboutConfig | null = null;
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
  { id: "classes", label: "Classes" },
  { id: "subjects", label: "Subjects" },
  { id: "students", label: "Students" },
  { id: "schoolWork", label: "Subject class pages" },
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
    description: "Main classes, subject classes, and subject catalog.",
    sections: ["classes", "subjects"],
  },
  {
    id: "schoolWork",
    label: "School work",
    description: "Course materials and assignments for subject classes.",
    sections: ["schoolWork"],
  },
];

type Route =
  | { view: "home" }
  | { view: "login" }
  | { view: "superadmin" }
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

  if (route.view === "school") {
    return <SchoolPage schoolId={route.id} />;
  }

  if (route.view === "admin") {
    return <AdminPage schoolId={route.id} />;
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
  const [mode, setMode] = useState<"sign-in" | "create-account">("sign-in");
  const [status, setStatus] = useState("Sign in with your EduLink admin account.");

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      if (user) {
        void redirectSignedInUser(user, setStatus);
      }
    });
  }, []);

  const submit = async () => {
    if (!hasFirebaseConfig || !auth) {
      navigate("/superadmin");
      return;
    }

    try {
      setStatus(mode === "sign-in" ? "Signing in..." : "Creating account...");
      const normalizedEmail = email.trim().toLowerCase();
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
          <p>School admins go straight to their school editor. Superadmins go to the platform dashboard.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextInput label="Email" value={email} onChange={setEmail} />
          <label className="field-label">
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <p className="form-status">{status}</p>
          <button className="primary-action" type="submit">
            <LogIn size={18} />
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          <button
            className="secondary-action login-mode-button"
            type="button"
            onClick={() => setMode((current) => (current === "sign-in" ? "create-account" : "sign-in"))}
          >
            {mode === "sign-in" ? "Create admin account" : "Use existing account"}
          </button>
        </form>
      </section>
    </main>
  );
}

async function redirectSignedInUser(user: User, setStatus: (status: string) => void) {
  const profile = await getAdminProfile(user.uid);

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
  }

  setStatus("You are signed in, but this email is not registered as a school admin.");
}

function SchoolPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));

  useEffect(() => {
    void loadSchoolForPublicPage(schoolId, setSchool);
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
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

  if (!school) {
    return <LoadingScreen />;
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

  if (!school) {
    return <LoadingScreen />;
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
      { title: "Administration", staff: staff.filter((member) => member.category === "Administration") },
      { title: "Teachers", staff: staff.filter((member) => member.category === "Teacher") },
      { title: "Other", staff: staff.filter((member) => !member.category || member.category === "Other") },
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

  if (!school) {
    return <LoadingScreen />;
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

function NewsPage({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getCachedSchool(schoolId));

  useEffect(() => {
    void loadSchoolForPublicPage(schoolId, setSchool);
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
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

  if (!school) {
    return <LoadingScreen />;
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
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig()]).then(([remoteSchool, nextGlobalAbout]) => {
      setSchool(getLocalSchool(schoolId) ?? remoteSchool);
      setGlobalAbout(nextGlobalAbout);
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
      void getAdminProfile(user.uid).then((nextProfile) => {
        setProfile(nextProfile);
      });
    });
  }, [schoolId]);

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
          onChange={setSchool}
          onSubmit={submit}
          onAutoSave={saveNextSchool}
          activeCategory={activeCategory}
          activeSection={activeSection}
          currentUserEmail={adminUser?.email ?? null}
          canAccessAllSubjectClasses={canManageSchool(profile, school.id, adminUser?.email, school)}
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
  const [superAdminView, setSuperAdminView] = useState<"schools" | "globalPages">("schools");
  const [query, setQuery] = useState("");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setProfile({ uid: "local", email: "local-admin@edulink.africa", schoolIds: [sampleSchool.id], superAdmin: true });
      void refreshSchools(setSchools, setStatus);
      void getGlobalAboutConfig().then(setGlobalAbout);
      return undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      if (!user) {
        setStatus("Sign in from /login to access superadmin tools");
        setProfile(null);
        return;
      }

      void getAdminProfile(user.uid).then((nextProfile) => {
        setProfile(nextProfile);
        if (!nextProfile?.superAdmin) {
          setStatus("This account is not a superadmin");
          return;
        }
        void refreshSchools(setSchools, setStatus);
        void getGlobalAboutConfig().then(setGlobalAbout);
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
  onChange,
  onSubmit,
  onAutoSave,
  activeCategory,
  activeSection,
  currentUserEmail,
  canAccessAllSubjectClasses,
  onBack,
  onSectionChange,
}: {
  school: School;
  globalAbout?: GlobalAboutConfig;
  onChange: (school: School) => void;
  onSubmit: () => Promise<void>;
  onAutoSave?: (school: School) => Promise<void>;
  activeCategory: EditorCategory;
  activeSection: EditorSection | null;
  currentUserEmail?: string | null;
  canAccessAllSubjectClasses?: boolean;
  onBack: () => void;
  onSectionChange: (section: EditorSection) => void;
}) {
  const createStaffMember = (): StaffMember => ({
    name: "Staff name",
    role: "Role",
    category: "Teacher",
    visibleOnHomePage: true,
    visibleOnStaffPage: true,
  });
  const createClassGroup = (): ClassGroup => ({ id: `class-${Date.now()}`, name: "New class", grade: "", teacher: "" });
  const classes = school.classes ?? [];
  const students = school.students ?? [];
  const subjects = school.subjects ?? [];
  const subjectClasses = school.subjectClasses ?? [];
  const accessibleSubjectClasses = subjectClasses.filter((subjectClass) => canAccessAllSubjectClasses || canTeachSubjectClass(school, subjectClass, currentUserEmail));
  const [activeWorkSubjectClassId, setActiveWorkSubjectClassId] = useState<string | null>(null);
  const aboutCategories = school.aboutCategories ?? [];
  const aboutPages = school.aboutPages ?? [];
  const createStudent = (): Student => ({
    id: `student-${Date.now()}`,
    firstName: "First name",
    lastName: "Last name",
    classId: classes[0]?.id ?? "",
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
  const [classModalIndex, setClassModalIndex] = useState<number | null | undefined>(undefined);
  const [subjectClassModalIndex, setSubjectClassModalIndex] = useState<number | null | undefined>(undefined);
  const [subjectModalIndex, setSubjectModalIndex] = useState<number | null | undefined>(undefined);
  const [studentModalIndex, setStudentModalIndex] = useState<number | null | undefined>(undefined);
  const [draftNews, setDraftNews] = useState<NewsItem>(() => createNewsItem());
  const [draftCalendar, setDraftCalendar] = useState<CalendarItem>(() => createCalendarItem());
  const [draftStaff, setDraftStaff] = useState<StaffMember>(() => createStaffMember());
  const [draftClass, setDraftClass] = useState<ClassGroup>(() => createClassGroup());
  const [draftStudent, setDraftStudent] = useState<Student>(() => createStudent());
  const [draftSubject, setDraftSubject] = useState<Subject>(() => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  }));
  const updateSchool = (nextSchool: School) => {
    onChange(nextSchool);
    void onAutoSave?.(nextSchool);
  };
  const setField = <K extends keyof School>(field: K, value: School[K]) => {
    updateSchool({ ...school, [field]: value });
  };

  const createSubject = (): Subject => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    abbreviation: "",
    color: subjectColorOptions[0],
  });
  const createSubjectClass = (): SubjectClass => ({
    id: `subject-class-${Date.now()}`,
    name: subjects[0] && classes[0] ? `${subjects[0].name} - ${classes[0].name}` : "New subject class",
    subjectId: subjects[0]?.id ?? "",
    baseClassId: classes[0]?.id ?? "",
    teacherName: "",
    studentIds: [],
  });
  const [draftSubjectClass, setDraftSubjectClass] = useState<SubjectClass>(() => createSubjectClass());
  const staffOptions = [
    { value: "", label: "Select staff member" },
    ...school.staff.map((member) => ({ value: member.name, label: `${member.name} - ${member.role}` })),
  ];
  const staffCategoryOptions: Array<{ value: StaffMember["category"]; label: string }> = [
    { value: "Teacher", label: "Teacher" },
    { value: "Administration", label: "Administration" },
    { value: "Other", label: "Other" },
  ];
  const renderStaffFields = (item: StaffMember, update: (item: StaffMember) => void) => (
    <>
      <TextInput label="Name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <SelectInput
        label="Category"
        value={item.category ?? "Other"}
        options={staffCategoryOptions}
        onChange={(value) => update({ ...item, category: value as StaffMember["category"] })}
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
  const renderClassFields = (item: ClassGroup, update: (item: ClassGroup) => void) => (
    <>
      <TextInput label="Main class name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <TextInput label="Grade" value={item.grade ?? ""} onChange={(value) => update({ ...item, grade: value })} />
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
            const subject = subjects.find((currentSubject) => currentSubject.id === value);
            update({
              ...item,
              subjectId: value,
              name: item.name === "New subject class" && subject ? subject.name : item.name,
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
          onChange={(value) => update({ ...item, baseClassId: value })}
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
  const renderStudentFields = (item: Student, update: (item: Student) => void) => (
    <>
      <div className="split-fields">
        <TextInput label="First name" value={item.firstName} onChange={(value) => update({ ...item, firstName: value })} />
        <TextInput label="Last name" value={item.lastName} onChange={(value) => update({ ...item, lastName: value })} />
      </div>
      <SelectInput
        label="Class"
        value={item.classId}
        options={classes.map((classGroup) => ({ value: classGroup.id, label: classGroup.name }))}
        onChange={(value) => update({ ...item, classId: value })}
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

        {activeSection === "classes" ? (
          <EditorPanel title="Classes">
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
            <ClassTable
              classes={classes}
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
            <div className="section-heading compact-section-heading">
              <h2>Subject classes</h2>
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
            ) : subjectClasses.length === 0 ? (
              <div className="empty-editor-state">
                <h3>No subject classes yet</h3>
                <p>Add a subject class to create a course group such as Math for 8A or a mixed student group.</p>
              </div>
            ) : (
              <div className="repeater">
                {subjectClasses.map((item, index) => (
                  <div className="repeater-item" key={item.id}>
                    <div className="subject-summary">
                      <strong>{item.name}</strong>
                      <span>{subjects.find((subject) => subject.id === item.subjectId)?.name ?? "No subject"} · {item.teacherName || "No teacher assigned"} · {item.studentIds.length} student{item.studentIds.length === 1 ? "" : "s"}</span>
                    </div>
                    <button
                      className="secondary-action repeater-add-button"
                      type="button"
                      onClick={() => {
                        setDraftSubjectClass(item);
                        setSubjectClassModalIndex(index);
                      }}
                    >
                      Edit
                    </button>
                    <button className="remove-button" type="button" onClick={() => setField("subjectClasses", subjectClasses.filter((_, currentIndex) => currentIndex !== index))}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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

        {isSchoolWorkPage && activeWorkSubjectClassId ? (
          <div className="school-work-detail-shell">
            <SubjectClassWorkPage
              subjectClass={subjectClasses.find((item) => item.id === activeWorkSubjectClassId) ?? null}
              subjects={subjects}
              students={students}
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
                    setDraftStudent(createStudent());
                    setStudentModalIndex(null);
                  }}
                >
                  Add student
                </button>
                <StudentTable
                  students={students}
                  classes={classes}
                  onEdit={(student, index) => {
                    setDraftStudent(student);
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
                    onClose={() => setStudentModalIndex(undefined)}
                    onSubmit={() => {
                      setField("students", studentModalIndex === null
                        ? [...students, draftStudent]
                        : students.map((student, index) => index === studentModalIndex ? draftStudent : student));
                      setStudentModalIndex(undefined);
                    }}
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
    classes: "Main classes and subject classes with student groups.",
    subjects: "Subject catalog, abbreviations, and display colors.",
    schoolWork: "Course materials and assignments for subject classes.",
    students: "Student records, guardians, and class assignments.",
  };
  return descriptions[section];
}

function StudentTable({
  students,
  classes,
  onEdit,
  onRemove,
}: {
  students: Student[];
  classes: ClassGroup[];
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
                <span>{student.id}</span>
              </td>
              <td>{getClassName(student.classId)}</td>
              <td>{student.dateOfBirth || "Not set"}</td>
              <td>{student.gender || "Not set"}</td>
              <td>{getGuardianSummary(student)}</td>
              <td>{student.description || "No description"}</td>
              <td>
                <div className="table-actions">
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

function ClassTable({
  classes,
  students,
  subjectClasses,
  onEdit,
  onRemove,
}: {
  classes: ClassGroup[];
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
              <td>{classGroup.grade || "Not set"}</td>
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

function StaffTable({
  staff,
  onEdit,
  onRemove,
}: {
  staff: StaffMember[];
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
              <td>{member.category ?? "Other"}</td>
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
            <small>{studentCount} student{studentCount === 1 ? "" : "s"} · {subjectClass.resourceFolders?.length ?? 0} folders · {subjectClass.resources?.length ?? 0} resources</small>
          </button>
        );
      })}
    </div>
  );
}

function SubjectClassWorkPage({
  subjectClass,
  subjects,
  students,
  onBack,
  onChange,
}: {
  subjectClass: SubjectClass | null;
  subjects: Subject[];
  students: Student[];
  onBack: () => void;
  onChange: (subjectClass: SubjectClass) => void;
}) {
  const [activeWorkTab, setActiveWorkTab] = useState<"overview" | "resources" | "status" | "students">("resources");
  const [selectedFolderId, setSelectedFolderId] = useState("root");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [showFolderResourcePicker, setShowFolderResourcePicker] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set(["root"]));
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null>(null);
  const [draftAnnouncement, setDraftAnnouncement] = useState<Pick<SubjectClassAnnouncement, "title" | "body">>({ title: "", body: "" });
  const committedResources = useMemo(() => subjectClass?.resources ?? [], [subjectClass?.resources]);
  const committedResourceSignature = useMemo(() => JSON.stringify(committedResources), [committedResources]);
  const pendingResourceSaveSignature = useRef<string | null>(null);
  const [draftResources, setDraftResources] = useState<SubjectResource[]>(committedResources);
  const [hasUnsavedResourceChanges, setHasUnsavedResourceChanges] = useState(false);

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
  const announcements = subjectClass.announcements ?? [];
  const subjectClassStudents = students.filter((student) => subjectClass.studentIds.includes(student.id));
  const folders = subjectClass.resourceFolders ?? [];
  const resources = draftResources;
  const activeFolderId = selectedFolderId === "root" ? undefined : selectedFolderId;
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const selectedResource = resources.find((resource) => resource.id === selectedResourceId) ?? null;
  const selectedTreeFolderId = selectedResource ? (selectedResource.folderId ?? "root") : activeFolder ? activeFolder.id : "root";
  const childFolders = folders.filter((folder) => (folder.parentId ?? "root") === selectedTreeFolderId);
  const folderResources = resources.filter((resource) => (resource.folderId ?? "root") === selectedTreeFolderId);
  const updateFolders = (nextFolders: ResourceFolder[]) => onChange({ ...subjectClass, resourceFolders: nextFolders });
  const updateResources = (nextResources: SubjectResource[]) => onChange({ ...subjectClass, resources: nextResources });
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
    setEditingFolderId(null);
    setEditingResourceId(null);
    setShowFolderResourcePicker(false);
    setExpandedFolderIds((current) => new Set(current).add(folderId));
  };
  const selectResource = (resource: SubjectResource) => {
    setSelectedFolderId(resource.folderId ?? "root");
    setSelectedResourceId(resource.id);
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
    updateResources(nextResources);
    setDraftResources(nextResources);
    setHasUnsavedResourceChanges(false);
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
  const moveResourceToFolder = (resourceId: string, folderId: string) => {
    const nextFolderId = folderId === "root" ? undefined : folderId;
    const nextCommittedResources = committedResources.map((resource) => {
      if (resource.id !== resourceId) {
        return resource;
      }
      const { folderId: _previousFolderId, ...resourceWithoutFolder } = resource;
      return nextFolderId ? { ...resourceWithoutFolder, folderId: nextFolderId } : resourceWithoutFolder;
    });
    const nextDraftResources = resources.map((resource) => {
      if (resource.id !== resourceId) {
        return resource;
      }
      const { folderId: _previousFolderId, ...resourceWithoutFolder } = resource;
      return nextFolderId ? { ...resourceWithoutFolder, folderId: nextFolderId } : resourceWithoutFolder;
    });
    updateResources(nextCommittedResources);
    setDraftResources(nextDraftResources);
    if (selectedResourceId === resourceId) {
      setSelectedFolderId(folderId);
    }
    setExpandedFolderIds((current) => new Set(current).add(folderId));
    setDragTargetFolderId(null);
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
    </div>
  );
  const handleFolderDragOver = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTargetFolderId(folderId);
  };
  const handleFolderDrop = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    const resourceId = event.dataTransfer.getData("text/plain");
    if (resourceId) {
      moveResourceToFolder(resourceId, folderId);
    }
  };
  const renderResourceTree = (parentId: string, depth = 0): React.ReactNode => {
    const children = folders.filter((folder) => (folder.parentId ?? "root") === parentId);
    const childResources = resources.filter((resource) => (resource.folderId ?? "root") === parentId);
    const isExpanded = expandedFolderIds.has(parentId);
    return (
      <>
        {isExpanded ? (
          <>
            {children.map((folder) => {
              const folderIsExpanded = expandedFolderIds.has(folder.id);
              const folderHasChildren = folders.some((childFolder) => (childFolder.parentId ?? "root") === folder.id)
                || resources.some((resource) => (resource.folderId ?? "root") === folder.id);
              return (
                <div key={folder.id}>
                  <div
                    className={[
                      "resource-tree-item",
                      !selectedResource && selectedFolderId === folder.id ? "active-resource-tree-item" : "",
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
                  event.dataTransfer.setData("text/plain", resource.id);
                }}
                style={{ "--tree-depth": depth } as React.CSSProperties}
              >
                <span className="resource-tree-spacer" />
                {resource.type === "note" ? <FileText size={16} /> : <Link2 size={16} />}
                <span>{resource.title}</span>
              </button>
            ))}
            {parentId !== "root" || (children.length === 0 && childResources.length === 0) ? (
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
        <button className="secondary-action" type="button" onClick={onBack}>Back to subject classes</button>
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
        <button className={activeWorkTab === "overview" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("overview")}>Overview</button>
        <button className={activeWorkTab === "resources" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("resources")}>Resources</button>
        <button className={activeWorkTab === "status" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("status")}>Status and follow-up</button>
        <button className={activeWorkTab === "students" ? "active-subject-work-tab" : ""} type="button" onClick={() => setActiveWorkTab("students")}>Students</button>
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
        <section className="subject-overview-panel">
          <div className="empty-editor-state">
            <h3>Status and follow-up</h3>
            <p>No status tools have been added yet.</p>
          </div>
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
            <div className="subject-student-list">
              {subjectClassStudents.map((student) => (
                <article className="subject-student-card" key={student.id}>
                  <strong>{student.firstName} {student.lastName}</strong>
                  <span>{student.gender || "No gender recorded"}{student.guardians?.[0]?.name ? ` · Guardian: ${student.guardians[0].name}` : ""}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {activeWorkTab === "resources" ? (
        <div className="resource-workspace">
        <aside className="resource-tree-panel">
          <div className="resource-tree-heading">
            <strong>Folders</strong>
            <button className="icon-action" type="button" onClick={addFolder} aria-label="Add folder">
              <Plus size={16} />
            </button>
          </div>
          <div
            className={[
              "resource-tree-item",
              !selectedResource && selectedFolderId === "root" ? "active-resource-tree-item" : "",
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
            {!selectedResource ? (
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
            {activeFolder && !selectedResource ? (
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
                  <div className="resource-detail-actions">
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
                  </div>
                </div>
                {editingResourceId === selectedResource.id ? (
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
            ) : (
              <>
                <div className="resource-save-row">
                  <button className="secondary-action" type="button" onClick={saveResourceChanges} disabled={!hasUnsavedResourceChanges}>
                    <Save size={16} />
                    Save resource changes
                  </button>
                </div>
                {!activeFolder && childFolders.length === 0 && folderResources.length === 0 ? resourceTypePicker : null}
                {activeFolder && childFolders.length === 0 && folderResources.length === 0 ? resourceTypePicker : null}
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
                {(childFolders.length > 0 || folderResources.length > 0) && showFolderResourcePicker ? resourceTypePicker : null}
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
  return school.staff.some((member) => member.email?.toLowerCase() === normalizedEmail && member.name === subjectClass.teacherName);
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

function SchoolHeader({ school, currentPage }: { school: School; currentPage?: string }) {
  return (
    <header className="school-header">
      <button className="school-brand" onClick={() => navigate(`/${school.id}`)}>
        <SchoolIcon size={30} />
        <span>{school.name}</span>
      </button>
      <nav className="school-nav" aria-label="School navigation">
        <a href={`/${school.id}`} className={currentPage === "home" ? "active" : ""}>Home</a>
        <a href={`/${school.id}/about`} className={currentPage === "about" ? "active" : ""}>About</a>
        <a href={`/${school.id}/for-students-and-guardians`} className={currentPage === "students" ? "active" : ""}>For students and guardians</a>
        <a href="#contact" className={currentPage === "contact" ? "active" : ""}>Contact</a>
      </nav>
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
        <h2>{school.name} - part of EduLink Africa</h2>
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
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  eyebrow: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
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
  variant?: "wide" | "square" | "hero";
}) {
  const [status, setStatus] = useState(`Choose an image up to ${MAX_IMAGE_UPLOAD_LABEL}.`);

  const uploadImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setStatus("Preparing image...");
    try {
      const nextImage = await prepareImageUpload(file, variant === "square"
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
        <div className={`image-upload-preview ${variant === "square" ? "square-image-preview" : ""} ${variant === "hero" ? "hero-image-preview" : ""}`}>
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
  }: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    cropSquare?: boolean;
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
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
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

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default App;
