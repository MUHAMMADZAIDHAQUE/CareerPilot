"""Add Phase 23 India intelligence, job sources registry, and application queue

Revision ID: 0020_phase23_india_queue
Revises: 0019_add_users_and_admin_auth
Create Date: 2026-09-30 05:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision: str = '0020_phase23_india_queue'
down_revision: Union[str, None] = '0019_add_users_and_admin_auth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add India-First & Fresher intelligence columns to jobs table
    op.add_column('jobs', sa.Column('india_relevance', sa.String(length=50), server_default='INDIA_POSSIBLE', nullable=False))
    op.add_column('jobs', sa.Column('india_relevance_score', sa.Float(), server_default='0.5', nullable=False))
    op.add_column('jobs', sa.Column('india_location_type', sa.String(length=50), nullable=True))
    op.add_column('jobs', sa.Column('india_location', sa.String(length=255), nullable=True))
    op.add_column('jobs', sa.Column('remote_india', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('jobs', sa.Column('country', sa.String(length=100), server_default='India', nullable=False))
    op.add_column('jobs', sa.Column('experience_min', sa.Float(), nullable=True))
    op.add_column('jobs', sa.Column('experience_max', sa.Float(), nullable=True))
    op.add_column('jobs', sa.Column('experience_category', sa.String(length=50), nullable=True))
    op.add_column('jobs', sa.Column('entry_level_score', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('jobs', sa.Column('content_hash', sa.String(length=64), nullable=True))
    op.add_column('jobs', sa.Column('scam_score', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('jobs', sa.Column('scam_risk_level', sa.String(length=50), server_default='LOW', nullable=False))
    op.add_column('jobs', sa.Column('has_safety_warnings', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('jobs', sa.Column('safety_warnings', sa.JSON(), server_default='[]', nullable=False))

    op.create_index(op.f('ix_jobs_india_relevance'), 'jobs', ['india_relevance'], unique=False)
    op.create_index(op.f('ix_jobs_remote_india'), 'jobs', ['remote_india'], unique=False)
    op.create_index(op.f('ix_jobs_country'), 'jobs', ['country'], unique=False)
    op.create_index(op.f('ix_jobs_experience_category'), 'jobs', ['experience_category'], unique=False)
    op.create_index(op.f('ix_jobs_content_hash'), 'jobs', ['content_hash'], unique=False)

    # 2. Create job_sources table for 100+ source architecture
    op.create_table(
        'job_sources',
        sa.Column('source_id', sa.String(length=100), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('source_type', sa.String(length=50), server_default='GREENHOUSE', nullable=False),
        sa.Column('region', sa.String(length=100), server_default='India', nullable=False),
        sa.Column('country', sa.String(length=100), server_default='India', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='ACTIVE', nullable=False),
        sa.Column('authorization_method', sa.String(length=50), server_default='PUBLIC_ACCESS', nullable=False),
        sa.Column('ingestion_method', sa.String(length=50), server_default='PUBLIC_ATS', nullable=False),
        sa.Column('endpoint_url', sa.String(length=500), nullable=True),
        sa.Column('rate_limit_per_minute', sa.Integer(), server_default='30', nullable=False),
        sa.Column('supports_pagination', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_failure_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('jobs_fetched_total', sa.Integer(), server_default='0', nullable=False),
        sa.Column('jobs_accepted_total', sa.Integer(), server_default='0', nullable=False),
        sa.Column('jobs_rejected_total', sa.Integer(), server_default='0', nullable=False),
        sa.Column('duplicates_found_total', sa.Integer(), server_default='0', nullable=False),
        sa.Column('avg_ingestion_time_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('terms_metadata', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_job_sources_source_type'), 'job_sources', ['source_type'], unique=False)
    op.create_index(op.f('ix_job_sources_status'), 'job_sources', ['status'], unique=False)

    # 3. Create job_source_runs table
    op.create_table(
        'job_source_runs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('source_id', sa.String(length=100), sa.ForeignKey('job_sources.source_id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='SUCCESS', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('jobs_fetched', sa.Integer(), server_default='0', nullable=False),
        sa.Column('jobs_accepted', sa.Integer(), server_default='0', nullable=False),
        sa.Column('jobs_rejected', sa.Integer(), server_default='0', nullable=False),
        sa.Column('duplicates_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('duration_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_job_source_runs_source_id'), 'job_source_runs', ['source_id'], unique=False)
    op.create_index(op.f('ix_job_source_runs_status'), 'job_source_runs', ['status'], unique=False)

    # 4. Create application_queue table
    op.create_table(
        'application_queue',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('candidate_id', sa.String(length=36), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_id', sa.String(length=36), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('priority', sa.String(length=50), server_default='MEDIUM', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='READY', nullable=False),
        sa.Column('next_action', sa.String(length=255), server_default='Review Job Requirements', nullable=False),
        sa.Column('resume_version_id', sa.String(length=36), sa.ForeignKey('resume_versions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('referral_status', sa.String(length=100), server_default='NONE', nullable=True),
        sa.Column('outreach_status', sa.String(length=100), server_default='NONE', nullable=True),
        sa.Column('application_url', sa.String(length=500), nullable=True),
        sa.Column('application_method', sa.String(length=50), server_default='DIRECT', nullable=False),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_confirmation', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_application_queue_candidate_id'), 'application_queue', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_application_queue_job_id'), 'application_queue', ['job_id'], unique=False)
    op.create_index(op.f('ix_application_queue_status'), 'application_queue', ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('application_queue')
    op.drop_table('job_source_runs')
    op.drop_table('job_sources')

    op.drop_index(op.f('ix_jobs_content_hash'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_experience_category'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_country'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_remote_india'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_india_relevance'), table_name='jobs')

    op.drop_column('jobs', 'safety_warnings')
    op.drop_column('jobs', 'has_safety_warnings')
    op.drop_column('jobs', 'scam_risk_level')
    op.drop_column('jobs', 'scam_score')
    op.drop_column('jobs', 'content_hash')
    op.drop_column('jobs', 'entry_level_score')
    op.drop_column('jobs', 'experience_category')
    op.drop_column('jobs', 'experience_max')
    op.drop_column('jobs', 'experience_min')
    op.drop_column('jobs', 'country')
    op.drop_column('jobs', 'remote_india')
    op.drop_column('jobs', 'india_location')
    op.drop_column('jobs', 'india_location_type')
    op.drop_column('jobs', 'india_relevance_score')
    op.drop_column('jobs', 'india_relevance')
