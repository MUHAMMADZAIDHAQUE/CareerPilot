from backend.app.services.referral_discovery.sources.linkedin_referral_source import LinkedInReferralSource
from backend.app.services.referral_discovery.sources.company_team_source import CompanyTeamSource
from backend.app.services.referral_discovery.sources.alumni_source import AlumniReferralSource
from backend.app.services.referral_discovery.sources.github_source import GitHubReferralSource
from backend.app.services.referral_discovery.sources.public_profile_source import PublicProfileSource
from backend.app.services.referral_discovery.sources.user_url_referral_source import UserUrlReferralSource

AVAILABLE_REFERRAL_SOURCES = [
    LinkedInReferralSource(),
    CompanyTeamSource(),
    AlumniReferralSource(),
    GitHubReferralSource(),
    PublicProfileSource(),
    UserUrlReferralSource(),
]

__all__ = [
    "LinkedInReferralSource",
    "CompanyTeamSource",
    "AlumniReferralSource",
    "GitHubReferralSource",
    "PublicProfileSource",
    "UserUrlReferralSource",
    "AVAILABLE_REFERRAL_SOURCES",
]
