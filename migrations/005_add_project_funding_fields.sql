-- Migration: Add project funding fields to token_registry
-- Enables developers to explain their project and funding needs when tokenizing land
--
-- New story: Developers tokenize land to raise funds for construction projects
-- Buyers invest in shares for future growth or rental income potential

ALTER TABLE token_registry
ADD COLUMN IF NOT EXISTS project_description TEXT,
ADD COLUMN IF NOT EXISTS project_type VARCHAR(50)
  CHECK (project_type IN ('residential', 'commercial', 'mixed_use', 'industrial', 'retail', 'hospitality', 'other')),
ADD COLUMN IF NOT EXISTS funding_goal_usd DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS funding_raised_usd DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_completion_date DATE,
ADD COLUMN IF NOT EXISTS expected_rental_yield_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS project_documents JSONB DEFAULT '{}';

-- Add computed column for funding progress percentage
-- This will be calculated in application layer but useful for queries
ALTER TABLE token_registry
ADD COLUMN IF NOT EXISTS funding_progress_percent DECIMAL(5,2)
  GENERATED ALWAYS AS (
    CASE
      WHEN funding_goal_usd > 0 THEN (funding_raised_usd / funding_goal_usd * 100)
      ELSE 0
    END
  ) STORED;

-- Add index for project type filtering
CREATE INDEX IF NOT EXISTS idx_token_registry_project_type
  ON token_registry(project_type);

-- Add index for funding progress queries
CREATE INDEX IF NOT EXISTS idx_token_registry_funding_progress
  ON token_registry(funding_progress_percent DESC)
  WHERE funding_goal_usd IS NOT NULL;

COMMENT ON COLUMN token_registry.project_description IS
  'Developer description of the construction/development project they are funding';
COMMENT ON COLUMN token_registry.project_type IS
  'Type of development project: residential, commercial, mixed_use, industrial, retail, hospitality, other';
COMMENT ON COLUMN token_registry.funding_goal_usd IS
  'Total funding goal in USD that the developer aims to raise through share sales';
COMMENT ON COLUMN token_registry.funding_raised_usd IS
  'Amount raised so far through share sales (updated via marketplace transactions)';
COMMENT ON COLUMN token_registry.expected_completion_date IS
  'Expected project completion date (e.g., Q4 2024)';
COMMENT ON COLUMN token_registry.expected_rental_yield_percent IS
  'Expected annual rental yield percentage for investors';
COMMENT ON COLUMN token_registry.project_documents IS
  'JSONB object containing URLs to project documents: {blueprints_url, permits_url, environmental_reports_url, etc}';
COMMENT ON COLUMN token_registry.funding_progress_percent IS
  'Computed: Percentage of funding goal achieved (funding_raised / funding_goal * 100)';
