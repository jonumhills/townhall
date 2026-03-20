"""
Pydantic models for alert subscriptions
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class AlertSubscriptionRequest(BaseModel):
    """Request model for creating alert subscription"""
    email: EmailStr
    address: str
    radius_miles: int = 3


class AlertSubscriptionResponse(BaseModel):
    """Response model for alert subscription"""
    id: str
    email: str
    address: str
    latitude: float
    longitude: float
    radius_miles: int
    is_active: bool
    created_at: str


class GeocodingResult(BaseModel):
    """Result from Mapbox geocoding API"""
    latitude: float
    longitude: float
    formatted_address: str
