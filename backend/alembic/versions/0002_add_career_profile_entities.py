"""add education, projects, certifications, achievements, career_preferences tables

Revision ID: 0002_profile_entities
Revises: 0001_initial_schema
Create Date: 2026-09-28 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '0002_profile_entities'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create education table
    op.create_table(
        'education',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('institution', sa.String(length=255), nullable=False),
        sa.Column('degree', sa.String(length=255), nullable=False),
        sa.Column('field_of_study', sa.String(length=255), nullable=True),
        sa.Column('start_date', sa.String(length=50), nullable=True),
        sa.Column('end_date', sa.String(length=50), nullable=True),
        sa.Column('gpa', sa.String(length=20), nullable=True),
        sa.Column('honors', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('coursework', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_education_candidate_id'), 'education', ['candidate_id'], unique=False)

    # 2. Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('technologies', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('repo_url', sa.String(length=500), nullable=True),
        sa.Column('live_url', sa.String(length=500), nullable=True),
        sa.Column('start_date', sa.String(length=50), nullable=True),
        sa.Column('end_date', sa.String(length=50), nullable=True),
        sa.Column('bullet_points', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_projects_candidate_id'), 'projects', ['candidate_id'], unique=False)

    # 3. Create certifications table
    op.create_table(
        'certifications',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('issuing_organization', sa.String(length=255), nullable=False),
        sa.Column('issue_date', sa.String(length=50), nullable=True),
        sa.Column('expiration_date', sa.String(length=50), nullable=True),
        sa.Column('credential_id', sa.String(length=255), nullable=True),
        sa.Column('credential_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_certifications_candidate_id'), 'certifications', ['candidate_id'], unique=False)

    # 4. Create achievements table
    op.create_table(
        'achievements',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('date', sa.String(length=50), nullable=True),
        sa.Column('issuer', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_achievements_candidate_id'), 'achievements', ['candidate_id'], unique=False)

    # 5. Create career_preferences table
    op.create_table(
        'career_preferences',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('preferred_roles', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('preferred_locations', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('work_mode', sa.String(length=50), server_default='Remote', nullable=False),
        sa.Column('preferred_employment_type', sa.String(length=50), server_default='Full-time', nullable=False),
        sa.Column('target_salary_min', sa.Integer(), nullable=True),
        sa.Column('target_salary_max', sa.Integer(), nullable=True),
        sa.Column('currency', sa.String(length=10), server_default='USD', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_career_preferences_candidate_id'), 'career_preferences', ['candidate_id'], unique=True)


def downgrade() -> None:
    op.drop_table('career_preferences')
    op.drop_table('achievements')
    op.drop_table('certifications')
    op.drop_table('projects')
    op.drop_table('education')
