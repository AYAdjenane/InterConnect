import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ArrowUpRight, Bell, Bookmark, Building2, Clock, Eye, FileText, Heart,
  Mail, Menu, Phone, Search, Shield, Sparkles, Upload,
  User, Users, X, CheckCircle, AlertCircle, LogOut, Briefcase, Send
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Page = "home" | "jobs" | "dashboard" | "profile" | "login" | "company-dashboard" | "company-profile" | "create-offer" | "candidates" | "notifications" | "my-applications" | "saved-offers";
type Role = "student" | "company";

interface AuthUser { id: number; email: string; role: Role; }
interface StudentProfile { full_name: string; phone: string; university: string; bio: string; skills: string; profile_strength: number; avatar_url: string; }
interface CompanyProfile { company_name: string; description: string; field_of_activity: string; address: string; website: string; contact_email: string; logo_url: string; }
interface Offer { id: number; title: string; type: string; location: string; description: string; company_name: string; match: number; saved: boolean; applied: boolean; published_at: string; applications?: number; status?: string; }
interface Application { id: number; offer_id: number; offer_title: string; company_name: string; type: string; location: string; status: string; applied_at: string; cover_letter?: string; cv_url?: string; full_name?: string; university?: string; skills?: string; match?: number; application_id?: number; }
interface Notification { id: number; message: string; read: number; created_at: string; }

