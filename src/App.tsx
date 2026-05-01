import { useEffect, useMemo, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  CalendarDays,
  ChevronRight,
  Globe2,
  GraduationCap,
  ImagePlus,
  LayoutDashboard,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Search,
  Save,
  School as SchoolIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { sampleSchool } from "./data/sampleSchool";
import { getAdminProfile, getLocalSchool, getSchool, listSchools, saveSchool, slugifySchoolName } from "./lib/schools";
import { hasFirebaseConfig } from "./lib/firebase";
import { auth } from "./lib/firebase";
import type { AboutCategory, AboutPage, AdminProfile, CalendarItem, ClassGroup, NewsItem, School, StaffMember, Student } from "./types";

type EditorSection = "profile" | "contact" | "about" | "news" | "calendar" | "staff" | "classes" | "students";

const editorSections: Array<{ id: EditorSection; label: string }> = [
  { id: "profile", label: "School profile" },
  { id: "contact", label: "Contact details" },
  { id: "about", label: "About" },
  { id: "news", label: "News" },
  { id: "calendar", label: "Calendar" },
  { id: "staff", label: "Staff" },
  { id: "classes", label: "Classes" },
  { id: "students", label: "Students" },
];

type Route =
  | { view: "home" }
  | { view: "login" }
  | { view: "superadmin" }
  | { view: "about"; id: string }
  | { view: "aboutPage"; schoolId: string; pageSlug: string }
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

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
  }

  const categories = school.aboutCategories ?? [];
  const pages = school.aboutPages ?? [];

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="about" />
      <section className="about-page-hero">
        <p className="eyebrow">{school.name}</p>
        <h1>About</h1>
        <p>{school.about}</p>
      </section>

      <section className="about-page-layout">
        {categories.length === 0 ? (
          <div className="empty-public-state">
            <h2>About pages are coming soon</h2>
            <p>This school has not published custom about pages yet.</p>
          </div>
        ) : (
          categories.map((category) => {
            const categoryPages = pages.filter((page) => page.categoryId === category.id);
            return (
              <section className="about-category-section" key={category.id}>
                <div>
                  <h2>{category.title}</h2>
                </div>
                <div className="about-page-list">
                  {categoryPages.length === 0 ? (
                    <p>No pages in this category yet.</p>
                  ) : (
                    categoryPages.map((page) => (
                      <a href={`/${schoolId}/about/${page.slug}`} className="about-page-card" key={page.id}>
                        {page.headerImage ? (
                          <div className="about-page-card-image" style={{ backgroundImage: `url(${page.headerImage})` }} />
                        ) : null}
                        <h3>{page.title}</h3>
                        <p>{page.body.substring(0, 150)}{page.body.length > 150 ? "..." : ""}</p>
                      </a>
                    ))
                  )}
                </div>
              </section>
            );
          })
        )}
      </section>

      <SchoolFooter school={school} />
    </main>
  );
}

function AboutSinglePageView({ schoolId, pageSlug }: { schoolId: string; pageSlug: string }) {
  const [school, setSchool] = useState<School | null>(() => getLocalSchool(schoolId) ?? null);

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
  }, [schoolId]);

  if (!school) {
    return <LoadingScreen />;
  }

  const page = school.aboutPages?.find((p) => p.slug === pageSlug);

  if (!page) {
    return (
      <main className="school-page">
        <SchoolHeader school={school} currentPage="about" />
        <section className="about-page-hero">
          <p className="eyebrow">{school.name}</p>
          <h1>Page not found</h1>
          <p>The requested page could not be found.</p>
        </section>
        <SchoolFooter school={school} />
      </main>
    );
  }

  const category = school.aboutCategories?.find((c) => c.id === page.categoryId);

  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage="about" />
      {page.headerImage ? (
        <section className="about-single-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(12, 45, 45, 0.86), rgba(12, 45, 45, 0.3)), url(${page.headerImage})` }}>
          <div className="about-single-hero-content">
            {category ? <p className="eyebrow">{category.title}</p> : null}
            <h1>{page.title}</h1>
          </div>
        </section>
      ) : (
        <section className="about-page-hero">
          {category ? <p className="eyebrow">{category.title}</p> : null}
          <h1>{page.title}</h1>
        </section>
      )}
      <section className="about-single-content">
        <div className="about-single-body" dangerouslySetInnerHTML={{ __html: page.body }} />
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

