"""add outreach table
 
Revision ID: 0010_outreach_table
Revises: 0009_contacts_and_referrals
Create Date: 2026-09-28 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0010_outreach_table'
down_revision: Union[str, None] = '0009_contacts_and_referrals'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'outreach',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('contact_id', sa.String(), sa.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('referral_id', sa.String(), sa.ForeignKey('referrals.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('channel', sa.String(length=50), nullable=False, index=True),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='NEEDS_REVIEW', nullable=False, index=True),
        sa.Column('relationship_context', sa.String(length=255), nullable=True),
        sa.Column('project_highlight', sa.String(length=255), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('outreach')
