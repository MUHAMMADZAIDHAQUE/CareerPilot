import logging
import sys
from backend.app.core.config import settings


def setup_logging():
    """Configure structured logging for CareerPilot backend."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    log_format = "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s"

    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    logger = logging.getLogger("careerpilot")
    logger.info("Structured logging initialized", extra={"environment": settings.ENVIRONMENT})
    return logger


logger = logging.getLogger("careerpilot")
