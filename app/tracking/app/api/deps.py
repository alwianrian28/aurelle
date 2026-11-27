"""Dependency FastAPI bersama."""
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.services.tracking import Deps


def get_deps(request: Request) -> Deps:
    """Klien Biteship / OSRM / Storage yang dibuat sekali di lifespan."""
    return request.app.state.deps


SessionDep = Annotated[AsyncSession, Depends(get_session)]
DepsDep = Annotated[Deps, Depends(get_deps)]