// ─── API Helper ──────────────────────────────────────────────────────────────
async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("ic_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  try {
    const res = await fetch(`/api${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } });
    
    const contentType = res.headers.get("content-type");
    let data: any = null;
    
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      // Unreachable server / HTML error response (e.g. 504 Gateway Timeout from Vite proxy)
      throw new Error("Unable to reach the database. Please ensure your backend server is running on port 5000.");
    }
    
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  } catch (e: any) {
    if (e.message === "Failed to fetch" || e.message.includes("Unexpected end of JSON input")) {
      throw new Error("Connection failed. Please ensure the backend server is running (npm.cmd run dev inside the server folder).");
    }
    throw e;
  }
}

// ─── Toast Component ─────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[999] flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl text-sm font-medium
      ${type === "success" ? "bg-[#112250] border border-[#e0c68f]/40 text-[#f5f0e9]" : "bg-red-900/90 border border-red-400/30 text-red-100"}`}>
      {type === "success" ? <CheckCircle size={18} className="text-[#e0c68f]" /> : <AlertCircle size={18} className="text-red-300" />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#112250] shadow-[0_0_0_1px_#e0c68f30,0_4px_20px_rgba(0,0,0,0.3)]">
        <span className="display text-3xl font-bold tracking-[-1px] text-[#e0c68f]">IC</span>
      </div>
      <div className="leading-none">
        <p className="display text-2xl font-bold tracking-wide text-[#f5f0e9]">InternConnect</p>
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#e0c68f]">Career atelier</p>
      </div>
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
function Button({ children, variant = "gold", onClick, className = "", disabled = false, type = "button" }:
  { children: React.ReactNode; variant?: "gold" | "ghost" | "cream" | "blue"; onClick?: () => void; className?: string; disabled?: boolean; type?: "button" | "submit" }) {
  const styles = {
    gold: "bg-[#e0c68f] text-[#0a1020] hover:bg-[#f5f0e9]",
    ghost: "border border-[#f5f0e9]/18 bg-white/5 text-[#f5f0e9] hover:border-[#e0c68f]/55 hover:bg-white/10",
    cream: "bg-[#f5f0e9] text-[#112250] hover:bg-white",
    blue: "bg-[#3c5070] text-white hover:bg-[#112250]",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${styles[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({ page, setPage, role, user, unreadCount, onLogout }:
  { page: Page; setPage: (p: Page) => void; role: Role; user: AuthUser | null; unreadCount: number; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const links = role === "student"
    ? [{ label: "Home", page: "home" as Page }, { label: "Opportunities", page: "jobs" as Page }, { label: "Dashboard", page: "dashboard" as Page }, { label: "Profile", page: "profile" as Page }]
    : [{ label: "Dashboard", page: "company-dashboard" as Page }, { label: "Profile", page: "company-profile" as Page }, { label: "Offers", page: "create-offer" as Page }];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 py-4">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-4 py-3">
        <button onClick={() => setPage(role === "student" ? "home" : "company-dashboard")} className="cursor-pointer"><Logo /></button>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <button key={link.page} onClick={() => setPage(link.page)}
              className={`rounded-full px-4 py-2 text-sm transition ${page === link.page ? "bg-[#f5f0e9] text-[#112250]" : "text-[#f5f0e9]/72 hover:bg-white/8 hover:text-white"}`}>
              {link.label}
            </button>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <button onClick={() => setPage("notifications")} className="relative rounded-full p-3 text-[#f5f0e9]/75 transition hover:bg-white/10" title="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#e0c68f] text-[9px] font-bold text-[#0a1020]">{unreadCount}</span>
                )}
              </button>
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-white/70">
                {role === "company" ? <Building2 size={14} /> : <User size={14} />}
                {user.email.split("@")[0]}
              </div>
              <button onClick={onLogout} className="rounded-full p-2 text-[#f5f0e9]/60 hover:text-[#e0c68f] transition">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <Button onClick={() => setPage("login")} variant="ghost" className="py-2.5">Sign in</Button>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-full p-3 text-white md:hidden">{open ? <X /> : <Menu />}</button>
      </div>
    </header>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function Home({ setPage }: { setPage: (p: Page) => void }) {
  const stats = [
    { value: "2,400+", label: "Active Offers" },
    { value: "18,000+", label: "Students" },
    { value: "850+", label: "Companies" },
    { value: "94%", label: "Match Rate" },
  ];
  return (
    <main className="leaf-bg relative overflow-hidden grain">
      <section className="hero-bg relative min-h-screen px-4 pb-16 pt-28">
        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="reveal max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-[#e0c68f]/35 bg-[#112250]/50 px-4 py-2 text-xs uppercase tracking-[0.34em] text-[#e0c68f]">Premium student hiring</p>
            <h1 className="display text-6xl font-bold leading-[0.92] text-[#f5f0e9] sm:text-7xl lg:text-8xl">Careers with a quieter kind of luxury.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#f5f0e9]/75">InternConnect bridges students and top companies through an elegant, intelligent hiring experience — where every opportunity feels crafted just for you.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => setPage("jobs")}>Explore opportunities <ArrowUpRight size={17} /></Button>
              <Button onClick={() => setPage("login")} variant="ghost">Sign in to dashboard</Button>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map(s => (
                <div key={s.label} className="rounded-2xl border border-[#f5f0e9]/10 bg-white/5 p-4 text-center backdrop-blur-sm">
                  <p className="display text-3xl font-bold text-[#e0c68f]">{s.value}</p>
                  <p className="mt-1 text-xs text-white/55">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="slide-in relative">
            <div className="floaty rounded-[2.25rem] border border-[#f5f0e9]/18 bg-[#112250]/58 p-5 shadow-2xl shadow-black/35 backdrop-blur-md">
              <div className="cream-panel rounded-[1.75rem] p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs uppercase tracking-[0.28em] text-[#3c5070]">Smart match</p><h2 className="display mt-2 text-5xl font-bold text-[#112250]">96%</h2></div>
                  <Sparkles className="text-[#e0c68f]" size={34} />
                </div>
                <div className="my-6 h-px bg-[#112250]/15" />
                <div className="mt-6 space-y-3">
                  {[{ role: "Product Design Intern", company: "Sapphire Labs", match: 96 },
                    { role: "Frontend Developer", company: "Royal Blue Studio", match: 91 },
                    { role: "Data Analyst Intern", company: "Quicksand AI", match: 88 }
                  ].map((job) => (
                    <div key={job.role} className="flex items-center justify-between rounded-2xl bg-white/65 p-3">
                      <div><p className="text-sm font-bold text-[#112250]">{job.role}</p><p className="text-xs text-[#3c5070]">{job.company}</p></div>
                      <span className="rounded-full bg-[#112250] px-3 py-1 text-xs text-[#f5f0e9]">{job.match}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
function Jobs({ user, showToast }: { user: AuthUser | null; showToast: (m: string, t: "success" | "error") => void }) {
  const [query, setQuery] = useState("");
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showMoreFields, setShowMoreFields] = useState(false);

  const [applyModalOffer, setApplyModalOffer] = useState<Offer | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [cvUrl, setCvUrl] = useState("");

  const [filters, setFilters] = useState<{
    types: string[];
    fieldsOfStudy: string[];
    location: string;
    durations: string[];
  }>({
    types: [],
    fieldsOfStudy: [],
    location: "",
    durations: []
  });

  const fetchAllOffers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active offers once for maximum responsiveness and real-time counts
      const res = await api("/offers");
      setAllOffers(res.data || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAllOffers();
  }, [fetchAllOffers]);

  // Client-side filtering logic
  const filteredOffers = useMemo(() => {
    return allOffers.filter(offer => {
      // 1. Search Query
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesTitle = offer.title?.toLowerCase().includes(q);
        const matchesDesc = offer.description?.toLowerCase().includes(q);
        const matchesCompany = offer.company_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCompany) return false;
      }

      // 2. Opportunity Type
      if (filters.types.length > 0) {
        const mappedType = offer.type === "Job" ? "Full-time" : offer.type;
        if (!filters.types.includes(mappedType)) return false;
      }

      // 3. Field of Study
      if (filters.fieldsOfStudy.length > 0) {
        const field = offer.field_of_study || "Computer Science";
        if (!filters.fieldsOfStudy.includes(field)) return false;
      }

      // 4. Location (Wilaya dropdown)
      if (filters.location) {
        const offerLoc = offer.location?.toLowerCase() || "";
        const filterLoc = filters.location.toLowerCase();
        if (!offerLoc.includes(filterLoc)) return false;
      }

      // 5. Duration
      if (filters.durations.length > 0) {
        const duration = offer.duration || "3-6 months";
        if (!filters.durations.includes(duration)) return false;
      }

      return true;
    });
  }, [allOffers, query, filters]);

  // Dynamic counts helper (independent of current filters, except search if desired - let's do independent of filters to match the screenshot UI)
  const getTypeCount = (type: string) => {
    return allOffers.filter(o => {
      const mappedType = o.type === "Job" ? "Full-time" : o.type;
      return mappedType === type;
    }).length;
  };

  const getFieldCount = (field: string) => {
    return allOffers.filter(o => (o.field_of_study || "Computer Science") === field).length;
  };

  const getDurationCount = (dur: string) => {
    return allOffers.filter(o => (o.duration || "3-6 months") === dur).length;
  };

  const toggleSave = async (offer: Offer) => {
    if (!user) return showToast("Please sign in to save offers.", "error");
    try {
      await api(`/offers/${offer.id}/save`, { method: "POST" });
      const updatedSaved = !offer.saved;
      setAllOffers(prev => prev.map(o => o.id === offer.id ? { ...o, saved: updatedSaved } : o));
      if (selectedOffer && selectedOffer.id === offer.id) {
        setSelectedOffer(prev => prev ? { ...prev, saved: updatedSaved } : null);
      }
      showToast(offer.saved ? "Offer removed from saved." : "Offer saved!", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const initiateApply = (offer: Offer) => {
    if (!user) return showToast("Please sign in to apply.", "error");
    if (user.role !== "student") return showToast("Only students can apply.", "error");
    setApplyModalOffer(offer);
    setCoverLetter("");
    setCvUrl("");
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyModalOffer || !user) return;
    setApplying(applyModalOffer.id);
    try {
      await api(`/offers/${applyModalOffer.id}/apply`, { 
        method: "POST",
        body: JSON.stringify({ cover_letter: coverLetter, cv_url: cvUrl })
      });
      setAllOffers(prev => prev.map(o => o.id === applyModalOffer.id ? { ...o, applied: true } : o));
      if (selectedOffer && selectedOffer.id === applyModalOffer.id) {
        setSelectedOffer(prev => prev ? { ...prev, applied: true } : null);
      }
      showToast(`Application sent to ${applyModalOffer.company_name}!`, "success");
      setApplyModalOffer(null);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setApplying(null);
    }
  };

  const toggleFilter = (key: "types" | "fieldsOfStudy" | "durations", value: string) => {
    setFilters(prev => {
      const list = prev[key];
      const newList = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
      return { ...prev, [key]: newList };
    });
  };

  const clearAll = () => {
    setFilters({
      types: [],
      fieldsOfStudy: [],
      location: "",
      durations: []
    });
  };

  const mainFields = ["Computer Science", "Engineering", "Business", "Design", "Marketing"];
  const moreFields = ["Medicine", "Law", "Sciences", "Other"];

  const wilayas = [
    "Algiers",
    "Béjaïa",
    "Constantine",
    "Oran",
    "Tizi Ouzou",
    "Sétif",
    "Blida",
    "Annaba",
    "Tlemcen",
    "Ghardaïa",
    "Batna",
    "Chlef",
    "Remote",
    "Hybrid"
  ];

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[#e0c68f]">Opportunity room</p>
            <h1 className="display mt-3 text-6xl font-bold text-white font-serif">Bestsellers for your career.</h1>
          </div>
          <div className="glass flex w-full max-w-xl items-center gap-3 rounded-full px-5 py-3">
            <Search size={18} className="text-[#e0c68f]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search role, company, or skill"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/38 outline-none" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
          {/* Filters Sidebar */}
          <aside className="glass h-max rounded-[2rem] p-6 text-white">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold font-serif text-white">Filters</h2>
              <button onClick={clearAll} className="text-xs font-semibold text-blue-400 hover:text-white transition">Clear all</button>
            </div>

            {/* ── Opportunity Type ── */}
            <div className="border-t border-white/10 py-5 first:border-t-0 first:pt-0">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#e0c68f]">Opportunity Type</p>
              <div className="space-y-3">
                {["Full-time", "Internship", "Part-time", "PFE"].map(v => (
                  <label key={v} className="flex cursor-pointer items-center justify-between text-sm text-white/75 hover:text-white transition">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={filters.types.includes(v)} onChange={() => toggleFilter("types", v)} className="h-4 w-4 rounded accent-[#e0c68f]" />
                      <span>{v}</span>
                    </div>
                    <span className="text-xs text-white/40 font-mono">{getTypeCount(v)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Field of Study ── */}
            <div className="border-t border-white/10 py-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#e0c68f]">Field of Study</p>
              <div className="space-y-3">
                {mainFields.map(v => (
                  <label key={v} className="flex cursor-pointer items-between justify-between text-sm text-white/75 hover:text-white transition">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={filters.fieldsOfStudy.includes(v)} onChange={() => toggleFilter("fieldsOfStudy", v)} className="h-4 w-4 rounded accent-[#e0c68f]" />
                      <span>{v}</span>
                    </div>
                    <span className="text-xs text-white/40 font-mono">{getFieldCount(v)}</span>
                  </label>
                ))}

                {showMoreFields && moreFields.map(v => (
                  <label key={v} className="flex cursor-pointer items-between justify-between text-sm text-white/75 hover:text-white transition">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={filters.fieldsOfStudy.includes(v)} onChange={() => toggleFilter("fieldsOfStudy", v)} className="h-4 w-4 rounded accent-[#e0c68f]" />
                      <span>{v}</span>
                    </div>
                    <span className="text-xs text-white/40 font-mono">{getFieldCount(v)}</span>
                  </label>
                ))}

                <button onClick={() => setShowMoreFields(!showMoreFields)} className="text-xs text-blue-400 font-semibold hover:text-white mt-1 transition">
                  {showMoreFields ? "- Show less" : "+ Show more"}
                </button>
              </div>
            </div>

            {/* ── Location dropdown ── */}
            <div className="border-t border-white/10 py-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#e0c68f]">Location</p>
              <div className="relative">
                <select
                  value={filters.location}
                  onChange={e => setFilters(p => ({ ...p, location: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#0c142c] py-3.5 px-4 text-sm text-white outline-none focus:border-[#e0c68f]/50 appearance-none cursor-pointer"
                >
                  <option value="">Wilaya</option>
                  {wilayas.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>
            </div>

            {/* ── Duration ── */}
            <div className="border-t border-white/10 py-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#e0c68f]">Duration</p>
              <div className="space-y-3">
                {["1-3 months", "3-6 months", "6+ months"].map(v => (
                  <label key={v} className="flex cursor-pointer items-center justify-between text-sm text-white/75 hover:text-white transition">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={filters.durations.includes(v)} onChange={() => toggleFilter("durations", v)} className="h-4 w-4 rounded accent-[#e0c68f]" />
                      <span>{v}</span>
                    </div>
                    <span className="text-xs text-white/40 font-mono">{getDurationCount(v)}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          {/* Offers list section */}
          <section className="grid gap-5 md:grid-cols-2">
            {loading ? (
              <div className="col-span-2 flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" />
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="col-span-2 rounded-[2.5rem] border border-white/10 bg-white/5 py-24 text-center text-white/50">
                <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-serif text-lg">No offers found matching your criteria.</p>
                <p className="text-sm opacity-60 mt-1">Try widening your search keywords or clearing some filters.</p>
              </div>
            ) : filteredOffers.map(offer => (
              <article key={offer.id} className="soft-card glass rounded-[2.5rem] p-7 flex flex-col justify-between hover:scale-[1.01] transition-transform duration-300">
                <div>
                  <div className="mb-6 flex items-start justify-between">
                    <div className="rounded-2xl bg-[#f5f0e9] px-4.5 py-3.5 text-[#112250] shadow-inner font-serif text-3xl font-bold flex items-center justify-center h-14 w-14">
                      {offer.company_name?.charAt(0) || "?"}
                    </div>
                    <button onClick={() => toggleSave(offer)} className="rounded-full p-2.5 text-white/70 hover:bg-white/10 hover:text-white transition">
                      <Heart size={21} className={offer.saved ? "fill-[#e0c68f] text-[#e0c68f]" : ""} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3.5">
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/80">{offer.type === "Job" ? "Full-time" : offer.type}</span>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/80">{offer.location}</span>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/80">{offer.duration || "3-6 months"}</span>
                    {user?.role === "student" && (
                      <span className="ml-auto rounded-full bg-[#e0c68f]/20 px-3 py-1 text-[11px] font-semibold text-[#e0c68f]">{offer.match ?? 50}% match</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-white mt-1 font-serif line-clamp-1">{offer.title}</h3>
                  <p className="text-sm font-semibold text-[#e0c68f] mt-1">{offer.company_name}</p>
                  <p className="mt-4 text-xs text-white/60 line-clamp-3 leading-relaxed">{offer.description}</p>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3.5">
                  <Button variant="ghost" className="py-3 rounded-2xl" onClick={() => setSelectedOffer(offer)}>Details</Button>
                  {offer.applied ? (
                    <Button variant="ghost" className="py-3 rounded-2xl opacity-50 cursor-default" disabled>Applied ✓</Button>
                  ) : (
                    <Button onClick={() => initiateApply(offer)} className="py-3 rounded-2xl" disabled={applying === offer.id}>
                      {applying === offer.id ? "Applying..." : "Apply"}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>

      {/* ─── Details Modal ────────────────────────────────────────────────────── */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity">
          <div className="glass max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] border border-white/10 p-8 text-white relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button onClick={() => setSelectedOffer(null)} className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition">
              <X size={20} />
            </button>

            {/* Header Content */}
            <div className="flex gap-5 items-center mb-6">
              <div className="rounded-[1.8rem] bg-[#f5f0e9] p-1 h-20 w-20 flex items-center justify-center shadow-lg">
                <span className="display text-4xl font-bold text-[#112250] font-serif">{selectedOffer.company_name?.charAt(0) || "?"}</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold font-serif text-white pr-8">{selectedOffer.title}</h2>
                <p className="text-[#e0c68f] font-semibold mt-1 text-base">{selectedOffer.company_name}</p>
              </div>
            </div>

            {/* Match Score & Badges */}
            <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[10px] uppercase text-white/40 tracking-wider">Opportunity</p>
                <p className="text-sm font-semibold mt-1">{selectedOffer.type === "Job" ? "Full-time" : selectedOffer.type}</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[10px] uppercase text-white/40 tracking-wider">Location</p>
                <p className="text-sm font-semibold mt-1 truncate">{selectedOffer.location}</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[10px] uppercase text-white/40 tracking-wider">Duration</p>
                <p className="text-sm font-semibold mt-1">{selectedOffer.duration || "3-6 months"}</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[10px] uppercase text-white/40 tracking-wider">Field of Study</p>
                <p className="text-sm font-semibold mt-1 truncate">{selectedOffer.field_of_study || "Computer Science"}</p>
              </div>
            </div>

            {user?.role === "student" && (
              <div className="bg-[#e0c68f]/10 border border-[#e0c68f]/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#e0c68f] uppercase tracking-wider font-semibold">Match Score</p>
                  <p className="text-sm text-white/80 mt-0.5">Based on your student profile skills matches</p>
                </div>
                <div className="text-right">
                  <span className="display text-3xl font-bold text-[#e0c68f]">{selectedOffer.match ?? 50}%</span>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-lg font-bold font-serif mb-3 text-white">Role Description</h3>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{selectedOffer.description}</p>
            </div>

            {/* Bottom Controls */}
            <div className="flex gap-4">
              <button
                onClick={() => toggleSave(selectedOffer)}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-4.5 hover:bg-white/10 transition text-sm font-semibold"
              >
                <Heart size={18} className={selectedOffer.saved ? "fill-[#e0c68f] text-[#e0c68f]" : ""} />
                <span>{selectedOffer.saved ? "Saved" : "Save Offer"}</span>
              </button>

              {selectedOffer.applied ? (
                <Button variant="ghost" className="flex-1 py-4.5 rounded-full opacity-55 cursor-default" disabled>Applied ✓</Button>
              ) : (
                <Button
                  onClick={() => initiateApply(selectedOffer)}
                  className="flex-1 py-4.5 rounded-full"
                  disabled={applying === selectedOffer.id}
                >
                  {applying === selectedOffer.id ? "Applying..." : "Apply Now"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Apply Modal ────────────────────────────────────────────────────── */}
      {applyModalOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity">
          <div className="glass w-full max-w-2xl rounded-[2.5rem] border border-white/10 text-white relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Close Button */}
            <button type="button" onClick={() => setApplyModalOffer(null)} className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition cursor-pointer z-10">
              <X size={20} />
            </button>

            {/* Header */}
            <div className="px-8 pt-8 pb-4">
              <h2 className="text-3xl font-bold font-serif text-white pr-8">Submit Application</h2>
              <p className="text-[#e0c68f] font-semibold mt-1 text-base">{applyModalOffer.title}</p>
            </div>

            {/* Content */}
            <form onSubmit={submitApplication} className="px-8 pb-8 overflow-y-auto flex-1">
              
              {/* Job Info Card */}
              <div className="bg-white/5 rounded-2xl p-4 mb-6 flex items-center gap-4 border border-white/5">
                <div className="rounded-[1.2rem] bg-[#f5f0e9] h-14 w-14 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
                  <FileText size={24} className="text-[#112250]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-serif leading-tight">{applyModalOffer.title}</h3>
                  <p className="text-white/80 text-sm mt-0.5">{applyModalOffer.company_name}</p>
                  <p className="text-white/50 text-xs mt-0.5">{applyModalOffer.location}</p>
                </div>
              </div>

              {/* Cover Letter */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-2">Cover Letter *</label>
                <textarea 
                  required
                  maxLength={1000}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Explain why you are the ideal candidate for this role..."
                  className="w-full h-40 rounded-xl border border-white/10 bg-white/5 p-4 text-white text-sm outline-none focus:border-[#e0c68f]/50 resize-none transition-colors" 
                />
                <div className="text-xs text-white/40 mt-2">
                  {coverLetter.length}/1000 characters
                </div>
              </div>

              {/* CV Link */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-white mb-2">Resume Link (Optional)</label>
                <input 
                  type="url"
                  value={cvUrl}
                  onChange={e => setCvUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://linkedin.com/..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-white text-sm outline-none focus:border-[#e0c68f]/50 transition-colors" 
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button variant="ghost" className="flex-1 py-4.5 rounded-full border-white/10" onClick={() => setApplyModalOffer(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" className="flex-1 py-4.5 rounded-full" disabled={applying === applyModalOffer.id}>
                  {applying === applyModalOffer.id ? "Sending..." : (
                    <>
                      <Send size={16} className="-ml-1 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Student Dashboard ────────────────────────────────────────────────────────
function StudentDashboard({ user, showToast, setPage }: { user: AuthUser; showToast: (m: string, t: "success" | "error") => void; setPage: (p: Page) => void }) {
  const [stats, setStats] = useState({ applications: 0, saved: 0, views: 248, profileStrength: 20 });
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, appsRes, notifRes] = await Promise.all([
          api("/student/dashboard"),
          api("/applications/student"),
          api("/notifications"),
        ]);
        setStats(statsRes.data);
        setApplications(appsRes.data || []);
        setNotifications(notifRes.data?.notifications || []);
      } catch (e: any) { showToast(e.message, "error"); }
      finally { setLoading(false); }
    }
    load();
  }, [showToast]);

  const markRead = async (id: number) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    } catch { /* silent */ }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Interview": return "text-green-400";
      case "Accepted": return "text-emerald-400";
      case "Rejected": return "text-red-400";
      case "Viewed": return "text-blue-400";
      default: return "text-[#e0c68f]";
    }
  };

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="glass rounded-[2.5rem] p-8">
            <h1 className="display text-6xl font-bold leading-none text-white">Your application ceremony.</h1>
            <p className="mt-4 text-white/55">Track your opportunities and manage applications in one place.</p>
            <Button onClick={() => setPage("jobs")} className="mt-6" variant="gold">Browse Offers <ArrowUpRight size={16} /></Button>
          </div>
          <div className="cream-panel rounded-[2.5rem] p-8">
            <p className="text-xs text-[#3c5070]">Profile strength</p>
            <div className="mt-5 flex items-end justify-between">
              <span className="display text-7xl font-bold text-[#112250]">{stats.profileStrength}%</span>
              <Shield className="text-[#e0c68f]" size={34} />
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-[#112250]/15">
              <div className="h-2 rounded-full bg-[#112250]" style={{ width: `${stats.profileStrength}%` }} />
            </div>
            <Button onClick={() => setPage("profile")} className="mt-5 w-full" variant="cream">Update Profile</Button>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3 mb-8">
          {[
            ["Applications", String(stats.applications), FileText, () => setPage("my-applications")],
            ["Views", String(stats.views), Eye, null],
            ["Saved", String(stats.saved), Bookmark, () => setPage("saved-offers")],
          ].map(([label, value, Icon, clickAction]) => (
            <div key={label as string} onClick={clickAction ? (clickAction as any) : undefined} className={`glass rounded-[2rem] p-6 transition-all duration-300 ${clickAction ? "cursor-pointer hover:border-[#e0c68f]/40 hover:bg-white/8 hover:-translate-y-1" : ""}`}>
              <Icon className="text-[#e0c68f]" size={22} />
              <p className="display mt-6 text-5xl font-bold text-white">{value as string}</p>
              <p className="text-sm text-white/55">{label as string}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass rounded-[2rem] p-6">
            <h2 className="display text-3xl font-bold text-white mb-5">My Applications</h2>
            {loading ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" /> :
              applications.length === 0 ? <p className="text-white/40 text-sm">No applications yet. Start browsing!</p> :
                <div className="space-y-3">
                  {applications.map(app => (
                    <div key={app.id} className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
                      <div>
                        <p className="font-semibold text-white text-sm">{app.offer_title}</p>
                        <p className="text-xs text-white/50">{app.company_name} · {app.type}</p>
                      </div>
                      <span className={`text-xs font-semibold ${statusColor(app.status)}`}>{app.status}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
          <div className="glass rounded-[2rem] p-6">
            <h2 className="display text-3xl font-bold text-white mb-5">Notifications</h2>
            {notifications.length === 0 ? <p className="text-white/40 text-sm">No notifications yet.</p> :
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} onClick={() => markRead(n.id)}
                    className={`cursor-pointer rounded-2xl p-3 text-sm transition ${n.read ? "bg-white/5 text-white/50" : "bg-[#e0c68f]/10 text-[#f5f0e9] border border-[#e0c68f]/20"}`}>
                    <p className="line-clamp-2">{n.message}</p>
                    <p className="mt-1 text-xs opacity-50">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Student Profile ──────────────────────────────────────────────────────────
function StudentProfile({ user, showToast }: { user: AuthUser; showToast: (m: string, t: "success" | "error") => void }) {
  const [profile, setProfile] = useState<StudentProfile>({ full_name: "", phone: "", university: "", bio: "", skills: "", profile_strength: 0, avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api("/auth/me").then(res => {
      const p = res.data?.profile;
      if (p) {
        setProfile(p);
        setSkillsList(p.skills ? p.skills.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
        if (p.avatar_url) setAvatarPreview(p.avatar_url);
      }
    }).catch(e => showToast(e.message, "error"));
  }, [showToast]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast("Image must be under 2MB.", "error"); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      setProfile(p => ({ ...p, avatar_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !skillsList.includes(s)) { setSkillsList([...skillsList, s]); }
    setNewSkill("");
  };

  const removeSkill = (s: string) => setSkillsList(skillsList.filter(x => x !== s));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api("/student/profile", {
        method: "PUT",
        body: JSON.stringify({ ...profile, skills: skillsList.join(","), avatarUrl: profile.avatar_url }),
      });
      setProfile(res.data);
      showToast("Profile saved successfully!", "success");
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="glass rounded-[2.5rem] p-8">
          {/* Avatar upload */}
          <div className="relative group w-28 h-28">
            <div className="h-28 w-28 rounded-[2rem] bg-[#f5f0e9] p-1 overflow-hidden">
              {avatarPreview
                ? <img src={avatarPreview} alt="Avatar" className="h-full w-full rounded-[1.7rem] object-cover" />
                : <div className="flex h-full w-full items-center justify-center rounded-[1.7rem] bg-[#112250]"><User size={42} /></div>
              }
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Change photo"
            >
              <Upload size={22} className="text-white" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="mt-2 text-xs text-white/40">Click photo to change · max 2MB</p>
          <h1 className="display mt-4 text-5xl font-bold text-white">Student profile</h1>
          <p className="mt-2 text-sm text-white/50">{user.email}</p>
          <div className="mt-6">
            <p className="text-xs text-[#e0c68f]">Profile strength</p>
            <p className="display text-4xl font-bold text-white mt-1">{profile.profile_strength}%</p>
            <div className="mt-2 h-2 w-full rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-[#e0c68f] transition-all" style={{ width: `${profile.profile_strength}%` }} />
            </div>
          </div>
          <Button onClick={handleSave} className="mt-8 w-full" variant="gold" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </aside>
        <section className="grid gap-5">
          <div className="cream-panel rounded-[2.5rem] p-8">
            <h2 className="display text-4xl font-bold text-[#112250]">Personal information</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {([["Full name *", "full_name", User], ["Email", "email", Mail], ["Phone", "phone", Phone], ["University", "university", Building2]] as [string, string, any][]).map(([label, field, Icon]) => (
                <label key={field} className="relative block">
                  <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3c5070]" size={17} />
                  <input
                    value={field === "email" ? user.email : (profile as any)[field] || ""}
                    onChange={e => field !== "email" && setProfile(p => ({ ...p, [field]: e.target.value }))}
                    readOnly={field === "email"}
                    placeholder={label}
                    className="focus-gold w-full rounded-full border border-[#112250]/12 bg-white/75 py-4 pl-12 pr-4 text-sm text-[#112250]"
                  />
                </label>
              ))}
            </div>
            <textarea
              value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              placeholder="Short professional bio"
              className="focus-gold mt-4 min-h-32 w-full rounded-[1.8rem] border border-[#112250]/12 bg-white/75 p-5 text-sm text-[#112250]"
            />
          </div>
          <div className="glass rounded-[2rem] p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Skills</h3>
              <div className="flex items-center gap-2">
                <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSkill()}
                  placeholder="Add a skill..." className="rounded-full bg-white/10 px-3 py-1 text-xs text-white placeholder:text-white/40 outline-none" />
                <button onClick={addSkill} className="text-xs text-[#e0c68f] hover:text-white transition">+ Add</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {skillsList.map(s => (
                <button key={s} onClick={() => removeSkill(s)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-red-500/20 hover:text-red-300 transition">
                  {s} ×
                </button>
              ))}
              {skillsList.length === 0 && <p className="text-xs text-white/30">No skills added yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Company Dashboard ────────────────────────────────────────────────────────
function CompanyDashboard({ user, setPage, showToast }: { user: AuthUser; setPage: (p: Page) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [offersRes, meRes, notifRes] = await Promise.all([
          api("/offers/company"),
          api("/auth/me"),
          api("/notifications"),
        ]);
        setOffers(offersRes.data || []);
        setCompanyName(meRes.data?.profile?.company_name || "Your Company");
        setNotifications(notifRes.data?.notifications || []);
      } catch (e: any) { showToast(e.message, "error"); }
      finally { setLoading(false); }
    }
    load();
  }, [showToast]);

  const deleteOffer = async (id: number) => {
    try {
      await api(`/offers/${id}`, { method: "DELETE" });
      setOffers(prev => prev.filter(o => o.id !== id));
      showToast("Offer deleted.", "success");
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const totalApps = offers.reduce((s, o) => s + (o.applications || 0), 0);
  const activeOffers = offers.filter(o => o.status === "Active").length;
  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="display text-5xl font-bold text-white">Welcome, {companyName}</h1>
            <p className="text-white/60">Here's what's happening with your recruitment today</p>
          </div>
          <Button onClick={() => setPage("create-offer")} variant="gold">+ Create Offer</Button>
        </div>

        <div className="grid gap-5 md:grid-cols-4 mb-8">
          {[
            { icon: FileText, label: "Active Offers", value: String(activeOffers), clickAction: () => {} },
            { icon: Users, label: "Total Candidates", value: String(totalApps), clickAction: () => setPage("candidates") },
            { icon: Clock, label: "Pending", value: "0", clickAction: null },
            { icon: Bell, label: "Notifications", value: String(unreadNotifications), clickAction: () => setPage("notifications") },
          ].map((stat, i) => (
            <div key={i} onClick={stat.clickAction as any} className={`glass rounded-[2rem] p-6 transition-all duration-300 ${stat.clickAction ? "cursor-pointer hover:border-[#e0c68f]/40 hover:bg-white/8 hover:-translate-y-1" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-white/10 p-3"><stat.icon className="text-[#e0c68f]" /></div>
                <div>
                  <p className="text-sm text-white/60">{stat.label}</p>
                  <p className="display text-4xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="glass rounded-[2rem] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="display text-3xl font-bold text-white">Published Offers</h2>
              <Button onClick={() => setPage("create-offer")} variant="ghost">+ New</Button>
            </div>
            {loading ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" /> :
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/10 text-left text-white/50">
                    <th className="py-3">Title</th><th>Type</th><th>Status</th><th>Applicants</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {offers.map(o => (
                      <tr key={o.id} className="border-b border-white/10">
                        <td className="py-4 font-medium text-white">{o.title}</td>
                        <td><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{o.type}</span></td>
                        <td className={o.status === "Active" ? "text-green-400" : "text-white/40"}>● {o.status}</td>
                        <td className="text-white/70">{o.applications || 0}</td>
                        <td className="flex gap-2 py-4">
                          <Button onClick={() => setPage("candidates")} variant="blue" className="px-3 py-1 text-xs">Candidates</Button>
                          <button onClick={() => deleteOffer(o.id)} className="text-red-400/70 hover:text-red-400 transition text-xs px-2">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {offers.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-white/30">No offers yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            }
          </div>
          <div className="glass rounded-[2rem] p-6">
            <h2 className="display text-3xl font-bold text-white mb-5">Quick Actions</h2>
            <div className="space-y-3">
              <Button onClick={() => setPage("create-offer")} className="w-full" variant="gold">Create New Offer</Button>
              <Button onClick={() => setPage("candidates")} className="w-full" variant="ghost">Review Candidates</Button>
              <Button onClick={() => setPage("company-profile")} className="w-full" variant="ghost">Edit Company Profile</Button>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-white mb-3">Recent Notifications</h3>
              {notifications.slice(0, 4).map(n => (
                <div key={n.id} className={`mb-2 rounded-xl p-3 text-xs ${n.read ? "text-white/40 bg-white/5" : "text-[#f5f0e9] bg-[#e0c68f]/10 border border-[#e0c68f]/15"}`}>
                  {n.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Company Profile ──────────────────────────────────────────────────────────
function CompanyProfile({ user, showToast }: { user: AuthUser; showToast: (m: string, t: "success" | "error") => void }) {
  const [profile, setProfile] = useState<CompanyProfile>({ company_name: "", description: "", field_of_activity: "", address: "", website: "", contact_email: "", logo_url: "" });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api("/auth/me").then(res => {
      if (res.data?.profile) {
        setProfile(res.data.profile);
        if (res.data.profile.logo_url) setLogoPreview(res.data.profile.logo_url);
      }
    }).catch(e => showToast(e.message, "error"));
  }, [showToast]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast("Logo must be under 2MB.", "error"); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setProfile(p => ({ ...p, logo_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api("/company/profile", {
        method: "PUT",
        body: JSON.stringify({
          companyName: profile.company_name,
          description: profile.description,
          fieldOfActivity: profile.field_of_activity,
          address: profile.address,
          website: profile.website,
          contactEmail: profile.contact_email,
          logoUrl: profile.logo_url,
        }),
      });
      setProfile(res.data);
      showToast("Company profile saved!", "success");
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const fields: [string, keyof CompanyProfile, string][] = [
    ["Company Name *", "company_name", "text"],
    ["Field of Activity", "field_of_activity", "text"],
    ["Address", "address", "text"],
    ["Website", "website", "url"],
    ["Contact Email", "contact_email", "email"],
  ];

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8"><h1 className="display text-5xl font-bold text-white">Company Profile</h1><p className="text-white/60">Manage your public company information</p></div>
        <div className="glass rounded-[2.5rem] p-8">
          {/* Logo upload */}
          <div className="mb-8 flex items-center gap-6">
            <div className="relative group">
              <div className="h-24 w-24 rounded-[1.5rem] border-2 border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                {logoPreview
                  ? <img src={logoPreview} alt="Company logo" className="h-full w-full object-contain p-1" />
                  : <Building2 size={36} className="text-white/30" />
                }
              </div>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Upload logo"
              >
                <Upload size={20} className="text-white" />
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
            <div>
              <p className="font-semibold text-white">Company Logo</p>
              <p className="text-xs text-white/40 mt-1">PNG, JPG, or SVG · max 2MB</p>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="mt-3 flex items-center gap-2 rounded-xl border border-[#e0c68f]/30 px-4 py-2 text-sm text-[#e0c68f] hover:bg-[#e0c68f]/10 transition"
              >
                <Upload size={15} /> {logoPreview ? "Change Logo" : "Upload Logo"}
              </button>
            </div>
          </div>
          <div className="space-y-5">
            {fields.map(([label, field, type]) => (
              <div key={field}>
                <label className="text-sm text-white/70">{label}</label>
                <input type={type} value={profile[field] || ""} onChange={e => setProfile(p => ({ ...p, [field]: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-[#e0c68f]/50" />
              </div>
            ))}
            <div>
              <label className="text-sm text-white/70">Company Description</label>
              <textarea value={profile.description || ""} onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                className="mt-2 h-28 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-[#e0c68f]/50" />
            </div>
            <Button onClick={handleSave} className="w-full" variant="gold" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Create Offer ─────────────────────────────────────────────────────────────
function CreateOffer({ setPage, showToast }: { setPage: (p: Page) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [form, setForm] = useState({ title: "", type: "Internship", location: "", description: "", field_of_study: "Computer Science", duration: "3-6 months" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/offers", { method: "POST", body: JSON.stringify(form) });
      showToast("Offer published successfully!", "success");
      setTimeout(() => setPage("company-dashboard"), 800);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="display text-5xl font-bold text-white">Create a new offer</h1>
        <form onSubmit={handleSubmit} className="mt-8 glass rounded-[2.5rem] p-8 space-y-6">
          <div>
            <label className="text-sm text-white/70">Offer Title *</label>
            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Full Stack Developer"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-[#e0c68f]/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/70">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1020] p-4 text-white outline-none focus:border-[#e0c68f]/50">
                {["Internship", "Job", "PFE", "Part-time"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/70">Location (Wilaya or Remote) *</label>
              <input required value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="Algiers"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-[#e0c68f]/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/70">Field of Study</label>
              <select value={form.field_of_study} onChange={e => setForm(p => ({ ...p, field_of_study: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1020] p-4 text-white outline-none focus:border-[#e0c68f]/50">
                {["Computer Science", "Engineering", "Business", "Design", "Marketing", "Other"].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/70">Duration</label>
              <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1020] p-4 text-white outline-none focus:border-[#e0c68f]/50">
                {["1-3 months", "3-6 months", "6+ months"].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-white/70">Description *</label>
            <textarea required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the role, required skills, and responsibilities..."
              className="mt-2 h-36 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-[#e0c68f]/50" />
          </div>
          <div className="flex gap-4">
            <Button type="submit" className="flex-1" variant="gold" disabled={submitting}>{submitting ? "Publishing..." : "Publish Offer"}</Button>
            <Button onClick={() => setPage("company-dashboard")} variant="ghost" className="flex-1">Cancel</Button>
          </div>
        </form>
      </div>
    </main>
  );
}

// ─── Candidates View ──────────────────────────────────────────────────────────
function CandidatesView({ user, setPage, showToast }: { user: AuthUser; setPage: (p: Page) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [candidates, setCandidates] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    api("/applications/company").then(res => setCandidates(res.data || [])).catch(e => showToast(e.message, "error")).finally(() => setLoading(false));
  }, [showToast]);

  const updateStatus = async (appId: number, status: string) => {
    try {
      await api(`/applications/${appId}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      setCandidates(prev => prev.map(c => c.application_id === appId ? { ...c, status } : c));
      showToast(`Status updated to: ${status}`, "success");
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Interview": return "text-green-400";
      case "Accepted": return "text-emerald-400";
      case "Rejected": return "text-red-400";
      case "Viewed": return "text-blue-400";
      default: return "text-[#e0c68f]";
    }
  };

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="display text-5xl font-bold text-white">Candidates</h1>
          <Button onClick={() => setPage("company-dashboard")} variant="ghost">← Back to Dashboard</Button>
        </div>
        <div className="glass rounded-[2.5rem] p-8">
          {loading ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" /> :
            <div className="space-y-4">
              {candidates.map(c => {
                const isExpanded = expandedId === (c.application_id ?? c.id);
                return (
                  <div key={c.application_id ?? c.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-all duration-300">
                    {/* Main row */}
                    <div
                      className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition"
                      onClick={() => setExpandedId(isExpanded ? null : (c.application_id ?? c.id))}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="rounded-xl bg-[#f5f0e9] h-11 w-11 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-[#112250] font-serif">{c.full_name?.charAt(0) || "?"}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{c.full_name}</p>
                          <p className="text-xs text-white/50 truncate">{c.university} · {c.offer_title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="rounded-full bg-[#e0c68f]/20 px-3 py-1 text-xs text-[#e0c68f]">{c.match ?? 50}%</span>
                        <span className={`text-xs font-semibold ${statusColor(c.status)}`}>{c.status}</span>
                        <select value={c.status}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateStatus(c.application_id ?? c.id, e.target.value)}
                          className="rounded-xl border border-white/10 bg-[#0a1020] px-3 py-1.5 text-xs text-white outline-none cursor-pointer">
                          {["Under Review", "Viewed", "Interview", "Accepted", "Rejected"].map(s => <option key={s}>{s}</option>)}
                        </select>
                        <span className={`text-white/40 text-sm transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-white/10 px-5 pb-5 pt-4 animate-in fade-in duration-200">
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Cover Letter */}
                          <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FileText size={16} className="text-[#e0c68f]" />
                              <h4 className="text-sm font-bold text-white">Cover Letter</h4>
                            </div>
                            {c.cover_letter ? (
                              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{c.cover_letter}</p>
                            ) : (
                              <p className="text-sm text-white/30 italic">No cover letter provided.</p>
                            )}
                          </div>

                          {/* Candidate Details */}
                          <div className="space-y-3">
                            {/* CV Link */}
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Upload size={16} className="text-[#e0c68f]" />
                                <h4 className="text-sm font-bold text-white">Resume / CV</h4>
                              </div>
                              {c.cv_url ? (
                                <a href={c.cv_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-full bg-[#e0c68f]/15 border border-[#e0c68f]/25 px-4 py-2 text-sm text-[#e0c68f] font-semibold hover:bg-[#e0c68f]/25 transition">
                                  <ArrowUpRight size={14} />
                                  View Resume
                                </a>
                              ) : (
                                <p className="text-sm text-white/30 italic">No resume link provided.</p>
                              )}
                            </div>

                            {/* Skills */}
                            {c.skills && (
                              <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <h4 className="text-sm font-bold text-white mb-2">Skills</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {c.skills.split(",").map((s: string) => s.trim()).filter(Boolean).map((skill: string) => (
                                    <span key={skill} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{skill}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Applied date */}
                            <div className="text-xs text-white/40">
                              Applied: {new Date(c.applied_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {candidates.length === 0 && <p className="py-10 text-center text-white/30">No candidates yet.</p>}
            </div>
          }
        </div>
      </div>
    </main>
  );
}

// ─── My Applications Page ─────────────────────────────────────────────────────
function MyApplicationsPage({ user, setPage, showToast }: { user: AuthUser; setPage: (p: Page) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    async function load() {
      try {
        const res = await api("/applications/student");
        setApplications(res.data || []);
      } catch (e: any) {
        showToast(e.message, "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const filteredApps = useMemo(() => {
    if (filter === "All") return applications;
    return applications.filter(app => app.status === filter);
  }, [applications, filter]);

  const statusColor = (status: string) => {
    switch (status) {
      case "Interview": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "Accepted": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "Rejected": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "Viewed": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default: return "text-[#e0c68f] bg-[#e0c68f]/10 border-[#e0c68f]/20";
    }
  };

  const getStepIndex = (status: string) => {
    switch (status) {
      case "Under Review": return 1;
      case "Viewed": return 2;
      case "Interview": return 3;
      case "Accepted":
      case "Rejected": return 4;
      default: return 1;
    }
  };

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="display text-5xl font-bold text-white">My Applications</h1>
            <p className="text-white/55 mt-1 text-sm">Review your submitted applications and track their progress.</p>
          </div>
          <Button onClick={() => setPage("dashboard")} variant="ghost">← Back to Dashboard</Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["All", "Under Review", "Viewed", "Interview", "Accepted", "Rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition border ${
                filter === tab
                  ? "bg-[#e0c68f] text-[#0a1020] border-[#e0c68f]"
                  : "bg-white/5 text-white/70 border-white/10 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="glass rounded-[2.5rem] p-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="mx-auto text-white/20 mb-4" size={48} />
              <p className="text-white/40 text-base">No applications found in this category.</p>
              <Button onClick={() => setPage("jobs")} className="mt-4" variant="gold">
                Find Opportunities
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApps.map((app) => {
                const isExpanded = expandedId === app.id;
                const step = getStepIndex(app.status);
                
                return (
                  <div key={app.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-all duration-300">
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 cursor-pointer hover:bg-white/5 transition"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="rounded-xl bg-[#112250] border border-[#e0c68f]/20 h-12 w-12 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-[#e0c68f] font-serif">
                            {app.company_name?.charAt(0) || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-base truncate">{app.offer_title}</h3>
                          <p className="text-sm text-white/60 truncate">{app.company_name}</p>
                          <p className="text-xs text-white/40 mt-0.5">{app.location} · {app.type === "Job" ? "Full-time" : app.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(app.status)}`}>
                            {app.status}
                          </span>
                          <p className="text-[10px] text-white/40 mt-1">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-white/40 text-sm transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/10 px-5 pb-6 pt-5 bg-[#0a1020]/30 animate-in fade-in duration-200">
                        
                        {/* Stepper Timeline */}
                        <div className="mb-6 rounded-xl bg-white/5 border border-white/5 p-5">
                          <h4 className="text-xs uppercase tracking-[0.2em] text-[#e0c68f] mb-4">Application Progress</h4>
                          <div className="relative flex items-center justify-between">
                            {/* Process line */}
                            <div className="absolute left-4 right-4 top-1/2 h-[2px] -translate-y-1/2 bg-white/10 z-0">
                              <div 
                                className="h-full bg-[#e0c68f] transition-all duration-500" 
                                style={{ width: `${((step - 1) / 3) * 100}%` }}
                              />
                            </div>
                            
                            {[
                              { label: "Applied", stepNum: 1 },
                              { label: "Under Review", stepNum: 2 },
                              { label: "Interview", stepNum: 3 },
                              { label: app.status === "Rejected" ? "Rejected" : "Decision", stepNum: 4 }
                            ].map((s, idx) => {
                              const isCompleted = step >= s.stepNum;
                              const isCurrent = step === s.stepNum;
                              const isRejected = app.status === "Rejected" && s.stepNum === 4;
                              
                              let circleColor = "bg-white/10 border-white/10 text-white/40";
                              if (isCompleted) {
                                circleColor = "bg-[#e0c68f] border-[#e0c68f] text-[#0a1020]";
                              }
                              if (isRejected) {
                                circleColor = "bg-red-500 border-red-500 text-white";
                              }
                              
                              return (
                                <div key={idx} className="relative z-10 flex flex-col items-center">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${circleColor} ${isCurrent ? "ring-4 ring-[#e0c68f]/20 scale-110" : ""}`}>
                                    {isRejected ? "✕" : isCompleted ? "✓" : s.stepNum}
                                  </div>
                                  <span className={`mt-2 text-[10px] font-semibold tracking-wider uppercase ${isCurrent ? "text-[#e0c68f]" : isCompleted ? "text-white/80" : "text-white/40"}`}>
                                    {s.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          {/* Cover Letter */}
                          <div className="rounded-xl bg-white/5 border border-white/5 p-4 flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                              <FileText size={16} className="text-[#e0c68f]" />
                              <h4 className="text-sm font-bold text-white">Cover Letter</h4>
                            </div>
                            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap flex-1 max-h-48 overflow-y-auto pr-2">
                              {app.cover_letter || "No cover letter provided."}
                            </p>
                          </div>

                          {/* CV and Details */}
                          <div className="rounded-xl bg-white/5 border border-white/5 p-4 flex flex-col justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Upload size={16} className="text-[#e0c68f]" />
                                <h4 className="text-sm font-bold text-white">Resume / CV</h4>
                              </div>
                              {app.cv_url ? (
                                <a 
                                  href={app.cv_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#e0c68f]/10 border border-[#e0c68f]/20 px-4 py-2.5 text-sm text-[#e0c68f] hover:bg-[#e0c68f]/20 transition"
                                >
                                  <FileText size={16} />
                                  <span>View Attached Resume</span>
                                  <ArrowUpRight size={14} />
                                </a>
                              ) : (
                                <p className="text-sm text-white/40">No resume link provided.</p>
                              )}
                            </div>

                            <div className="border-t border-white/5 pt-3 mt-auto">
                              <p className="text-xs text-white/40">
                                Need to follow up? Contact InternConnect support or wait for notifications.
                              </p>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Saved Offers Page ────────────────────────────────────────────────────────
function SavedOffersPage({ user, setPage, showToast }: { user: AuthUser; setPage: (p: Page) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [savedOffers, setSavedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  
  // Apply Modal state
  const [applyModalOffer, setApplyModalOffer] = useState<Offer | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [applying, setApplying] = useState<number | null>(null);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await api("/offers/saved");
      setSavedOffers(res.data || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const toggleSave = async (offer: Offer) => {
    try {
      await api(`/offers/${offer.id}/save`, { method: "POST" });
      setSavedOffers(prev => prev.filter(o => o.id !== offer.id));
      if (selectedOffer && selectedOffer.id === offer.id) {
        setSelectedOffer(null);
      }
      showToast("Offer removed from saved list.", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const initiateApply = (offer: Offer) => {
    setApplyModalOffer(offer);
    setCoverLetter("");
    setCvUrl("");
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyModalOffer) return;
    setApplying(applyModalOffer.id);
    try {
      await api(`/offers/${applyModalOffer.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ cover_letter: coverLetter, cv_url: cvUrl })
      });
      // Mark as applied in our list
      setSavedOffers(prev => prev.map(o => o.id === applyModalOffer.id ? { ...o, applied: true } : o));
      if (selectedOffer && selectedOffer.id === applyModalOffer.id) {
        setSelectedOffer(prev => prev ? { ...prev, applied: true } : null);
      }
      showToast(`Application sent to ${applyModalOffer.company_name}!`, "success");
      setApplyModalOffer(null);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setApplying(null);
    }
  };

  const filteredOffers = useMemo(() => {
    if (!query.trim()) return savedOffers;
    const q = query.toLowerCase();
    return savedOffers.filter(o =>
      o.title.toLowerCase().includes(q) ||
      o.company_name.toLowerCase().includes(q) ||
      o.location.toLowerCase().includes(q)
    );
  }, [savedOffers, query]);

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="display text-5xl font-bold text-white">Saved Opportunities</h1>
            <p className="text-white/55 mt-1 text-sm">Access and manage the roles you have bookmarked.</p>
          </div>
          <Button onClick={() => setPage("dashboard")} variant="ghost">← Back to Dashboard</Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"><Search size={18} /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved offers..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 py-4 text-white text-sm outline-none focus:border-[#e0c68f]/50 transition-colors"
          />
        </div>

        <div className="glass rounded-[2.5rem] p-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-16">
              <Bookmark className="mx-auto text-white/20 mb-4" size={48} />
              <p className="text-white/40 text-base">No saved opportunities found.</p>
              <Button onClick={() => setPage("jobs")} className="mt-4" variant="gold">
                Browse Offers
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {filteredOffers.map((offer) => (
                <div key={offer.id} className="relative flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:border-[#e0c68f]/30 hover:-translate-y-1">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-3 text-left">
                        <div className="rounded-xl bg-[#112250] border border-[#e0c68f]/20 h-10 w-10 flex items-center justify-center flex-shrink-0">
                          <span className="text-base font-bold text-[#e0c68f] font-serif">
                            {offer.company_name?.charAt(0) || "?"}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm line-clamp-1">{offer.title}</h3>
                          <p className="text-xs text-white/60">{offer.company_name}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleSave(offer)}
                        className="rounded-full p-2 text-[#e0c68f] hover:bg-white/10 transition"
                        title="Remove from saved"
                      >
                        <Heart size={18} className="fill-[#e0c68f] text-[#e0c68f]" />
                      </button>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="rounded-full bg-white/5 border border-white/5 px-2.5 py-1 text-[10px] text-white/70">
                        {offer.location}
                      </span>
                      <span className="rounded-full bg-white/5 border border-white/5 px-2.5 py-1 text-[10px] text-white/70">
                        {offer.type === "Job" ? "Full-time" : offer.type}
                      </span>
                      <span className="rounded-full bg-[#e0c68f]/10 border border-[#e0c68f]/10 px-2.5 py-1 text-[10px] text-[#e0c68f] font-semibold">
                        {offer.match ?? 50}% Match
                      </span>
                    </div>

                    <p className="text-xs text-white/50 line-clamp-3 mb-6 leading-relaxed text-left">
                      {offer.description}
                    </p>
                  </div>

                  <div className="flex gap-3 border-t border-white/5 pt-4">
                    <Button 
                      onClick={() => setSelectedOffer(offer)}
                      variant="ghost" 
                      className="flex-1 py-2 px-3 text-xs rounded-xl"
                    >
                      Details
                    </Button>
                    {offer.applied ? (
                      <Button variant="ghost" className="flex-1 py-2 px-3 text-xs rounded-xl opacity-50 cursor-default" disabled>
                        Applied ✓
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => initiateApply(offer)}
                        variant="gold" 
                        className="flex-1 py-2 px-3 text-xs rounded-xl"
                      >
                        Apply Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Detail Modal ─── */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity">
          <div className="glass w-full max-w-3xl rounded-[2.5rem] border border-white/10 text-white relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <button onClick={() => setSelectedOffer(null)} className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition">
              <X size={20} />
            </button>
            <div className="flex flex-col md:flex-row gap-6 p-8 border-b border-white/10 text-left">
              <div className="rounded-[1.75rem] bg-[#f5f0e9] h-20 w-20 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
                <span className="display text-4xl font-bold text-[#112250] font-serif">{selectedOffer.company_name?.charAt(0) || "?"}</span>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold font-serif text-white pr-8">{selectedOffer.title}</h2>
                <p className="text-[#e0c68f] font-semibold mt-1 text-base">{selectedOffer.company_name}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs text-white/60">
                  <div className="flex items-center gap-1.5"><Briefcase size={14} className="text-[#e0c68f]" /> <span>{selectedOffer.type === "Job" ? "Full-time" : selectedOffer.type}</span></div>
                  <div className="flex items-center gap-1.5"><Clock size={14} className="text-[#e0c68f]" /> <span>{selectedOffer.duration || "3-6 months"}</span></div>
                  <div className="flex items-center gap-1.5"><Building2 size={14} className="text-[#e0c68f]" /> <span>{selectedOffer.location}</span></div>
                </div>
              </div>
              <div className="rounded-2xl bg-[#e0c68f]/10 border border-[#e0c68f]/20 p-4 flex flex-col items-center justify-center flex-shrink-0 min-w-28 self-start">
                <span className="text-[10px] uppercase tracking-wider text-white/50">Smart Match</span>
                <span className="display text-3xl font-bold text-[#e0c68f] mt-1">{selectedOffer.match ?? 50}%</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 text-left">
              <h3 className="text-sm font-bold text-white mb-3">About the Position</h3>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{selectedOffer.description}</p>
            </div>
            <div className="border-t border-white/10 p-6 flex gap-4 bg-[#0a1020]/25">
              <button 
                onClick={() => toggleSave(selectedOffer)}
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-6 py-4.5 text-sm font-semibold transition text-white"
              >
                <Heart size={18} className="fill-[#e0c68f] text-[#e0c68f]" />
                <span>Saved</span>
              </button>
              {selectedOffer.applied ? (
                <Button variant="ghost" className="flex-1 py-4.5 rounded-full opacity-55 cursor-default" disabled>Applied ✓</Button>
              ) : (
                <Button 
                  onClick={() => { setSelectedOffer(null); initiateApply(selectedOffer); }}
                  className="flex-1 py-4.5 rounded-full"
                >
                  Apply Now
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Apply Modal ─── */}
      {applyModalOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity">
          <div className="glass w-full max-w-2xl rounded-[2.5rem] border border-white/10 text-white relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <button type="button" onClick={() => setApplyModalOffer(null)} className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition cursor-pointer z-10">
              <X size={20} />
            </button>
            <div className="px-8 pt-8 pb-4 text-left">
              <h2 className="text-3xl font-bold font-serif text-white pr-8">Submit Application</h2>
              <p className="text-[#e0c68f] font-semibold mt-1 text-base">{applyModalOffer.title}</p>
            </div>
            <form onSubmit={submitApplication} className="px-8 pb-8 overflow-y-auto flex-1 text-left">
              <div className="bg-white/5 rounded-2xl p-4 mb-6 flex items-center gap-4 border border-white/5">
                <div className="rounded-[1.2rem] bg-[#f5f0e9] h-14 w-14 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
                  <FileText size={24} className="text-[#112250]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-serif leading-tight">{applyModalOffer.title}</h3>
                  <p className="text-white/80 text-sm mt-0.5">{applyModalOffer.company_name}</p>
                  <p className="text-white/50 text-xs mt-0.5">{applyModalOffer.location}</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-2">Cover Letter *</label>
                <textarea 
                  required
                  maxLength={1000}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Explain why you are the ideal candidate for this role..."
                  className="w-full h-40 rounded-xl border border-white/10 bg-white/5 p-4 text-white text-sm outline-none focus:border-[#e0c68f]/50 resize-none transition-colors" 
                />
                <div className="text-xs text-white/40 mt-2">
                  {coverLetter.length}/1000 characters
                </div>
              </div>
              <div className="mb-8">
                <label className="block text-sm font-bold text-white mb-2">Resume Link (Optional)</label>
                <input 
                  type="url"
                  value={cvUrl}
                  onChange={e => setCvUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://linkedin.com/..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-white text-sm outline-none focus:border-[#e0c68f]/50 transition-colors" 
                />
              </div>
              <div className="flex gap-4">
                <Button variant="ghost" className="flex-1 py-4.5 rounded-full border-white/10" onClick={() => setApplyModalOffer(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" className="flex-1 py-4.5 rounded-full" disabled={applying === applyModalOffer.id}>
                  {applying === applyModalOffer.id ? "Sending..." : (
                    <>
                      <Send size={16} className="-ml-1 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Notifications View ───────────────────────────────────────────────────────
function NotificationsView({ user, setPage, showToast, setUnreadCount }: 
  { user: AuthUser; setPage: (p: Page) => void; showToast: (m: string, t: "success" | "error") => void; setUnreadCount: React.Dispatch<React.SetStateAction<number>> }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/notifications");
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, setUnreadCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (id: number) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
      setUnreadCount(0);
      showToast("All notifications marked as read.", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const deleteNotification = async (id: number, wasUnread: boolean) => {
    try {
      await api(`/notifications/${id}`, { method: "DELETE" });
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      showToast("Notification deleted.", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const clearAll = async () => {
    try {
      await api("/notifications", { method: "DELETE" });
      setNotifications([]);
      setUnreadCount(0);
      showToast("All notifications cleared.", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const filteredNotifications = filter === "all" 
    ? notifications 
    : notifications.filter(n => !n.read);

  const getNotificationIcon = (message: string) => {
    const text = message.toLowerCase();
    if (text.includes("applied") || text.includes("candidate") || text.includes("application")) {
      return <FileText className="text-[#e0c68f]" size={20} />;
    }
    if (text.includes("status") || text.includes("interview") || text.includes("accepted") || text.includes("rejected")) {
      return <Sparkles className="text-emerald-400" size={20} />;
    }
    return <Bell className="text-blue-400" size={20} />;
  };

  return (
    <main className="leaf-bg min-h-screen px-4 pb-20 pt-32 grain">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[#e0c68f]">Security & Alerts</p>
            <h1 className="display text-5xl font-bold text-white mt-2">Notification center.</h1>
          </div>
          <Button onClick={() => setPage(user.role === "student" ? "dashboard" : "company-dashboard")} variant="ghost">
            ← Back to Dashboard
          </Button>
        </div>

        <div className="glass rounded-[2.5rem] p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
            <div className="flex rounded-full border border-[#e0c68f]/20 p-1 bg-white/5 w-fit">
              <button 
                onClick={() => setFilter("all")} 
                className={`rounded-full px-5 py-2 text-xs font-semibold transition cursor-pointer ${filter === "all" ? "bg-[#e0c68f] text-[#0a1020]" : "text-white/70 hover:text-white"}`}
              >
                All ({notifications.length})
              </button>
              <button 
                onClick={() => setFilter("unread")} 
                className={`rounded-full px-5 py-2 text-xs font-semibold transition cursor-pointer ${filter === "unread" ? "bg-[#e0c68f] text-[#0a1020]" : "text-white/70 hover:text-white"}`}
              >
                Unread ({notifications.filter(n => !n.read).length})
              </button>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={markAllRead} 
                disabled={notifications.filter(n => !n.read).length === 0}
                className="rounded-full border border-white/10 hover:border-[#e0c68f]/40 hover:bg-white/5 transition text-xs text-white/70 px-4 py-2 font-medium cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Mark all read
              </button>
              <button 
                onClick={clearAll} 
                disabled={notifications.length === 0}
                className="rounded-full border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10 transition text-xs text-red-300 px-4 py-2 font-medium cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Clear all
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-20 border border-white/5 rounded-2xl bg-white/5">
              <Bell size={48} className="mx-auto mb-4 text-white/20" />
              <p className="text-white/40 text-sm font-medium">No notifications to display.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map(n => (
                <div 
                  key={n.id} 
                  className={`flex gap-4 items-start rounded-2xl p-4 transition-all duration-300 border ${n.read ? "bg-white/5 text-white/50 border-white/5" : "bg-[#e0c68f]/8 text-white border-[#e0c68f]/20 hover:bg-[#e0c68f]/12"}`}
                >
                  <div className="rounded-xl bg-white/10 p-3 mt-0.5">
                    {getNotificationIcon(n.message)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${!n.read ? "font-medium" : ""}`}>{n.message}</p>
                    <p className="mt-2 text-xs text-white/40">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <button 
                        onClick={() => markRead(n.id)} 
                        className="rounded-full border border-[#e0c68f]/30 bg-white/5 hover:bg-[#e0c68f]/25 px-3 py-1 text-xs font-semibold text-[#e0c68f] hover:text-white cursor-pointer transition"
                        title="Mark as read"
                      >
                        Mark Read
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(n.id, !n.read)} 
                      className="rounded-full p-2 text-white/40 hover:text-red-400 hover:bg-white/5 cursor-pointer transition"
                      title="Delete notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function Login({ setPage, onLogin, showToast }: { setPage: (p: Page) => void; onLogin: (user: AuthUser, token: string) => void; showToast: (m: string, t: "success" | "error") => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [roleTab, setRoleTab] = useState<Role>("student");
  const [form, setForm] = useState({ email: "", password: "", fullName: "", companyName: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, role: roleTab, fullName: form.fullName, companyName: form.companyName };
      const res = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      onLogin(res.data.user, res.data.token);
      showToast(mode === "login" ? "Welcome back!" : "Account created!", "success");
      setPage(res.data.user.role === "student" ? "dashboard" : "company-dashboard");
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[url('https://images.pexels.com/photos/1624496/pexels-photo-1624496.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=950&w=1600')] bg-cover bg-center px-4 py-10">
      <div className="absolute inset-0 bg-[#0a1020]/55" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center">
        <div className="glass w-full max-w-lg rounded-[2.5rem] p-8 sm:p-10">
          <div className="mb-8 flex justify-center"><button onClick={() => setPage("home")}><Logo /></button></div>
          <div className="mb-6 flex rounded-full border border-[#e0c68f]/30 p-1">
            <button onClick={() => setRoleTab("student")} className={`flex-1 rounded-full py-2 text-sm ${roleTab === "student" ? "bg-[#e0c68f] text-[#0a1020]" : "text-white/70"}`}>Student</button>
            <button onClick={() => setRoleTab("company")} className={`flex-1 rounded-full py-2 text-sm ${roleTab === "company" ? "bg-[#e0c68f] text-[#0a1020]" : "text-white/70"}`}>Company</button>
          </div>
          <h1 className="display text-center text-5xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create account"}</h1>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && roleTab === "company" && (
              <input required placeholder="Company Name" value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                className="focus-gold w-full rounded-full border border-white/14 bg-white/12 p-4 text-white placeholder:text-white/48" />
            )}
            {mode === "signup" && roleTab === "student" && (
              <input required placeholder="Full Name" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                className="focus-gold w-full rounded-full border border-white/14 bg-white/12 p-4 text-white placeholder:text-white/48" />
            )}
            <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="focus-gold w-full rounded-full border border-white/14 bg-white/12 p-4 text-white placeholder:text-white/48" />
            <input required type="password" placeholder="Password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="focus-gold w-full rounded-full border border-white/14 bg-white/12 p-4 text-white placeholder:text-white/48" />
            <Button type="submit" className="w-full py-4" variant="gold" disabled={loading}>{loading ? "Please wait..." : (mode === "login" ? "Login" : "Sign up")}</Button>
          </form>
          <div className="mt-6 text-center text-sm text-white/60">
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="hover:text-[#e0c68f] transition">
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ setPage, role }: { setPage: (p: Page) => void; role: Role }) {
  return (
    <footer className="leaf-bg border-t border-white/10 px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <Logo />
        <div className="flex flex-wrap gap-4 text-sm text-white/55">
          {role === "student"
            ? [["Opportunities", "jobs"], ["Dashboard", "dashboard"], ["Profile", "profile"]].map(([label, p]) => (
              <button key={p} onClick={() => setPage(p as Page)} className="hover:text-[#e0c68f] transition">{label}</button>
            ))
            : [["Dashboard", "company-dashboard"], ["Profile", "company-profile"], ["Create Offer", "create-offer"]].map(([label, p]) => (
              <button key={p} onClick={() => setPage(p as Page)} className="hover:text-[#e0c68f] transition">{label}</button>
            ))}
        </div>
        <p className="text-sm text-white/40">InternConnect © 2026</p>
      </div>
    </footer>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [booting, setBooting] = useState(true);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("ic_token");
    if (!token) { setBooting(false); return; }
    api("/auth/me").then(res => {
      setUser(res.data.user);
      setPage(res.data.user.role === "student" ? "home" : "company-dashboard");
    }).catch(() => {
      localStorage.removeItem("ic_token");
    }).finally(() => setBooting(false));
  }, []);

  // Poll notifications every 30 seconds
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      api("/notifications").then(res => setUnreadCount(res.data?.unreadCount || 0)).catch(() => { });
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = (u: AuthUser, token: string) => {
    localStorage.setItem("ic_token", token);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("ic_token");
    setUser(null);
    setPage("home");
    showToast("Logged out successfully.", "success");
  };

  const role: Role = user?.role || "student";

  const renderPage = () => {
    if (booting) return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1020]">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e0c68f] border-t-transparent mt-4" />
        </div>
      </div>
    );
    if (page === "login") return <Login setPage={setPage} onLogin={handleLogin} showToast={showToast} />;
    if (page === "jobs") return <Jobs user={user} showToast={showToast} />;
    if (page === "dashboard" && user?.role === "student") return <StudentDashboard user={user} showToast={showToast} setPage={setPage} />;
    if (page === "profile" && user?.role === "student") return <StudentProfile user={user!} showToast={showToast} />;
    if (page === "company-dashboard" && user?.role === "company") return <CompanyDashboard user={user} setPage={setPage} showToast={showToast} />;
    if (page === "company-profile" && user?.role === "company") return <CompanyProfile user={user!} showToast={showToast} />;
    if (page === "create-offer" && user?.role === "company") return <CreateOffer setPage={setPage} showToast={showToast} />;
    if (page === "candidates" && user?.role === "company") return <CandidatesView user={user!} setPage={setPage} showToast={showToast} />;
    if (page === "notifications" && user) return <NotificationsView user={user} setPage={setPage} showToast={showToast} setUnreadCount={setUnreadCount} />;
    if (page === "my-applications" && user?.role === "student") return <MyApplicationsPage user={user!} setPage={setPage} showToast={showToast} />;
    if (page === "saved-offers" && user?.role === "student") return <SavedOffersPage user={user!} setPage={setPage} showToast={showToast} />;
    if ((page === "dashboard" || page === "profile" || page === "notifications") && !user) { setPage("login"); return null; }
    return <Home setPage={setPage} />;
  };

  return (
    <div className="min-h-screen bg-[#0a1020]">
      {page !== "login" && !booting && (
        <Nav page={page} setPage={setPage} role={role} user={user} unreadCount={unreadCount} onLogout={handleLogout} />
      )}
      {renderPage()}
      {page !== "login" && !booting && <Footer setPage={setPage} role={role} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
