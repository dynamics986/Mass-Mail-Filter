import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { t } from "./i18n";
import { buildMonthGrid, monthLabel, shiftMonth, weekdayHeaders } from "./lib/calendar";
import { getAnnouncementsUrl, loadFaculties, loadFeed } from "./lib/data";
import { EXPORT_TEMPLATE, parseCuLinkMarkdown } from "./lib/markdownImport";
import { coachSeen, markCoachSeen } from "./lib/coach";
import {
  buildTimeline,
  ensureTimeMarks,
  formatMarkSpan,
  isActionThisWeek,
  kindLabel,
  nearestActionSortKey,
  type TimelineEntry,
} from "./lib/schedule";
import {
  evaluateItem,
  formatRequirementLabel,
  isClosingSoon,
  isExcluded,
  listRequirementChecks,
  relativeDeadline,
} from "./lib/scoring";
import { taxonomyLabel } from "./lib/taxonomyLabels";
import {
  clearState,
  defaultState,
  exportState,
  favoriteSnapshot,
  importState,
  loadState,
  saveState,
} from "./lib/storage";
import {
  hasFreshPolish,
  onPolishStoreChange,
  peekPolish,
  polishCount,
  polishItem,
  polishMany,
  type PolishRecord,
} from "./lib/enhance";
import { LANGUAGE_OPTIONS, toggleLanguage } from "./lib/languages";
import { loadSecrets, maskKey, saveSecrets, type AppSecrets } from "./lib/secrets";
import { testSiliconflowKey } from "./lib/siliconflow";
import { wantsChineseHelp, warmTranslator } from "./lib/translate";
import type {
  Evaluation,
  FacultiesFile,
  FeedMeta,
  GoalType,
  LocalState,
  MailItem,
  Profile,
  ScoreBreakdown,
  SortKey,
  TimeKind,
  YearLevel,
} from "./types";

type DimKey = "fit" | "urgent" | "value" | "meaningful";

const DIM_KEYS: DimKey[] = ["fit", "urgent", "value", "meaningful"];

const GOAL_OPTIONS: { id: GoalType; zh: string; en: string }[] = [
  { id: "paid", zh: "有薪工作", en: "Paid work" },
  { id: "research", zh: "研究体验", en: "Research" },
  { id: "competition", zh: "竞赛项目", en: "Competition" },
  { id: "volunteer", zh: "志愿活动", en: "Volunteer" },
  { id: "event", zh: "讲座活动", en: "Events" },
];

function dimLabel(key: DimKey, lang: "zh" | "en"): string {
  const map: Record<DimKey, { zh: string; en: string }> = {
    fit: { zh: "契合", en: "Fit" },
    urgent: { zh: "紧急", en: "Urgent" },
    value: { zh: "价值", en: "Value" },
    meaningful: { zh: "意义", en: "Meaning" },
  };
  return map[key][lang];
}

