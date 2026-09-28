"""add interview preparation and interactive session tables

Revision ID: 0012_interview_tables
Revises: 0011_applications_table
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0012_interview_tables'
down_revision: Union[str, None] = '0011_applications_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. interview_preparations
    op.create_table(
        'interview_preparations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('resume_version_id', sa.String(), sa.ForeignKey('resume_versions.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('technical_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('project_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('behavioral_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('jd_specific_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('resume_specific_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('follow_up_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('suggested_preparation_topics', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('general_questions', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('disclaimer', sa.Text(), nullable=False),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # 2. interview_sessions
    op.create_table(
        'interview_sessions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('resume_version_id', sa.String(), sa.ForeignKey('resume_versions.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('status', sa.String(length=50), server_default='IN_PROGRESS', nullable=False, index=True),
        sa.Column('current_turn_index', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_target_questions', sa.Integer(), server_default='5', nullable=False),
        sa.Column('weak_areas', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('final_feedback', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # 3. interview_turns
    op.create_table(
        'interview_turns',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('session_id', sa.String(), sa.ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('turn_index', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('context_source', sa.String(length=255), nullable=True),
        sa.Column('candidate_answer', sa.Text(), nullable=True),
        sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('evaluation', sa.JSON(), nullable=True),
        sa.Column('follow_up_question', sa.Text(), nullable=True),
        sa.Column('is_follow_up', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('interview_turns')
    op.drop_table('interview_sessions')
    op.drop_table('interview_preparations')
