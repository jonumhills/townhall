#!/usr/bin/env python3
"""
Alert Checker Cron Job

This script:
1. Calls the townhall_alert_checker Elasticsearch agent
2. Parses the agent's JSON response
3. Sends email notifications via SMTP

Schedule: Run every 6 hours via cron or scheduler
"""
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from loguru import logger

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load environment variables FIRST (before importing email_service)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path, override=True)

from api.config import settings
from api.services.email_service import email_service

# Configure logger
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{message}</cyan>",
    level="INFO"
)
logger.add(
    Path(__file__).parent / "logs" / f"alerts_{datetime.now().strftime('%Y%m%d')}.log",
    rotation="1 day",
    retention="30 days",
    level="DEBUG"
)


def call_alert_checker_agent() -> dict:
    """
    Call the townhall_alert_checker agent

    Returns:
        Agent response as dict
    """
    max_retries = 3
    timeout = 300  # 5 minutes - agent may take time for complex queries

    for attempt in range(max_retries):
        try:
            url = f"{settings.KIBANA_ENDPOINT}/api/agent_builder/converse"

            headers = {
                "Authorization": f"ApiKey {settings.ELASTIC_API_KEY}",
                "kbn-xsrf": "true",
                "Content-Type": "application/json"
            }

            payload = {
                "agent_id": settings.ALERT_AGENT_ID,
                "input": "Check for new rezoning petitions near subscriber addresses. For each active subscription in alert_subscriptions index, find petitions within their radius and analyze how each petition would impact the subscriber. Return results as JSON with email, address, radius, and list of petitions with impact analysis (concerns, benefits, severity)."
            }

            logger.info(f"Calling alert checker agent: {settings.ALERT_AGENT_ID} (attempt {attempt + 1}/{max_retries})")
            response = requests.post(url, json=payload, headers=headers, timeout=timeout)
            response.raise_for_status()

            data = response.json()
            logger.info("Agent response received successfully")

            return data

        except requests.exceptions.Timeout as e:
            logger.warning(f"Agent request timed out (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt == max_retries - 1:
                logger.error(f"Agent failed after {max_retries} attempts")
                raise
            logger.info(f"Retrying in 5 seconds...")
            import time
            time.sleep(5)

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to call alert checker agent: {str(e)}")
            raise


def parse_agent_response(agent_data: dict) -> dict:
    """
    Parse agent response to extract notifications

    Args:
        agent_data: Raw agent response

    Returns:
        Parsed notifications dict
    """
    try:
        # Extract message from agent response
        message = agent_data.get("response", {}).get("message", "")

        if not message:
            logger.warning("Agent response contains no message")
            return {"notifications": [], "summary": {}}

        # Try to extract JSON from message
        # Agent might wrap JSON in markdown code blocks
        if "```json" in message:
            json_start = message.find("```json") + 7
            json_end = message.find("```", json_start)
            json_str = message[json_start:json_end].strip()
        elif "```" in message:
            json_start = message.find("```") + 3
            json_end = message.find("```", json_start)
            json_str = message[json_start:json_end].strip()
        elif "{" in message:
            # Try to extract JSON object
            json_start = message.find("{")
            json_end = message.rfind("}") + 1
            json_str = message[json_start:json_end]
        else:
            # Agent might return plain text if no notifications
            logger.info("No JSON found in agent response - likely no notifications")
            return {"notifications": [], "summary": {}}

        # Parse JSON
        result = json.loads(json_str)
        logger.info(f"Parsed {len(result.get('notifications', []))} notifications from agent")

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse agent response as JSON: {str(e)}")
        logger.debug(f"Agent message: {message}")
        return {"notifications": [], "summary": {}}


def send_notifications(notifications: list) -> tuple:
    """
    Send email notifications to subscribers

    Args:
        notifications: List of notification objects

    Returns:
        Tuple of (success_count, failure_count)
    """
    success_count = 0
    failure_count = 0

    for notification in notifications:
        try:
            email = notification.get("email")
            address = notification.get("address")
            radius_miles = notification.get("radius_miles", 3)
            petitions = notification.get("petitions", [])

            if not email or not petitions:
                logger.warning(f"Skipping notification - missing email or petitions: {notification}")
                continue

            logger.info(f"Sending alert to {email} for {len(petitions)} petition(s)")

            # Send email
            success = email_service.send_alert_email(
                to_email=email,
                address=address,
                radius_miles=radius_miles,
                petitions=petitions
            )

            if success:
                success_count += 1
                logger.info(f"✓ Alert sent successfully to {email}")
            else:
                failure_count += 1
                logger.error(f"✗ Failed to send alert to {email}")

        except Exception as e:
            logger.error(f"Error processing notification for {notification.get('email', 'unknown')}: {str(e)}")
            failure_count += 1

    return success_count, failure_count


def main():
    """Main cron job execution"""
    try:
        logger.info("=" * 80)
        logger.info("Starting alert checker cron job")
        logger.info(f"Timestamp: {datetime.now().isoformat()}")
        logger.info("=" * 80)

        # Step 1: Call agent
        agent_response = call_alert_checker_agent()
        logger.info(f"Agent call completed - {agent_response}")
        # Step 2: Parse response
        result = parse_agent_response(agent_response)

        notifications = result.get("notifications", [])
        summary = result.get("summary", {})

        logger.info(f"Summary: {summary}")

        if not notifications:
            logger.info("No notifications to send - no new petitions found")
            return

        # Step 3: Send emails
        logger.info(f"Processing {len(notifications)} notification(s)")
        success_count, failure_count = send_notifications(notifications)

        # Summary
        logger.info("=" * 80)
        logger.info("Alert checker cron job completed")
        logger.info(f"Total notifications: {len(notifications)}")
        logger.info(f"Emails sent successfully: {success_count}")
        logger.info(f"Emails failed: {failure_count}")
        logger.info("=" * 80)

        # Exit with error code if any failures
        if failure_count > 0:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Fatal error in alert checker cron job: {str(e)}")
        logger.exception(e)
        sys.exit(1)


if __name__ == "__main__":
    main()
