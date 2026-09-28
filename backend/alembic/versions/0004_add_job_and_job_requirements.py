"""add jobs and job_requirements tables

Revision ID: 0004_jobs_and_requirements
Revises: 0003_resume_documents
Create Date: 2026-09-28 17:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '0004_jobs_and_requirements'
down_revision: Union[str, None] = '0003_resume_documents'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create jobs table
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('employment_type', sa.String(length=100), server_default='Full-time', nullable=True),
        sa.Column('raw_description', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('domain', sa.String(length=150), nullable=True),
        sa.Column('salary', sa.String(length=150), nullable=True),
        sa.Column('application_url', sa.String(length=500), nullable=True),
        sa.Column('deadline', sa.String(length=100), nullable=True),
        sa.Column('experience_requirement', sa.Text(), nullable=True),
        sa.Column('education_requirements', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('responsibilities', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('qualifications', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('technologies', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('required_skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('preferred_skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('inferred_concepts', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_jobs_company'), 'jobs', ['company'], unique=False)
    op.create_index(op.f('ix_jobs_role'), 'jobs', ['role'], unique=False)

    # 2. Create job_requirements table
    op.create_table(
        'job_requirements',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('requirement_type', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=100), server_default='skill', nullable=True),
        sa.Column('context', sa.Text(), nullable=True),
        sa.Column('years_experience', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_job_requirements_job_id'), 'job_requirements', ['job_id'], unique=False)
    op.create_index(op.f('ix_job_requirements_name'), 'job_requirements', ['name'], unique=False)
    op.create_index(op.f('ix_job_requirements_requirement_type'), 'job_requirements', ['requirement_type'], unique=False)


def downgrade() -> None:
    op.drop_table('job_requirements')
    op.drop_table('jobs')
