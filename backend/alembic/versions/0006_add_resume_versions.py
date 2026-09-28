"""add resume_versions table for evidence-based tailored resumes

Revision ID: 0006_resume_versions
Revises: 0005_matching_engine
Create Date: 2026-09-28 22:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0006_resume_versions'
down_revision: Union[str, None] = '0005_matching_engine'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'resume_versions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('source_resume_id', sa.String(), sa.ForeignKey('resume_documents.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('latex_content', sa.Text(), nullable=False),
        sa.Column('validation_status', sa.String(50), server_default='valid', nullable=False, index=True),
        sa.Column('version_number', sa.Integer(), server_default='1', nullable=False),
        sa.Column('validation_details', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('diff_summary', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('resume_versions')
