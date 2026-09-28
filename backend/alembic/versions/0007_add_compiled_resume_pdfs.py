"""add compiled_resume_pdfs table for LaTeX compilation artifacts

Revision ID: 0007_compiled_resume_pdfs
Revises: 0006_resume_versions
Create Date: 2026-09-28 22:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0007_compiled_resume_pdfs'
down_revision: Union[str, None] = '0006_resume_versions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'compiled_resume_pdfs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('resume_version_id', sa.String(), sa.ForeignKey('resume_versions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('job_id', sa.String(), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('compilation_status', sa.String(50), server_default='success', nullable=False, index=True),
        sa.Column('compiler_used', sa.String(50), server_default='pdflatex', nullable=False),
        sa.Column('compilation_log', sa.Text(), server_default='', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('compile_duration_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('compiled_resume_pdfs')