function ScoreMeters({
  scores,
  lang,
  keys = DIM_KEYS,
}: {
  scores: ScoreBreakdown;
  lang: "zh" | "en";
  keys?: Array<keyof Omit<ScoreBreakdown, "total">>;
}) {
  return (
    <div className="score-meters" aria-label="Score breakdown">
      {keys.map(key => {
        const value = scores[key];
        const label =
          key === "important"
            ? lang === "zh"
              ? "重要"
              : "Important"
            : dimLabel(key as DimKey, lang);
        return (
          <div key={key} className="score-meter">
            <span className="score-label">{label}</span>
            <div className="score-track" aria-hidden="true">
              <span className="score-fill" style={{ width: `${value}%` }} />
            </div>
            <span className="score-num">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Manual one-click polish; results are shared in localStorage and reused everywhere. */
function PolishBlock({
  item,
  profile,
  titleAs = "h3",
  summaryClass = "summary",
  compact,
}: {
  item: MailItem;
  profile: Profile;
  titleAs?: "h1" | "h3";
  summaryClass?: string;
  compact?: boolean;
}) {
  const lang = profile.language;
  const [record, setRecord] = useState<PolishRecord | undefined>(() => peekPolish(item, profile));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const sync = () => setRecord(peekPolish(item, profile));
    sync();
    return onPolishStoreChange(sync);
  }, [item.id, item.title, item.summary, item.bodyText, profile.language, profile.nativeLanguages]);

  const run = async (force = false) => {
    setBusy(true);
    setErr("");
    try {
      setRecord(await polishItem(item, profile, { force }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : lang === "zh" ? "润色失败" : "Polish failed");
    } finally {
      setBusy(false);
    }
  };

  const TitleTag = titleAs;
  const title = record?.title || item.title;
  const summary =
    record?.summary ||
    item.summary ||
    (lang === "zh" ? "暂无梗概，请查看原文。" : "No summary yet—open the original.");
  const cached = !!record;

  return (
    <div className="polish-block">
      <TitleTag>{title}</TitleTag>
      <p className={summaryClass}>{summary}</p>
      <div className="polish-actions">
        {cached ? (
          <>
            <span className="polish-cached">{lang === "zh" ? "已润色并已缓存" : "Polished · cached"}</span>
            {!compact && (
              <button type="button" className="linkish" disabled={busy} onClick={() => run(true)}>
                {busy ? (lang === "zh" ? "润色中…" : "Polishing…") : lang === "zh" ? "重新润色" : "Re-polish"}
              </button>
            )}
          </>
        ) : (
          <button type="button" className="chip polish-btn" disabled={busy} onClick={() => run(false)}>
            {busy ? (lang === "zh" ? "润色中…" : "Polishing…") : lang === "zh" ? "一键润色" : "Polish"}
          </button>
        )}
      </div>
      {cached && item.summary && record && record.summary !== item.summary && (
        <details className="zh-original">
          <summary>{lang === "zh" ? "查看原文" : "Show original"}</summary>
          <p>
            <b>{item.title}</b>
            <br />
            {item.summary}
          </p>
        </details>
      )}
      {err && <p className="translate-hint">{err}</p>}
    </div>
  );
}

function LanguageChecklist({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  lang: "zh" | "en";
}) {
  return (
    <fieldset className="lang-check">
      <legend>{label}</legend>
      <div className="lang-check-grid">
        {LANGUAGE_OPTIONS.map(opt => {
          const checked = value.includes(opt.id);
          return (
            <label key={opt.id} className={checked ? "on" : undefined}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(toggleLanguage(value, opt.id))}
              />
              <span>{lang === "zh" ? opt.zh : opt.en}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const split = (value: string) => value.split(",").map(x => x.trim()).filter(Boolean);
const fmtDate = (date: string | undefined, lang: "zh" | "en") =>
  date ? new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", { dateStyle: "medium" }).format(new Date(date)) : "—";
const money = (item: MailItem) =>
  item.compensation
    ? `HK$${item.compensation.minHkd ?? item.compensation.maxHkd ?? "?"}${
        item.compensation.maxHkd && item.compensation.maxHkd !== item.compensation.minHkd
          ? `–${item.compensation.maxHkd}`
          : ""
      }`
    : "—";
const audienceSummary = (item: MailItem, lang: "zh" | "en") => {
  const req = item.requirements.find(r => r.field === "studentLevel" || r.field === "major");
  if (req) return String(req.value);
  return lang === "zh" ? "全体学生" : "All students";
};

interface ToastState {
  message: string;
  undo?: () => void;
}

function App() {
  const [local, setLocal] = useState<LocalState>(() => loadState());
  const [items, setItems] = useState<MailItem[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [faculties, setFaculties] = useState<FacultiesFile | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadFeed()
      .then(data => {
        setItems(data.items);
        setMeta(data.meta);
        setOffline(data.offline);
      })
      .catch(() => setError("Unable to load the data feed."));
    loadFaculties()
      .then(setFaculties)
      .catch(() => undefined);
  }, []);
  useEffect(() => saveState(local), [local]);
  useEffect(() => {
    if (wantsChineseHelp(local.profile.nativeLanguages, local.profile.language)) {
      void warmTranslator();
    }
  }, [local.profile.nativeLanguages, local.profile.language]);

  const updateLocal = (fn: (state: LocalState) => LocalState) => setLocal(s => fn(s));
  const profileIncomplete = !local.profile.facultyId || !local.profile.year;
  const allItems = useMemo(() => {
    const imported = local.importedItems ?? [];
    const map = new Map<string, MailItem>();
    for (const item of items) map.set(item.id, item);
    for (const item of imported) map.set(item.id, item);
    return [...map.values()];
  }, [items, local.importedItems]);

  const showToast = (message: string, undo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  };
  const hideItem = (item: MailItem) => {
    updateLocal(s => ({ ...s, hidden: [...new Set([...s.hidden, item.id])] }));
    showToast(
      local.profile.language === "zh" ? `已隐藏「${item.title}」` : `Hidden: ${item.title}`,
      () => updateLocal(s => ({ ...s, hidden: s.hidden.filter(id => id !== item.id) })),
    );
  };

  return (
    <div className="app-shell">
      <Header local={local} setLocal={setLocal} />
      {(offline || error) && (
        <div className="notice warning">{offline ? t(local.profile.language, "offline") : error}</div>
      )}
      {meta && Date.now() - new Date(meta.fetchedAt).getTime() > 10 * 86400000 && (
        <div className="notice warning">
          <span>{t(local.profile.language, "stale")}</span>
          <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
            Digest ↗
          </a>
        </div>
      )}
      {local.profile.onboarded && profileIncomplete && (
        <div className="notice info-banner">
          <span>{t(local.profile.language, "completeProfile")}</span>
          <NavLink to="/settings">{t(local.profile.language, "settings")}</NavLink>
        </div>
      )}
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                items={allItems}
                local={local}
                updateLocal={updateLocal}
                meta={meta}
                hideItem={hideItem}
                showToast={showToast}
              />
            }
          />
          <Route path="/item/:id" element={<Detail items={allItems} local={local} updateLocal={updateLocal} />} />
          <Route path="/history" element={<History items={allItems} local={local} updateLocal={updateLocal} />} />
          <Route path="/timeline" element={<TimelinePage items={allItems} local={local} />} />
          <Route path="/import" element={<ImportPage local={local} setLocal={setLocal} />} />
          <Route path="/digests" element={<DigestArchive items={allItems} local={local} />} />
          <Route
            path="/settings"
            element={<Settings local={local} setLocal={setLocal} faculties={faculties} />}
          />
        </Routes>
      </main>
      <BottomNav lang={local.profile.language} />
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              {t(local.profile.language, "undo")}
            </button>
          )}
        </div>
      )}
      {!local.profile.onboarded && (
        <Onboarding
          profile={local.profile}
          faculties={faculties}
          onSave={profile => setLocal(s => ({ ...s, profile: { ...profile, onboarded: true } }))}
        />
      )}
    </div>
  );
}

function BottomNav({ lang }: { lang: "zh" | "en" }) {
  return (
    <nav className="bottom-nav" aria-label={lang === "zh" ? "移动导航" : "Mobile navigation"}>
      <NavLink to="/">{t(lang, "home")}</NavLink>
      <NavLink to="/timeline">{t(lang, "timeline")}</NavLink>
      <NavLink to="/import">{t(lang, "importMail")}</NavLink>
      <NavLink to="/history">{t(lang, "history")}</NavLink>
      <NavLink to="/settings">{t(lang, "settings")}</NavLink>
    </nav>
  );
}

function Header({ local, setLocal }: { local: LocalState; setLocal: (state: LocalState) => void }) {
  const lang = local.profile.language;
  return (
    <header className="topbar">
      <NavLink to="/" className="brand">
        <span className="brand-mark">CU</span>
        <span>
          <b>CU Link</b>
          <small>Mass Mail Filter</small>
        </span>
      </NavLink>
      <nav>
        <NavLink to="/">{t(lang, "home")}</NavLink>
        <NavLink to="/timeline">{t(lang, "timeline")}</NavLink>
        <NavLink to="/import">{t(lang, "importMail")}</NavLink>
        <NavLink to="/history">{t(lang, "history")}</NavLink>
        <NavLink to="/digests">{t(lang, "digests")}</NavLink>
        <NavLink to="/settings">{t(lang, "settings")}</NavLink>
      </nav>
      <button
        className="lang-button"
        aria-label="Toggle language"
        onClick={() =>
          setLocal({ ...local, profile: { ...local.profile, language: lang === "zh" ? "en" : "zh" } })
        }
      >
        {lang === "zh" ? "EN" : "中"}
      </button>
    </header>
  );
}

function Home({
  items,
  local,
  updateLocal,
  meta,
  hideItem,
  showToast,
}: {
  items: MailItem[];
  local: LocalState;
  updateLocal: (fn: (s: LocalState) => LocalState) => void;
  meta: FeedMeta | null;
  hideItem: (item: MailItem) => void;
  showToast: (message: string, undo?: () => void) => void;
}) {
  const lang = local.profile.language;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "all";
  const sort = (params.get("sort") as SortKey) || "total";
  const showIneligible = params.get("ineligible") === "1";
  const mode = (params.get("mode") as "feed" | "action") || "feed";
  const query = params.get("q") || "";
  const mins = useMemo(() => {
    const read = (key: string) => {
      const n = Number(params.get(key));
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
    };
    return {
      fit: read("minFit"),
      urgent: read("minUrgent"),
      value: read("minValue"),
      meaningful: read("minMeaning"),
    } satisfies Record<DimKey, number>;
  }, [params]);
  const hasDimFilter = DIM_KEYS.some(k => mins[k] > 0);

  const setFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("filter");
    else next.set("filter", value);
    setParams(next, { replace: true });
  };
  const setSort = (value: SortKey) => {
    const next = new URLSearchParams(params);
    if (value === "total") next.delete("sort");
    else next.set("sort", value);
    setParams(next, { replace: true });
  };
  const setMin = (key: DimKey, value: number) => {
    const next = new URLSearchParams(params);
    const param =
      key === "fit" ? "minFit" : key === "urgent" ? "minUrgent" : key === "value" ? "minValue" : "minMeaning";
    if (value <= 0) next.delete(param);
    else next.set(param, String(value));
    setParams(next, { replace: true });
  };
  const clearMins = () => {
    const next = new URLSearchParams(params);
    ["minFit", "minUrgent", "minValue", "minMeaning"].forEach(k => next.delete(k));
    setParams(next, { replace: true });
  };
  const setMode = (value: "feed" | "action") => {
    const next = new URLSearchParams(params);
    if (value === "feed") next.delete("mode");
    else next.set("mode", value);
    setParams(next, { replace: true });
  };
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete("q");
    else next.set("q", value);
    setParams(next, { replace: true });
  };

  const evaluated = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map(item => ({ item, evaluation: evaluateItem(item, local.profile) }))
      .filter(x => !local.hidden.includes(x.item.id) && !isExcluded(x.item, local.profile))
      .filter(x => showIneligible || x.evaluation.eligibility !== "ineligible")
      .filter(x => {
        if (!q) return true;
        const blob = `${x.item.title} ${x.item.summary} ${x.item.tags.join(" ")} ${x.item.organizer ?? ""} ${x.item.category}`.toLowerCase();
        return blob.includes(q);
      })
      .filter(x => {
        if (filter === "all") return true;
        if (filter === "paid") return !!x.item.compensation;
        if (filter === "deadline") return isClosingSoon(x.item);
        if (filter === "research") return x.item.taxonomy?.type === "research";
        if (filter === "paid_work") return x.item.taxonomy?.type === "paid_work";
        if (filter === "event") return x.item.taxonomy?.type === "event" || x.item.taxonomy?.type === "programme";
        return true;
      })
      .filter(x =>
        DIM_KEYS.every(key => x.evaluation.scores[key] >= mins[key]),
      )
      .filter(x => mode !== "action" || isActionThisWeek(x.item))
      .sort((a, b) => {
        if (mode === "action") {
          const ak = nearestActionSortKey(a.item);
          const bk = nearestActionSortKey(b.item);
          if (ak !== bk) return ak.localeCompare(bk);
          return b.evaluation.scores.urgent - a.evaluation.scores.urgent;
        }
        if (sort === "urgent") return b.evaluation.scores.urgent - a.evaluation.scores.urgent;
        if (sort === "value") return b.evaluation.scores.value - a.evaluation.scores.value;
        if (sort === "fit") return b.evaluation.scores.fit - a.evaluation.scores.fit;
        return b.evaluation.score - a.evaluation.score;
      });
  }, [items, local, filter, sort, showIneligible, mins, mode, query]);

  const [focusIndex, setFocusIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCoach, setShowCoach] = useState(() => !coachSeen());
  const searchRef = useRef<HTMLInputElement>(null);
  const dismissCoach = () => {
    markCoachSeen();
    setShowCoach(false);
  };

  useEffect(() => {
    setFocusIndex(i => Math.min(i, Math.max(0, evaluated.length - 1)));
  }, [evaluated.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "?") {
        setShowShortcuts(s => !s);
        return;
      }
      if (!evaluated.length) return;
      if (e.key === "j") {
        e.preventDefault();
        setFocusIndex(i => Math.min(evaluated.length - 1, i + 1));
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        setFocusIndex(i => Math.max(0, i - 1));
        return;
      }
      const current = evaluated[focusIndex]?.item;
      if (!current) return;
      if (e.key === "Enter") {
        navigate(`/item/${current.id}`);
        return;
      }
      if (e.key === "h") {
        hideItem(current);
        return;
      }
      if (e.key === "s") {
        updateLocal(s => {
          const favorites = { ...s.favorites };
          if (favorites[current.id]) delete favorites[current.id];
          else favorites[current.id] = favoriteSnapshot(current);
          return { ...s, favorites };
        });
        return;
      }
      if (e.key === "p") {
        polishItem(current, local.profile)
          .then(() => showToast(lang === "zh" ? "已润色" : "Polished"))
          .catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evaluated, focusIndex, local.profile, lang, navigate, hideItem, updateLocal, showToast]);

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedItems = useMemo(
    () => evaluated.filter(x => selected.has(x.item.id)).map(x => x.item),
    [evaluated, selected],
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkHide = () => {
    const ids = selectedItems.map(i => i.id);
    if (!ids.length) return;
    updateLocal(s => ({ ...s, hidden: [...new Set([...s.hidden, ...ids])] }));
    showToast(
      lang === "zh" ? `已隐藏 ${ids.length} 项` : `Hid ${ids.length} items`,
      () => updateLocal(s => ({ ...s, hidden: s.hidden.filter(id => !ids.includes(id)) })),
    );
    setSelected(new Set());
  };
  const bulkFavorite = () => {
    if (!selectedItems.length) return;
    updateLocal(s => {
      const favorites = { ...s.favorites };
      selectedItems.forEach(item => {
        favorites[item.id] = favoriteSnapshot(item);
      });
      return { ...s, favorites };
    });
    showToast(lang === "zh" ? `已收藏 ${selectedItems.length} 项` : `Saved ${selectedItems.length} items`);
    setSelected(new Set());
  };
  const bulkPolish = async () => {
    if (!selectedItems.length || bulkBusy) return;
    setBulkBusy(true);
    try {
      await polishMany(selectedItems, local.profile, { concurrency: 2 });
      showToast(lang === "zh" ? "已润色所选" : "Polished selected");
    } finally {
      setBulkBusy(false);
      setSelected(new Set());
    }
  };

  const digestCount = useMemo(() => new Set(items.map(i => i.digestDate)).size, [items]);
  const stale = meta ? Date.now() - new Date(meta.fetchedAt).getTime() > 10 * 86400000 : false;

  const [polishTick, setPolishTick] = useState(0);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMsg, setBatchMsg] = useState("");
  useEffect(() => onPolishStoreChange(() => setPolishTick(n => n + 1)), []);
  const pendingPolish = useMemo(
    () => evaluated.filter(x => !hasFreshPolish(x.item, local.profile)).length,
    [evaluated, local.profile, polishTick],
  );

  const runBatchPolish = async () => {
    if (!evaluated.length || batchBusy) return;
    setBatchBusy(true);
    setBatchMsg(lang === "zh" ? "正在润色…" : "Polishing…");
    try {
      const result = await polishMany(
        evaluated.map(x => x.item),
        local.profile,
        {
          concurrency: 2,
          onProgress: (done, total) =>
            setBatchMsg(lang === "zh" ? `润色中 ${done}/${total}` : `Polishing ${done}/${total}`),
        },
      );
      setBatchMsg(
        lang === "zh"
          ? `完成：新润色 ${result.polished}，跳过已缓存 ${result.skipped}${result.failed ? `，失败 ${result.failed}` : ""}（库内共 ${polishCount()} 条）`
          : `Done: ${result.polished} new, ${result.skipped} cached skipped${result.failed ? `, ${result.failed} failed` : ""} (${polishCount()} in store)`,
      );
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <>
      <section className="hero compact-mobile">
        <p className="eyebrow">CUHK · Undergraduate Digest</p>
        <p className="motto">{t(lang, "motto")}</p>
        <h1>{lang === "zh" ? "适合你的机会，排在前面" : "Opportunities that fit, first."}</h1>
        <p>
          {lang === "zh"
            ? "按紧急、价值、契合与意义综合排序。每条推荐都能展开依据，画像只留在本机。"
            : "Ranked by urgency, value, fit, and meaning—with clear evidence. Your profile never leaves this device."}
        </p>
      </section>
      {meta && (
        <div className="freshness-strip">
          <span>
            {lang === "zh"
              ? `${digestCount} 期 Digest · 更新于 ${fmtDate(meta.fetchedAt, lang)}`
              : `${digestCount} digests · updated ${fmtDate(meta.fetchedAt, lang)}`}
          </span>
          {stale && (
            <span className="freshness-actions">
              <NavLink to="/digests">{t(lang, "digests")} ↗</NavLink>
              <NavLink to="/import">{t(lang, "importMail")}</NavLink>
            </span>
          )}
        </div>
      )}
      {showCoach && (
        <div className="coachmark">
          <p>
            <b>{lang === "zh" ? "小贴士" : "Quick tips"}</b>
          </p>
          <ul>
            <li>{lang === "zh" ? "按「/」聚焦搜索框" : "Press \"/\" to jump to search"}</li>
            <li>
              {lang === "zh"
                ? "切换到「本周行动」查看即将到来的截止与活动"
                : "Switch to \"This week\" to see upcoming deadlines & events"}
            </li>
            <li>
              {lang === "zh"
                ? "勾选多个卡片可批量收藏 / 隐藏 / 润色"
                : "Select multiple cards to bulk save / hide / polish"}
            </li>
          </ul>
          <button type="button" className="chip" onClick={dismissCoach}>
            {t(lang, "dismissTips")}
          </button>
        </div>
      )}
      <section className="toolbar">
        <div>
          <p className="section-kicker">{lang === "zh" ? "模式" : "Mode"}</p>
          <div className="chips">
            <button
              type="button"
              className={mode === "feed" ? "chip active" : "chip"}
              onClick={() => setMode("feed")}
            >
              {t(lang, "forYou")}
            </button>
            <button
              type="button"
              className={mode === "action" ? "chip active" : "chip"}
              onClick={() => setMode("action")}
            >
              {t(lang, "actionInbox")}
            </button>
          </div>
        </div>
        <div>
          <p className="section-kicker">{lang === "zh" ? "搜索" : "Search"}</p>
          <input
            ref={searchRef}
            type="search"
            name="home-search"
            autoComplete="off"
            className="home-search"
            placeholder={t(lang, "search")}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div>
          <p className="section-kicker">{lang === "zh" ? "筛选" : "Filters"}</p>
          <div className="chips">
            {[
              ["all", lang === "zh" ? "全部" : "All"],
              ["paid_work", lang === "zh" ? "有薪工作" : "Paid work"],
              ["research", lang === "zh" ? "研究" : "Research"],
              ["event", lang === "zh" ? "活动课程" : "Events"],
              ["paid", lang === "zh" ? "有报酬" : "Compensated"],
              ["deadline", lang === "zh" ? "即将截止" : "Closing soon"],
            ].map(([key, label]) => (
              <button key={key} className={filter === key ? "chip active" : "chip"} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="section-kicker">{lang === "zh" ? "排序" : "Sort"}</p>
          <div className="chips">
            {(
              [
                ["total", "sortTotal"],
                ["urgent", "sortUrgent"],
                ["value", "sortValue"],
                ["fit", "sortFit"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} className={sort === key ? "chip active" : "chip"} onClick={() => setSort(key)}>
                {t(lang, label)}
              </button>
            ))}
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={showIneligible}
            onChange={e => {
              const next = new URLSearchParams(params);
              if (e.target.checked) next.set("ineligible", "1");
              else next.delete("ineligible");
              setParams(next, { replace: true });
            }}
          />
          <span>{t(lang, "showIneligible")}</span>
        </label>
        <div className="dim-filters">
          <div className="dim-filters-head">
            <p className="section-kicker">{lang === "zh" ? "分数门槛" : "Score thresholds"}</p>
            {hasDimFilter && (
              <button type="button" className="linkish" onClick={clearMins}>
                {lang === "zh" ? "重置拉杆" : "Reset sliders"}
              </button>
            )}
          </div>
          <div className="dim-filters-grid">
            {DIM_KEYS.map(key => (
              <label key={key}>
                <span>
                  {dimLabel(key, lang)}
                  <b>≥ {mins[key]}</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={mins[key]}
                  onChange={e => setMin(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>
      </section>
      <section className="feed">
        <div className="feed-heading">
          <div>
            <p className="section-kicker">{lang === "zh" ? "最近有效机会" : "Recent & open"}</p>
            <h2>{t(lang, "home")}</h2>
          </div>
          <div className="feed-heading-actions">
            <button
              type="button"
              className="chip polish-btn"
              disabled={batchBusy || !evaluated.length || pendingPolish === 0}
              onClick={runBatchPolish}
              title={
                lang === "zh"
                  ? "只润色尚未缓存的条目；已润色的会跳过"
                  : "Only polishes items not yet cached"
              }
            >
              {batchBusy
                ? lang === "zh"
                  ? "润色中…"
                  : "Polishing…"
                : lang === "zh"
                  ? `一键润色本页${pendingPolish ? `（${pendingPolish}）` : ""}`
                  : `Polish page${pendingPolish ? ` (${pendingPolish})` : ""}`}
            </button>
            <span>
              {evaluated.length} {lang === "zh" ? "项" : "items"}
            </span>
          </div>
        </div>
        {batchMsg && <p className="translate-hint" style={{ marginTop: -8, marginBottom: 14 }}>{batchMsg}</p>}
        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>
              {selected.size} {lang === "zh" ? "已选" : "selected"}
            </span>
            <button type="button" onClick={bulkHide}>
              {t(lang, "bulkHide")}
            </button>
            <button type="button" onClick={bulkFavorite}>
              {t(lang, "bulkSave")}
            </button>
            <button type="button" disabled={bulkBusy} onClick={bulkPolish}>
              {bulkBusy ? (lang === "zh" ? "润色中…" : "Polishing…") : t(lang, "bulkPolish")}
            </button>
            <button type="button" className="linkish" onClick={() => setSelected(new Set())}>
              {lang === "zh" ? "取消选择" : "Clear selection"}
            </button>
          </div>
        )}
        {evaluated.length ? (
          <div className="card-grid">
            {evaluated.map((x, i) => (
              <OpportunityCard
                key={x.item.id}
                {...x}
                local={local}
                updateLocal={updateLocal}
                onHide={hideItem}
                focused={i === focusIndex}
                selected={selected.has(x.item.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        ) : (
          <Empty
            text={t(lang, "noResults")}
            actions={
              <>
                <button
                  className="chip"
                  onClick={() => {
                    setFilter("all");
                    clearMins();
                  }}
                >
                  {lang === "zh" ? "放宽筛选" : "Clear filters"}
                </button>
                <NavLink className="chip" to="/settings">
                  {t(lang, "completeProfile")}
                </NavLink>
              </>
            }
          />
        )}
      </section>
      {showShortcuts && (
        <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <section
            className="shortcuts-panel"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <h2>{t(lang, "shortcuts")}</h2>
            <ul className="shortcuts-list">
              <li>
                <kbd>j</kbd>/<kbd>k</kbd> {lang === "zh" ? "上下移动焦点" : "Move focus down/up"}
              </li>
              <li>
                <kbd>Enter</kbd> {lang === "zh" ? "打开详情" : "Open detail"}
              </li>
              <li>
                <kbd>h</kbd> {lang === "zh" ? "隐藏（可撤销）" : "Hide (undoable)"}
              </li>
              <li>
                <kbd>s</kbd> {lang === "zh" ? "收藏 / 取消收藏" : "Toggle save"}
              </li>
              <li>
                <kbd>p</kbd> {lang === "zh" ? "润色当前项" : "Polish current item"}
              </li>
              <li>
                <kbd>/</kbd> {lang === "zh" ? "聚焦搜索框" : "Focus search"}
              </li>
              <li>
                <kbd>?</kbd> {lang === "zh" ? "显示 / 隐藏此面板" : "Toggle this panel"}
              </li>
            </ul>
            <button type="button" className="chip" onClick={() => setShowShortcuts(false)}>
              {t(lang, "dismissTips")}
            </button>
          </section>
        </div>
      )}
    </>
  );
}

function OpportunityCard({
  item,
  evaluation,
  local,
  updateLocal,
  onHide,
  selected,
  onToggleSelect,
  focused,
  hiddenView,
}: {
  item: MailItem;
  evaluation: Evaluation;
  local: LocalState;
  updateLocal: (fn: (s: LocalState) => LocalState) => void;
  onHide?: (item: MailItem) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  focused?: boolean;
  hiddenView?: boolean;
}) {
  const lang = local.profile.language;
  const favorite = !!local.favorites[item.id];
  const deadlineLabel = relativeDeadline(item, lang);
  const hot = isClosingSoon(item);
  const highConfidenceReqs = listRequirementChecks(item, local.profile)
    .filter(c => c.req.confidence === "high")
    .slice(0, 2);
  return (
    <article className={focused ? "opportunity-card focused" : "opportunity-card"}>
      <div className="card-top">
        {onToggleSelect && (
          <label className="card-select" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect(item.id)}
              aria-label={lang === "zh" ? "选择此项" : "Select this item"}
            />
          </label>
        )}
        <span className={`status ${evaluation.eligibility}`}>{t(lang, evaluation.eligibility)}</span>
        {item.source === "import" && (
          <span className="import-badge">{lang === "zh" ? "已导入" : "Imported"}</span>
        )}
        <span className="score-total">
          <b>{evaluation.score}</b>/100
        </span>
      </div>
      <p className="category">
        {item.taxonomy?.type?.replace("_", " ") ?? item.category} · {fmtDate(item.digestDate, lang)}
      </p>
      <PolishBlock item={item} profile={local.profile} titleAs="h3" summaryClass="summary" compact />
      <div className="tags">
        {(item.tags.length ? item.tags : item.taxonomy?.domains ?? []).slice(0, 3).map(tag => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {!!highConfidenceReqs.length && (
        <div className="req-tags">
          {highConfidenceReqs.map((c, i) => (
            <span key={i} className={`req-tag req-${c.result}`}>
              {formatRequirementLabel(c.req, lang)}
            </span>
          ))}
        </div>
      )}
      <ScoreMeters scores={evaluation.scores} lang={lang} />
      <div className="card-meta">
        <span>{money(item)}</span>
        <span className={hot ? "deadline-hot" : undefined}>◷ {deadlineLabel}</span>
      </div>
      <div className="card-actions">
        <NavLink className="primary" to={`/item/${item.id}`}>
          {t(lang, "view")}
        </NavLink>
        <button
          aria-label={favorite ? t(lang, "unfavorite") : t(lang, "favorite")}
          className={favorite ? "icon-button selected" : "icon-button"}
          onClick={() =>
            updateLocal(s => {
              const favorites = { ...s.favorites };
              if (favorites[item.id]) delete favorites[item.id];
              else favorites[item.id] = favoriteSnapshot(item);
              return { ...s, favorites };
            })
          }
        >
          {favorite ? "★" : "☆"}
        </button>
        {hiddenView ? (
          <button
            className="icon-button"
            aria-label={t(lang, "unhide")}
            onClick={() => updateLocal(s => ({ ...s, hidden: s.hidden.filter(id => id !== item.id) }))}
          >
            {t(lang, "unhide")}
          </button>
        ) : (
          <button
            className="icon-button"
            aria-label={t(lang, "hide")}
            onClick={() =>
              onHide ? onHide(item) : updateLocal(s => ({ ...s, hidden: [...new Set([...s.hidden, item.id])] }))
            }
          >
            ×
          </button>
        )}
      </div>
    </article>
  );
}

function Detail({
  items,
  local,
  updateLocal,
}: {
  items: MailItem[];
  local: LocalState;
  updateLocal: (fn: (s: LocalState) => LocalState) => void;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = items.find(i => i.id === id);
  const lang = local.profile.language;
  const [feedbackState, setFeedbackState] = useState({ disliked: false, liked: false });
  const [lastExcluded, setLastExcluded] = useState<string[] | null>(null);
  if (!item) return <Empty text={lang === "zh" ? "找不到此项目，可能已经归档。" : "This item may have been archived."} />;
  const evaluation = evaluateItem(item, local.profile);
  const topic = item.taxonomy?.type ?? item.tags[0] ?? item.category;
  const reqChecks = listRequirementChecks(item, local.profile);
  return (
    <article className="detail">
      <button className="back" onClick={() => navigate(-1)}>
        ← {t(lang, "back")}
      </button>
      <div className="detail-head">
        <div>
          <span className={`status ${evaluation.eligibility}`}>{t(lang, evaluation.eligibility)}</span>
          <p className="category">
            {item.category} · {fmtDate(item.digestDate, lang)}
          </p>
          <PolishBlock item={item} profile={local.profile} titleAs="h1" summaryClass="page-intro" />
        </div>
        <div className="score-ring">
          <strong>{evaluation.score}</strong>
          <span>/100</span>
        </div>
      </div>
      <div className="detail-grid">
        <section>
          <h2>{t(lang, "evidence")}</h2>
          <div style={{ marginBottom: 18 }}>
            <ScoreMeters
              scores={evaluation.scores}
              lang={lang}
              keys={["fit", "urgent", "value", "meaningful", "important"]}
            />
          </div>
          <div className="reasons large">
            {evaluation.reasons.map((r, i) => (
              <div key={`${r.key}-${i}`}>
                <b>
                  {r.points > 0 ? "+" : ""}
                  {r.points}
                </b>
                <span>
                  [{r.dimension}] {r.label}
                </span>
              </div>
            ))}
          </div>
          {evaluation.evidence.length ? (
            <ul className="evidence">
              {evaluation.evidence.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {lang === "zh" ? "邮件没有足够明确的资格信息，请核对原文。" : "Not enough explicit eligibility text. Check the original."}
            </p>
          )}
          <section className="requirements-block">
            <h2>{t(lang, "requirements")}</h2>
            {reqChecks.length ? (
              <ul className="req-checklist">
                {reqChecks.map((c, i) => (
                  <li key={i} className={`req-${c.result}`}>
                    <span className="req-icon" aria-hidden="true">
                      {c.result === "match" ? "✓" : c.result === "conflict" ? "✗" : "?"}
                    </span>
                    <span>{formatRequirementLabel(c.req, lang)}</span>
                    <small className="muted">{c.req.evidence}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {lang === "zh" ? "未提取到明确的资格要求。" : "No explicit requirements extracted."}
              </p>
            )}
          </section>
          {!!item.keyPhrases?.length && (
            <details className="key-phrases">
              <summary>{lang === "zh" ? "关键词" : "Key phrases"}</summary>
              <ul>
                {item.keyPhrases.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </details>
          )}
          {!!item.summaryEvidence?.length && (
            <details className="summary-evidence">
              <summary>{lang === "zh" ? "摘要依据" : "Summary evidence"}</summary>
              <ul>
                {item.summaryEvidence.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <aside>
          <div className="fact-grid">
            <Info label={lang === "zh" ? "类目" : "Category"} value={taxonomyLabel(item.taxonomy?.type, lang)} />
            <Info label={t(lang, "compensation")} value={money(item)} />
            <Info label={lang === "zh" ? "截止" : "Deadline"} value={relativeDeadline(item, lang)} />
            <Info label={lang === "zh" ? "对象" : "Audience"} value={audienceSummary(item, lang)} />
          </div>
          <Info label={lang === "zh" ? "截止证据" : "Deadline evidence"} value={item.deadlineEvidence || "—"} />
          <Info label={lang === "zh" ? "主办方" : "Organizer"} value={item.organizer ?? "—"} />
          {item.contactEmail && <a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a>}
          <div className="info">
            <span>{lang === "zh" ? "时间节点" : "Schedule"}</span>
            <ul className="mini-schedule">
              {ensureTimeMarks(item).map((mark, i) => (
                <li key={`${mark.kind}-${i}`}>
                  <b>{kindLabel(mark.kind, lang)}</b> {formatMarkSpan(mark, lang)}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <section className="message">
        <h2>{t(lang, "body")}</h2>
        <p>{item.cleanBody || item.bodyText}</p>
      </section>
      <section className="link-list">
        <a className="primary" href={item.sourceUrl} target="_blank" rel="noreferrer">
          {t(lang, "source")} ↗
        </a>
        {item.applicationUrls.map(url => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {t(lang, "apply")} ↗
          </a>
        ))}
      </section>
      <section className="feedback">
        <button
          className={feedbackState.disliked ? "confirmed" : ""}
          aria-pressed={feedbackState.disliked}
          onClick={() => {
            const additions = [...new Set([topic, taxonomyLabel(item.taxonomy?.type, lang)])];
            updateLocal(s => ({
              ...s,
              profile: { ...s.profile, excluded: [...new Set([...s.profile.excluded, ...additions])] },
            }));
            setLastExcluded(additions);
            setFeedbackState(state => ({ ...state, disliked: true }));
          }}
        >
          {feedbackState.disliked ? (lang === "zh" ? "✓ 已减少此类" : "✓ Showing less") : t(lang, "dislike")}
        </button>
        {feedbackState.disliked && lastExcluded && (
          <button
            type="button"
            className="linkish"
            onClick={() => {
              updateLocal(s => ({
                ...s,
                profile: {
                  ...s.profile,
                  excluded: s.profile.excluded.filter(x => !lastExcluded.includes(x)),
                },
              }));
              setLastExcluded(null);
              setFeedbackState(state => ({ ...state, disliked: false }));
            }}
          >
            {t(lang, "undo")}
          </button>
        )}
        <button
          className={feedbackState.liked ? "confirmed" : ""}
          aria-pressed={feedbackState.liked}
          onClick={() => {
            const goalMap: Record<string, GoalType> = {
              paid_work: "paid",
              research: "research",
              competition: "competition",
              service: "volunteer",
              event: "event",
              programme: "event",
            };
            const goal = goalMap[item.taxonomy?.type ?? ""];
            updateLocal(s => ({
              ...s,
              profile: {
                ...s.profile,
                goals: goal ? [...new Set([...s.profile.goals, goal])] : s.profile.goals,
              },
            }));
            setFeedbackState(state => ({ ...state, liked: true }));
          }}
        >
          {feedbackState.liked ? (lang === "zh" ? "✓ 已加强此类" : "✓ Preference saved") : t(lang, "addInterest")}
        </button>
        <button onClick={() => updateLocal(s => ({ ...s, corrections: [...new Set([...s.corrections, item.id])] }))}>
          {local.corrections.includes(item.id) ? "✓ " : ""}
          {t(lang, "correction")}
        </button>
      </section>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function History({
  items,
  local,
  updateLocal,
}: {
  items: MailItem[];
  local: LocalState;
  updateLocal: (fn: (s: LocalState) => LocalState) => void;
}) {
  const lang = local.profile.language;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "saved" | "hidden">("all");
  const q = query.toLowerCase();
  const visible = items
    .filter(item => `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLowerCase().includes(q))
    .filter(
      item =>
        view === "all" ||
        (view === "saved" && local.favorites[item.id]) ||
        (view === "hidden" && local.hidden.includes(item.id)),
    );
  const archived =
    view === "saved"
      ? Object.values(local.favorites).filter(f => !items.some(i => i.id === f.id))
      : [];
  return (
    <section className="page">
      <p className="eyebrow">Archive · Search</p>
      <h1>{t(lang, "history")}</h1>
      <p className="page-intro">
        {lang === "zh" ? (
          <>
            检索收藏与已隐藏项。也可打开 <NavLink to="/digests">{t(lang, "digests")}</NavLink>。
          </>
        ) : (
          <>
            Search saved and hidden items. Or open <NavLink to="/digests">{t(lang, "digests")}</NavLink>.
          </>
        )}
      </p>
      <div className="search-row">
        <input
          type="search"
          name="search"
          autoComplete="off"
          placeholder={t(lang, "search")}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="chips">
          {(["all", "saved", "hidden"] as const).map(x => (
            <button key={x} className={view === x ? "chip active" : "chip"} onClick={() => setView(x)}>
              {x === "all" ? t(lang, "all") : x === "saved" ? t(lang, "saved") : t(lang, "hide")}
            </button>
          ))}
        </div>
      </div>
      {!visible.length && !archived.length ? (
        <Empty text={lang === "zh" ? "这里还没有内容。" : "Nothing here yet."} />
      ) : (
        <div className="list-view">
          {visible.map(item => (
            <OpportunityCard
              key={item.id}
              item={item}
              evaluation={evaluateItem(item, local.profile)}
              local={local}
              updateLocal={updateLocal}
              hiddenView={view === "hidden"}
            />
          ))}
          {archived.map(item => (
            <article className="archived-card" key={item.id}>
              <span>{lang === "zh" ? "已归档收藏" : "Archived favorite"}</span>
              <h3>{item.title}</h3>
              <p className="summary">{item.summary}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {t(lang, "source")} ↗
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DigestArchive({ items, local }: { items: MailItem[]; local: LocalState }) {
  const lang = local.profile.language;
  const digests = [...new Set(items.map(item => item.digestDate))].sort((a, b) => b.localeCompare(a));
  return (
    <section className="page digests">
      <p className="eyebrow">CUHK · Weekly announcements</p>
      <h1>{t(lang, "digests")}</h1>
      <p className="page-intro">
        {lang === "zh"
          ? "每期除外链 Announcements 外，还可直接打开本站已收录条目。"
          : "Besides the official announcements page, jump into indexed items on CU Link."}
      </p>
      {digests.length ? (
        <div className="digest-list">
          {digests.map(date => {
            const rowItems = items
              .filter(item => item.digestDate === date)
              .map(item => ({ item, evaluation: evaluateItem(item, local.profile) }))
              .sort((a, b) => b.evaluation.score - a.evaluation.score);
            return (
              <div className="digest-block" key={date}>
                <a className="digest-row" href={getAnnouncementsUrl(date)} target="_blank" rel="noreferrer">
                  <span>
                    <strong>{fmtDate(date, lang)}</strong>
                    <small>
                      {rowItems.length} {lang === "zh" ? "项已收录" : "items indexed"}
                    </small>
                  </span>
                  <b>{lang === "zh" ? "官方 Digest ↗" : "Official digest ↗"}</b>
                </a>
                <ul className="digest-items">
                  {rowItems.slice(0, 12).map(({ item, evaluation }) => (
                    <li key={item.id}>
                      <NavLink to={`/item/${item.id}`}>{item.title}</NavLink>
                      <span className="score-pill">{evaluation.score}</span>
                    </li>
                  ))}
                  {rowItems.length > 12 && (
                    <li className="muted">
                      {lang === "zh" ? `另有 ${rowItems.length - 12} 项…` : `+${rowItems.length - 12} more…`}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty text={lang === "zh" ? "暂时没有已收录的 Digest。" : "No digests indexed yet."} />
      )}
    </section>
  );
}

function Settings({
  local,
  setLocal,
  faculties,
}: {
  local: LocalState;
  setLocal: (state: LocalState) => void;
  faculties: FacultiesFile | null;
}) {
  const [draft, setDraft] = useState<Profile>(local.profile);
  const [secrets, setSecrets] = useState<AppSecrets>(() => loadSecrets());
  const [aiTest, setAiTest] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = draft.language;
  const field = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft(d => ({ ...d, [key]: value }));
  const faculty = faculties?.faculties.find(f => f.id === draft.facultyId);
  const save = () => {
    saveSecrets(secrets);
    setLocal({ ...local, profile: { ...draft, onboarded: true } });
  };
  return (
    <section className="page settings">
      <p className="eyebrow">Private · On-device</p>
      <h1>{t(lang, "settings")}</h1>
      <p className="privacy">◉ {t(lang, "privacy")}</p>
      <section className="ai-settings">
        <h2>{lang === "zh" ? "硅基流动 AI（可选）" : "SiliconFlow AI (optional)"}</h2>
        <p className="muted">
          {lang === "zh"
            ? "用于梗概润色与英→中翻译。Key 只存在本机，不会随画像导出，也不会提交到仓库。"
            : "Used for summary polish and EN→ZH. The key stays on this device only—never exported with profile JSON."}
        </p>
        <label className="switch" style={{ margin: "12px 0" }}>
          <input
            type="checkbox"
            checked={secrets.aiEnabled}
            onChange={e => setSecrets(s => ({ ...s, aiEnabled: e.target.checked }))}
          />
          <span>{lang === "zh" ? "启用 AI 增强摘要 / 翻译" : "Enable AI summary & translation"}</span>
        </label>
        <div className="form-grid">
          <label style={{ gridColumn: "1 / -1" }}>
            {lang === "zh" ? "API Key" : "API Key"}
            <input
              type="password"
              autoComplete="off"
              name="siliconflow-key"
              placeholder={secrets.siliconflowApiKey ? maskKey(secrets.siliconflowApiKey) : "sk-…"}
              value={secrets.siliconflowApiKey}
              onChange={e => setSecrets(s => ({ ...s, siliconflowApiKey: e.target.value.trim() }))}
            />
          </label>
          <label>
            {lang === "zh" ? "模型" : "Model"}
            <select
              value={secrets.siliconflowModel}
              onChange={e => setSecrets(s => ({ ...s, siliconflowModel: e.target.value }))}
            >
              <option value="Qwen/Qwen2.5-7B-Instruct">Qwen2.5-7B（快）</option>
              <option value="Qwen/Qwen2.5-14B-Instruct">Qwen2.5-14B（默认）</option>
              <option value="Qwen/Qwen2.5-32B-Instruct">Qwen2.5-32B</option>
              <option value="deepseek-ai/DeepSeek-V3">DeepSeek-V3</option>
            </select>
          </label>
          <div className="settings-actions" style={{ alignSelf: "end" }}>
            <button
              type="button"
              onClick={async () => {
                saveSecrets(secrets);
                setAiTest(lang === "zh" ? "测试中…" : "Testing…");
                try {
                  const reply = await testSiliconflowKey(secrets);
                  setAiTest(lang === "zh" ? `连通正常：${reply}` : `OK: ${reply}`);
                } catch (err) {
                  setAiTest(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              {lang === "zh" ? "测试连接" : "Test connection"}
            </button>
          </div>
        </div>
        {aiTest && <p className="translate-hint">{aiTest}</p>}
      </section>
      <p className="section-kicker" style={{ marginTop: 20 }}>
        {lang === "zh" ? "界面语言" : "Interface language"}
      </p>
      <div className="year-chips" style={{ marginBottom: 8 }}>
        {(
          [
            ["zh", "中文"],
            ["en", "English"],
          ] as const
        ).map(([code, label]) => (
          <button
            key={code}
            type="button"
            className={draft.language === code ? "chip active" : "chip"}
            onClick={() => field("language", code)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="section-kicker" style={{ marginTop: 16 }}>
        {t(lang, "goals")}
      </p>
      <div className="goal-chips" style={{ marginBottom: 16 }}>
        {GOAL_OPTIONS.map(g => {
          const on = draft.goals.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              className={on ? "chip active" : "chip"}
              onClick={() =>
                field(
                  "goals",
                  on ? draft.goals.filter(x => x !== g.id) : [...draft.goals, g.id],
                )
              }
            >
              {lang === "zh" ? g.zh : g.en}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        {lang === "zh"
          ? `已标记抽取有误 ${local.corrections.length} 条（随导出 JSON 带走）。`
          : `${local.corrections.length} extraction flags (included in export JSON).`}
      </p>
      <div className="form-grid">
        <label>
          {lang === "zh" ? "学院" : "Faculty"}
          <select
            value={draft.facultyId}
            onChange={e => field("facultyId", e.target.value)}
            name="faculty"
            autoComplete="organization"
          >
            <option value="">{lang === "zh" ? "请选择" : "Select…"}</option>
            {faculties?.faculties.map(f => (
              <option key={f.id} value={f.id}>
                {lang === "zh" ? f.nameZh || f.nameEn : f.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          {lang === "zh" ? "专业 / 课程" : "Programme"}
          <select
            value={draft.programmeId}
            onChange={e => {
              const p = faculty?.programmes.find(x => x.id === e.target.value);
              setDraft(d => ({ ...d, programmeId: e.target.value, major: p?.nameEn ?? d.major }));
            }}
            name="programme"
            autoComplete="off"
          >
            <option value="">{lang === "zh" ? "请选择" : "Select…"}</option>
            {faculty?.programmes.map(p => (
              <option key={p.id} value={p.id}>
                {p.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          {lang === "zh" ? "年级" : "Year"}
          <select value={draft.year} onChange={e => field("year", e.target.value as YearLevel)} name="year">
            <option value="">{lang === "zh" ? "请选择" : "Select…"}</option>
            {(["Y1", "Y2", "Y3", "Y4", "Y5", "Final", "PG"] as const).map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          {lang === "zh" ? "学生阶段" : "Student level"}
          <select value={draft.studentLevel} onChange={e => field("studentLevel", e.target.value as Profile["studentLevel"])}>
            <option value="undergraduate">Undergraduate</option>
            <option value="postgraduate">Postgraduate</option>
          </select>
        </label>
        <LanguageChecklist
          label={lang === "zh" ? "母语（可多选）" : "Native languages"}
          value={draft.nativeLanguages}
          onChange={v => field("nativeLanguages", v)}
          lang={lang}
        />
        <LanguageChecklist
          label={lang === "zh" ? "会使用的语言（可多选）" : "Spoken languages"}
          value={draft.spokenLanguages}
          onChange={v => field("spokenLanguages", v)}
          lang={lang}
        />
        <TextList label={lang === "zh" ? "技能" : "Skills"} value={draft.skills} onChange={v => field("skills", v)} />
        <TextList
          label={lang === "zh" ? "排除关键词" : "Excluded keywords"}
          value={draft.excluded}
          onChange={v => field("excluded", v)}
        />
        <label className="switch" style={{ alignSelf: "end" }}>
          <input type="checkbox" checked={draft.preferPaid} onChange={e => field("preferPaid", e.target.checked)} />
          <span>{lang === "zh" ? "更偏好有报酬机会" : "Prefer paid opportunities"}</span>
        </label>
      </div>
      <section className="weights">
        <h2>{lang === "zh" ? "五维权重（高级）" : "Dimension weights (advanced)"}</h2>
        {Object.entries(draft.weights).map(([key, value]) => (
          <label key={key}>
            <span>
              {key}
              <b>{value}</b>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              value={value}
              onChange={e =>
                setDraft(d => ({ ...d, weights: { ...d.weights, [key]: Number(e.target.value) } }))
              }
            />
          </label>
        ))}
      </section>
      <div className="settings-actions">
        <button className="primary" onClick={save}>
          {t(lang, "save")}
        </button>
        <button onClick={() => exportState(local)}>{t(lang, "export")}</button>
        <button onClick={() => fileRef.current?.click()}>{t(lang, "import")}</button>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="application/json"
          onChange={async e => {
            const file = e.target.files?.[0];
            if (file) setLocal(await importState(file));
          }}
        />
        <button
          className="danger"
          onClick={() => {
            if (confirm(lang === "zh" ? "确定清除全部本地数据？" : "Clear all local data?")) {
              clearState();
              setLocal(defaultState);
            }
          }}
        >
          {t(lang, "clear")}
        </button>
      </div>
    </section>
  );
}

function TextList({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <label>
      {label}
      <input value={value.join(", ")} onChange={e => onChange(split(e.target.value))} autoComplete="off" />
    </label>
  );
}

function Onboarding({
  profile,
  faculties,
  onSave,
}: {
  profile: Profile;
  faculties: FacultiesFile | null;
  onSave: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [step, setStep] = useState(0);
  const lang = draft.language;
  const faculty = faculties?.faculties.find(f => f.id === draft.facultyId);
  const goals: { id: GoalType; zh: string; en: string }[] = [
    { id: "paid", zh: "有薪工作", en: "Paid work" },
    { id: "research", zh: "研究体验", en: "Research" },
    { id: "competition", zh: "竞赛项目", en: "Competition" },
    { id: "volunteer", zh: "志愿活动", en: "Volunteer" },
    { id: "event", zh: "讲座活动", en: "Events" },
  ];
  const years: YearLevel[] = ["Y1", "Y2", "Y3", "Y4", "Y5", "Final", "PG"];

  return (
    <div className="modal-backdrop">
      <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
        <span className="brand-mark">CU</span>
        <p className="eyebrow">Welcome to CU Link</p>
        <p className="motto">{t(lang, "motto")}</p>
        <h1 id="onboard-title">{lang === "zh" ? "先告诉我们你是谁" : "Tell us who you are"}</h1>
        <p>
          {lang === "zh"
            ? "不用填写兴趣标签。学院、年级与目标类型就够开始筛选。"
            : "No interest-tag essay. Faculty, year, and goals are enough to start."}
        </p>

        {step === 0 && (
          <div className="onboard-step onboard-grid">
            <label>
              {lang === "zh" ? "学院" : "Faculty"}
              <select
                value={draft.facultyId}
                onChange={e => setDraft(d => ({ ...d, facultyId: e.target.value, programmeId: "", major: "" }))}
                name="faculty"
              >
                <option value="">{lang === "zh" ? "请选择学院…" : "Select faculty…"}</option>
                {faculties?.faculties.map(f => (
                  <option key={f.id} value={f.id}>
                    {lang === "zh" ? `${f.nameZh} · ${f.nameEn}` : f.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {lang === "zh" ? "专业 / 课程" : "Programme"}
              <select
                value={draft.programmeId}
                onChange={e => {
                  const p = faculty?.programmes.find(x => x.id === e.target.value);
                  setDraft(d => ({ ...d, programmeId: e.target.value, major: p?.nameEn ?? "" }));
                }}
                name="programme"
              >
                <option value="">{lang === "zh" ? "请选择专业…" : "Select programme…"}</option>
                {faculty?.programmes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameEn}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="onboard-step">
            <p className="section-kicker">{lang === "zh" ? "年级" : "Year"}</p>
            <div className="year-chips">
              {years.map(y => (
                <button
                  key={y}
                  type="button"
                  className={draft.year === y ? "chip active" : "chip"}
                  onClick={() => setDraft(d => ({ ...d, year: y, studentLevel: y === "PG" ? "postgraduate" : "undergraduate" }))}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-step">
            <p className="section-kicker">{lang === "zh" ? "界面语言" : "Interface language"}</p>
            <div className="year-chips" style={{ marginBottom: 16 }}>
              {(
                [
                  ["zh", "中文"],
                  ["en", "English"],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  className={draft.language === code ? "chip active" : "chip"}
                  onClick={() => setDraft(d => ({ ...d, language: code }))}
                >
                  {label}
                </button>
              ))}
            </div>
            <LanguageChecklist
              label={lang === "zh" ? "母语（可多选）" : "Native languages"}
              value={draft.nativeLanguages}
              onChange={nativeLanguages => setDraft(d => ({ ...d, nativeLanguages }))}
              lang={lang}
            />
            <LanguageChecklist
              label={lang === "zh" ? "会使用的语言（可多选）" : "Spoken languages"}
              value={draft.spokenLanguages}
              onChange={spokenLanguages => setDraft(d => ({ ...d, spokenLanguages }))}
              lang={lang}
            />
            <p className="section-kicker" style={{ marginTop: 18 }}>
              {lang === "zh" ? "你现在更想找什么（可多选）" : "What are you looking for?"}
            </p>
            <div className="goal-chips">
              {goals.map(g => {
                const on = draft.goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={on ? "chip active" : "chip"}
                    onClick={() =>
                      setDraft(d => ({
                        ...d,
                        goals: on ? d.goals.filter(x => x !== g.id) : [...d.goals, g.id],
                      }))
                    }
                  >
                    {lang === "zh" ? g.zh : g.en}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="onboard-actions">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)}>
              {lang === "zh" ? "上一步" : "Back"}
            </button>
          )}
          {step < 2 ? (
            <button className="primary" type="button" onClick={() => setStep(s => s + 1)}>
              {lang === "zh" ? "下一步" : "Next"}
            </button>
          ) : (
            <button className="primary" type="button" onClick={() => onSave(draft)}>
              {lang === "zh" ? "开始筛选" : "Start filtering"}
            </button>
          )}
          <button type="button" onClick={() => onSave({ ...draft })}>
            {lang === "zh" ? "稍后填写" : "Skip for now"}
          </button>
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, language: lang === "zh" ? "en" : "zh" }))}
          >
            {lang === "zh" ? "English" : "中文"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TimelinePage({ items, local }: { items: MailItem[]; local: LocalState }) {
  const lang = local.profile.language;
  const allKinds: TimeKind[] = [
    "published",
    "apply_deadline",
    "event_point",
    "event_range",
    "project_start",
    "project_end",
    "work_period",
    "rolling",
  ];
  const deadlineKinds = new Set<TimeKind>(["apply_deadline", "rolling"]);
  const [active, setActive] = useState<Set<TimeKind>>(() => new Set(allKinds));
  const [showAll, setShowAll] = useState(false);
  const [deadlinesOnly, setDeadlinesOnly] = useState(false);
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const scopedItems = useMemo(() => {
    return items.filter(item => {
      if (!showAll && local.hidden.includes(item.id)) return false;
      if (!showAll && isExcluded(item, local.profile)) return false;
      if (!showAll) {
        const el = evaluateItem(item, local.profile).eligibility;
        if (el === "ineligible") return false;
      }
      return true;
    });
  }, [items, local, showAll]);
  const kindFilter = deadlinesOnly ? deadlineKinds : active;
  const entries = useMemo(() => buildTimeline(scopedItems, kindFilter), [scopedItems, kindFilter]);
  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, entries),
    [cursor.year, cursor.month, entries],
  );
  const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const dayEntries = useMemo(() => {
    if (!selectedIso) return [] as TimelineEntry[];
    const day = grid.find(d => d.iso === selectedIso);
    if (!day) return [];
    const seen = new Set<string>();
    const out: TimelineEntry[] = [];
    for (const e of [...day.points, ...day.ranges]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  }, [selectedIso, grid]);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (deadlinesOnly && listRef.current) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [deadlinesOnly, entries.length]);
  const toggle = (kind: TimeKind) =>
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <section className="page timeline-page">
      <p className="eyebrow">Schedule · Calendar</p>
      <h1>{t(lang, "timeline")}</h1>
      <p className="page-intro">
        {lang === "zh"
          ? "默认隐藏已隐藏/不符合项。月历：点=单日，条=时段。"
          : "Hidden/ineligible items are filtered by default. Dots = days; bars = ranges."}
      </p>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={deadlinesOnly ? "chip active" : "chip"}
          onClick={() => setDeadlinesOnly(v => !v)}
        >
          {t(lang, "deadlinesOnly")}
        </button>
        <label className="switch" style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          <span>{t(lang, "showAllTimeline")}</span>
        </label>
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {allKinds.map(kind => (
          <button
            key={kind}
            type="button"
            className={`chip kind-chip kind-${kind}${!deadlinesOnly && active.has(kind) ? " active" : ""}`}
            onClick={() => {
              setDeadlinesOnly(false);
              toggle(kind);
            }}
            disabled={deadlinesOnly}
          >
            <span className="kind-swatch" aria-hidden="true" />
            {kindLabel(kind, lang)}
          </button>
        ))}
      </div>
      <ul className="cal-legend" aria-label={lang === "zh" ? "颜色图例" : "Color legend"}>
        {allKinds.map(kind => (
          <li key={`legend-${kind}`} className={`kind-${kind}`}>
            {kind === "event_range" || kind === "work_period" ? (
              <span className={`cal-range kind-${kind}`} aria-hidden="true" />
            ) : (
              <span className={`cal-dot kind-${kind}`} aria-hidden="true" />
            )}
            {kindLabel(kind, lang)}
          </li>
        ))}
      </ul>

      <div className="month-cal">
        <div className="month-cal-head">
          <h2>{monthLabel(cursor.year, cursor.month, lang)}</h2>
          <div className="month-cal-nav">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(c => shiftMonth(c.year, c.month, -1))}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() })}
            >
              {lang === "zh" ? "本月" : "Today"}
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(c => shiftMonth(c.year, c.month, 1))}
            >
              →
            </button>
          </div>
        </div>
        <div className="weekday-row">
          {weekdayHeaders(lang).map(d => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="month-grid">
          {grid.map(day => {
            const shown = Math.min(day.points.length, 4) + Math.min(day.ranges.length, 2);
            const extra = day.points.length + day.ranges.length - shown;
            return (
              <button
                key={day.iso}
                type="button"
                className={[
                  "cal-day",
                  day.inMonth ? "in-month" : "out",
                  day.iso === todayIso ? "today" : "",
                  day.iso === selectedIso ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => day.inMonth && setSelectedIso(day.iso === selectedIso ? null : day.iso)}
                disabled={!day.inMonth}
              >
                <span className="cal-day-num">{day.day}</span>
                <span className="cal-marks" aria-hidden="true">
                  {day.points.slice(0, 4).map(p => (
                    <span
                      key={p.id}
                      className={`cal-dot kind-${p.mark.kind}`}
                      title={`${kindLabel(p.mark.kind, lang)} · ${p.title}`}
                    />
                  ))}
                  {day.ranges.slice(0, 2).map(r => (
                    <span
                      key={r.id}
                      className={`cal-range kind-${r.mark.kind}`}
                      title={`${kindLabel(r.mark.kind, lang)} · ${r.title}`}
                    />
                  ))}
                  {extra > 0 && <span className="cal-more">+{extra}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedIso && (
        <div className="cal-day-list">
          <h3>
            {fmtDate(selectedIso, lang)} · {dayEntries.length}{" "}
            {lang === "zh" ? "项" : "items"}
          </h3>
          {dayEntries.length ? (
            <ol className="timeline-rail">
              {dayEntries.map(entry => (
                <TimelineNode key={`day-${entry.id}`} entry={entry} lang={lang} />
              ))}
            </ol>
          ) : (
            <p className="muted">{lang === "zh" ? "这一天没有节点。" : "Nothing on this day."}</p>
          )}
        </div>
      )}

      <p className="section-kicker" style={{ marginBottom: 12 }}>
        {lang === "zh" ? "完整列表" : "Full list"}
      </p>
      {entries.length ? (
        <ol className="timeline-rail" ref={listRef}>
          {entries.map(entry => (
            <TimelineNode key={entry.id} entry={entry} lang={lang} />
          ))}
        </ol>
      ) : (
        <Empty text={lang === "zh" ? "当前筛选下没有可展示的时间节点。" : "No timeline marks for the current filters."} />
      )}
    </section>
  );
}

function TimelineNode({ entry, lang }: { entry: TimelineEntry; lang: "zh" | "en" }) {
  return (
    <li className={`timeline-node shape-${entry.mark.shape} kind-${entry.mark.kind}`}>
      <div className="timeline-axis" aria-hidden="true">
        <span className="timeline-dot" />
        {entry.mark.shape === "range" && <span className="timeline-bar" />}
      </div>
      <div className="timeline-card">
        <div className="timeline-meta">
          <span className={`time-pill kind-${entry.mark.kind}`}>{kindLabel(entry.mark.kind, lang)}</span>
          <strong>{formatMarkSpan(entry.mark, lang)}</strong>
        </div>
        <h3>
          <NavLink to={`/item/${entry.itemId}`}>{entry.title}</NavLink>
        </h3>
        {entry.summary && <p className="summary">{entry.summary}</p>}
        {entry.mark.evidence && <p className="muted evidence-line">{entry.mark.evidence}</p>}
      </div>
    </li>
  );
}

function ImportPage({ local, setLocal }: { local: LocalState; setLocal: (s: LocalState) => void }) {
  const lang = local.profile.language;
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<MailItem[]>([]);
  const [error, setError] = useState("");
  const [mergedOk, setMergedOk] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseDraft = (text: string) => {
    try {
      const items = parseCuLinkMarkdown(text);
      setPreview(items);
      setError("");
      setDraft(text);
      setMergedOk(0);
    } catch (err) {
      setPreview([]);
      setError(err instanceof Error ? err.message : "Parse failed");
    }
  };

  const merge = () => {
    if (!preview.length) return;
    const n = preview.length;
    setLocal({
      ...local,
      importedItems: (() => {
        const map = new Map((local.importedItems ?? []).map(i => [i.id, i]));
        for (const item of preview) map.set(item.id, { ...item, source: "import" });
        return [...map.values()];
      })(),
    });
    setMergedOk(n);
  };

  const clearImported = () => {
    if (confirm(lang === "zh" ? "清除全部已导入邮件？" : "Clear all imported mail items?")) {
      setLocal({ ...local, importedItems: [] });
      setPreview([]);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([EXPORT_TEMPLATE], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cu-link-mail-export.example.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page import-page">
      <p className="eyebrow">OpenClaw · Markdown bridge</p>
      <h1>{t(lang, "importMail")}</h1>
      <p className="page-intro">
        {lang === "zh"
          ? "让 OpenClaw 读完邮箱后导出 Markdown（cu-link-export v1），在此粘贴或上传。解析只在本机完成，可并入推荐流与时间线。"
          : "Have OpenClaw dump mailbox messages as cu-link-export v1 Markdown, then paste or upload here. Parsing stays on-device and merges into Home / Timeline."}
      </p>
      <div className="import-actions">
        <button type="button" className="primary" onClick={downloadTemplate}>
          {lang === "zh" ? "下载模板" : "Download template"}
        </button>
        <a className="chip" href="./templates/cu-link-mail-export.example.md" target="_blank" rel="noreferrer">
          {lang === "zh" ? "打开模板" : "Open template"}
        </a>
        <button type="button" onClick={() => fileRef.current?.click()}>
          {lang === "zh" ? "上传 .md" : "Upload .md"}
        </button>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept=".md,text/markdown,text/plain"
          onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            parseDraft(await file.text());
          }}
        />
        <button type="button" className="danger" onClick={clearImported}>
          {lang === "zh" ? `清除已导入（${local.importedItems?.length ?? 0}）` : `Clear imported (${local.importedItems?.length ?? 0})`}
        </button>
      </div>
      <label className="import-editor">
        <span>{lang === "zh" ? "Markdown 内容" : "Markdown content"}</span>
        <textarea
          value={draft}
          spellCheck={false}
          placeholder={lang === "zh" ? "粘贴 OpenClaw 导出的 Markdown…" : "Paste OpenClaw export Markdown…"}
          onChange={e => setDraft(e.target.value)}
        />
      </label>
      <div className="import-actions">
        <button type="button" className="primary" onClick={() => parseDraft(draft)}>
          {lang === "zh" ? "解析预览" : "Parse preview"}
        </button>
        <button type="button" className="primary" disabled={!preview.length} onClick={merge}>
          {lang === "zh" ? `合并 ${preview.length} 项` : `Merge ${preview.length} items`}
        </button>
      </div>
      {error && <div className="notice warning">{error}</div>}
      {mergedOk > 0 && (
        <div className="notice info-banner">
          <span>
            {lang === "zh" ? `已合并 ${mergedOk} 项。` : `Merged ${mergedOk} items.`}
          </span>
          <NavLink to="/">{t(lang, "home")}</NavLink>
          <NavLink to="/timeline">{t(lang, "timeline")}</NavLink>
        </div>
      )}
      {preview.length > 0 && (
        <div className="import-preview">
          <h2>
            {lang === "zh" ? "预览" : "Preview"} · {preview.length}
          </h2>
          <ul>
            {preview.map(item => (
              <li key={item.id}>
                <span className="import-badge">{lang === "zh" ? "导入" : "Import"}</span>{" "}
                <strong>{item.title}</strong>
                <span className="muted">
                  {item.deadline ? ` · deadline ${item.deadline}` : ""}
                  {item.timeMarks?.length ? ` · ${item.timeMarks.length} marks` : ""}
                </span>
                <p className="summary">{item.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Empty({ text, actions }: { text: string; actions?: ReactNode }) {
  return (
    <div className="empty">
      <span aria-hidden="true">⌕</span>
      <p>{text}</p>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export default App;
