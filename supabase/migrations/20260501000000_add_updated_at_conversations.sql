-- Add updated_at column to chat_conversations for tracking last modification
-- The trigger will automatically update this timestamp on every UPDATE operation

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Reuse the existing update_updated_at_column() function
CREATE TRIGGER update_chat_conversations_updated_at 
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
