/*
  # Add bot_paused to chat_conversations
  
  Allows operators to pause the AI bot and respond manually.
  When bot_paused = true, the webhook will NOT call ChatGPT
  and the operator can reply from the panel.
*/

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS bot_paused boolean DEFAULT false;