function SchoolTemplate({ school, currentPage }: { school: School; currentPage?: string }) {
  return (
    <main className="school-page">
      <SchoolHeader school={school} currentPage={currentPage} />
      <section className="school-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(12, 45, 45, 0.86), rgba(12, 45, 45, 0.3)), url(${school.heroImage})` }}>
        <div className="school-hero-content">
          <p className="eyebrow">{school.type}</p>
          <h1>{school.name}</h1>
          <p>{school.tagline}</p>
        </div>
      </section>

      <section className="school-main-grid">
        <div className="main-column">
          <ContentSection title="News" action="All news">
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
              {school.staff.map((member) => (
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
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSchool(schoolId).then((remoteSchool) => setSchool(getLocalSchool(schoolId) ?? remoteSchool));
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

        <SchoolEditor school={school} onChange={setSchool} onSubmit={submit} activeSection={activeSection} onSectionChange={setActiveSection} />
      </section>
    </main>
  );
}

function SuperAdminPage() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School>(sampleSchool);
  const [activeSection, setActiveSection] = useState<EditorSection>("profile");
  const [query, setQuery] = useState("");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setProfile({ uid: "local", email: "local-admin@edulink.africa", schoolIds: [sampleSchool.id], superAdmin: true });
      void refreshSchools(setSchools, setSelectedSchool, setStatus);
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
        void refreshSchools(setSchools, setSelectedSchool, setStatus);
      });
    });
  }, []);

  const filteredSchools = schools.filter((school) => {
    const haystack = `${school.name} ${school.id} ${school.city} ${school.country}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const saveSelectedSchool = async () => {
    if (hasFirebaseConfig && !profile?.superAdmin) {
      setStatus("Only superadmins can save from this dashboard");
      return;
    }
    setStatus("Saving school...");
    await saveSchool(selectedSchool);
    await refreshSchools(setSchools, setSelectedSchool, setStatus, selectedSchool.id);
  };

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
      aboutCategories: [],
      aboutPages: [],
      updatedAt: new Date().toISOString(),
    };
    setStatus("Creating school...");
    await saveSchool(nextSchool);
    setNewSchoolName("");
    await refreshSchools(setSchools, setSelectedSchool, setStatus, id);
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
          <button className="primary-action" onClick={() => void saveSelectedSchool()}>
            <Save size={18} />
            Save selected
          </button>
        </div>
      </header>

      <section className="superadmin-layout">
        <aside className="superadmin-sidebar">
          <div className="panel-heading">
            <ShieldCheck />
            <div>
              <h1>Superadmin</h1>
              <p>Manage all schools and simulate their public pages.</p>
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
          <label className="field-label search-field">
            Search schools
            <span className="input-shell">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </span>
          </label>
          <div className="school-picker">
            {filteredSchools.map((school) => (
              <button
                className={school.id === selectedSchool.id ? "active-school" : ""}
                key={school.id}
                onClick={() => setSelectedSchool(school)}
              >
                <strong>{school.name}</strong>
                <span>/{school.id}</span>
              </button>
            ))}
          </div>
          <div className="create-school-box">
            <TextInput label="Create school" value={newSchoolName} onChange={setNewSchoolName} />
            <button className="primary-action" type="button" onClick={() => void createSchool()}>
              Create
            </button>
          </div>
        </aside>

        <section className="superadmin-main">
          <div className="simulation-toolbar">
            <div>
              <p className="eyebrow">Simulating</p>
              <h2>{selectedSchool.name}</h2>
              <p>Public URL: /{selectedSchool.id}</p>
            </div>
            <div className="admin-actions">
              <button className="secondary-action" onClick={() => openInNewTab(`/${selectedSchool.id}`)}>
                Public page
              </button>
              <button className="secondary-action" onClick={() => navigate(`/${selectedSchool.id}/admin`)}>
                School admin
              </button>
            </div>
          </div>

          <div className="superadmin-split">
            <SchoolEditor
              school={selectedSchool}
              onChange={setSelectedSchool}
              onSubmit={saveSelectedSchool}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
            <section className="simulation-panel">
              <SchoolTemplate school={selectedSchool} />
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function SchoolEditor({
  school,
  onChange,
  onSubmit,
  activeSection,
  onSectionChange,
}: {
  school: School;
  onChange: (school: School) => void;
  onSubmit: () => Promise<void>;
  activeSection: EditorSection;
  onSectionChange: (section: EditorSection) => void;
}) {
  const setField = <K extends keyof School>(field: K, value: School[K]) => {
    onChange({ ...school, [field]: value });
  };

  const classes = school.classes ?? [];
  const students = school.students ?? [];
  const aboutCategories = school.aboutCategories ?? [];
  const aboutPages = school.aboutPages ?? [];

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
            <div className="nested-editor-grid">
              <section className="sub-editor-panel">
                <h3>Categories</h3>
                <Repeater
                  items={aboutCategories}
                  addLabel="Add category"
                  createItem={(): AboutCategory => ({ id: `about-category-${Date.now()}`, title: "New category" })}
                  onChange={(items) => {
                    const validIds = new Set(items.map((item) => item.id));
                    onChange({
                      ...school,
                      aboutCategories: items,
                      aboutPages: aboutPages.map((page) => ({
                        ...page,
                        categoryId: validIds.has(page.categoryId) ? page.categoryId : items[0]?.id ?? "",
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
                {aboutCategories.length === 0 ? (
                  <div className="empty-editor-state">
                    <h3>Create a category first</h3>
                    <p>About pages must belong to a category. Add at least one category before creating pages.</p>
                  </div>
                ) : (
                  <Repeater
                    items={aboutPages}
                    addLabel="Add page"
                    createItem={(): AboutPage => ({
                      id: `about-page-${Date.now()}`,
                      categoryId: aboutCategories[0].id,
                      title: "New page",
                      slug: "",
                      headerImage: "",
                      body: "",
                    })}
                    onChange={(items) => setField("aboutPages", items)}
                    renderItem={(item, update) => (
                      <>
                        <TextInput label="Page title" value={item.title} onChange={(value) => update({ ...item, title: value, slug: item.slug || value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} />
                        <TextInput label="URL slug" value={item.slug} onChange={(value) => update({ ...item, slug: value })} />
                        <SelectInput
                          label="Category"
                          value={item.categoryId}
                          options={aboutCategories.map((category) => ({ value: category.id, label: category.title }))}
                          onChange={(value) => update({ ...item, categoryId: value })}
                        />
                        <TextInput label="Header image URL" value={item.headerImage ?? ""} onChange={(value) => update({ ...item, headerImage: value })} />
                        <TextArea label="Page content (HTML)" value={item.body} onChange={(value) => update({ ...item, body: value })} />
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
              createItem={() => ({ title: "New announcement", date: "2026-05-01", body: "Announcement details" })}
              onChange={(items) => setField("announcements", items)}
              renderItem={(item, update) => (
                <>
                  <TextInput label="Title" value={item.title} onChange={(value) => update({ ...item, title: value })} />
                  <TextInput label="Date" value={item.date} onChange={(value) => update({ ...item, date: value })} />
                  <TextArea label="Body" value={item.body} onChange={(value) => update({ ...item, body: value })} />
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
            <Repeater
              items={school.staff}
              addLabel="Add staff member"
              createItem={(): StaffMember => ({ name: "Staff name", role: "Role", category: "Teacher" })}
              onChange={(items) => setField("staff", items)}
              renderItem={(item, update) => (
                <>
                  <TextInput label="Name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
                  <SelectInput
                    label="Category"
                    value={item.category ?? "Other"}
                    options={[
                      { value: "Teacher", label: "Teacher" },
                      { value: "Administration", label: "Administration" },
                      { value: "Other", label: "Other" },
                    ]}
                    onChange={(value) => update({ ...item, category: value as StaffMember["category"] })}
                  />
                  <TextInput label="Description" value={item.role} onChange={(value) => update({ ...item, role: value })} />
                  <TextInput label="Phone" value={item.phone ?? ""} onChange={(value) => update({ ...item, phone: value })} />
                  <TextInput label="Email" value={item.email ?? ""} onChange={(value) => update({ ...item, email: value })} />
                </>
              )}
            />
          </EditorPanel>
        ) : null}

        {activeSection === "classes" ? (
          <EditorPanel title="Classes">
            <Repeater
              items={classes}
              addLabel="Add class"
              createItem={(): ClassGroup => ({ id: `class-${Date.now()}`, name: "New class", grade: "", teacher: "" })}
              onChange={(items) => {
                const validIds = new Set(items.map((item) => item.id));
                onChange({
                  ...school,
                  classes: items,
                  students: students.map((student) => ({
                    ...student,
                    classId: validIds.has(student.classId) ? student.classId : items[0]?.id ?? "",
                  })),
                });
              }}
              renderItem={(item, update) => (
                <>
                  <TextInput label="Class name" value={item.name} onChange={(value) => update({ ...item, name: value })} />
                  <TextInput label="Grade" value={item.grade ?? ""} onChange={(value) => update({ ...item, grade: value })} />
                  <TextInput label="Class teacher" value={item.teacher ?? ""} onChange={(value) => update({ ...item, teacher: value })} />
                </>
              )}
            />
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
                  guardianName: "",
                  guardianEmail: "",
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
                    <TextInput label="Guardian name" value={item.guardianName ?? ""} onChange={(value) => update({ ...item, guardianName: value })} />
                    <TextInput label="Guardian email" value={item.guardianEmail ?? ""} onChange={(value) => update({ ...item, guardianEmail: value })} />
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

async function refreshSchools(
  setSchools: (schools: School[]) => void,
  setSelectedSchool: (school: School) => void,
  setStatus: (status: string) => void,
  selectedId?: string,
) {
  const nextSchools = await listSchools();
  setSchools(nextSchools);
  setSelectedSchool(nextSchools.find((school) => school.id === selectedId) ?? nextSchools[0] ?? sampleSchool);
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

function ContentSection({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="content-section" id={title.toLowerCase().split(" ")[0]}>
      <div className="section-heading">
        <h2>{title}</h2>
        {action ? (
          <button>
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
        <UserRound size={24} />
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

function Repeater<T extends NewsItem | CalendarItem | StaffMember | ClassGroup | Student | AboutCategory | AboutPage>({
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
      {items.map((item, index) => (
        <div className="repeater-item" key={index}>
          {renderItem(item, (nextItem) => onChange(items.map((current, currentIndex) => (currentIndex === index ? nextItem : current))))}
          <button className="remove-button" type="button" onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button className="secondary-action repeater-add-button" type="button" onClick={() => onChange([...items, createItem()])}>
        {addLabel}
      </button>
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

export default App;
