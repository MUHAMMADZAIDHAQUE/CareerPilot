"""add tailored resume status, ATS transparency, and approval fields

Revision ID: 0015_tailored_resume_status
Revises: 0014_job_discovery_fields
Create Date: 2026-09-29 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0015_tailored_resume_status'
down_revision: Union[str, None] = '0014_job_discovery_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add lifecycle status and ATS fields to resume_versions
    op.add_column('resume_versions', sa.Column('status', sa.String(length=50), server_default='REVIEW_REQUIRED', nullable=False))
    op.add_column('resume_versions', sa.Column('pdf_path', sa.String(length=500), nullable=True))
    op.add_column('resume_versions', sa.Column('ats_score', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('resume_versions', sa.Column('ats_details', sa.JSON(), server_default='{}', nullable=False))
    op.add_column('resume_versions', sa.Column('generated_at', sa.String(length=50), nullable=True))
    op.add_column('resume_versions', sa.Column('approved_at', sa.String(length=50), nullable=True))
    op.add_column('resume_versions', sa.Column('rejection_reason', sa.Text(), nullable=True))

    op.create_index(op.f('ix_resume_versions_status'), 'resume_versions', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_resume_versions_status'), table_name='resume_versions')
    op.drop_column('resume_versions', 'rejection_reason')
    op.drop_column('resume_versions', 'approved_at')
    op.drop_column('resume_versions', 'generated_at')
    op.drop_column('resume_versions', 'ats_details')
    op.drop_column('resume_versions', 'ats_score')
    op.drop_column('resume_versions', 'pdf_path')
    op.drop_column('resume_versions', 'status')
