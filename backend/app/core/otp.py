"""Хранилище одноразовых SMS-кодов. В проде Redis, в тестах память."""

import secrets
import time
from typing import Protocol

from redis.asyncio import Redis

from app.core.config import settings


class OtpStore(Protocol):
    async def save(self, phone: str, code: str) -> None: ...
    async def verify(self, phone: str, code: str) -> bool: ...


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


class RedisOtpStore:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def save(self, phone: str, code: str) -> None:
        await self.redis.set(f"otp:{phone}", code, ex=settings.otp_ttl_seconds)
        await self.redis.delete(f"otp-attempts:{phone}")

    async def verify(self, phone: str, code: str) -> bool:
        attempts_key = f"otp-attempts:{phone}"
        attempts = await self.redis.incr(attempts_key)
        await self.redis.expire(attempts_key, settings.otp_ttl_seconds)
        if attempts > settings.otp_max_attempts:
            return False
        stored = await self.redis.get(f"otp:{phone}")
        if stored is None or not secrets.compare_digest(stored.decode(), code):
            return False
        await self.redis.delete(f"otp:{phone}", attempts_key)
        return True


class MemoryOtpStore:
    def __init__(self) -> None:
        self.codes: dict[str, tuple[str, float, int]] = {}

    async def save(self, phone: str, code: str) -> None:
        self.codes[phone] = (code, time.monotonic() + settings.otp_ttl_seconds, 0)

    async def verify(self, phone: str, code: str) -> bool:
        entry = self.codes.get(phone)
        if entry is None:
            return False
        stored, expires, attempts = entry
        if time.monotonic() > expires or attempts >= settings.otp_max_attempts:
            return False
        if not secrets.compare_digest(stored, code):
            self.codes[phone] = (stored, expires, attempts + 1)
            return False
        del self.codes[phone]
        return True


_redis_store: RedisOtpStore | None = None


def get_otp_store() -> OtpStore:
    global _redis_store
    if _redis_store is None:
        _redis_store = RedisOtpStore(Redis.from_url(settings.redis_url))
    return _redis_store
