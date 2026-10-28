import hmac
from hashlib import sha256

from hotel_agent.domain.value_objects import QuestionId

TOKEN_LENGTH = 16


def question_token(question_id: QuestionId, secret: str) -> str:
    signed = hmac.new(secret.encode(), str(question_id).encode(), sha256)
    return signed.hexdigest()[:TOKEN_LENGTH]


def token_matches(question_id: QuestionId, token: str, secret: str) -> bool:
    if not secret or not token:
        return False
    return hmac.compare_digest(
        question_token(question_id, secret).encode(), token.strip().casefold().encode()
    )
