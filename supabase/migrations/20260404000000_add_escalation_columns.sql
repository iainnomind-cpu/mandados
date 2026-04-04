/*
  # Add escalation columns to chat_conversations
  
  Enables automatic escalation to human operators when the AI bot
  detects non-order situations (complaints, payment issues, damaged
  products, special requests).
  
  When escalation_reason is set, the bot auto-pauses and the dashboard
  shows a prominent alert for operators to handle the situation.
*/

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS escalation_reason text DEFAULT NULL;

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS escalation_category text DEFAULT NULL;

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz DEFAULT NULL;
