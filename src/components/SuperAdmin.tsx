import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Receipt,
  Save,
  School as SchoolIcon,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faScaleBalanced, faTags } from "@fortawesome/free-solid-svg-icons";
import { navigate, openInNewTab } from "../lib/navigate";
import {
  computePaymentStatus,
  formatBillingPeriod,
  formatDateTime,
  formatKES,
  generatePayment,
  getCurrentPeriod,
  getPaidAmount,
  parsePercentageInput,
} from "../lib/utils";
import { getSchoolAdminEmails, hasStaffCategory, REMARK_PARENTS } from "../lib/staffUtils";
import { AdminCardTitle, CheckboxInput, EditorPanel, ImageUpload, Repeater, RegistrationModal, RichTextEditor, SelectInput, TextInput, TextArea } from "./ui";
import {
  defaultGlobalAboutConfig,
  defaultGlobalSchoolWorkConfig,
  deleteSchool,
  deleteSuperAdminProfile,
  getAdminProfile,
  getGlobalAboutConfig,
  getGlobalSchoolWorkConfig,
  getSuperAdmins,
  listSchools,
  saveGlobalAboutConfig,
  saveGlobalSchoolWorkConfig,
  saveSchool,
  saveSuperAdminProfile,
  slugifySchoolName,
  updateSuperAdminProfile,
} from "../lib/schools";
import { auth, createAuthUser, hasFirebaseConfig } from "../lib/firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { sampleSchool } from "../data/sampleSchool";
import type {
  AboutCategory,
  AboutPage,
  AdminProfile,
  AssessmentScale,
  GlobalAboutConfig,
  GlobalAboutPage,
  GlobalSchoolWorkConfig,
  PaymentComment,
  PaymentLineItem,
  PaymentRecord,
  RemarkCategory,
  School,
  SchoolPayment,
  SchoolSubscription,
  SupportTicket,
} from "../types";

async function refreshSchools(
  setSchools: (schools: School[]) => void,
  setStatus: (status: string) => void,
) {
  const nextSchools = await listSchools();
  setSchools(nextSchools);
  setStatus(`${nextSchools.length} school${nextSchools.length === 1 ? "" : "s"} loaded`);
}

export function SuperAdminPage() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [globalAbout, setGlobalAbout] = useState<GlobalAboutConfig>(defaultGlobalAboutConfig);
  const [globalSchoolWork, setGlobalSchoolWork] = useState<GlobalSchoolWorkConfig>(defaultGlobalSchoolWorkConfig);
  const [superAdminView, setSuperAdminView] = useState<"schools" | "supportTickets" | "globalPages" | "schoolWorkSettings" | "superAdmins" | "subscriptions" | "payments" | "users">("schools");
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
      setStatus("Only superadmins can save lms settings");
      return;
    }
    setStatus("Saving lms settings...");
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
            <button
              className={superAdminView === "users" ? "active-superadmin-nav" : ""}
              type="button"
              onClick={() => setSuperAdminView("users")}
            >
              <UserRound size={18} />
              Users
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
          ) : superAdminView === "users" ? (
            <UsersPanel schools={schools} />
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
                {filteredSchools.length === 0 && status !== "Loading..." ? (
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

function UsersPanel({ schools }: { schools: School[] }) {
  const [userQuery, setUserQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");

  type UserRow = {
    key: string;
    name: string;
    schoolId: string;
    schoolName: string;
    role: string;
    email: string;
    simulateAdminUrl: string | null;
    simulateWorkUrl: string | null;
  };

  const rows: UserRow[] = schools.flatMap((school) => {
    const adminEmails = getSchoolAdminEmails(school);
    const staffRows: UserRow[] = school.staff.map((member) => {
      const isAdmin = Boolean(member.email && adminEmails.map((e) => e.toLowerCase()).includes(member.email!.toLowerCase()));
      const isTeacher = hasStaffCategory(member, "Teacher");
      const role = isAdmin ? "Admin" : isTeacher ? "Teacher" : "Staff";
      const workParams = isAdmin
        ? new URLSearchParams({ simulateRole: "admin" })
        : new URLSearchParams({ simulateRole: "staff", simulateId: member.email ?? "" });
      return {
        key: `${school.id}-staff-${member.email ?? member.name}`,
        name: member.name,
        schoolId: school.id,
        schoolName: school.name,
        role,
        email: member.email ?? "—",
        simulateAdminUrl: isAdmin ? `/${school.id}/admin?simulateRole=admin` : null,
        simulateWorkUrl: member.email ? `/${school.id}/lms?${workParams.toString()}` : null,
      };
    });
    const studentRows: UserRow[] = school.students.map((student) => ({
      key: `${school.id}-student-${student.id}`,
      name: `${student.firstName} ${student.lastName}`,
      schoolId: school.id,
      schoolName: school.name,
      role: "Student",
      email: student.email ?? "—",
      simulateAdminUrl: null,
      simulateWorkUrl: `/${school.id}/lms?${new URLSearchParams({ simulateRole: "student", simulateId: student.id }).toString()}`,
    }));
    return [...staffRows, ...studentRows];
  });

  const q = userQuery.toLowerCase();
  const filtered = rows.filter((row) =>
    (!schoolFilter || row.schoolId === schoolFilter) &&
    (!q || row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q) || row.role.toLowerCase().includes(q))
  );

  const schoolOptions = [
    { value: "", label: "All schools" },
    ...schools.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <EditorPanel title="Users">
      <div className="users-panel-filters">
        <label className="field-label">
          Search
          <span className="input-shell">
            <Search size={18} />
            <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Name or email…" />
          </span>
        </label>
        <SelectInput label="School" value={schoolFilter} options={schoolOptions} onChange={setSchoolFilter} />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No users found</h3>
          <p>Try adjusting the search or school filter.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>School</th>
                <th>Role</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.name}</strong></td>
                  <td><a href={`/${row.schoolId}/admin`} className="users-panel-school-link">{row.schoolName}</a></td>
                  <td>{row.role}</td>
                  <td>{row.email}</td>
                  <td className="table-actions-cell">
                    {row.simulateAdminUrl ? (
                      <button className="secondary-action" type="button" onClick={() => openInNewTab(row.simulateAdminUrl!)}>
                        Admin
                      </button>
                    ) : null}
                    {row.simulateWorkUrl ? (
                      <button className="secondary-action" type="button" onClick={() => openInNewTab(row.simulateWorkUrl!)}>
                        School work
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </EditorPanel>
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
                  {ticket.status === "resolved"
                    ? <Check size={14} className="support-ticket-resolved-check" />
                    : <span className={`support-ticket-status-dot support-ticket-status-dot--${ticket.status}`} />}
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
                    {ticket.response ? (
                      <div className="support-ticket-response">
                        <div className="support-ticket-response-meta">
                          <strong>{ticket.respondedBy ?? "Support"}</strong>
                          {ticket.respondedAt ? <span>{formatDateTime(ticket.respondedAt)}</span> : null}
                        </div>
                        <p>{ticket.response}</p>
                      </div>
                    ) : null}
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

export function SchoolBillingPanel({
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
