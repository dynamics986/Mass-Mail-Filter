# How CUHK MailRoute Works / CUHK MailRoute 工作原理

## English

### What the site does

CUHK MailRoute converts public CUHK Undergraduate Digest messages and locally imported Markdown into a searchable opportunity feed. It extracts structured facts, checks known requirements against the user's local profile, calculates five ranking dimensions, and presents the result through recommendations, a timeline, archive search, and weekly digest summaries.

Scores are deterministic heuristics, not admission probabilities, official judgments, or AI-generated decisions. The original message is always authoritative.

### Data flow and retention

1. The scheduled pipeline scans the most recent 28 days of public Digest announcements.
2. It extracts titles, summaries, source URLs, opportunity types, domains, roles, compensation, deadlines, requirements, and useful tags.
3. Validation checks source freshness and stops publication if recent available issues are missing.
4. The public feed keeps the latest four Digest issues in full and may retain older items whose meaningful deadlines are still open.
5. Markdown imported by a user is parsed and stored only in that browser; it is not uploaded to the project.

### Eligibility

Structured requirements are compared with profile fields such as study level, major, language, age, gender, residency, health, and skills.

| Status | Meaning |
|---|---|
| Eligible | Known requirements match and none remain unresolved. |
| Likely eligible | At least one requirement matches, while another cannot be confirmed. |
| Needs confirmation | Information is missing or no structured requirement was extracted. |
| Ineligible | A high-confidence requirement conflicts with the profile. |

Missing profile information is treated as unknown, not as a conflict. Eligibility is only a reading aid; the organizer makes the real decision.

### Five ranking dimensions

Each dimension is rounded and limited to `0–100`.

| Dimension | Main signals |
|---|---|
| Fit | Eligibility, faculty/domain proximity, languages, goals, skills, and category feedback. |
| Urgency | Application deadline: closer deadlines score higher; expired items score `0`; rolling and unstated deadlines receive conservative fixed values. |
| Value | Verified compensation, relevant experience, certificates, credits, and the Paid work goal. |
| Meaning | Opportunity-type prior plus research-participant and growth/portfolio signals. |
| Importance | The relationship between the user's study stage and the opportunity type. |

The overall score is a normalized weighted average:

```text
(Fit×30 + Urgency×20 + Value×20 + Meaning×20 + Importance×10) ÷ 100
```

These are the default weights. Users may adjust every weight from `0` to `40`; the calculation divides by the actual weight sum, so the weights do not need to total `100`.

### Personalization, filtering, and sorting

- **More like this** adds `18` points to Fit for the affected opportunity category; **Less like this** subtracts `28`. Feedback is reversible and the adjusted score remains within `0–100`.
- Hidden items, excluded-keyword matches, and high-confidence ineligible items are omitted from the default recommendation view.
- Users can search content, filter by opportunity traits, include ineligible items, and set minimum Fit, Urgency, Value, and Meaning scores.
- Standard mode sorts by the selected score. This-week mode first limits items to relevant near-term time nodes, then orders them by action time and urgency.

### Local data, AI, and offline behavior

- Profile settings, preferences, saved/hidden items, imports, feedback, AI credentials, and AI caches stay in the current browser.
- AI is optional and is used only to shorten titles, structure summaries, or assist English-to-Chinese translation. It does not calculate eligibility or scores.
- When AI is used, relevant email text is sent directly from the browser to the selected provider. Credentials are excluded from profile exports.
- The service worker caches the application and public feed. If the network fails, the site may show the latest cached data with offline or stale warnings.

### Limits

- Extraction quality limits scoring quality; missing compensation or deadlines do not prove that none exist.
- Compensation is not fully normalized by duration or unit, so a total payment and an hourly rate may not be economically comparable.
- Keyword and skill matching are heuristic and may miss synonyms or context.
- Scores are most useful for relative comparison for the same user and data version. Always verify important facts through **View source**.

---

## 中文

### 网站做什么

