from dataclasses import dataclass


@dataclass(frozen=True, slots=True, kw_only=True)
class EvidenceVerdict:
    record_id: str
    supported: bool
    quote: str
