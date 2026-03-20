"""
API Response Models (Only Used Endpoints)
"""
from typing import List, Optional
from pydantic import BaseModel


class CountyInfo(BaseModel):
    """County information with statistics"""
    id: str
    name: str
    state: str
    total_meetings: int
    total_petitions: int
    zoning_meetings: int
    petitions_with_pins: Optional[int] = 0
    total_pins: Optional[int] = 0
    last_scrape: str


class StatsResponse(BaseModel):
    """Aggregated statistics response"""
    total_counties: int
    total_meetings: int
    total_petitions: int
    total_pins: int
    counties: List[CountyInfo]


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    counties_available: int
