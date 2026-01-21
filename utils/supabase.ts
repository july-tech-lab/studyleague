import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xyuriwchmebrwhfndoeo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dXJpd2NobWVicndoZm5kb2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDIzODksImV4cCI6MjA4MDY3ODM4OX0.AXdzsbblkL4C-PDWeazp4VBa3cfOAAx9x9IQs5g9f18";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
