"""
Alert subscription API routes
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime
import requests
import json
import uuid
from loguru import logger

from api.config import settings
from api.models.alert import (
    AlertSubscriptionRequest,
    AlertSubscriptionResponse,
    GeocodingResult
)
from api.services.email_service import email_service

router = APIRouter()

# Mapbox Geocoding configuration
MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"


def geocode_address(address: str) -> GeocodingResult:
    """
    Geocode address using Mapbox API

    Args:
        address: Human-readable address

    Returns:
        GeocodingResult with lat/lon coordinates
    """
    try:
        # Encode address for URL
        encoded_address = requests.utils.quote(address)
        url = f"{MAPBOX_GEOCODING_URL}/{encoded_address}.json"

        params = {
            "access_token": settings.MAPBOX_TOKEN,
            "limit": 1
        }

        response = requests.get(url, params=params)
        response.raise_for_status()

        data = response.json()

        if not data.get("features"):
            raise ValueError(f"No geocoding results found for address: {address}")

        feature = data["features"][0]
        coordinates = feature["geometry"]["coordinates"]

        return GeocodingResult(
            longitude=coordinates[0],
            latitude=coordinates[1],
            formatted_address=feature.get("place_name", address)
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Geocoding API error: {str(e)}")
    except (KeyError, IndexError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid geocoding response: {str(e)}")


def store_subscription_in_elasticsearch(subscription_data: dict) -> str:
    """
    Store alert subscription in Elasticsearch

    Args:
        subscription_data: Subscription document

    Returns:
        Document ID
    """
    try:
        url = f"{settings.ELASTIC_ENDPOINT}/alert_subscriptions/_doc"

        headers = {
            "Authorization": f"ApiKey {settings.ELASTIC_API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=subscription_data, headers=headers)
        response.raise_for_status()

        result = response.json()
        return result.get("_id")

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Elasticsearch error: {str(e)}")


def send_welcome_email_background(email: str, address: str, radius_miles: int, latitude: float, longitude: float):
    """
    Background task: call the alert checker agent scoped to this subscriber
    and send an immediate welcome email with current matching petitions.
    """
    try:
        url = f"{settings.KIBANA_ENDPOINT}/api/agent_builder/converse"
        headers = {
            "Authorization": f"ApiKey {settings.ELASTIC_API_KEY}",
            "kbn-xsrf": "true",
            "Content-Type": "application/json",
        }
        # Extract city/county from address for text-based matching
        address_parts = address.split(",")
        city = address_parts[1].strip() if len(address_parts) > 1 else address

        payload = {
            "agent_id": settings.ALERT_AGENT_ID,
            "input": (
                f"A new subscriber just signed up with email={email}, address={address}, radius={radius_miles} miles. "
                f"Search the petitions index for Active petitions in or near {city}. "
                f"Return up to 5 relevant petitions with impact analysis for this subscriber. "
                f"You MUST return a JSON response in exactly this structure (no extra text before or after): "
                f'{{"notifications": [{{"email": "{email}", "address": "{address}", "radius_miles": {radius_miles}, '
                f'"petitions": [{{"petition_number": "...", "location_description": "...", "petitioner": "...", '
                f'"current_zoning": "...", "proposed_zoning": "...", "status": "...", "meeting_date": "...", '
                f'"impact_analysis": {{"summary": "...", "severity": "medium", "concerns": [], "benefits": [], "recommendation": ""}}}}]}}], '
                f'"summary": {{"total_subscriptions": 1, "total_notifications": 1, "total_petitions_found": 5}}}}'
            ),
        }

        logger.info(f"Sending welcome email for new subscriber: {email}")
        response = requests.post(url, json=payload, headers=headers, timeout=300)
        response.raise_for_status()
        data = response.json()

        # Parse agent response (same logic as alerts_cron)
        message = data.get("response", {}).get("message", "")
        if not message:
            logger.warning(f"No message in agent response for welcome email to {email}")
            return

        if "```json" in message:
            json_str = message[message.find("```json") + 7: message.find("```", message.find("```json") + 7)].strip()
        elif "```" in message:
            json_str = message[message.find("```") + 3: message.find("```", message.find("```") + 3)].strip()
        elif "{" in message:
            json_str = message[message.find("{"):message.rfind("}") + 1]
        else:
            logger.info(f"No petitions found near {address} for welcome email")
            return

        result = json.loads(json_str)
        notifications = result.get("notifications", [])

        if not notifications or not notifications[0].get("petitions"):
            logger.info(f"No nearby petitions found for welcome email to {email}")
            return

        notification = notifications[0]
        email_service.send_alert_email(
            to_email=notification["email"],
            address=notification["address"],
            radius_miles=notification.get("radius_miles", radius_miles),
            petitions=notification["petitions"],
        )
        logger.info(f"Welcome email sent to {email}")

    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {str(e)}")


@router.post("/subscribe", response_model=AlertSubscriptionResponse)
async def create_alert_subscription(request: AlertSubscriptionRequest, background_tasks: BackgroundTasks):
    """
    Create a new alert subscription

    1. Geocode the provided address
    2. Store subscription in Elasticsearch alert_subscriptions index
    3. Return subscription details
    """
    # Geocode address to get coordinates
    geocoding_result = geocode_address(request.address)

    # Create subscription document
    subscription_id = str(uuid.uuid4())
    subscription_data = {
        "email": request.email,
        "address": geocoding_result.formatted_address,
        "latitude": geocoding_result.latitude,
        "longitude": geocoding_result.longitude,
        "radius_miles": request.radius_miles,
        "location": {
            "lat": geocoding_result.latitude,
            "lon": geocoding_result.longitude
        },
        "is_active": True,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    # Store in Elasticsearch
    doc_id = store_subscription_in_elasticsearch(subscription_data)

    # Trigger immediate welcome email in background
    background_tasks.add_task(
        send_welcome_email_background,
        email=subscription_data["email"],
        address=subscription_data["address"],
        radius_miles=subscription_data["radius_miles"],
        latitude=subscription_data["latitude"],
        longitude=subscription_data["longitude"],
    )

    return AlertSubscriptionResponse(
        id=doc_id,
        email=subscription_data["email"],
        address=subscription_data["address"],
        latitude=subscription_data["latitude"],
        longitude=subscription_data["longitude"],
        radius_miles=subscription_data["radius_miles"],
        is_active=subscription_data["is_active"],
        created_at=subscription_data["created_at"]
    )


@router.delete("/unsubscribe/{email}")
async def unsubscribe_alerts(email: str):
    """
    Deactivate alert subscription for an email

    Uses Elasticsearch update_by_query to set is_active=false
    """
    try:
        url = f"{settings.ELASTIC_ENDPOINT}/alert_subscriptions/_update_by_query"

        headers = {
            "Authorization": f"ApiKey {settings.ELASTIC_API_KEY}",
            "Content-Type": "application/json"
        }

        query = {
            "script": {
                "source": "ctx._source.is_active = false",
                "lang": "painless"
            },
            "query": {
                "term": {
                    "email.keyword": email
                }
            }
        }

        response = requests.post(url, json=query, headers=headers)
        response.raise_for_status()

        result = response.json()
        updated_count = result.get("updated", 0)

        if updated_count == 0:
            raise HTTPException(status_code=404, detail=f"No active subscriptions found for {email}")

        return {
            "message": f"Successfully unsubscribed {email}",
            "updated_count": updated_count
        }

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Elasticsearch error: {str(e)}")


@router.get("/subscriptions/{email}")
async def get_user_subscriptions(email: str):
    """
    Get all active subscriptions for an email address
    """
    try:
        url = f"{settings.ELASTIC_ENDPOINT}/alert_subscriptions/_search"

        headers = {
            "Authorization": f"ApiKey {settings.ELASTIC_API_KEY}",
            "Content-Type": "application/json"
        }

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"email.keyword": email}},
                        {"term": {"is_active": True}}
                    ]
                }
            }
        }

        response = requests.post(url, json=query, headers=headers)
        response.raise_for_status()

        result = response.json()
        hits = result.get("hits", {}).get("hits", [])

        subscriptions = []
        for hit in hits:
            source = hit["_source"]
            subscriptions.append(AlertSubscriptionResponse(
                id=hit["_id"],
                email=source["email"],
                address=source["address"],
                latitude=source["latitude"],
                longitude=source["longitude"],
                radius_miles=source["radius_miles"],
                is_active=source["is_active"],
                created_at=source["created_at"]
            ))

        return subscriptions

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Elasticsearch error: {str(e)}")
