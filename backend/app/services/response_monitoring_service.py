import re
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.app.models.application import (
    Application,
    ApplicationStatus,
    InboundResponse,
    Assessment,
    Deadline,
    InterviewEvent,
    Notification,
)
from backend.app.schemas.application import (
    InboundResponseCreate,
    InboundResponseResponse,
    AssessmentCreate,
    AssessmentResponse,
    DeadlineCreate,
    DeadlineResponse,
    InterviewEventCreate,
    InterviewEventResponse,
)
from backend.app.core.logging import logger


MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def parse_explicit_date(text: str) -> Optional[datetime]:
    """
    Extracts explicit date from text without hallucination.
    Never invents or fabricates dates.
    """
    # 1. ISO format: YYYY-MM-DD
    iso_match = re.search(r"\b(202[4-9])-(\d{2})-(\d{2})\b", text)
    if iso_match:
        try:
            return datetime(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)), 23, 59, 59)
        except ValueError:
            pass

    # 2. Month DD, YYYY or Month DD
    month_match = re.search(r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(202[4-9]))?\b", text, re.IGNORECASE)
    if month_match:
        m_str = month_match.group(1).lower()
        day = int(month_match.group(2))
        year = int(month_match.group(3)) if month_match.group(3) else datetime.utcnow().year
        month = MONTH_MAP.get(m_str[:3])
        if month:
            try:
                return datetime(year, month, day, 23, 59, 59)
            except ValueError:
                pass

    # 3. DD Month YYYY
    day_first_match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(202[4-9]))?\b", text, re.IGNORECASE)
    if day_first_match:
        day = int(day_first_match.group(1))
        m_str = day_first_match.group(2).lower()
        year = int(day_first_match.group(3)) if day_first_match.group(3) else datetime.utcnow().year
        month = MONTH_MAP.get(m_str[:3])
        if month:
            try:
                return datetime(year, month, day, 23, 59, 59)
            except ValueError:
                pass

    return None


