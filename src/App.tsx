import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { t } from "./i18n";
import { loadFeed } from "./lib/data";
import { getAnnouncementsUrl, getCuhkSource } from "./lib/links";
import { evaluateItem, isClosingSoon, isEngineering, isExcluded, isHelper } from "./lib/ranking";
import { clearState, defaultState, exportState, favoriteSnapshot, importState, loadState, saveState } from "./lib/storage";
import type { Evaluation, FeedMeta, LocalState, MailItem, Profile } from "./types";

const split = (value: string) => value.split(",").map(x => x.trim()).filter(Boolean);
const fmtDate = (date: string | undefined, lang: "zh" | "en") => date ? new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", { dateStyle: "medium" }).format(new Date(date)) : "—";
const money = (item: MailItem) => item.compensation ? `HK$${item.compensation.minHkd ?? item.compensation.maxHkd ?? "?"}${item.compensation.maxHkd && item.compensation.maxHkd !== item.compensation.minHkd ? `–${item.compensation.maxHkd}` : ""}` : "—";

function App() {
  const [local, setLocal] = useState<LocalState>(() => loadState());
  const [items, setItems] = useState<MailItem[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState("");
  useEffect(() => { loadFeed().then(data => { setItems(data.items); setMeta(data.meta); setOffline(data.offline); }).catch(() => setError("Unable to load the data feed.")); }, []);
  useEffect(() => saveState(local), [local]);
  const updateLocal = (fn: (state: LocalState) => LocalState) => setLocal(s => fn(s));
  return <div className="app-shell">
    <Header local={local} setLocal={setLocal} />
    {(offline || error) && <div className="notice warning">{offline ? t(local.profile.language, "offline") : error}</div>}
    {meta && Date.now() - new Date(meta.fetchedAt).getTime() > 10 * 86400000 && <div className="notice warning"><span>{t(local.profile.language, "stale")}</span><a href={meta.sourceUrl} target="_blank" rel="noreferrer">Digest ↗</a></div>}
    <main>
      <Routes>
        <Route path="/" element={<Home items={items} meta={meta} local={local} updateLocal={updateLocal} />} />
        <Route path="/item/:id" element={<Detail items={items} local={local} updateLocal={updateLocal} />} />
        <Route path="/history" element={<History items={items} local={local} updateLocal={updateLocal} />} />
        <Route path="/digests" element={<DigestArchive items={items} local={local} />} />
        <Route path="/settings" element={<Settings local={local} setLocal={setLocal} />} />
      </Routes>
    </main>
    {!local.profile.onboarded && <Onboarding profile={local.profile} onSave={profile => setLocal(s => ({ ...s, profile: { ...profile, onboarded: true } }))} />}
  </div>;
}

function Header({ local, setLocal }: { local: LocalState; setLocal: (state: LocalState) => void }) {
  const lang = local.profile.language;
  return <header className="topbar"><NavLink to="/" className="brand"><span className="brand-mark">CU</span><span><b>CU Link</b><small>Mass Mail Filter</small></span></NavLink>
    <nav><NavLink to="/">{t(lang, "home")}</NavLink><NavLink to="/history">{t(lang, "history")}</NavLink><NavLink to="/digests">{lang === "zh" ? "每周公告" : "Weekly digests"}</NavLink><NavLink to="/settings">{t(lang, "settings")}</NavLink></nav>
    <button className="lang-button" onClick={() => setLocal({ ...local, profile: { ...local.profile, language: lang === "zh" ? "en" : "zh" } })}>{lang === "zh" ? "EN" : "中"}</button>
  </header>;
}

function Home({ items, meta, local, updateLocal }: { items: MailItem[]; meta: FeedMeta | null; local: LocalState; updateLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const lang = local.profile.language;
  const [filter, setFilter] = useState("all"), [showIneligible, setShowIneligible] = useState(false);
  const evaluated = useMemo(() => items.map(item => ({ item, evaluation: evaluateItem(item, local.profile) })).filter(x => !local.hidden.includes(x.item.id) && !isExcluded(x.item, local.profile)).filter(x => showIneligible || x.evaluation.eligibility !== "ineligible").filter(x => filter === "all" || (filter === "paid" && !!x.item.compensation) || (filter === "engineering" && isEngineering(x.item)) || (filter === "language" && x.evaluation.reasons.some(r => r.key === "language")) || (filter === "helper" && isHelper(x.item)) || (filter === "deadline" && isClosingSoon(x.item))).sort((a, b) => b.evaluation.score - a.evaluation.score), [items, local, filter, showIneligible]);
  const newest = meta?.latestDigest ?? "";
  const matches = items.filter(i => ["eligible", "likely"].includes(evaluateItem(i, local.profile).eligibility)).length;
  return <>
    <section className="hero"><div><p className="eyebrow">CUHK · UNDERGRADUATE DIGEST</p><h1>{lang === "zh" ? "适合你的，就在这里" : "For you, right here."}</h1><p>{lang === "zh" ? "把真正适合你的机会，排到最前面。每个推荐都有清楚理由。" : "See the opportunities that fit you first—with clear reasons for every recommendation."}</p></div>
      <div className="hero-stats"><Stat value={items.filter(i => i.digestDate === newest).length} label={t(lang, "newThisWeek")} /><Stat value={matches} label={t(lang, "matches")} /><Stat value={meta ? fmtDate(meta.fetchedAt, lang) : "…"} label={t(lang, "updated")} /></div></section>
    <section className="toolbar"><div><p className="section-kicker">{t(lang, "filters")}</p><div className="chips">{["all", "paid", "engineering", "language", "helper", "deadline"].map(key => <button key={key} className={filter === key ? "chip active" : "chip"} onClick={() => setFilter(key)}>{t(lang, key as "all")}</button>)}</div></div><label className="switch"><input type="checkbox" checked={showIneligible} onChange={e => setShowIneligible(e.target.checked)} /><span>{t(lang, "showIneligible")}</span></label></section>
    <section className="feed"><div className="feed-heading"><div><p className="section-kicker">{t(lang, "recent")}</p><h2>{t(lang, "home")}</h2></div><span>{evaluated.length} {lang === "zh" ? "项" : "items"}</span></div>
      {evaluated.length ? <div className="card-grid">{evaluated.map(x => <OpportunityCard key={x.item.id} {...x} local={local} updateLocal={updateLocal} />)}</div> : <Empty text={t(lang, "noResults")} />}</section>
  </>;
}

function Stat({ value, label }: { value: string | number; label: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }
function EligibilityBadge({ evaluation, lang }: { evaluation: Evaluation; lang: "zh" | "en" }) { return <span className={`status ${evaluation.eligibility}`}>{t(lang, evaluation.eligibility)}</span>; }
function OpportunityCard({ item, evaluation, local, updateLocal }: { item: MailItem; evaluation: Evaluation; local: LocalState; updateLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const lang = local.profile.language, favorite = !!local.favorites[item.id];
  return <article className="opportunity-card"><div className="card-top"><EligibilityBadge evaluation={evaluation} lang={lang} /><span className="score"><b>{evaluation.score}</b>/100</span></div><p className="category">{item.category} · {fmtDate(item.digestDate, lang)}</p><h3>{item.title}</h3><div className="tags">{item.tags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div><div className="reasons">{evaluation.reasons.slice(0, 4).map((reason, i) => <div key={`${reason.key}-${i}`}><b>{reason.points > 0 ? "+" : ""}{reason.points}</b><span>{reason.label}</span></div>)}</div>
    <div className="card-meta"><span>💰 {money(item)}</span><span>◷ {item.deadline ? fmtDate(item.deadline, lang) : lang === "zh" ? "未注明截止" : "No deadline"}</span></div>
    <div className="card-actions"><NavLink className="primary" to={`/item/${item.id}`}>{t(lang, "view")}</NavLink><button aria-label={favorite ? t(lang, "unfavorite") : t(lang, "favorite")} className={favorite ? "icon-button selected" : "icon-button"} onClick={() => updateLocal(s => { const favorites = { ...s.favorites }; if (favorites[item.id]) delete favorites[item.id]; else favorites[item.id] = favoriteSnapshot(item); return { ...s, favorites }; })}>{favorite ? "★" : "☆"}</button><button className="icon-button" aria-label={t(lang, "hide")} onClick={() => updateLocal(s => ({ ...s, hidden: [...new Set([...s.hidden, item.id])] }))}>×</button></div>
  </article>;
}

function Detail({ items, local, updateLocal }: { items: MailItem[]; local: LocalState; updateLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const { id } = useParams(), navigate = useNavigate(), item = items.find(i => i.id === id), lang = local.profile.language;
  const [feedbackState, setFeedbackState] = useState({ disliked: false, interested: false });
  if (!item) return <Empty text={lang === "zh" ? "找不到此项目，可能已经归档。" : "This item may have been archived."} />;
  const evaluation = evaluateItem(item, local.profile);
  const topic = item.tags[0] ?? item.category;
  const source = getCuhkSource(item);
  return <article className="detail"><button className="back" onClick={() => navigate(-1)}>← {t(lang, "back")}</button><div className="detail-head"><div><EligibilityBadge evaluation={evaluation} lang={lang} /><p className="category">{item.category} · {fmtDate(item.digestDate, lang)}</p><h1>{item.title}</h1></div><div className="score-ring"><strong>{evaluation.score}</strong><span>/100</span></div></div>
    <div className="detail-grid"><section><h2>{t(lang, "evidence")}</h2>{evaluation.evidence.length ? <ul className="evidence">{evaluation.evidence.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">{lang === "zh" ? "邮件没有足够明确的资格信息，请核对原文。" : "The message does not state enough eligibility information. Check the original."}</p>}<div className="reasons large">{evaluation.reasons.map((r, i) => <div key={i}><b>{r.points > 0 ? "+" : ""}{r.points}</b><span>{r.label}</span></div>)}</div></section>
      <aside><Info label={t(lang, "compensation")} value={money(item)} /><Info label={lang === "zh" ? "截止日期" : "Deadline"} value={fmtDate(item.deadline, lang)} /><Info label={lang === "zh" ? "主办方" : "Organizer"} value={item.organizer ?? "—"} />{item.contactEmail && <a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a>}</aside></div>
    <section className="message"><h2>{t(lang, "body")}</h2><p>{item.bodyText}</p></section><section className="link-list">{source.url ? <a className="primary" href={source.url} target="_blank" rel="noreferrer">{t(lang, "source")} ↗</a> : <span className="source-unavailable">{lang === "zh" ? "演示项目没有真实 Message ID，无法打开通知原网页。" : "This demo item has no real Message ID, so its original page is unavailable."}</span>}{item.applicationUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">{t(lang, "apply")} ↗</a>)}</section>
    <section className="feedback"><button className={feedbackState.disliked ? "confirmed" : ""} aria-pressed={feedbackState.disliked} onClick={() => { updateLocal(s => ({ ...s, profile: { ...s.profile, excluded: [...new Set([...s.profile.excluded, topic])] } })); setFeedbackState(state => ({ ...state, disliked: true })); }}>{feedbackState.disliked ? (lang === "zh" ? "✓ 已减少此类推荐" : "✓ Showing less like this") : t(lang, "dislike")}</button><button className={feedbackState.interested ? "confirmed" : ""} aria-pressed={feedbackState.interested} onClick={() => { updateLocal(s => ({ ...s, profile: { ...s.profile, interests: [...new Set([...s.profile.interests, topic])] } })); setFeedbackState(state => ({ ...state, interested: true })); }}>{feedbackState.interested ? (lang === "zh" ? "✓ 已加入兴趣" : "✓ Interest added") : t(lang, "addInterest")}</button><button onClick={() => updateLocal(s => ({ ...s, corrections: [...new Set([...s.corrections, item.id])] }))}>{local.corrections.includes(item.id) ? "✓" : ""} {t(lang, "correction")}</button></section>
  </article>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="info"><span>{label}</span><strong>{value}</strong></div>; }

function History({ items, local, updateLocal }: { items: MailItem[]; local: LocalState; updateLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const lang = local.profile.language; const [query, setQuery] = useState(""), [view, setView] = useState<"all" | "saved" | "hidden">("all");
  const q = query.toLowerCase(); const visible = items.filter(item => `${item.title} ${item.bodyText} ${item.tags.join(" ")}`.toLowerCase().includes(q)).filter(item => view === "all" || (view === "saved" && local.favorites[item.id]) || (view === "hidden" && local.hidden.includes(item.id)));
  const archived = view === "saved" ? Object.values(local.favorites).filter(f => !items.some(i => i.id === f.id)) : [];
  return <section className="page"><p className="eyebrow">ARCHIVE · SEARCH</p><h1>{t(lang, "history")}</h1><div className="search-row"><input type="search" placeholder={t(lang, "search")} value={query} onChange={e => setQuery(e.target.value)} /><div className="chips">{(["all", "saved", "hidden"] as const).map(x => <button className={view === x ? "chip active" : "chip"} onClick={() => setView(x)} key={x}>{x === "all" ? t(lang, "all") : x === "saved" ? t(lang, "saved") : t(lang, "hide")}</button>)}</div></div>
    <div className="list-view">{visible.map(item => <OpportunityCard key={item.id} item={item} evaluation={evaluateItem(item, local.profile)} local={local} updateLocal={updateLocal} />)}{archived.map(item => <article className="archived-card" key={item.id}><span>{t(lang, "archived")}</span><h3>{item.title}</h3><a href={item.sourceUrl} target="_blank" rel="noreferrer">{t(lang, "source")} ↗</a></article>)}</div></section>;
}

function DigestArchive({ items, local }: { items: MailItem[]; local: LocalState }) {
  const lang = local.profile.language;
  const digests = [...new Set(items.map(item => item.digestDate))].sort((a, b) => b.localeCompare(a));
  return <section className="page digests"><p className="eyebrow">CUHK · WEEKLY ANNOUNCEMENTS</p><h1>{lang === "zh" ? "每周公告" : "Weekly digests"}</h1><p className="page-intro">{lang === "zh" ? "在这里查看每一期 Undergraduate Digest 的 Announcements 总表。具体通知请从机会详情页直接打开原网页。" : "Open each Undergraduate Digest Announcements list here. Individual message pages remain available from opportunity details."}</p>
    {digests.length ? <div className="digest-list">{digests.map(date => { const count = items.filter(item => item.digestDate === date).length; return <a className="digest-row" href={getAnnouncementsUrl(date)} target="_blank" rel="noreferrer" key={date}><span><strong>{fmtDate(date, lang)}</strong><small>{count} {lang === "zh" ? "项已收录" : "items indexed"}</small></span><b>{lang === "zh" ? "查看该期 CUHK Digest" : "Open this CUHK Digest"} ↗</b></a>; })}</div> : <Empty text={lang === "zh" ? "暂时没有已收录的 Digest。" : "No digests have been indexed yet."} />}
  </section>;
}

function Settings({ local, setLocal }: { local: LocalState; setLocal: (state: LocalState) => void }) {
  const [draft, setDraft] = useState<Profile>(local.profile), fileRef = useRef<HTMLInputElement>(null), lang = draft.language;
  const field = (key: keyof Profile, value: unknown) => setDraft(d => ({ ...d, [key]: value }));
  const save = () => setLocal({ ...local, profile: { ...draft, onboarded: true } });
  return <section className="page settings"><p className="eyebrow">PRIVATE · ON-DEVICE</p><h1>{t(lang, "settings")}</h1><p className="privacy">◉ {t(lang, "privacy")}</p><div className="form-grid"><label>{lang === "zh" ? "学生阶段" : "Student level"}<select value={draft.studentLevel} onChange={e => field("studentLevel", e.target.value)}><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option></select></label><label>{lang === "zh" ? "专业" : "Major"}<input value={draft.major} onChange={e => field("major", e.target.value)} /></label><TextList label={lang === "zh" ? "母语（逗号分隔）" : "Native languages (comma-separated)"} value={draft.nativeLanguages} onChange={v => field("nativeLanguages", v)} /><TextList label={lang === "zh" ? "会使用的语言" : "Spoken languages"} value={draft.spokenLanguages} onChange={v => field("spokenLanguages", v)} /><label>{lang === "zh" ? "年龄（可留空）" : "Age (optional)"}<input type="number" value={draft.age ?? ""} onChange={e => field("age", e.target.value ? Number(e.target.value) : undefined)} /></label><label>{lang === "zh" ? "性别（可留空）" : "Gender (optional)"}<input value={draft.gender ?? ""} onChange={e => field("gender", e.target.value || undefined)} /></label><TextList label={lang === "zh" ? "技能" : "Skills"} value={draft.skills} onChange={v => field("skills", v)} /><TextList label={lang === "zh" ? "兴趣关键词" : "Interest keywords"} value={draft.interests} onChange={v => field("interests", v)} /><TextList label={lang === "zh" ? "排除关键词" : "Excluded keywords"} value={draft.excluded} onChange={v => field("excluded", v)} /></div>
    <section className="weights"><h2>{lang === "zh" ? "推荐权重" : "Recommendation weights"}</h2>{Object.entries(draft.weights).map(([key, value]) => <label key={key}><span>{key}<b>{value}</b></span><input type="range" min="0" max="40" value={value} onChange={e => setDraft(d => ({ ...d, weights: { ...d.weights, [key]: Number(e.target.value) } }))} /></label>)}</section>
    <div className="settings-actions"><button className="primary" onClick={save}>{t(lang, "save")}</button><button onClick={() => exportState(local)}>{t(lang, "export")}</button><button onClick={() => fileRef.current?.click()}>{t(lang, "import")}</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={async e => { const file = e.target.files?.[0]; if (file) setLocal(await importState(file)); }} /><button className="danger" onClick={() => { if (confirm(lang === "zh" ? "确定清除全部本地数据？" : "Clear all local data?")) { clearState(); setLocal(defaultState); } }}>{t(lang, "clear")}</button></div></section>;
}
function TextList({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) { return <label>{label}<input value={value.join(", ")} onChange={e => onChange(split(e.target.value))} /></label>; }

function Onboarding({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const [draft, setDraft] = useState(profile), lang = draft.language;
  return <div className="modal-backdrop"><section className="onboarding"><span className="brand-mark">CU</span><p className="eyebrow">WELCOME TO CU LINK</p><h1>{lang === "zh" ? "只看真正适合你的机会" : "Only see opportunities that fit"}</h1><p>{t(lang, "profileIntro")}</p><div className="onboard-grid"><TextList label={lang === "zh" ? "母语" : "Native languages"} value={draft.nativeLanguages} onChange={nativeLanguages => setDraft(d => ({ ...d, nativeLanguages }))} /><TextList label={lang === "zh" ? "会使用的语言" : "Spoken languages"} value={draft.spokenLanguages} onChange={spokenLanguages => setDraft(d => ({ ...d, spokenLanguages }))} /><TextList label={lang === "zh" ? "兴趣" : "Interests"} value={draft.interests} onChange={interests => setDraft(d => ({ ...d, interests }))} /><TextList label={lang === "zh" ? "技能" : "Skills"} value={draft.skills} onChange={skills => setDraft(d => ({ ...d, skills }))} /></div><div className="onboard-actions"><button className="primary" onClick={() => onSave(draft)}>{lang === "zh" ? "开始筛选" : "Start filtering"}</button><button onClick={() => setDraft(d => ({ ...d, language: lang === "zh" ? "en" : "zh" }))}>{lang === "zh" ? "English" : "中文"}</button></div></section></div>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><span>⌕</span><p>{text}</p></div>; }
export default App;
