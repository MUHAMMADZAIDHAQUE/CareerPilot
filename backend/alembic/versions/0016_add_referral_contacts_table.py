"""add referral contacts table for Phase 18 referral discovery

Revision ID: 0016_referral_contacts
Revises: 0015_tailored_resume_status
Create Date: 2026-09-29 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0016_referral_contacts'
down_revision: Union[str, None] = '0015_tailored_resume_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'referral_contacts',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('company_id', sa.String(length=255), nullable=True),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('headline', sa.String(length=500), nullable=True),
        sa.Column('current_title', sa.String(length=255), nullable=False),
        sa.Column('department', sa.String(length=150), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('profile_url', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=100), server_default='linkedin', nullable=False),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('source_references', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('public_contact_method', sa.String(length=255), nullable=True),
        sa.Column('university', sa.String(length=255), nullable=True),
        sa.Column('graduation_year', sa.Integer(), nullable=True),
        sa.Column('skills', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('relevance_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('relevance_reasons', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('score_breakdown', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('relationship_type', sa.String(length=50), server_default='EMPLOYEE', nullable=False),
        sa.Column('verification_status', sa.String(length=50), server_default='VERIFIED', nullable=False),
        sa.Column('last_verified_at', sa.String(length=100), nullable=True),
        sa.Column('discovered_at', sa.String(length=100), nullable=True),
        sa.Column('duplicate_key', sa.String(length=255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('outreach_status', sa.String(length=50), server_default='NOT_CONTACTED', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_index(op.f('ix_referral_contacts_job_id'), 'referral_contacts', ['job_id'], unique=False)
    op.create_index(op.f('ix_referral_contacts_company_name'), 'referral_contacts', ['company_name'], unique=False)
    op.create_index(op.f('ix_referral_contacts_company'), 'referral_contacts', ['company'], unique=False)
    op.create_index(op.f('ix_referral_contacts_name'), 'referral_contacts', ['name'], unique=False)
    op.create_index(op.f('ix_referral_contacts_duplicate_key'), 'referral_contacts', ['duplicate_key'], unique=False)
    op.create_index(op.f('ix_referral_contacts_outreach_status'), 'referral_contacts', ['outreach_status'], unique=False)
    op.create_index(op.f('ix_referral_contacts_verification_status'), 'referral_contacts', ['verification_status'], unique=False)


def downgrade() -> None:
    op.drop_table('referral_contacts')
