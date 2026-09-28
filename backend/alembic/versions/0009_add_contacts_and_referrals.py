"""add contacts and referrals tables
 
Revision ID: 0009_contacts_and_referrals
Revises: 0008_job_discovery_fields
Create Date: 2026-09-28 23:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0009_contacts_and_referrals'
down_revision: Union[str, None] = '0008_job_discovery_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create contacts table
    op.create_table(
        'contacts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('name', sa.String(length=255), nullable=False, index=True),
        sa.Column('company', sa.String(length=255), nullable=False, index=True),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('department', sa.String(length=150), nullable=True),
        sa.Column('source', sa.String(length=100), server_default='user_provided', nullable=False, index=True),
        sa.Column('profile_url', sa.String(length=500), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('relationship', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('university', sa.String(length=255), nullable=True),
        sa.Column('skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # 2. Create referrals table
    op.create_table(
        'referrals',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('contact_id', sa.String(), sa.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('relationship_type', sa.String(length=100), nullable=False, index=True),
        sa.Column('relevance_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('relevance_reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='suggested', nullable=False, index=True),
        sa.Column('evidence', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('score_breakdown', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('referrals')
    op.drop_table('contacts')
