"""
Townhall Rezoning Tracker - FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from api.config import settings
from api.models.response import HealthResponse
from api.routes import counties, parcels, stats, alerts, lender

# Initialize FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (only used endpoints)
app.include_router(stats.router, prefix="/api")
app.include_router(counties.router, prefix="/api")
app.include_router(parcels.router, prefix="/api")
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(lender.router, prefix="/api", tags=["lender"])


@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    from api.utils.data_loader import get_available_counties

    counties_count = len(get_available_counties())

    return HealthResponse(
        status="healthy",
        version=settings.API_VERSION,
        counties_available=counties_count
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Detailed health check"""
    from api.utils.data_loader import get_available_counties

    counties_count = len(get_available_counties())

    return HealthResponse(
        status="healthy",
        version=settings.API_VERSION,
        counties_available=counties_count
    )


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info(f"Starting {settings.API_TITLE} v{settings.API_VERSION}")
    logger.info(f"Data directory: {settings.DATA_ROOT_DIR}")
    logger.info(f"CORS origins: {settings.CORS_ORIGINS}")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("Shutting down API server")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
        log_level=settings.LOG_LEVEL.lower()
    )
