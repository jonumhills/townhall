"""
Email service for sending alert notifications
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
from loguru import logger
from api.config import settings


class EmailService:
    """Email service using SMTP (Gmail)"""

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.ALERT_FROM_EMAIL
        self.app_url = settings.APP_URL

    def format_impact_html(self, petition: Dict) -> str:
        """Format petition impact analysis as HTML"""
        impact = petition.get("impact_analysis", {})
        severity = impact.get("severity", "medium")

        # Severity emoji and color
        severity_config = {
            "high": {"emoji": "⚠️", "color": "#dc2626", "label": "HIGH IMPACT"},
            "medium": {"emoji": "ℹ️", "color": "#f59e0b", "label": "MEDIUM IMPACT"},
            "low": {"emoji": "✅", "color": "#16a34a", "label": "LOW IMPACT"}
        }

        config = severity_config.get(severity, severity_config["medium"])

        # Format concerns
        concerns_html = ""
        for concern in impact.get("concerns", []):
            concerns_html += f"<li style='margin: 8px 0; color: #4b5563;'>{concern}</li>"

        # Format benefits
        benefits_html = ""
        for benefit in impact.get("benefits", []):
            benefits_html += f"<li style='margin: 8px 0; color: #4b5563;'>{benefit}</li>"

        return f"""
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; background: #ffffff;">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <span style="font-size: 24px; margin-right: 10px;">{config['emoji']}</span>
                <span style="color: {config['color']}; font-weight: bold; font-size: 14px;">{config['label']}</span>
            </div>

            <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">
                Petition {petition['petition_number']}
                {f"({petition.get('distance_miles', 'N/A')} miles away)" if petition.get('distance_miles') else ''}
            </h3>

            <div style="background: #f9fafb; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                <p style="margin: 4px 0; color: #374151;"><strong>Developer:</strong> {petition.get('petitioner', 'Unknown')}</p>
                <p style="margin: 4px 0; color: #374151;"><strong>Location:</strong> {petition.get('location_description', 'N/A')}</p>
                <p style="margin: 4px 0; color: #374151;"><strong>Change:</strong> {petition.get('current_zoning', 'N/A')} → {petition.get('proposed_zoning', 'N/A')}</p>
                <p style="margin: 4px 0; color: #374151;"><strong>Status:</strong> {petition.get('status', 'N/A')}</p>
                {f"<p style='margin: 4px 0; color: #374151;'><strong>Meeting:</strong> {petition.get('meeting_date', 'N/A')}</p>" if petition.get('meeting_date') else ''}
            </div>

            <h4 style="color: #111827; margin: 16px 0 8px 0; font-size: 15px;">{impact.get('summary', 'Zoning change analysis')}</h4>

            {f'''
            <div style="margin: 16px 0;">
                <h5 style="color: #dc2626; margin: 8px 0; font-size: 14px;">⚠️ Potential Concerns:</h5>
                <ul style="margin: 8px 0; padding-left: 20px;">{concerns_html}</ul>
            </div>
            ''' if concerns_html else ''}

            {f'''
            <div style="margin: 16px 0;">
                <h5 style="color: #16a34a; margin: 8px 0; font-size: 14px;">✅ Potential Benefits:</h5>
                <ul style="margin: 8px 0; padding-left: 20px;">{benefits_html}</ul>
            </div>
            ''' if benefits_html else ''}

            {f'''
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin-top: 16px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>💡 Recommendation:</strong> {impact.get('recommendation', '')}</p>
            </div>
            ''' if impact.get('recommendation') else ''}
        </div>
        """

    def create_alert_email_html(
        self,
        email: str,
        address: str,
        radius_miles: int,
        petitions: List[Dict]
    ) -> str:
        """Create HTML email body for alert notification"""

        # Count high impact petitions
        high_impact_count = sum(1 for p in petitions if p.get('impact_analysis', {}).get('severity') == 'high')

        # Format each petition
        petitions_html = ""
        for petition in petitions:
            petitions_html += self.format_impact_html(petition)

        # Petition numbers for map link
        petition_numbers = ','.join([p['petition_number'] for p in petitions])

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
            <!-- Full-width container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        <!-- Main content container -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 800px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 50px 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 36px; font-weight: bold;">🏗️ Townhall Rezoning Alert</h1>
                                    {f'<p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95; font-weight: 600;">{high_impact_count} High Impact Alert{"s" if high_impact_count != 1 else ""}</p>' if high_impact_count > 0 else ''}
                                </td>
                            </tr>

                            <!-- Body Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <p style="font-size: 18px; color: #111827; margin-top: 0; margin-bottom: 20px;">
                                        We found <strong style="color: #667eea;">{len(petitions)}</strong> new rezoning petition{"s" if len(petitions) != 1 else ""} within <strong style="color: #667eea;">{radius_miles} miles</strong> of your monitored address:
                                    </p>

                                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                                        <p style="margin: 0; color: #374151; font-size: 16px;">📍 <strong>{address}</strong></p>
                                    </div>

                                    <hr style="border: none; border-top: 2px solid #e5e7eb; margin: 30px 0;">

                                    {petitions_html}

                                    <!-- CTA Button -->
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px;">
                                        <tr>
                                            <td align="center" style="padding: 30px 20px; background: #f9fafb; border-radius: 8px;">
                                                <a href="{self.app_url}/map?petitions={petition_numbers}" style="display: inline-block; background: #667eea; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                                    📍 View on Interactive Map
                                                </a>
                                                <p style="margin: 15px 0 0 0; font-size: 14px; color: #6b7280;">
                                                    Click to see these petitions highlighted on the Townhall map
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                                        You're receiving this because you subscribed to alerts for <strong>{address}</strong>
                                    </p>
                                    <p style="margin: 10px 0;">
                                        <a href="{self.app_url}/unsubscribe?email={email}" style="color: #667eea; text-decoration: none; font-weight: 500;">Unsubscribe from these alerts</a>
                                    </p>
                                    <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 13px;">
                                        <strong>Townhall</strong> - Making Democracy Transparent
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        return html

    def send_alert_email(
        self,
        to_email: str,
        address: str,
        radius_miles: int,
        petitions: List[Dict]
    ) -> bool:
        """
        Send alert email to subscriber

        Args:
            to_email: Recipient email address
            address: Monitored address
            radius_miles: Alert radius
            petitions: List of matching petitions with impact analysis

        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = f"🚨 {len(petitions)} New Rezoning Alert{'s' if len(petitions) != 1 else ''} Near You"
            message["From"] = self.from_email
            message["To"] = to_email

            # Create HTML content
            html_content = self.create_alert_email_html(
                to_email,
                address,
                radius_miles,
                petitions
            )

            # Create plain text fallback
            text_content = f"""
Townhall Rezoning Alert

We found {len(petitions)} new rezoning petition(s) within {radius_miles} miles of {address}.

"""
            for petition in petitions:
                text_content += f"""
Petition {petition['petition_number']}
Developer: {petition.get('petitioner', 'Unknown')}
Location: {petition.get('location_description', 'N/A')}
Change: {petition.get('current_zoning', 'N/A')} → {petition.get('proposed_zoning', 'N/A')}
Status: {petition.get('status', 'N/A')}

"""

            text_content += f"""
View on map: {self.app_url}/map

Unsubscribe: {self.app_url}/unsubscribe?email={to_email}
"""

            # Attach parts
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(message)

            logger.info(f"Alert email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()
