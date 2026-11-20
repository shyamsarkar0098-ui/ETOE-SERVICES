import { supabase } from './supabase.js';

export async function invokeChatbot(payload) {
  if (!supabase) {
    throw new Error('The secure ETOE chatbot backend is not configured. Set up Supabase and deploy the etoe-chat function.');
  }

  const { data, error } = await supabase.functions.invoke('etoe-chat', { body: payload });
  if (error) {
    let message = error.message || 'The ETOE chatbot could not connect.';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const response = await error.context.json();
        if (typeof response?.error === 'string') message = response.error;
      } catch {
        // Keep the Functions SDK's connection error when no JSON response is available.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
