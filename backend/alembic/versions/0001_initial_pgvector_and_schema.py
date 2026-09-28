"""initial pgvector extension and core schemas

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-28 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Create candidates table
    op.create_table(
        'candidates',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('headline', sa.String(length=255), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('linkedin_url', sa.String(length=255), nullable=True),
        sa.Column('github_url', sa.String(length=255), nullable=True),
        sa.Column('portfolio_url', sa.String(length=255), nullable=True),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_candidates_email'), 'candidates', ['email'], unique=True)

    # 3. Create experiences table
    op.create_table(
        'experiences',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('start_date', sa.String(length=50), nullable=False),
        sa.Column('end_date', sa.String(length=50), nullable=True),
        sa.Column('is_current', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('bullet_points', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('technologies_used', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_experiences_candidate_id'), 'experiences', ['candidate_id'], unique=False)

    # 4. Create skills table
    op.create_table(
        'skills',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=100), server_default='General', nullable=False),
        sa.Column('proficiency_level', sa.String(length=50), nullable=True),
        sa.Column('years_of_experience', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_skills_candidate_id'), 'skills', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_skills_name'), 'skills', ['name'], unique=False)

    # 5. Create resume_templates table
    op.create_table(
        'resume_templates',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('latex_source', sa.Text(), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_resume_templates_candidate_id'), 'resume_templates', ['candidate_id'], unique=False)

    # 6. Create job_postings table
    op.create_table(
        'job_postings',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('employment_type', sa.String(length=50), server_default='Full-time', nullable=False),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('raw_description', sa.Text(), nullable=False),
        sa.Column('parsed_requirements', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('must_have_skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('nice_to_have_skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_job_postings_title'), 'job_postings', ['title'], unique=False)
    op.create_index(op.f('ix_job_postings_company'), 'job_postings', ['company'], unique=False)

    # 7. Create match_results table
    op.create_table(
        'match_results',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_id', sa.String(), sa.ForeignKey('job_postings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('total_score', sa.Float(), nullable=False),
        sa.Column('structured_score', sa.Float(), nullable=False),
        sa.Column('semantic_score', sa.Float(), nullable=False),
        sa.Column('matched_skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('missing_skills', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('evidence_citations', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_match_results_candidate_id'), 'match_results', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_match_results_job_id'), 'match_results', ['job_id'], unique=False)


def downgrade() -> None:
    op.drop_table('match_results')
    op.drop_table('job_postings')
    op.drop_table('resume_templates')
    op.drop_table('skills')
    op.drop_table('experiences')
    op.drop_table('candidates')
    op.execute("DROP EXTENSION IF EXISTS vector;")
