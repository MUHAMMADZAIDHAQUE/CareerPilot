"""add outreach drafts and audit events tables for Phase 19

Revision ID: 0017_outreach_drafts
Revises: 0016_referral_contacts
Create Date: 2026-09-29 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0017_outreach_drafts'
down_revision: Union[str, None] = '0016_referral_contacts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'outreach_drafts',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=True),
        sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=True),
        sa.Column('referral_contact_id', sa.String(length=36), sa.ForeignKey('referral_contacts.id', ondelete='CASCADE'), nullable=True),
        sa.Column('resume_version_id', sa.String(length=36), sa.ForeignKey('resume_versions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('recipient_name', sa.String(length=255), nullable=True),
        sa.Column('recipient_email', sa.String(length=255), nullable=True),
        sa.Column('recipient_profile_url', sa.String(length=500), nullable=True),
        sa.Column('channel', sa.String(length=50), server_default='LINKEDIN', nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='DRAFT', nullable=False),
        sa.Column('generation_version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('prompt_version', sa.String(length=50), server_default='v1.0', nullable=False),
        sa.Column('personalization_evidence', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('validation_results', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('risk_flags', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.String(length=255), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_by', sa.String(length=255), nullable=True),
        sa.Column('human_edits', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('dispatch_status', sa.String(length=50), server_default='NOT_DISPATCHED', nullable=False),
        sa.Column('audit_metadata', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_index(op.f('ix_outreach_drafts_candidate_id'), 'outreach_drafts', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_outreach_drafts_job_id'), 'outreach_drafts', ['job_id'], unique=False)
    op.create_index(op.f('ix_outreach_drafts_referral_contact_id'), 'outreach_drafts', ['referral_contact_id'], unique=False)
    op.create_index(op.f('ix_outreach_drafts_channel'), 'outreach_drafts', ['channel'], unique=False)
    op.create_index(op.f('ix_outreach_drafts_status'), 'outreach_drafts', ['status'], unique=False)
    op.create_index(op.f('ix_outreach_drafts_dispatch_status'), 'outreach_drafts', ['dispatch_status'], unique=False)

    op.create_table(
        'outreach_audit_events',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('draft_id', sa.String(length=36), sa.ForeignKey('outreach_drafts.id', ondelete='CASCADE'), nullable=True),
        sa.Column('candidate_id', sa.String(length=36), nullable=True),
        sa.Column('job_id', sa.String(length=36), nullable=True),
        sa.Column('referral_contact_id', sa.String(length=36), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('actor', sa.String(length=100), server_default='user', nullable=False),
        sa.Column('payload', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('no_message_sent', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_index(op.f('ix_outreach_audit_events_draft_id'), 'outreach_audit_events', ['draft_id'], unique=False)
    op.create_index(op.f('ix_outreach_audit_events_event_type'), 'outreach_audit_events', ['event_type'], unique=False)


def downgrade() -> None:
    op.drop_table('outreach_audit_events')
    op.drop_table('outreach_drafts')
