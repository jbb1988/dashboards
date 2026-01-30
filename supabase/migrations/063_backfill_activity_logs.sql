-- Backfill activity logs for existing approved contracts
-- This migration adds activity log entries for contracts that were submitted/approved before the activity_log feature was added

DO $$
DECLARE
    review_record RECORD;
    new_activity_log JSONB;
BEGIN
    -- Loop through all contract reviews that have been submitted for approval
    FOR review_record IN
        SELECT
            id,
            submitted_by_email,
            submitted_at,
            created_at,
            approver_email,
            approved_at,
            approval_status,
            approval_feedback,
            activity_log
        FROM contract_reviews
        WHERE approval_token IS NOT NULL  -- Has been submitted for approval
        ORDER BY created_at
    LOOP
        -- Start with existing activity_log or empty array
        new_activity_log := COALESCE(review_record.activity_log, '[]'::jsonb);

        -- Check if we need to add submission event (if not already there)
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(new_activity_log) elem
            WHERE elem->>'action' = 'submitted'
        ) THEN
            -- Add submitted event
            IF review_record.submitted_by_email IS NOT NULL THEN
                new_activity_log := new_activity_log || jsonb_build_array(
                    jsonb_build_object(
                        'action', 'submitted',
                        'by', review_record.submitted_by_email,
                        'at', COALESCE(review_record.submitted_at, review_record.created_at)
                    )
                );
            END IF;
        END IF;

        -- Check if we need to add approval/rejection event (if not already there)
        IF review_record.approval_status IN ('approved', 'rejected') THEN
            IF NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(new_activity_log) elem
                WHERE elem->>'action' IN ('approved', 'rejected')
            ) THEN
                -- Add approval/rejection event
                IF review_record.approver_email IS NOT NULL THEN
                    new_activity_log := new_activity_log || jsonb_build_array(
                        jsonb_build_object(
                            'action', review_record.approval_status,
                            'by', review_record.approver_email,
                            'at', COALESCE(review_record.approved_at, review_record.created_at),
                            'feedback', review_record.approval_feedback
                        )
                    );
                END IF;
            END IF;
        END IF;

        -- Update the review with the new activity log
        UPDATE contract_reviews
        SET activity_log = new_activity_log
        WHERE id = review_record.id;

    END LOOP;

    RAISE NOTICE 'Backfilled activity logs for existing contract reviews';
END $$;