class ResponseMonitoringService:
    """
    Inbound communication response classification, assessment detection,
    interview invitation tracking, and deadline extraction engine.
    """

    @classmethod
    def classify_text(cls, subject: str, body: str) -> Tuple[str, float, bool]:
        """
        Classifies inbound communication based on evidence without hallucinations.
        Returns: (classification, confidence, action_required)
        """
        corpus = f"{subject or ''} {body}".lower()

        # 1. Assessment / Test
        if any(w in corpus for w in ["hackerrank", "codesignal", "testgorilla", "hirevue", "hackerearth", "coding assessment", "online test", "technical assessment", "take-home assignment", "aptitude test", "coding challenge"]):
            return "ASSESSMENT", 0.95, True

        # 2. Interview Invitation
        if any(w in corpus for w in ["interview", "invitation to chat", "screening call", "technical interview", "schedule a call", "meet with the team", "calendly.com", "zoom.us", "meet.google.com"]):
            return "INTERVIEW", 0.92, True

        # 3. Referral Offer
        if any(w in corpus for w in ["happy to refer", "submitted your referral", "referral submitted", "referred you internally", "internal referral"]):
            return "REFERRAL_OFFER", 0.95, False

        # 4. Declined
        if any(w in corpus for w in ["unfortunately", "not moving forward", "other candidates", "regret to inform", "pursuing other applicants", "not a match at this time"]):
            return "DECLINED", 0.90, False

        # 5. Request More Info
        if any(w in corpus for w in ["send over your updated resume", "could you clarify", "share your portfolio", "transcripts", "available dates"]):
            return "REQUEST_MORE_INFO", 0.88, True

        # 6. Positive / Interested
        if any(w in corpus for w in ["great profile", "impressed with your background", "would love to discuss", "strong fit"]):
            return "POSITIVE", 0.85, True

        # 7. Application Update
        if any(w in corpus for w in ["application received", "status update", "under review", "application submitted"]):
            return "APPLICATION_UPDATE", 0.85, False

        return "OTHER", 0.60, False

    @classmethod
    def extract_assessment(cls, text: str) -> Optional[Dict[str, Any]]:
        """Detects coding tests and assessments with explicit platform and deadlines."""
        text_lower = text.lower()
        if not any(k in text_lower for k in ["hackerrank", "codesignal", "testgorilla", "hackerearth", "online test", "coding assessment", "technical assignment"]):
            return None

        platform = "HACKERRANK"
        if "codesignal" in text_lower:
            platform = "CODESIGNAL"
        elif "testgorilla" in text_lower:
            platform = "TESTGORILLA"
        elif "hackerearth" in text_lower:
            platform = "HACKEREARTH"
        elif "hirevue" in text_lower:
            platform = "HIREVUE"

        # Detect URL
        url_match = re.search(r"https?://[^\s<>\"']+", text)
        url = url_match.group(0) if url_match else None

        # Detect deadline
        deadline_date = parse_explicit_date(text)

        title = f"{platform.title()} Technical Assessment"

        return {
            "title": title,
            "platform": platform,
            "url": url,
            "deadline": deadline_date,
            "assessment_type": "CODING_ASSESSMENT",
            "confidence": 0.95,
        }

    @classmethod
    def extract_interview(cls, text: str, subject: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Detects interview invitation details, video meeting URLs, and dates."""
        text_lower = f"{subject or ''} {text}".lower()
        if not any(k in text_lower for k in ["interview", "screening", "chat with", "schedule a time", "zoom.us", "meet.google.com", "calendly.com"]):
            return None

        # Determine type
        itype = "TECHNICAL"
        if "hr" in text_lower or "recruiter" in text_lower or "screening" in text_lower:
            itype = "HR"
        elif "hiring manager" in text_lower or "manager" in text_lower:
            itype = "HIRING_MANAGER"
        elif "system design" in text_lower:
            itype = "SYSTEM_DESIGN"
        elif "final" in text_lower:
            itype = "FINAL_ROUND"

        # Extract meeting URL
        meeting_match = re.search(r"https?://(?:[a-zA-Z0-9-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|calendly\.com)[^\s<>\"']+", text)
        meeting_url = meeting_match.group(0) if meeting_match else None

        scheduled_date = parse_explicit_date(text) or (datetime.utcnow() + timedelta(days=3))

        return {
            "interview_type": itype,
            "meeting_url": meeting_url,
            "scheduled_at": scheduled_date,
            "confidence": 0.90,
        }

    @classmethod
    async def ingest_inbound_response(
        cls,
        session: AsyncSession,
        req: InboundResponseCreate,
    ) -> InboundResponseResponse:
        """
        Ingests an incoming communication, classifies it, detects assessments / interviews / deadlines,
        updates Application CRM, and posts notifications.
        """
        # 1. Classification
        classification, confidence, action_req = cls.classify_text(req.subject or "", req.body)

        # 2. Detection
        assessment_info = cls.extract_assessment(req.body)
        interview_info = cls.extract_interview(req.body, req.subject)
        deadline_date = parse_explicit_date(req.body)

        assessment_detected = assessment_info is not None
        interview_detected = interview_info is not None
        deadline_detected = deadline_date is not None or (assessment_info and assessment_info["deadline"] is not None)

        response_record = InboundResponse(
            id=str(uuid.uuid4()),
            candidate_id=req.candidate_id,
            job_id=req.job_id,
            contact_id=req.contact_id,
            outreach_id=req.outreach_id,
            dispatch_id=req.dispatch_id,
            application_id=req.application_id,
            channel=req.channel,
            message_id=req.message_id or f"inb_{uuid.uuid4().hex[:10]}",
            received_at=req.received_at or datetime.utcnow(),
            sender=req.sender,
            subject=req.subject,
            body=req.body,
            classification=classification,
            confidence=confidence,
            action_required=action_req,
            assessment_detected=assessment_detected,
            interview_detected=interview_detected,
            deadline_detected=deadline_detected,
            metadata_json=req.metadata_json,
        )
        session.add(response_record)
        await session.flush()

        # 3. Find or correlate Application
        app = None
        if req.application_id:
            a_res = await session.execute(select(Application).where(Application.id == req.application_id))
            app = a_res.scalars().first()
        elif req.job_id:
            a_stmt = select(Application).where(Application.job_id == req.job_id)
            if req.candidate_id:
                a_stmt = a_stmt.where(Application.candidate_id == req.candidate_id)
            a_res = await session.execute(a_stmt)
            app = a_res.scalars().first()

        # 4. Handle Assessment
        if assessment_info:
            due = assessment_info["deadline"] or (datetime.utcnow() + timedelta(days=5))
            asmt = Assessment(
                id=str(uuid.uuid4()),
                application_id=app.id if app else None,
                job_id=req.job_id,
                response_id=response_record.id,
                candidate_id=req.candidate_id,
                assessment_type=assessment_info["assessment_type"],
                title=assessment_info["title"],
                platform=assessment_info["platform"],
                url=assessment_info["url"],
                deadline=due,
                status="PENDING",
                notes=f"Detected from response from {req.sender}",
                confidence=assessment_info["confidence"],
                metadata_json={"detected_from_response": True},
            )
            session.add(asmt)

            # Create assessment deadline
            dl = Deadline(
                id=str(uuid.uuid4()),
                application_id=app.id if app else None,
                candidate_id=req.candidate_id,
                deadline_type="ASSESSMENT_DEADLINE",
                title=f"{assessment_info['title']} Due",
                due_date=due,
                status="PENDING",
                priority="HIGH",
                notes=f"Complete assessment at {assessment_info.get('url') or 'portal'}",
            )
            session.add(dl)

            if app:
                app.status = ApplicationStatus.ASSESSMENT

        # 5. Handle Interview
        elif interview_info:
            ie = InterviewEvent(
                id=str(uuid.uuid4()),
                application_id=app.id if app else None,
                candidate_id=req.candidate_id,
                job_id=req.job_id or "job_auto",
                company=(app.job.company if app and app.job else "Employer"),
                scheduled_at=interview_info["scheduled_at"],
                interview_type=interview_info["interview_type"],
                meeting_url=interview_info["meeting_url"],
                status="SCHEDULED",
                notes=f"Interview request received from {req.sender}",
                metadata_json={"detected_from_response": True},
            )
            session.add(ie)

            # Create interview deadline
            dl = Deadline(
                id=str(uuid.uuid4()),
                application_id=app.id if app else None,
                candidate_id=req.candidate_id,
                deadline_type="INTERVIEW",
                title=f"{interview_info['interview_type']} Interview with {ie.company}",
                due_date=interview_info["scheduled_at"],
                status="PENDING",
                priority="HIGH",
                notes=f"Meeting URL: {interview_info.get('meeting_url') or 'Check email'}",
            )
            session.add(dl)

            if app:
                app.status = ApplicationStatus.INTERVIEW

        elif deadline_date:
            dl = Deadline(
                id=str(uuid.uuid4()),
                application_id=app.id if app else None,
                candidate_id=req.candidate_id,
                deadline_type="FOLLOW_UP",
                title=f"Response action required: {req.subject or 'Message'}",
                due_date=deadline_date,
                status="PENDING",
                priority="MEDIUM",
                notes=f"Sender: {req.sender}",
            )
            session.add(dl)

        # 6. Lifecycle updates for other classifications
        if app and not assessment_info and not interview_info:
            if classification == "DECLINED":
                app.status = ApplicationStatus.REJECTED
            elif classification in {"POSITIVE", "REFERRAL_OFFER"}:
                app.status = ApplicationStatus.APPLICATION_READY
                if classification == "REFERRAL_OFFER":
                    app.referral_status = "referred"

        # 7. Notification
        notif = Notification(
            id=str(uuid.uuid4()),
            candidate_id=req.candidate_id,
            title=f"New Response: {classification.replace('_', ' ').title()}",
            message=f"Received communication from {req.sender}: {req.subject or req.body[:80]}...",
            category="RESPONSE_RECEIVED" if not assessment_detected else "ASSESSMENT",
            deep_link=f"/applications/{app.id}" if app else "/applications",
            metadata_json={"response_id": response_record.id, "classification": classification},
        )
        session.add(notif)

        await session.commit()
        await session.refresh(response_record)
        return InboundResponseResponse.model_validate(response_record)

    @classmethod
    async def list_responses(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        job_id: Optional[str] = None,
    ) -> List[InboundResponseResponse]:
        query = select(InboundResponse).order_by(desc(InboundResponse.received_at))
        if candidate_id:
            query = query.where(InboundResponse.candidate_id == candidate_id)
        if job_id:
            query = query.where(InboundResponse.job_id == job_id)
        res = await session.execute(query)
        items = res.scalars().all()
        return [InboundResponseResponse.model_validate(i) for i in items]

    @classmethod
    async def get_response(
        cls,
        session: AsyncSession,
        response_id: str,
    ) -> Optional[InboundResponseResponse]:
        res = await session.execute(select(InboundResponse).where(InboundResponse.id == response_id))
        item = res.scalars().first()
        return InboundResponseResponse.model_validate(item) if item else None

    @classmethod
    async def list_assessments(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        application_id: Optional[str] = None,
    ) -> List[AssessmentResponse]:
        query = select(Assessment).order_by(desc(Assessment.created_at))
        if candidate_id:
            query = query.where(Assessment.candidate_id == candidate_id)
        if application_id:
            query = query.where(Assessment.application_id == application_id)
        res = await session.execute(query)
        items = res.scalars().all()
        return [AssessmentResponse.model_validate(i) for i in items]

    @classmethod
    async def list_deadlines(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[DeadlineResponse]:
        query = select(Deadline).order_by(Deadline.due_date.asc())
        if candidate_id:
            query = query.where(Deadline.candidate_id == candidate_id)
        if status_filter:
            query = query.where(Deadline.status == status_filter)
        res = await session.execute(query)
        items = res.scalars().all()
        return [DeadlineResponse.model_validate(i) for i in items]

    @classmethod
    async def list_interviews(
        cls,
        session: AsyncSession,
        candidate_id: Optional[str] = None,
        application_id: Optional[str] = None,
    ) -> List[InterviewEventResponse]:
        query = select(InterviewEvent).order_by(InterviewEvent.scheduled_at.asc())
        if candidate_id:
            query = query.where(InterviewEvent.candidate_id == candidate_id)
        if application_id:
            query = query.where(InterviewEvent.application_id == application_id)
        res = await session.execute(query)
        items = res.scalars().all()
        return [InterviewEventResponse.model_validate(i) for i in items]

    @classmethod
    async def create_interview(
        cls,
        session: AsyncSession,
        req: InterviewEventCreate,
    ) -> InterviewEventResponse:
        ie = InterviewEvent(
            id=str(uuid.uuid4()),
            application_id=req.application_id,
            candidate_id=req.candidate_id,
            job_id=req.job_id,
            company=req.company,
            scheduled_at=req.scheduled_at,
            interview_type=req.interview_type,
            meeting_url=req.meeting_url,
            status=req.status,
            notes=req.notes,
            metadata_json=req.metadata_json,
        )
        session.add(ie)

        # Create deadline for interview
        dl = Deadline(
            id=str(uuid.uuid4()),
            application_id=req.application_id,
            candidate_id=req.candidate_id,
            deadline_type="INTERVIEW",
            title=f"{req.interview_type} Interview with {req.company}",
            due_date=req.scheduled_at,
            status="PENDING",
            priority="HIGH",
            notes=f"Meeting: {req.meeting_url or 'N/A'}",
        )
        session.add(dl)

        # Update application status to INTERVIEW if linked
        if req.application_id:
            a_res = await session.execute(select(Application).where(Application.id == req.application_id))
            app = a_res.scalars().first()
            if app:
                app.status = ApplicationStatus.INTERVIEW
                app.interview_stage = req.interview_type

        await session.commit()
        await session.refresh(ie)
        return InterviewEventResponse.model_validate(ie)
