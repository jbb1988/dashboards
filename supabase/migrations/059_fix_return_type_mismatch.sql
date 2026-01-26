-- Fix: Return type mismatch - salesforce_id is varchar(18), not text
DROP FUNCTION IF EXISTS upsert_contracts_from_sync(jsonb);

CREATE OR REPLACE FUNCTION upsert_contracts_from_sync(contracts_data jsonb)
RETURNS TABLE(sf_id varchar(18)) AS $$
BEGIN
  PERFORM set_config('app.is_sync_operation', 'true', true);

  RETURN QUERY
  INSERT INTO contracts (
    salesforce_id, name, opportunity_name, account_name, value, status,
    status_group, sales_stage, contract_type, close_date, award_date,
    contract_date, deliver_date, install_date, cash_date, current_situation,
    next_steps, sales_rep, probability, budgeted, manual_close_probability,
    is_closed, is_won, updated_at, sf_last_pulled_at
  )
  SELECT
    (c->>'salesforce_id')::varchar(18),
    (c->>'name')::text,
    (c->>'opportunity_name')::text,
    (c->>'account_name')::text,
    COALESCE((c->>'value')::numeric, 0),
    (c->>'status')::text,
    (c->>'status_group')::text,
    COALESCE((c->>'sales_stage')::text, ''),
    CASE
      WHEN c->'contract_type' IS NOT NULL
           AND jsonb_typeof(c->'contract_type') = 'array'
           AND jsonb_array_length(c->'contract_type') > 0 THEN
        ARRAY(SELECT jsonb_array_elements_text(c->'contract_type'))
      ELSE
        ARRAY[]::text[]
    END,
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
    NOW()
  FROM jsonb_array_elements(contracts_data) AS c
  ON CONFLICT (salesforce_id) DO UPDATE SET
    name = EXCLUDED.name,
    opportunity_name = EXCLUDED.opportunity_name,
    account_name = EXCLUDED.account_name,
    value = EXCLUDED.value,
    status = CASE WHEN contracts.manual_status_override = true THEN contracts.status ELSE EXCLUDED.status END,
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
