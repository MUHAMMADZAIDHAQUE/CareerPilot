"""add applications table
 
Revision ID: 0011_applications_table
Revises: 0010_outreach_table
Create Date: 2026-09-28 23:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0011_applications_table'
down_revision: Union[str, None] = '0010_outreach_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'applications',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('resume_version_id', sa.String(), sa.ForeignKey('resume_versions.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('status', sa.String(length=50), server_default='SAVED', nullable=False, index=True),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source', sa.String(length=100), server_default='direct', nullable=True),
        sa.Column('referral_status', sa.String(length=100), server_default='none', nullable=True),
        sa.Column('interview_stage', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('next_action', sa.String(length=255), nullable=True),
        sa.Column('next_followup_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('applications')
