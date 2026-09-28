"""enhance jobs with discovery and sourcing fields

Revision ID: 0008_job_discovery_fields
Revises: 0007_compiled_resume_pdfs
Create Date: 2026-09-28 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0008_job_discovery_fields'
down_revision: Union[str, None] = '0007_compiled_resume_pdfs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('source_type', sa.String(50), server_default='direct', nullable=False, index=True))
    op.add_column('jobs', sa.Column('source_name', sa.String(100), server_default='Direct Entry', nullable=False))
    op.add_column('jobs', sa.Column('canonical_url', sa.String(500), nullable=True, index=True))
    op.add_column('jobs', sa.Column('external_id', sa.String(255), nullable=True, index=True))
    op.add_column('jobs', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False, index=True))
    op.add_column('jobs', sa.Column('is_expired', sa.Boolean(), server_default='false', nullable=False, index=True))
    op.add_column('jobs', sa.Column('dedup_hash', sa.String(64), nullable=True, index=True))


def downgrade() -> None:
    op.drop_column('jobs', 'dedup_hash')
    op.drop_column('jobs', 'is_expired')
    op.drop_column('jobs', 'is_active')
    op.drop_column('jobs', 'external_id')
    op.drop_column('jobs', 'canonical_url')
    op.drop_column('jobs', 'source_name')
    op.drop_column('jobs', 'source_type')
