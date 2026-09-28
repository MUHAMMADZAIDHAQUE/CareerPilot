-- CareerPilot AI Database Initialization Script
-- Automatically executed when PostgreSQL container starts

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log confirmation
DO $$
BEGIN
    RAISE NOTICE 'pgvector and uuid-ossp extensions initialized successfully in % database.', current_database();
END $$;
