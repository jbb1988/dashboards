-- Change version columns to support decimal versions (e.g., 5.2, 10.1)
ALTER TABLE playbook_versions ALTER COLUMN version TYPE NUMERIC(10,2) USING version::NUMERIC(10,2);
ALTER TABLE playbooks ALTER COLUMN current_version TYPE NUMERIC(10,2) USING current_version::NUMERIC(10,2);
