-- Fix: Ensure sync operation flag and upsert happen in same transaction
-- Problem: Calling set_sync_operation_flag() via RPC then upsert separately
--          can result in different database sessions/connections due to pooling
-- Solution: Create atomic upsert function that sets flag within same transaction

-- Drop existing helper function (we'll replace it with a better approach)
DROP FUNCTION IF EXISTS set_sync_operation_flag();

-- Create function to upsert contracts with sync flag set atomically
CREATE OR REPLACE FUNCTION upsert_contracts_from_sync(contracts_data jsonb)
RETURNS TABLE(salesforce_id text) AS $$
BEGIN
  -- Set the sync operation flag for this transaction
  PERFORM set_config('app.is_sync_operation', 'true', true);  -- true = local to transaction

  -- Perform the upsert and return the salesforce_ids
  RETURN QUERY
  INSERT INTO contracts (
    salesforce_id,
    name,
    opportunity_name,
    account_name,
    value,
    status,
    status_group,
    sales_stage,
    contract_type,
    close_date,
    award_date,
    contract_date,
    deliver_date,
    install_date,
    cash_date,
    current_situation,
    next_steps,
    sales_rep,
    probability,
    budgeted,
    manual_close_probability,
    is_closed,
    is_won,
    updated_at,
    sf_last_pulled_at
  )
  SELECT
    (c->>'salesforce_id')::text,
    (c->>'name')::text,
    (c->>'opportunity_name')::text,
    (c->>'account_name')::text,
    COALESCE((c->>'value')::numeric, 0),
    (c->>'status')::text,
    (c->>'status_group')::text,
    COALESCE((c->>'sales_stage')::text, ''),
    COALESCE((c->>'contract_type')::jsonb, '[]'::jsonb),
    (c->>'close_date')::timestamp,
    (c->>'award_date')::timestamp,
    (c->>'contract_date')::timestamp,
    (c->>'deliver_date')::timestamp,
    (c->>'install_date')::timestamp,
    (c->>'cash_date')::timestamp,
    (c->>'current_situation')::text,
    (c->>'next_steps')::text,
    COALESCE((c->>'sales_rep')::text, 'Unassigned'),
    COALESCE((c->>'probability')::numeric, 0),
    COALESCE((c->>'budgeted')::boolean, false),
    (c->>'manual_close_probability')::numeric,
    COALESCE((c->>'is_closed')::boolean, false),
    COALESCE((c->>'is_won')::boolean, false),
    (c->>'updated_at')::timestamp,
    NOW()  -- Set sf_last_pulled_at to current time
  FROM jsonb_array_elements(contracts_data) AS c
  ON CONFLICT (salesforce_id) DO UPDATE SET
    name = EXCLUDED.name,
    opportunity_name = EXCLUDED.opportunity_name,
    account_name = EXCLUDED.account_name,
    value = EXCLUDED.value,
    -- Only update status if manual_status_override is not true
    status = CASE
      WHEN contracts.manual_status_override = true THEN contracts.status
      ELSE EXCLUDED.status
    END,
    status_group = EXCLUDED.status_group,
    sales_stage = EXCLUDED.sales_stage,
    contract_type = EXCLUDED.contract_type,
    close_date = EXCLUDED.close_date,
    award_date = EXCLUDED.award_date,
    contract_date = EXCLUDED.contract_date,
    deliver_date = EXCLUDED.deliver_date,
    install_date = EXCLUDED.install_date,
    cash_date = EXCLUDED.cash_date,
    current_situation = EXCLUDED.current_situation,
    next_steps = EXCLUDED.next_steps,
    sales_rep = EXCLUDED.sales_rep,
    probability = EXCLUDED.probability,
    budgeted = EXCLUDED.budgeted,
    manual_close_probability = EXCLUDED.manual_close_probability,
    is_closed = EXCLUDED.is_closed,
    is_won = EXCLUDED.is_won,
    updated_at = EXCLUDED.updated_at,
    sf_last_pulled_at = NOW()
  RETURNING contracts.salesforce_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_contracts_from_sync(jsonb) IS
'Atomically upserts contracts from Salesforce sync. Sets sync operation flag within same transaction to prevent false "pending sync" status. Preserves manual status overrides.';
