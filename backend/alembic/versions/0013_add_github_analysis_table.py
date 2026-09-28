"""add github_analyses table

Revision ID: 0013_github_analysis_table
Revises: 0012_interview_tables
Create Date: 2026-09-29 00:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0013_github_analysis_table'
down_revision: Union[str, None] = '0012_interview_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'github_analyses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('username', sa.String(length=255), nullable=False, index=True),
        sa.Column('profile_summary', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('skills_demonstrated', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('skills_missing_evidence', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('relevant_projects', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('potential_resume_evidence', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('recommended_improvements', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('github_analyses')
