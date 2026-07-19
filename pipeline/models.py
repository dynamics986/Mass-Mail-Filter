from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

RequirementField = Literal[
    "studentLevel", "major", "nativeLanguage", "spokenLanguage",
    "age", "gender", "residency", "health", "skill",
]
DeadlineKind = Literal["apply", "event", "rolling", "unknown"]
Confidence = Literal["high", "medium", "low"]
L1Type = Literal[
    "paid_work", "research", "event", "programme",
    "competition", "service", "admin",
]
L2Domain = Literal[
    "Engineering", "CS_AI", "Business", "Medicine", "Arts",
    "Education", "Science", "SocialScience", "Law", "Language", "Cross",
]
L3Role = Literal["ra", "helper", "intern", "volunteer", "applicant", "attendee"]


class Requirement(BaseModel):
    field: RequirementField
    operator: Literal["equals", "includes", "min", "max"]
    value: str | int
    confidence: Literal["high", "medium"]
    evidence: str


class Compensation(BaseModel):
    type: Literal["cash", "voucher", "allowance", "prize", "unknown"]
    minHkd: int | None = None
    maxHkd: int | None = None


class Taxonomy(BaseModel):
    type: L1Type
    domains: list[L2Domain] = Field(default_factory=list)
    roles: list[L3Role] = Field(default_factory=list)
    confidence: Confidence = "medium"
    evidence: str = ""


class DeadlineInfo(BaseModel):
    date: str | None = None
    kind: DeadlineKind = "unknown"
    confidence: Confidence = "low"
    evidence: str = ""


TimeKind = Literal[
    "published",
    "apply_deadline",
    "event_point",
    "event_range",
    "project_start",
    "project_end",
    "work_period",
    "rolling",
]
TimeShape = Literal["point", "range", "open"]


class TimeMark(BaseModel):
    kind: TimeKind
    shape: TimeShape = "point"
    start: str | None = None
    end: str | None = None
    confidence: Confidence = "medium"
    evidence: str = ""
    label: str = ""


class MailItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    digestDate: str
    category: str
    title: str
    bodyText: str
    cleanBody: str = ""
    summary: str = ""
    summaryEvidence: list[str] = Field(default_factory=list)
    organizer: str | None = None
    contactEmail: str | None = None
    sourceUrl: HttpUrl
    applicationUrls: list[HttpUrl] = Field(default_factory=list)
    deadline: str | None = None
    deadlineKind: DeadlineKind = "unknown"
    deadlineConfidence: Confidence = "low"
    deadlineEvidence: str = ""
    timeMarks: list[TimeMark] = Field(default_factory=list)
    compensation: Compensation | None = None
    taxonomy: Taxonomy
    tags: list[str] = Field(default_factory=list)
    keyPhrases: list[str] = Field(default_factory=list)
    requirements: list[Requirement] = Field(default_factory=list)
    publishedAt: str
    fetchedAt: str
    source: Literal["digest", "import"] = "digest"


class FeedMeta(BaseModel):
    latestDigest: str
    fetchedAt: str
    itemCount: int
    status: Literal["ok", "stale", "error"] = "ok"
    sourceUrl: HttpUrl


class Programme(BaseModel):
    id: str
    nameEn: str
    nameZh: str = ""
    facultyId: str


class Faculty(BaseModel):
    id: str
    nameEn: str
    nameZh: str
    programmes: list[Programme] = Field(default_factory=list)


class FacultiesFile(BaseModel):
    sourceUrl: str
    fetchedAt: str
    faculties: list[Faculty]
