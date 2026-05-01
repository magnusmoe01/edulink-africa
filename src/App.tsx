import { useEffect, useMemo, useRef, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  Bold,
  CalendarDays,
  ChevronRight,
  Globe2,
  GraduationCap,
  Heading2,
  ImagePlus,
  Italic,
  LayoutDashboard,
  List,
  ListOrdered,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Quote,
  Search,
  Save,
  School as SchoolIcon,
  ShieldCheck,
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
import type { AboutCategory, AboutPage, AdminProfile, CalendarItem, ClassGroup, GlobalAboutConfig, GlobalAboutPage, Guardian, NewsItem, School, StaffMember, Student, Subject } from "./types";

type EditorSection = "profile" | "contact" | "about" | "news" | "calendar" | "staff" | "classes" | "subjects" | "students";

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
      classes: [],
      students: [],
      subjects: [],
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
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
  }

  return <SchoolTemplate school={school} currentPage="home" />;
}

function AboutPageView({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig | null>(null);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig()]).then(([remoteSchool, nextGlobalAbout]) => {
      setSchool(getLocalSchool(schoolId) ?? remoteSchool);
      setGlobalAbout(nextGlobalAbout);
    });
  }, [schoolId]);

  if (!school || !globalAbout) {
    return <LoadingScreen />;
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
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig | null>(null);

  useEffect(() => {
    void Promise.all([getSchool(schoolId), getGlobalAboutConfig()]).then(([remoteSchool, nextGlobalAbout]) => {
      setSchool(getLocalSchool(schoolId) ?? remoteSchool);
      setGlobalAbout(nextGlobalAbout);
    });
  }, [schoolId]);

  if (!school || !globalAbout) {
    return <LoadingScreen />;
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
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
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
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
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
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
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
  const [activeSection, setActiveSection] = useState<EditorSection>("profile");
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
    if (hasFirebaseConfig && (!adminUser || !canManageSchool(profile, school.id, adminUser.email, school))) {
      setSaveStatus("Sign in to save changes");
      return;
    }
    setSaveStatus("Saving...");
    await saveSchool(school);
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const logout = async () => {
    if (!auth) {
      return;
    }
    await signOut(auth);
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
          <button className="primary-action" onClick={() => void submit()}>
            <Save size={18} />
            {saveStatus ?? "Save"}
          </button>
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
          <EditorMenu activeSection={activeSection} onChange={setActiveSection} />
        </aside>

        <SchoolEditor
          school={school}
          globalAbout={globalAbout}
          onChange={setSchool}
          onSubmit={submit}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
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
      classes: [],
      students: [],
      subjects: [],
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
                      <TextInput label="Header image URL" value={item.headerImage ?? ""} onChange={(value) => update({ ...item, headerImage: value })} />
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
  activeSection,
  onSectionChange,
}: {
  school: School;
  globalAbout?: GlobalAboutConfig;
  onChange: (school: School) => void;
  onSubmit: () => Promise<void>;
  activeSection: EditorSection;
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
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [draftStaff, setDraftStaff] = useState<StaffMember>(() => createStaffMember());
  const [draftClass, setDraftClass] = useState<ClassGroup>(() => createClassGroup());
  const [draftSubject, setDraftSubject] = useState<Subject>(() => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    teacherName: "",
    classIds: [],
    studentIds: [],
  }));
  const setField = <K extends keyof School>(field: K, value: School[K]) => {
    onChange({ ...school, [field]: value });
  };

  const classes = school.classes ?? [];
  const students = school.students ?? [];
  const subjects = school.subjects ?? [];
  const aboutCategories = school.aboutCategories ?? [];
  const aboutPages = school.aboutPages ?? [];
  const createSubject = (): Subject => ({
    id: `subject-${Date.now()}`,
    name: "New subject",
    teacherName: "",
    classIds: classes[0] ? [classes[0].id] : [],
    studentIds: classes[0] ? students.filter((student) => student.classId === classes[0].id).map((student) => student.id) : [],
  });
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
      <TextInput label="Class name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
      <TextInput label="Grade" value={item.grade ?? ""} onChange={(value) => update({ ...item, grade: value })} />
      <SelectInput
        label="Class teacher"
        value={item.teacher ?? ""}
        options={staffOptions}
        onChange={(value) => update({ ...item, teacher: value })}
      />
    </>
  );
  const renderSubjectFields = (item: Subject, update: (item: Subject) => void) => {
    const selectedClassIds = item.classIds ?? [];
    const selectedStudentIds = item.studentIds ?? [];
    const classStudents = students.filter((student) => selectedClassIds.includes(student.classId));
    const selectedStudents = students.filter((student) => selectedStudentIds.includes(student.id));

    return (
      <>
        <TextInput label="Subject name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
        <SelectInput
          label="Teacher"
          value={item.teacherName}
          options={staffOptions}
          onChange={(value) => update({ ...item, teacherName: value })}
        />
        <CheckboxGroup
          label="Classes included"
          options={classes.map((classGroup) => ({
            value: classGroup.id,
            label: `${classGroup.name}${classGroup.grade ? ` - Grade ${classGroup.grade}` : ""}`,
          }))}
          values={selectedClassIds}
          onChange={(classIds) => update({
            ...item,
            classIds,
            studentIds: mergeUnique([
              ...selectedStudentIds,
              ...students.filter((student) => classIds.includes(student.classId)).map((student) => student.id),
            ]),
          })}
        />
        <CheckboxGroup
          label="Students included"
          options={students.map((student) => {
            const classGroup = classes.find((currentClass) => currentClass.id === student.classId);
            return {
              value: student.id,
              label: `${student.firstName} ${student.lastName}${classGroup ? ` - ${classGroup.name}` : ""}`,
            };
          })}
          values={selectedStudentIds}
          onChange={(studentIds) => update({ ...item, studentIds })}
        />
        <div className="subject-summary">
          <strong>{selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"} selected</strong>
          <span>{classStudents.length} student{classStudents.length === 1 ? "" : "s"} currently in selected class{selectedClassIds.length === 1 ? "" : "es"}</span>
        </div>
      </>
    );
  };
  const globalCategories = globalAbout?.categories ?? [];
  const globalPageSlugs = new Set(globalAbout?.pages.map((page) => page.slug) ?? []);
  const editableAboutPages = aboutPages.filter((page) => !globalPageSlugs.has(page.slug));
  const editableAboutCategoryOptions = [
    ...globalCategories.map((category) => ({ value: category.id, label: `${category.title} (global)` })),
    ...aboutCategories.map((category) => ({ value: category.id, label: category.title })),
  ];
  const defaultAboutCategoryId = aboutCategories[0]?.id ?? globalCategories[0]?.id ?? "";

  return (
    <form
      className="school-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="editor-grid">
        {activeSection === "profile" ? (
          <EditorPanel title="School profile">
            <TextInput label="URL slug" value={school.id} onChange={(value) => setField("id", slugifySchoolName(value))} />
            <TextInput label="School name" value={school.name} onChange={(value) => setField("name", value)} />
            <TextInput label="School type" value={school.type} onChange={(value) => setField("type", value)} />
            <TextInput label="Tagline" value={school.tagline} onChange={(value) => setField("tagline", value)} />
            <TextArea label="About" value={school.about} onChange={(value) => setField("about", value)} />
            <TextInput label="Hero image URL" value={school.heroImage} onChange={(value) => setField("heroImage", value)} icon={<ImagePlus size={18} />} />
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
                    onChange({
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
                        <TextInput label="Header image URL" value={item.headerImage ?? ""} onChange={(value) => update({ ...item, headerImage: value })} />
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
            <Repeater
              items={school.announcements}
              addLabel="Add news"
              createItem={() => ({
                id: `news-${Date.now()}`,
                title: "New announcement",
                slug: "",
                date: "2026-05-01",
                headerImage: "",
                body: "<p>Announcement details</p>",
              })}
              onChange={(items) => setField("announcements", items)}
              renderItem={(item, update) => (
                <>
                  <TextInput
                    label="Title"
                    value={item.title}
                    onChange={(value) => update({ ...item, title: value, slug: item.slug || slugifySchoolName(value) })}
                  />
                  <TextInput label="URL slug" value={item.slug ?? ""} onChange={(value) => update({ ...item, slug: slugifySchoolName(value) })} />
                  <TextInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
                  <TextInput label="Header image URL" value={item.headerImage ?? ""} onChange={(value) => update({ ...item, headerImage: value })} />
                  <RichTextEditor label="Body" value={item.body} onChange={(value) => update({ ...item, body: value })} />
                </>
              )}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "calendar" ? (
          <EditorPanel title="Calendar">
            <Repeater
              items={school.calendar}
              addLabel="Add event"
              createItem={() => ({ title: "School event", date: "2026-05-01" })}
              onChange={(items) => setField("calendar", items)}
              renderItem={(item, update) => (
                <>
                  <TextInput label="Title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
                  <TextInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
                </>
              )}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "staff" ? (
          <EditorPanel title="Staff">
            <div className="repeater">
              <button
                className="secondary-action repeater-add-button"
                type="button"
                onClick={() => {
                  setDraftStaff(createStaffMember());
                  setIsStaffModalOpen(true);
                }}
              >
                Add staff member
              </button>
              {school.staff.map((item, index) => (
                <div className="repeater-item" key={`${item.name}-${index}`}>
                  {renderStaffFields(item, (nextItem) => setField("staff", school.staff.map((current, currentIndex) => (currentIndex === index ? nextItem : current))))}
                  <button className="remove-button" type="button" onClick={() => setField("staff", school.staff.filter((_, currentIndex) => currentIndex !== index))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {isStaffModalOpen ? (
              <RegistrationModal
                title="Register staff member"
                eyebrow="Staff"
                submitLabel="Add staff member"
                onClose={() => setIsStaffModalOpen(false)}
                onSubmit={() => {
                  setField("staff", [...school.staff, draftStaff]);
                  setIsStaffModalOpen(false);
                }}
              >
                {renderStaffFields(draftStaff, setDraftStaff)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "classes" ? (
          <EditorPanel title="Classes">
            <div className="repeater">
              <button
                className="secondary-action repeater-add-button"
                type="button"
                onClick={() => {
                  setDraftClass(createClassGroup());
                  setIsClassModalOpen(true);
                }}
              >
                Add class
              </button>
              {classes.map((item, index) => (
                <div className="repeater-item" key={item.id}>
                  {renderClassFields(item, (nextItem) => {
                    const nextClasses = classes.map((current, currentIndex) => (currentIndex === index ? nextItem : current));
                    const validIds = new Set(nextClasses.map((classGroup) => classGroup.id));
                    onChange({
                      ...school,
                      classes: nextClasses,
                      students: students.map((student) => ({
                        ...student,
                        classId: validIds.has(student.classId) ? student.classId : nextClasses[0]?.id ?? "",
                      })),
                    });
                  })}
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => {
                      const nextClasses = classes.filter((_, currentIndex) => currentIndex !== index);
                      const validIds = new Set(nextClasses.map((classGroup) => classGroup.id));
                      onChange({
                        ...school,
                        classes: nextClasses,
                        students: students.map((student) => ({
                          ...student,
                          classId: validIds.has(student.classId) ? student.classId : nextClasses[0]?.id ?? "",
                        })),
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {isClassModalOpen ? (
              <RegistrationModal
                title="Create class"
                eyebrow="Classes"
                submitLabel="Add class"
                onClose={() => setIsClassModalOpen(false)}
                onSubmit={() => {
                  const nextClasses = [...classes, draftClass];
                  onChange({ ...school, classes: nextClasses });
                  setIsClassModalOpen(false);
                }}
              >
                {renderClassFields(draftClass, setDraftClass)}
              </RegistrationModal>
            ) : null}
          </EditorPanel>
        ) : null}

        {activeSection === "subjects" ? (
          <EditorPanel title="Subjects">
            {classes.length === 0 || students.length === 0 ? (
              <div className="empty-editor-state">
                <h3>Add classes and students first</h3>
                <p>Subjects use existing classes and students. Create at least one class and one student before adding subjects.</p>
                <div className="admin-actions">
                  <button className="primary-action" type="button" onClick={() => onSectionChange("classes")}>
                    Go to classes
                  </button>
                  <button className="secondary-action" type="button" onClick={() => onSectionChange("students")}>
                    Go to students
                  </button>
                </div>
              </div>
            ) : (
              <div className="repeater">
                <button
                  className="secondary-action repeater-add-button"
                  type="button"
                  onClick={() => {
                    setDraftSubject(createSubject());
                    setIsSubjectModalOpen(true);
                  }}
                >
                  Add subject
                </button>
                {subjects.map((item, index) => (
                  <div className="repeater-item" key={item.id}>
                    {renderSubjectFields(item, (nextItem) => setField("subjects", subjects.map((current, currentIndex) => (currentIndex === index ? nextItem : current))))}
                    <button className="remove-button" type="button" onClick={() => setField("subjects", subjects.filter((_, currentIndex) => currentIndex !== index))}>
                      Remove
                    </button>
                  </div>
                ))}
                {isSubjectModalOpen ? (
                  <RegistrationModal
                    title="Create subject"
                    eyebrow="Subjects"
                    submitLabel="Add subject"
                    onClose={() => setIsSubjectModalOpen(false)}
                    onSubmit={() => {
                      setField("subjects", [...subjects, draftSubject]);
                      setIsSubjectModalOpen(false);
                    }}
                  >
                    {renderSubjectFields(draftSubject, setDraftSubject)}
                  </RegistrationModal>
                ) : null}
              </div>
            )}
          </EditorPanel>
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
              <Repeater
                items={students}
                addLabel="Add student"
                createItem={(): Student => ({
                  id: `student-${Date.now()}`,
                  firstName: "First name",
                  lastName: "Last name",
                  classId: classes[0].id,
                  dateOfBirth: "",
                  gender: "",
                  description: "",
                  guardians: [],
                })}
                onChange={(items) => setField("students", items)}
                renderItem={(item, update) => (
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
                )}
              />
            )}
          </EditorPanel>
        ) : null}
      </div>
    </form>
  );
}

function EditorMenu({
  activeSection,
  onChange,
}: {
  activeSection: EditorSection;
  onChange: (section: EditorSection) => void;
}) {
  return (
    <nav className="editor-menu" aria-label="School admin sections">
      {editorSections.map((section) => (
        <button
          className={activeSection === section.id ? "active-editor-section" : ""}
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function canManageSchool(profile: AdminProfile | null, schoolId: string, userEmail?: string | null, school?: School) {
  if (profile?.superAdmin || profile?.schoolIds.includes(schoolId)) {
    return true;
  }

  const normalizedEmail = userEmail?.toLowerCase();
  return Boolean(normalizedEmail && school?.adminEmails?.map((adminEmail) => adminEmail.toLowerCase()).includes(normalizedEmail));
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
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const valueSet = new Set(values);

  return (
    <fieldset className="checkbox-group">
      <legend>{label}</legend>
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

function StaffImageUpload({ photoUrl, onChange }: { photoUrl: string; onChange: (photoUrl: string) => void }) {
  const [status, setStatus] = useState("Recommended: square image, at least 400 x 400px.");

  const uploadImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file.");
      return;
    }

    setStatus("Preparing image...");
    try {
      const nextPhotoUrl = await resizeImageForFirestore(file);
      onChange(nextPhotoUrl);
      setStatus("Image ready. Save the school to store it in Firestore.");
    } catch {
      setStatus("Could not prepare this image.");
    }
  };

  return (
    <div className="field-label staff-image-field">
      <span>Staff image</span>
      <div className="staff-image-control">
        <div className="staff-image-preview">
          {photoUrl ? <img src={photoUrl} alt="" /> : <UserRound size={24} />}
        </div>
        <div>
          <input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          <p>{status}</p>
          {photoUrl ? (
            <button className="remove-button" type="button" onClick={() => onChange("")}>
              Remove image
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RichTextEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);

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

  const insertImage = () => {
    const imageUrl = window.prompt("Image URL");
    if (!imageUrl?.trim()) {
      return;
    }
    const altText = window.prompt("Image description") ?? "";
    runCommand(
      "insertHTML",
      `<figure><img src="${escapeHtmlAttribute(imageUrl.trim())}" alt="${escapeHtmlAttribute(altText.trim())}" /></figure><p><br></p>`,
    );
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
        <button type="button" onClick={insertImage} title="Image">
          <ImagePlus size={18} />
        </button>
      </div>
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

function resizeImageForFirestore(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Could not resize image"));
          return;
        }

        canvas.width = size;
        canvas.height = size;

        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;

        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function Repeater<T extends NewsItem | CalendarItem | StaffMember | ClassGroup | Student | Subject | AboutCategory | AboutPage | GlobalAboutPage>({
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
      <GraduationCap size={36} />
      <p>Loading school page...</p>
    </main>
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
