from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

RequirementField = Literal["studentLevel", "major", "nativeLanguage", "spokenLanguage", "age", "gender", "residency", "health", "skill"]

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

class MailItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    digestDate: str
    category: str
    title: str
    bodyText: str
    organizer: str | None = None
    contactEmail: str | None = None
    sourceUrl: HttpUrl
    applicationUrls: list[HttpUrl] = Field(default_factory=list)
    deadline: str | None = None
    compensation: Compensation | None = None
    tags: list[str] = Field(default_factory=list)
    requirements: list[Requirement] = Field(default_factory=list)
    publishedAt: str
    fetchedAt: str

class FeedMeta(BaseModel):
    latestDigest: str
    fetchedAt: str
    itemCount: int
    status: Literal["ok", "stale", "error"] = "ok"
    sourceUrl: HttpUrl
