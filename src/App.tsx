import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { tagLabel, taxonomyLabel } from "./lib/taxonomyLabels";
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
  polishMany,
} from "./lib/enhance";
import { LANGUAGE_OPTIONS, toggleLanguage } from "./lib/languages";
import { categoryFeedback, toggleItemFeedback } from "./lib/feedback";
import { getOriginalSourceUrl, isUsableSourceUrl } from "./lib/sourceLinks";
import { nonRedundantSummary } from "./lib/textCleanup";
import { activeProvider, aiReady, AI_PROVIDERS, loadSecrets, maskKey, saveSecrets, type AiProvider, type AppSecrets } from "./lib/secrets";
import { aiErrorMessage, testAiConnection } from "./lib/siliconflow";
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

function yearLabel(year: YearLevel, lang: "zh" | "en"): string {
  if (lang === "en") return year;
  if (year === "Final") return "毕业年级";
  if (year === "PG") return "研究生";
  return `${year.slice(1)} 年级`;
}

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
    <div className="score-meters" aria-label={lang === "zh" ? "分数明细" : "Score breakdown"}>
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
      .catch(() => setError("feed-load"));
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
        <div className="notice warning">
          {offline
            ? t(local.profile.language, "offline")
            : local.profile.language === "zh"
              ? "无法载入邮件数据。"
              : "Unable to load the data feed."}
        </div>
      )}
      {meta && Date.now() - new Date(meta.fetchedAt).getTime() > 10 * 86400000 && (
        <div className="notice warning">
          <span>{t(local.profile.language, "stale")}</span>
          <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
            {local.profile.language === "zh" ? "查看数据源" : "View source"} ↗
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
      <footer className="app-footer">dynamics986@2026.</footer>
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
        <img className="brand-mark" src="./mailroute-icon-192.png" alt="" />
        <span>
          <b>CUHK MailRoute</b>
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
        aria-label={lang === "zh" ? "切换为英文" : "Switch to Chinese"}
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
  const toggleIneligible = () => {
    const next = new URLSearchParams(params);
    if (showIneligible) next.delete("ineligible");
    else next.set("ineligible", "1");
    setParams(next, { replace: true });
  };

  const evaluated = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map(item => ({ item, evaluation: evaluateItem(item, local.profile, categoryFeedback(item, items, local.itemFeedback)) }))
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
    if (!aiReady(loadSecrets())) {
      showToast(lang === "zh" ? "请先在个人设置中启用并配置 AI 服务。" : "Enable and configure AI Services in Settings first.");
      return;
    }
    setBulkBusy(true);
    try {
      const result = await polishMany(selectedItems, local.profile, { concurrency: 1 });
      if (result.firstError) {
        showToast(aiErrorMessage(new Error(result.firstError), lang));
      } else {
        showToast(lang === "zh" ? "已润色所选" : "Polished selected");
      }
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
    if (!aiReady(loadSecrets())) {
      const missingAiMessage = lang === "zh"
        ? "请先在个人设置中启用 AI 服务，并填写当前服务商的 API Key 与模型 ID。"
        : "Enable AI Services in Settings and enter an API key and model ID for the selected provider.";
      setBatchMsg(current => current === missingAiMessage ? "" : missingAiMessage);
      return;
    }
    setBatchBusy(true);
    setBatchMsg(lang === "zh" ? "正在润色…" : "Polishing…");
    try {
      const result = await polishMany(
        evaluated.map(x => x.item),
        local.profile,
        {
          concurrency: 1,
          onProgress: (done, total) =>
            setBatchMsg(lang === "zh" ? `润色中 ${done}/${total}` : `Polishing ${done}/${total}`),
        },
      );
      const errorText = result.firstError ? aiErrorMessage(new Error(result.firstError), lang) : "";
      setBatchMsg(lang === "zh"
        ? `完成：新润色 ${result.polished}，跳过已缓存 ${result.skipped}${result.failed ? `，失败 ${result.failed}` : ""}${result.unprocessed ? `，已停止且未处理 ${result.unprocessed}` : ""}（库内共 ${polishCount()} 条）${errorText ? `。原因：${errorText}` : ""}`
        : `Done: ${result.polished} new, ${result.skipped} cached${result.failed ? `, ${result.failed} failed` : ""}${result.unprocessed ? `, stopped with ${result.unprocessed} unprocessed` : ""} (${polishCount()} in store)${errorText ? `. Reason: ${errorText}` : ""}`,
      );
    } catch {
      setBatchMsg(lang === "zh" ? "润色失败，请检查 AI 设置后重试。" : "Polish failed. Check AI settings and try again.");
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <>
      <section className="hero compact-mobile">
        <h1>{t(lang, "home")}</h1>
      </section>
      {meta && (
        <div className="freshness-strip">
          <span>
            {lang === "zh"
              ? `${digestCount} 期摘要 · 更新于 ${fmtDate(meta.fetchedAt, lang)}`
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
        <div className="control-group control-mode">
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
        <div className="control-group control-search">
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
        <div className="control-group control-filters">
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
        <div className="control-group control-sort">
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
        <div className="dim-filters">
          <div className="dim-filters-head">
            <p className="section-kicker">{lang === "zh" ? "分数门槛" : "Score thresholds"}</p>
            <button
              type="button"
              className={`linkish dim-reset${hasDimFilter ? "" : " is-hidden"}`}
              disabled={!hasDimFilter}
              onClick={clearMins}
            >
              {lang === "zh" ? "重置拉杆" : "Reset sliders"}
            </button>
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
          <h2>{t(lang, "curatedOpportunities")}</h2>
          <div className="feed-heading-actions">
            <button
              type="button"
              className={`chip eligibility-btn${showIneligible ? " active" : ""}`}
              aria-pressed={showIneligible}
              onClick={toggleIneligible}
              title={lang === "zh"
                ? "默认隐藏与个人资料明确冲突的邮件"
                : "Items that clearly conflict with your profile are hidden by default"}
            >
              {showIneligible
                ? (lang === "zh" ? "已包含资格不符项目" : "Including ineligible")
                : t(lang, "showIneligible")}
            </button>
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
  const polished = peekPolish(item, local.profile);
  const displayTitle = polished?.title || item.title;
  const displaySummary = nonRedundantSummary(displayTitle, polished?.summary || item.summary);
  const deadlineLabel = relativeDeadline(item, lang);
  const hot = isClosingSoon(item);
  const highConfidenceReqs = listRequirementChecks(item, local.profile)
    .filter(c => c.req.confidence === "high")
    .slice(0, 2);
  return (
    <article className={`opportunity-card${focused ? " focused" : ""}${selected ? " card-selected" : ""}`}>
      <div className="card-top">
        <div className="card-heading-meta">
          <span className="category">
            {taxonomyLabel(item.taxonomy?.type, lang)} · {fmtDate(item.digestDate, lang)}
          </span>
          <span className={`status ${evaluation.eligibility}`}>{t(lang, evaluation.eligibility)}</span>
          {item.source === "import" && (
            <span className="import-badge">{lang === "zh" ? "已导入" : "Imported"}</span>
          )}
        </div>
        <div className="card-top-actions">
          <span className="score-total">
            <b>{evaluation.score}</b>/100
          </span>
          {onToggleSelect && (
            <button
              type="button"
              className={selected ? "card-select-button selected" : "card-select-button"}
              aria-pressed={!!selected}
              aria-label={selected
                ? (lang === "zh" ? "取消选择此项" : "Deselect this item")
                : (lang === "zh" ? "选择此项" : "Select this item")}
              title={selected
                ? (lang === "zh" ? "取消选择" : "Deselect")
                : (lang === "zh" ? "加入批量操作" : "Add to bulk actions")}
              onClick={() => onToggleSelect(item.id)}
            >
              {selected ? "✓" : "+"}
            </button>
          )}
        </div>
      </div>
      <h3>{displayTitle}</h3>
      {displaySummary && <p className="summary">{displaySummary}</p>}
      <div className="card-labels">
        <div className="tags">
          {(item.tags.length ? item.tags : item.taxonomy?.domains ?? []).slice(0, 3).map(tag => (
            <span key={tag}>{tagLabel(tag, lang)}</span>
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
      </div>
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
  const location = useLocation();
  const item = items.find(i => i.id === id);
  const lang = local.profile.language;
  if (!item) return <Empty text={lang === "zh" ? "找不到此项目，可能已经归档。" : "This item may have been archived."} />;
  const feedback = local.itemFeedback[item.id];
  const originalSourceUrl = getOriginalSourceUrl(item);
  const polished = peekPolish(item, local.profile);
  const displayTitle = polished?.title || item.title;
  const displaySummary = nonRedundantSummary(displayTitle, polished?.summary || item.summary);
  const evaluation = evaluateItem(item, local.profile, categoryFeedback(item, items, local.itemFeedback));
  const reqChecks = listRequirementChecks(item, local.profile);
  const feedbackActions = (
    <section className="feedback detail-head-feedback" aria-label={lang === "zh" ? "推荐反馈" : "Recommendation feedback"}>
      <button
        className={feedback === "less" ? "confirmed" : ""}
        aria-pressed={feedback === "less"}
        onClick={() => updateLocal(s => ({
          ...s,
          itemFeedback: toggleItemFeedback(s.itemFeedback, item.id, "less"),
        }))}
      >
        {feedback === "less" ? (lang === "zh" ? "✓ 已减少此类" : "✓ Showing less") : t(lang, "dislike")}
      </button>
      <button
        className={feedback === "more" ? "confirmed" : ""}
        aria-pressed={feedback === "more"}
        onClick={() => updateLocal(s => ({
          ...s,
          itemFeedback: toggleItemFeedback(s.itemFeedback, item.id, "more"),
        }))}
      >
        {feedback === "more" ? (lang === "zh" ? "✓ 已加强此类" : "✓ Preference saved") : t(lang, "addInterest")}
      </button>
      <button onClick={() => updateLocal(s => ({
        ...s,
        corrections: s.corrections.includes(item.id)
          ? s.corrections.filter(correctionId => correctionId !== item.id)
          : [...s.corrections, item.id],
      }))}>
        {local.corrections.includes(item.id) ? "✓ " : ""}
        {t(lang, "correction")}
      </button>
    </section>
  );
  return (
    <article className="detail">
      <button
        type="button"
        className="back"
        onClick={() => location.key === "default" ? navigate("/") : navigate(-1)}
      >
        <span aria-hidden="true">←</span>
        {t(lang, "back")}
      </button>
      <div className="detail-head">
        <div>
          <h1>{displayTitle}</h1>
          {displaySummary && <p className="detail-summary">{displaySummary}</p>}
          <div className="detail-source-action">
            {originalSourceUrl ? (
              <a
                className="primary detail-source-link"
                href={originalSourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {lang === "zh" ? "查看原文 ↗" : "View source ↗"}
              </a>
            ) : (
              <p className="source-unavailable">
                {lang === "zh" ? "此项目没有可用的原文链接。" : "No original source is available for this item."}
              </p>
            )}
            {feedbackActions}
          </div>
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
      <h1>{t(lang, "history")}</h1>
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
              evaluation={evaluateItem(item, local.profile, categoryFeedback(item, items, local.itemFeedback))}
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
              {isUsableSourceUrl(item.sourceUrl) && (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {t(lang, "source")} ↗
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DigestArchive({ items, local }: { items: MailItem[]; local: LocalState }) {
  const lang = local.profile.language;
  const digests = [...new Set(items.map(item => item.digestDate))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 4);
  return (
    <section className="page digests">
      <h1>{t(lang, "digests")}</h1>
      <p className="page-intro">
        {lang === "zh"
          ? "查看最近四周的 Undergraduate Digest 公告总表"
          : "Open the Undergraduate Digest announcement lists from the most recent four weeks "}
      </p>
      {digests.length ? (
        <div className="digest-list">
          {digests.map(date => {
            const count = items.filter(item => item.digestDate === date).length;
            return (
              <a className="digest-row" href={getAnnouncementsUrl(date)} target="_blank" rel="noreferrer" key={date}>
                <span>
                  <strong>{fmtDate(date, lang)}</strong>
                  <small>{count} {lang === "zh" ? "项已收录" : "items indexed"}</small>
                </span>
                <b>{lang === "zh" ? "查看该期 CUHK Digest" : "Open this CUHK Digest ↗"}</b>
              </a>
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
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestTone, setAiTestTone] = useState<"idle" | "testing" | "success" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = draft.language;
  useEffect(() => {
    setDraft(current => current.language === local.profile.language
      ? current
      : { ...current, language: local.profile.language });
  }, [local.profile.language]);
  const providerDefinition = AI_PROVIDERS.find(p => p.id === secrets.provider) ?? AI_PROVIDERS[0];
  const providerConfig = secrets.providers[secrets.provider];
  const updateProviderConfig = (values: Partial<typeof providerConfig>) =>
    setSecrets(s => ({
      ...s,
      providers: { ...s.providers, [s.provider]: { ...s.providers[s.provider], ...values } },
    }));
  const field = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft(d => ({ ...d, [key]: value }));
  const faculty = faculties?.faculties.find(f => f.id === draft.facultyId);
  const save = () => {
    saveSecrets(secrets);
    setLocal({ ...local, profile: { ...draft, onboarded: true } });
  };
  return (
    <section className="page settings">
      <h1>{t(lang, "settings")}</h1>
      <p className="privacy">◉ {t(lang, "privacy")}</p>
      <section className="ai-settings">
        <h2>{lang === "zh" ? "AI 服务（Pro）" : "AI Services (Pro)"}</h2>
        <p className="muted">
          {lang === "zh"
            ? "用于梗概润色与英→中翻译。各服务商的 API Key 存在本浏览器，安全保密。"
            : "Used for summary polishing and English-to-Chinese translation. Each provider's API Key is stored only in this browser and kept private."}
        </p>
        <label className="switch" style={{ margin: "12px 0" }}>
          <input
            type="checkbox"
            checked={secrets.aiEnabled}
            onChange={e => setSecrets(s => ({ ...s, aiEnabled: e.target.checked }))}
          />
          <span>{lang === "zh" ? "启用 AI 增强摘要 / 翻译" : "Enable AI summary & translation"}</span>
        </label>
        <div className="ai-provider-form">
          <label>
            {lang === "zh" ? "服务商" : "Provider"}
            <select
              value={secrets.provider}
              onChange={e => {
                setSecrets(s => ({ ...s, provider: e.target.value as AiProvider }));
                setAiTest("");
                setAiTestTone("idle");
              }}
            >
              {AI_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>{lang === "zh" ? provider.zh : provider.en}</option>
              ))}
            </select>
          </label>
          <label>
            API Key
            <input
              type="password"
              autoComplete="off"
              name={`${secrets.provider}-key`}
              placeholder={providerConfig.apiKey ? maskKey(providerConfig.apiKey) : providerDefinition.keyHint[lang]}
              value={providerConfig.apiKey}
              onChange={e => updateProviderConfig({ apiKey: e.target.value.trim() })}
            />
          </label>
          <div className="ai-model-row">
            <label>
              {lang === "zh" ? "模型 / 接入点 ID" : "Model / endpoint ID"}
              <input
                value={providerConfig.model}
                placeholder={providerDefinition.modelHint?.[lang] || providerDefinition.defaultModel}
                onChange={e => updateProviderConfig({ model: e.target.value })}
              />
            </label>
            <button
              className="ai-test-button"
              type="button"
              disabled={aiTesting}
              onClick={async () => {
                if (aiTesting) return;
                setAiTesting(true);
                setAiTestTone("testing");
                setAiTest(lang === "zh" ? "测试中…" : "Testing…");
                try {
                  const reply = await testAiConnection(secrets);
                  const active = activeProvider(secrets);
                  setAiTestTone("success");
                  setAiTest(lang === "zh"
                    ? `连接成功：${active.definition.zh} · ${active.config.model} · 模型回复：${reply}`
                    : `Connected: ${active.definition.en} · ${active.config.model} · Model reply: ${reply}`);
                } catch (err) {
                  setAiTestTone("error");
                  setAiTest(aiErrorMessage(err, lang));
                } finally {
                  setAiTesting(false);
                }
              }}
            >
              {aiTesting ? (lang === "zh" ? "测试中…" : "Testing…") : (lang === "zh" ? "测试连接" : "Test connection")}
            </button>
          </div>
        </div>
        <details className="provider-advanced">
          <summary>{lang === "zh" ? "高级设置：Base URL" : "Advanced: Base URL"}</summary>
          <label>
            Base URL
            <input
              value={providerConfig.baseUrl || ""}
              placeholder={providerDefinition.baseUrl}
              onChange={e => updateProviderConfig({ baseUrl: e.target.value })}
            />
          </label>
          <p className="muted">
            {lang === "zh"
              ? "通常无需填写。只有服务商控制台提供了不同的兼容接口地址，或你使用代理、其他区域端点时才需要修改；留空会使用当前服务商的官方默认地址。"
              : "Usually no change is needed. Edit this only when your provider gives you a different compatible API address, or when you use a proxy or another regional endpoint. Leave it blank to use the selected provider's official default address."}
          </p>
        </details>
        {aiTest && (
          <p className={`ai-connection-status ${aiTestTone}`} role="status" aria-live="polite">
            <span aria-hidden="true">{aiTestTone === "success" ? "✓" : aiTestTone === "error" ? "✕" : "◌"}</span>
            {aiTest}
          </p>
        )}
      </section>
      <p className="section-kicker settings-section-label" style={{ marginTop: 16 }}>
        {lang === "zh" ? "目标类型 · Goals" : "Goals · 目标类型"}
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
                {yearLabel(y, lang)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {lang === "zh" ? "学生阶段" : "Student level"}
          <select value={draft.studentLevel} onChange={e => field("studentLevel", e.target.value as Profile["studentLevel"])}>
            <option value="undergraduate">{lang === "zh" ? "本科生" : "Undergraduate"}</option>
            <option value="postgraduate">{lang === "zh" ? "研究生" : "Postgraduate"}</option>
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
      </div>
      <section className="weights">
        <h2>{lang === "zh" ? "五维权重（高级）" : "Dimension weights (advanced)"}</h2>
        {Object.entries(draft.weights).map(([key, value]) => (
          <label key={key}>
            <span>
              {key === "important"
                ? (lang === "zh" ? "重要" : "Important")
                : dimLabel(key as DimKey, lang)}
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
        <img className="brand-mark" src="./mailroute-icon-192.png" alt="" />
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
                  {yearLabel(y, lang)}
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
        const el = evaluateItem(item, local.profile, categoryFeedback(item, items, local.itemFeedback)).eligibility;
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
      <h1>{t(lang, "timeline")}</h1>
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
          <div className="month-cal-title">
            <h2>{monthLabel(cursor.year, cursor.month, lang)}</h2>
            <div className="chips timeline-primary-filters">
              <button
                type="button"
                className={deadlinesOnly ? "chip active" : "chip"}
                aria-pressed={deadlinesOnly}
                onClick={() => setDeadlinesOnly(v => !v)}
              >
                {t(lang, "deadlinesOnly")}
              </button>
              <button
                type="button"
                className={showAll ? "chip active" : "chip"}
                aria-pressed={showAll}
                onClick={() => setShowAll(v => !v)}
              >
                {t(lang, "showAllTimeline")}
              </button>
            </div>
          </div>
          <div className="month-cal-nav">
            <button
              type="button"
              aria-label={lang === "zh" ? "上个月" : "Previous month"}
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
              aria-label={lang === "zh" ? "下个月" : "Next month"}
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
  const [agentCopyStatus, setAgentCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseDraft = (text: string) => {
    try {
      const items = parseCuLinkMarkdown(text);
      setPreview(items);
      setError("");
      setDraft(text);
      setMergedOk(0);
    } catch {
      setPreview([]);
      setError(lang === "zh" ? "解析失败，请检查 Markdown 格式。" : "Parse failed. Check the Markdown format.");
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

  const copyAgentPrompt = async () => {
    const prompt = lang === "zh"
      ? "请读取需要导入 CUHK MailRoute 的邮件，并严格按照 CUHK MailRoute Markdown 模板整理后导出为一个 .md 文件。每封邮件使用独立的 Item 区块，保留标题、日期、来源链接、正文摘要、截止日期和申请链接。"
      : "Read the emails to be imported into CUHK MailRoute and export one .md file that strictly follows the CUHK MailRoute Markdown template. Use a separate Item block for each email and retain its title, date, source URL, summary, deadline, and application links.";
    try {
      await navigator.clipboard.writeText(prompt);
      setAgentCopyStatus("copied");
    } catch {
      setAgentCopyStatus("failed");
    }
    window.setTimeout(() => setAgentCopyStatus("idle"), 2000);
  };

  return (
    <section className="page import-page">
      <h1>{t(lang, "importMail")}</h1>
      <ol className="import-guide">
        <li>
          <b>1</b>
          <div className="import-step">
            <strong>{lang === "zh" ? "获取模板" : "Get the template"}</strong>
            <p>{lang === "zh" ? "下载或打开示例 Markdown" : "Download or open the example Markdown"}</p>
            <div className="import-step-actions">
              <button type="button" className="primary" onClick={downloadTemplate}>
                {lang === "zh" ? "下载模板" : "Download template"}
              </button>
              <a className="chip" href="./templates/cu-link-mail-export.example.md" target="_blank" rel="noreferrer">
                {lang === "zh" ? "打开模板" : "Open template"}
              </a>
            </div>
          </div>
        </li>
        <li>
          <b>2</b>
          <div className="import-step">
            <strong>{lang === "zh" ? "Agent 导出" : "Export with an agent"}</strong>
            <p>{lang === "zh" ? "让 Agent 按模板整理邮件" : "Ask an agent to format the emails and create a .md file"}</p>
            <div className="import-step-actions">
              <button type="button" className="primary" onClick={copyAgentPrompt}>
                {agentCopyStatus === "copied"
                  ? (lang === "zh" ? "已复制" : "Copied")
                  : agentCopyStatus === "failed"
                    ? (lang === "zh" ? "复制失败" : "Copy failed")
                    : (lang === "zh" ? "复制 Agent 提示词" : "Copy agent prompt")}
              </button>
            </div>
          </div>
        </li>
        <li>
          <b>3</b>
          <div className="import-step">
            <strong>{lang === "zh" ? "解析并合并" : "Parse and merge"}</strong>
            <p>{lang === "zh" ? "上传 Agent 生成的文件，再解析并合并" : "Upload the generated file, then parse and merge it"}</p>
            <div className="import-step-actions">
              <button
                type="button"
                className="primary"
                onClick={() => fileRef.current?.click()}
              >
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
              <button type="button" className="chip danger" onClick={clearImported}>
                {lang === "zh" ? `清除导入（${local.importedItems?.length ?? 0}）` : `Clear imported (${local.importedItems?.length ?? 0})`}
              </button>
            </div>
          </div>
        </li>
      </ol>
      <p className="import-privacy">
        {lang === "zh"
          ? "隐私提示：解析和保存均在本机浏览器完成。导出文件可能含私人邮件，请勿提交到代码仓库或公开分享"
          : "Privacy: parsing and storage stay in this browser. Exports may contain private mail—do not commit or share them publicly"}
      </p>
      <label className="import-editor">
        <textarea
          value={draft}
          spellCheck={false}
          placeholder={lang === "zh" ? "粘贴 Markdown…" : "Paste Markdown…"}
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
