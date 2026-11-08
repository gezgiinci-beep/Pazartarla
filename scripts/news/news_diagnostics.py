"""Allowlisted diagnostic metadata only: never serialize exceptions or content."""
import json
from urllib.error import HTTPError, URLError


PHASES = frozenset({"startup", "discovery", "lookup", "source", "ai", "import"})
FIELDS = frozenset({"title", "excerpt", "body", "review_note"})
FIELD_CODES = frozenset({
    "ai_field_type", "ai_field_too_short", "ai_field_too_long", "ai_field_unsafe_text",
})
VALUE_CODES = {
    "AI output must be an object": "ai_output_not_object",
    "AI output has unexpected fields": "ai_output_fields",
    "AI output validation failed": "ai_output_validation",
    "AI output too similar to source": "ai_source_similarity",
    "AI added unsupported numbers": "ai_unsupported_numbers",
    "AI response invalid": "ai_response_invalid",
    "AI prompt blocked": "ai_prompt_blocked",
    "AI response missing": "ai_response_missing",
    "AI response incomplete": "ai_response_incomplete",
    "AI unavailable": "ai_unavailable",
    "AI request budget exhausted": "ai_request_budget_exhausted",
    "AI secret is not configured": "ai_not_configured",
    "Gemini secret is not configured": "ai_not_configured",
    "API response too large": "response_too_large",
    "Daily progress response invalid": "progress_response_invalid",
    "Invalid OIDC endpoint": "oidc_endpoint_invalid",
    "Automation runs only on the trusted repository main branch": "untrusted_runner",
    "Unknown source ID": "source_unknown",
}


class DraftValidationError(ValueError):
    """Keep existing ValueError behavior while identifying a rejected field."""
    def __init__(self, code, field):
        super().__init__("AI output validation failed")
        self.diagnostic_code = code
        self.diagnostic_field = field


def failure_details(phase, exc):
    """Only fixed codes/field names and numeric HTTP status may enter logs."""
    detail = {"phase": phase if phase in PHASES else "unknown"}
    if isinstance(exc, HTTPError):
        status = exc.code
        if type(status) is int and 100 <= status <= 599:
            detail["status"] = status
            detail["error_code"] = {
                401: "authentication_failed", 402: "billing_required",
                403: "permission_denied", 404: "resource_unavailable",
                429: "quota_or_rate_limit",
                500: "upstream_unavailable", 502: "upstream_unavailable",
                503: "upstream_unavailable", 504: "upstream_unavailable",
            }.get(status, "http_error")
        else:
            detail["error_code"] = "http_error"
    elif isinstance(exc, DraftValidationError):
        detail["error_code"] = (exc.diagnostic_code if exc.diagnostic_code in FIELD_CODES
                                else "ai_output_validation")
        if exc.diagnostic_field in FIELDS:
            detail["field"] = exc.diagnostic_field
    elif isinstance(exc, json.JSONDecodeError):
        detail["error_code"] = "invalid_json"
    elif isinstance(exc, KeyError):
        detail["error_code"] = "missing_required_field"
    elif isinstance(exc, (TimeoutError, URLError, OSError)):
        detail["error_code"] = "network_or_io_error"
    elif isinstance(exc, ValueError):
        # Message lookup only; an unknown message is never emitted.
        detail["error_code"] = VALUE_CODES.get(str(exc), "value_invalid")
    else:
        detail["error_code"] = "processing_error"
    return detail
