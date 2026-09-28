"""enhance match_results and add embedding columns

Revision ID: 0005_matching_engine
Revises: 0004_jobs_and_requirements
Create Date: 2026-09-28 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '0005_matching_engine'
down_revision: Union[str, None] = '0004_jobs_and_requirements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add embedding to skills
    op.add_column('skills', sa.Column('embedding', Vector(1536), nullable=True))

    # 2. Add embedding to job_requirements
    op.add_column('job_requirements', sa.Column('embedding', Vector(1536), nullable=True))

    # 3. Add deterministic scoring columns to match_results
    op.add_column('match_results', sa.Column('overall_match_score', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('match_results', sa.Column('required_skill_coverage', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('match_results', sa.Column('preferred_skill_coverage', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('match_results', sa.Column('experience_compatibility', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('match_results', sa.Column('education_compatibility', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('match_results', sa.Column('project_relevance', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('match_results', sa.Column('missing_required_skills', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('match_results', sa.Column('missing_preferred_skills', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('match_results', sa.Column('relevant_projects', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('match_results', sa.Column('evidence', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('match_results', sa.Column('weights_used', sa.JSON(), server_default='{}', nullable=False))


def downgrade() -> None:
    op.drop_column('match_results', 'weights_used')
    op.drop_column('match_results', 'evidence')
    op.drop_column('match_results', 'relevant_projects')
    op.drop_column('match_results', 'missing_preferred_skills')
    op.drop_column('match_results', 'missing_required_skills')
    op.drop_column('match_results', 'project_relevance')
    op.drop_column('match_results', 'education_compatibility')
    op.drop_column('match_results', 'experience_compatibility')
    op.drop_column('match_results', 'preferred_skill_coverage')
    op.drop_column('match_results', 'required_skill_coverage')
    op.drop_column('match_results', 'overall_match_score')
    op.drop_column('job_requirements', 'embedding')
    op.drop_column('skills', 'embedding')
