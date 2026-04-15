-- ============================================
-- Heavy Haul - Status Automation v2
-- ============================================
-- Replaces old status automation with new logic:
--   "ready"    = all docs complete + permits approved + escort confirmed
--   "pending"  = at least one doc provided OR permits approved
--   "intake"   = fresh move, no progress yet
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing triggers first (to avoid conflicts)
DROP TRIGGER IF EXISTS trg_check_move_ready ON moves;
DROP TRIGGER IF EXISTS trg_check_move_ready_on_doc_change ON documents;

-- Step 2: Drop old functions
DROP FUNCTION IF EXISTS check_move_ready();
DROP FUNCTION IF EXISTS check_move_ready_on_doc_change();

-- Step 3: Create new function for moves table trigger
CREATE OR REPLACE FUNCTION check_move_ready()
RETURNS TRIGGER AS $$
DECLARE
  doc_record RECORD;
  all_docs_complete BOOLEAN := false;
  any_doc_provided BOOLEAN := false;
  permits_approved BOOLEAN := (NEW.permit_status = 'approved');
  escort_confirmed BOOLEAN := (NEW.escort_status = 'confirmed');
BEGIN
  -- Check documents completeness
  SELECT * INTO doc_record
  FROM documents
  WHERE move_id = NEW.id;

  IF FOUND THEN
    all_docs_complete := (
      doc_record.insurance_cert = true AND
      doc_record.rateconfirmation = true AND
      doc_record.bill_of_lading = true AND
      doc_record.escort_confirmation = true AND
      doc_record.route_plan = true
    );

    any_doc_provided := (
      doc_record.insurance_cert = true OR
      doc_record.rateconfirmation = true OR
      doc_record.bill_of_lading = true OR
      doc_record.escort_confirmation = true OR
      doc_record.route_plan = true
    );
  END IF;

  -- Determine new status
  -- READY: all docs complete + permits approved + escort confirmed
  IF all_docs_complete AND permits_approved AND escort_confirmed THEN
    NEW.overall_status := 'ready';

  -- PENDING: at least one doc provided OR permits approved
  ELSIF any_doc_provided OR permits_approved THEN
    NEW.overall_status := 'pending';

  -- INTAKE: everything is still empty
  ELSE
    NEW.overall_status := 'intake';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on moves table (fires on INSERT and UPDATE)
CREATE TRIGGER trg_check_move_ready
  BEFORE INSERT OR UPDATE ON moves
  FOR EACH ROW
  EXECUTE FUNCTION check_move_ready();

-- Step 4: Create new function for documents table trigger
CREATE OR REPLACE FUNCTION check_move_ready_on_doc_change()
RETURNS TRIGGER AS $$
DECLARE
  move_record RECORD;
  doc_record RECORD;
  all_docs_complete BOOLEAN := false;
  any_doc_provided BOOLEAN := false;
  permits_approved BOOLEAN := false;
  escort_confirmed BOOLEAN := false;
  target_id BIGINT;
BEGIN
  -- Get the move_id from the document record
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.move_id;
  ELSE
    target_id := NEW.move_id;
  END IF;

  -- Get the move record
  SELECT * INTO move_record FROM moves WHERE id = target_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get all documents for this move
  SELECT * INTO doc_record
  FROM documents
  WHERE move_id = target_id
  LIMIT 1;

  IF FOUND THEN
    all_docs_complete := (
      doc_record.insurance_cert = true AND
      doc_record.rateconfirmation = true AND
      doc_record.bill_of_lading = true AND
      doc_record.escort_confirmation = true AND
      doc_record.route_plan = true
    );

    any_doc_provided := (
      doc_record.insurance_cert = true OR
      doc_record.rateconfirmation = true OR
      doc_record.bill_of_lading = true OR
      doc_record.escort_confirmation = true OR
      doc_record.route_plan = true
    );
  END IF;

  permits_approved := (move_record.permit_status = 'approved');
  escort_confirmed := (move_record.escort_status = 'confirmed');

  -- Determine and apply new status
  IF all_docs_complete AND permits_approved AND escort_confirmed THEN
    UPDATE moves SET overall_status = 'ready' WHERE id = target_id;
  ELSIF any_doc_provided OR permits_approved THEN
    UPDATE moves SET overall_status = 'pending' WHERE id = target_id;
  ELSE
    UPDATE moves SET overall_status = 'intake' WHERE id = target_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on documents table
CREATE TRIGGER trg_check_move_ready_on_doc_change
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_move_ready_on_doc_change();

-- Step 5: Normalize existing data
-- Update any moves with old status values to the new schema
UPDATE moves SET overall_status = 'pending' WHERE overall_status = 'permits';
UPDATE moves SET overall_status = 'intake' WHERE overall_status IN ('new', 'draft');

-- Step 6: Re-evaluate all existing moves
-- This forces the trigger to run and set correct status for every move
UPDATE moves SET overall_status = overall_status;

-- Step 7: Verification
SELECT id, customer_name, permit_status, escort_status, overall_status
FROM moves
ORDER BY id;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- New status values: 'ready', 'pending', 'intake'
-- Status auto-updates on:
--   - Document checkbox changes
--   - Permit status changes
--   - Escort status changes
--   - Move creation
-- ============================================