CUHK MailRoute 将公开的 CUHK Undergraduate Digest 和用户在本机导入的 Markdown 整理为可检索的机会列表。系统抽取结构化信息，将已知要求与浏览器内的个人设置比较，计算五个排序维度，再通过推荐、日程、归档检索和每周摘要展示结果。

分数是可重复的启发式排序，不是录取概率、官方判断，也不是 AI 直接作出的决定。邮件原文始终是最终依据。

### 数据流程与保留

1. 定时流程扫描最近 28 天的公开 Digest 公告。
2. 抽取标题、梗概、原文链接、机会类型、领域、角色、报酬、截止日期、资格要求和实用标签。
3. 发布前验证来源新鲜度；如果缺少近期已发布的摘要，停止更新。
4. 公共数据完整保留最新四期摘要，也可继续保留仍有有效截止日期的更早项目。
5. 用户导入的 Markdown 只在当前浏览器解析和保存，不会上传到项目。

### 资格判断

系统把结构化要求与学生阶段、专业、语言、年龄、性别、身份、健康和技能等个人设置进行比较。

| 状态 | 含义 |
|---|---|
| 符合 | 已知要求均匹配，且没有待确认项。 |
| 可能符合 | 至少一项匹配，同时仍有要求无法确认。 |
| 待确认 | 资料不足，或邮件没有抽取出结构化要求。 |
| 不符合 | 至少一项高置信要求与个人资料冲突。 |

未填写的信息会被视为未知，而不是冲突。资格状态只用于辅助阅读，最终资格由主办方判断。

### 五个排序维度

每个维度都会四舍五入并限制在 `0–100`。

| 维度 | 主要依据 |
|---|---|
| 契合 | 资格、学院与领域关系、语言、目标、技能和类目反馈。 |
| 紧急 | 申请截止日期；越接近分数越高，已截止为 `0`，滚动招募和未注明截止使用保守固定值。 |
| 价值 | 已确认的报酬、相关经历、证书、学分和“有薪工作”目标。 |
| 意义 | 机会类型基础值，以及研究参与者和成长／作品集等信号。 |
| 重要 | 当前学习阶段与机会类型之间的关系。 |

综合分是归一化加权平均：

```text
(契合×30 + 紧急×20 + 价值×20 + 意义×20 + 重要×10) ÷ 100
```

以上是默认权重。用户可以把每项调整到 `0–40`；程序按实际权重总和重新归一化，因此权重不必相加等于 `100`。

### 个性化、过滤与排序

- “更多此类”使相应机会类目的契合分增加 `18`；“减少此类”使其减少 `28`。反馈可以取消，调整后分数仍限制在 `0–100`。
- 默认推荐会排除已隐藏、命中排除关键词和高置信“不符合”的项目。
- 用户可以搜索内容、按机会特征筛选、包含资格不符项目，并设置契合、紧急、价值和意义的最低分数。
- 普通模式按所选分数排序；本周行动模式先保留近期有相关时间节点的项目，再按行动时间和紧急度排列。

### 本地数据、AI 与离线行为

- 个人设置、偏好、收藏／隐藏、导入内容、反馈、AI 凭据和 AI 缓存都保存在当前浏览器。
- AI 是可选功能，只用于缩短标题、整理梗概或辅助英译中，不参与资格判断和评分。
- 使用 AI 时，相关邮件文本会由浏览器直接发送给所选服务商；凭据不会进入个人设置导出文件。
- Service Worker 会缓存应用和公开数据。网络失败时，网站可能显示最近缓存的数据，并提示离线或数据可能过期。

### 局限

- 抽取质量决定评分质量；没有抽取到报酬或截止日期，不代表它们不存在。
- 报酬尚未完全按时长和单位归一化，因此总报酬与时薪未必可以直接比较。
- 关键词和技能匹配属于启发式方法，可能遗漏同义词或上下文。
- 分数更适合在相同用户和数据版本下作相对比较。重要信息应通过“查看原文”核对。
