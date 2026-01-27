-- SupaSaaSy Initial Migration
-- Creates the supasaasy schema for all framework tables

-- Create the supasaasy schema
CREATE SCHEMA IF NOT EXISTS supasaasy;

-- Grant usage to authenticated and service_role
GRANT USAGE ON SCHEMA supasaasy TO authenticated;
GRANT USAGE ON SCHEMA supasaasy TO service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA supasaasy
GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA supasaasy
GRANT ALL ON TABLES TO service_role;

-- Comment on schema
COMMENT ON SCHEMA supasaasy IS 'SupaSaaSy data sync framework schema';
