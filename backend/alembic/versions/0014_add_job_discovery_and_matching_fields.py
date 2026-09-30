"""add job discovery, normalization and matching categorization fields

Revision ID: 0014_job_discovery_fields
Revises: 0013_github_analysis_table
Create Date: 2026-09-29 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0014_job_discovery_fields'
down_revision: Union[str, None] = '0013_github_analysis_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add discovery and normalization columns to jobs table
    op.add_column('jobs', sa.Column('normalized_title', sa.String(length=255), nullable=True))
    op.add_column('jobs', sa.Column('official_company_url', sa.String(length=500), nullable=True))
    op.add_column('jobs', sa.Column('remote_status', sa.String(length=50), server_default='Unknown', nullable=True))
    op.add_column('jobs', sa.Column('experience_level', sa.String(length=50), server_default='Unknown', nullable=True))
    op.add_column('jobs', sa.Column('is_fresher_eligible', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('jobs', sa.Column('fresher_eligibility_reason', sa.Text(), nullable=True))
    op.add_column('jobs', sa.Column('source_references', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('jobs', sa.Column('posted_at', sa.String(length=100), nullable=True))
    op.add_column('jobs', sa.Column('last_verified_at', sa.String(length=100), nullable=True))

    op.create_index(op.f('ix_jobs_normalized_title'), 'jobs', ['normalized_title'], unique=False)
    op.create_index(op.f('ix_jobs_is_fresher_eligible'), 'jobs', ['is_fresher_eligible'], unique=False)

    # Add match categorization columns to match_results table
    op.add_column('match_results', sa.Column('match_category', sa.String(length=50), server_default='POSSIBLE_MATCH', nullable=False))
    op.add_column('match_results', sa.Column('eligibility_status', sa.String(length=50), server_default='ELIGIBLE', nullable=False))
    op.add_column('match_results', sa.Column('fresher_eligible', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('match_results', 'fresher_eligible')
    op.drop_column('match_results', 'eligibility_status')
    op.drop_column('match_results', 'match_category')

    op.drop_index(op.f('ix_jobs_is_fresher_eligible'), table_name='jobs')
    op.drop_index(op.f('ix_jobs_normalized_title'), table_name='jobs')
    op.drop_column('jobs', 'last_verified_at')
    op.drop_column('jobs', 'posted_at')
    op.drop_column('jobs', 'source_references')
    op.drop_column('jobs', 'fresher_eligibility_reason')
    op.drop_column('jobs', 'is_fresher_eligible')
    op.drop_column('jobs', 'experience_level')
    op.drop_column('jobs', 'remote_status')
    op.drop_column('jobs', 'official_company_url')
    op.drop_column('jobs', 'normalized_title')
