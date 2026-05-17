import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, GraduationCap, Mail, MapPin, Phone, School as SchoolIcon, UserRound } from "lucide-react";
import { navigate } from "../lib/navigate";
import { formatDate, getTextExcerpt } from "../lib/utils";
import { getGlobalAboutConfig, getLocalSchool, getSchool, slugifySchoolName } from "../lib/schools";
import { hasStaffCategory, isVisibleOnHomePage, isVisibleOnStaffPage } from "../lib/staffUtils";
import { AboutBackButton, ContactLine, ContentSection, InfoPanel } from "./ui";
import { PublishedTimetableView } from "./Timetable";
import { schoolCache, getCachedSchool, loadSchoolForPublicPage } from "../lib/schoolCache";
import { sampleSchool } from "../data/sampleSchool";
import type { AboutCategory, GlobalAboutConfig, NewsItem, School, StaffMember } from "../types";

let globalAboutCache: GlobalAboutConfig | null = null;

function getNewsSlug(item: NewsItem) {
  return item.slug || slugifySchoolName(item.title);
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

export function useSchoolDocumentBrand(school: School | null) {
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

function shouldShowPublicSchoolWebsite(school: School) {
  return school.showWebsite !== false;
}

export function LoadingContent() {
  return (
    <div className="loading-content">
      <GraduationCap size={36} />
      <p>Loading school page...</p>
    </div>
  );
}

export function LoadingScreen() {
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

export function SchoolLoadingPage({ school, currentPage }: { school: School; currentPage?: string }) {
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

export function PublicSchoolLoadingPage({ schoolId, currentPage }: { schoolId: string; currentPage?: string }) {
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

export function SchoolHeader({
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
  const [navLoading, setNavLoading] = useState(!globalAboutCache && !globalCategories);
  useEffect(() => {
    if (!globalAboutCache) {
      void getGlobalAboutConfig().then((config) => {
        globalAboutCache = config;
        setLoadedCategories(config.categories);
        setNavLoading(false);
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
        {navLoading ? (
          <span className="school-nav-loading">
            <span className="school-nav-loading-dot" />
            <span className="school-nav-loading-dot" />
            <span className="school-nav-loading-dot" />
          </span>
        ) : allNavCategories.map((cat) => (
          <a key={cat.id} href={getCategoryHref(cat)} className={currentPage === cat.id ? "active" : ""}>{cat.title}</a>
        ))}
        <a href={`/${school.id}/lms`} className="school-lms-login-button">LMS login</a>
      </nav>}
    </header>
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

export function SchoolPage({ schoolId }: { schoolId: string }) {
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

export function AboutPageView({ schoolId }: { schoolId: string }) {
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

export function AboutSinglePageView({ schoolId, pageSlug }: { schoolId: string; pageSlug: string }) {
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

export function GlobalCategoryPageView({ schoolId, categoryId }: { schoolId: string; categoryId: string }) {
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

export function StudentsGuardiansPage({ schoolId }: { schoolId: string }) {
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

      {school.timetable?.publishedVersionId ? (
        <section className="school-section">
          <PublishedTimetableView school={school} />
        </section>
      ) : null}

      <SchoolFooter school={school} />
    </main>
  );
}

export function NewsPage({ schoolId }: { schoolId: string }) {
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

export function NewsSinglePage({ schoolId, newsSlug }: { schoolId: string; newsSlug: string }) {
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
