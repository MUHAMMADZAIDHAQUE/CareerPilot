"""Fix match_results foreign key to reference jobs.id instead of legacy job_postings.id

Revision ID: 0021_fix_match_results_job_fk
Revises: 0020_phase23_india_queue
Create Date: 2026-09-30 06:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0021_fix_match_results_job_fk'
down_revision: Union[str, None] = '0020_phase23_india_queue'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop legacy foreign key pointing to job_postings
    op.drop_constraint('match_results_job_id_fkey', 'match_results', type_='foreignkey')
    # Create foreign key pointing to jobs table
    op.create_foreign_key(
        'match_results_job_id_fkey',
        'match_results',
        'jobs',
        ['job_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('match_results_job_id_fkey', 'match_results', type_='foreignkey')
    op.create_foreign_key(
        'match_results_job_id_fkey',
        'match_results',
        'job_postings',
        ['job_id'],
        ['id'],
        ondelete='CASCADE',
    )
