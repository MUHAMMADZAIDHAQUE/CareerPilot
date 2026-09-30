"""add job alerts, outreach dispatches, responses, assessments, deadlines, interview events, notifications, and providers tables for Phase 20

Revision ID: 0018_phase20_crm_dispatch
Revises: 0017_outreach_drafts
Create Date: 2026-09-29 21:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0018_phase20_crm_dispatch'
down_revision: Union[str, None] = '0017_outreach_drafts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. job_alerts
    op.create_table(
        'job_alerts',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=True),
        sa.Column('alert_name', sa.String(length=255), nullable=False),
        sa.Column('roles', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('locations', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('sources', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('experience_levels', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('work_modes', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('min_match_score', sa.Float(), server_default='70.0', nullable=False),
        sa.Column('frequency', sa.String(length=50), server_default='DAILY', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_job_alerts_candidate_id'), 'job_alerts', ['candidate_id'], unique=False)

    # 2. outreach_dispatches
    op.create_table(
        'outreach_dispatches',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('draft_id', sa.String(length=36), sa.ForeignKey('outreach_drafts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('candidate_id', sa.String(length=36), nullable=True),
        sa.Column('job_id', sa.String(length=36), nullable=True),
        sa.Column('referral_contact_id', sa.String(length=36), nullable=True),
        sa.Column('channel', sa.String(length=50), server_default='EMAIL', nullable=False),
        sa.Column('recipient_name', sa.String(length=255), nullable=False),
        sa.Column('recipient_address', sa.String(length=255), nullable=False),
        sa.Column('provider', sa.String(length=50), server_default='AUTHORIZED_MOCK', nullable=False),
        sa.Column('idempotency_key', sa.String(length=255), unique=True, nullable=False),
        sa.Column('status', sa.String(length=50), server_default='READY_TO_SEND', nullable=False),
        sa.Column('provider_message_id', sa.String(length=255), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivery_confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('audit_metadata', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_outreach_dispatches_draft_id'), 'outreach_dispatches', ['draft_id'], unique=False)
    op.create_index(op.f('ix_outreach_dispatches_idempotency_key'), 'outreach_dispatches', ['idempotency_key'], unique=True)
    op.create_index(op.f('ix_outreach_dispatches_status'), 'outreach_dispatches', ['status'], unique=False)

    # 3. inbound_responses
    op.create_table(
        'inbound_responses',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('contact_id', sa.String(length=36), nullable=True),
        sa.Column('outreach_id', sa.String(length=36), nullable=True),
        sa.Column('dispatch_id', sa.String(length=36), nullable=True),
        sa.Column('application_id', sa.String(length=36), sa.ForeignKey('applications.id', ondelete='SET NULL'), nullable=True),
        sa.Column('channel', sa.String(length=50), server_default='EMAIL', nullable=False),
        sa.Column('message_id', sa.String(length=255), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('sender', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('classification', sa.String(length=50), server_default='OTHER', nullable=False),
        sa.Column('confidence', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('action_required', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('assessment_detected', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('interview_detected', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('deadline_detected', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_inbound_responses_application_id'), 'inbound_responses', ['application_id'], unique=False)
    op.create_index(op.f('ix_inbound_responses_classification'), 'inbound_responses', ['classification'], unique=False)

    # 4. assessments
    op.create_table(
        'assessments',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('application_id', sa.String(length=36), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=True),
        sa.Column('response_id', sa.String(length=36), sa.ForeignKey('inbound_responses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assessment_type', sa.String(length=50), server_default='CODING_ASSESSMENT', nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('platform', sa.String(length=100), server_default='HACKERRANK', nullable=False),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_assessments_application_id'), 'assessments', ['application_id'], unique=False)
    op.create_index(op.f('ix_assessments_status'), 'assessments', ['status'], unique=False)

    # 5. deadlines
    op.create_table(
        'deadlines',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('application_id', sa.String(length=36), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('deadline_type', sa.String(length=50), server_default='APPLICATION_DEADLINE', nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False),
        sa.Column('priority', sa.String(length=50), server_default='MEDIUM', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_deadlines_application_id'), 'deadlines', ['application_id'], unique=False)
    op.create_index(op.f('ix_deadlines_due_date'), 'deadlines', ['due_date'], unique=False)
    op.create_index(op.f('ix_deadlines_status'), 'deadlines', ['status'], unique=False)

    # 6. interview_events
    op.create_table(
        'interview_events',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('application_id', sa.String(length=36), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=True),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('interview_type', sa.String(length=50), server_default='TECHNICAL', nullable=False),
        sa.Column('meeting_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='SCHEDULED', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_interview_events_application_id'), 'interview_events', ['application_id'], unique=False)
    op.create_index(op.f('ix_interview_events_scheduled_at'), 'interview_events', ['scheduled_at'], unique=False)

    # 7. notifications
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), server_default='SYSTEM', nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('deep_link', sa.String(length=500), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_notifications_candidate_id'), 'notifications', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_notifications_category'), 'notifications', ['category'], unique=False)
    op.create_index(op.f('ix_notifications_is_read'), 'notifications', ['is_read'], unique=False)

    # 8. connected_providers
    op.create_table(
        'connected_providers',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('provider_type', sa.String(length=50), nullable=False),
        sa.Column('email_address', sa.String(length=255), nullable=False),
        sa.Column('is_connected', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='CONNECTED', nullable=False),
        sa.Column('scopes', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_connected_providers_candidate_id'), 'connected_providers', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_connected_providers_provider_type'), 'connected_providers', ['provider_type'], unique=False)


def downgrade() -> None:
    op.drop_table('connected_providers')
    op.drop_table('notifications')
    op.drop_table('interview_events')
    op.drop_table('deadlines')
    op.drop_table('assessments')
    op.drop_table('inbound_responses')
    op.drop_table('outreach_dispatches')
    op.drop_table('job_alerts')
