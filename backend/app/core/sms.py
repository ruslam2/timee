import logging

from app.core.config import settings

logger = logging.getLogger("magazin.sms")


async def send_sms(phone: str, text: str) -> None:
    if settings.sms_provider == "console":
        logger.warning("SMS to %s: %s", phone, text)
        return
    # Eskiz.uz подключается на этапе интеграций
    raise NotImplementedError(f"SMS provider {settings.sms_provider!r} is not configured")
