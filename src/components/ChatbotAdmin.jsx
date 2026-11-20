import React, { useEffect, useState } from 'react';
import { Bot, Check, CircleAlert, Headset, LoaderCircle, MessageSquare, RefreshCw, Send, Settings2, ShieldCheck } from 'lucide-react';
import { invokeChatbot } from '../lib/chatbot.js';

const initialConfig = {
  enabled: false,
  provider: 'openai-compatible',
  apiUrl: '',
  model: '',
  keyConfigured: false,
  welcomeMessage: '',
  quickReplies: [],
  faqItems: []
};

function faqText(items) {
  return (items || []).map(item => `${item.question} | ${item.answer}`).join('\n');
}

function parseFaqText(value) {
  const rows = value.split('\n').map(line => line.trim()).filter(Boolean);
  return rows.map((row, index) => {
    const separator = row.indexOf('|');
    if (separator <= 0 || !row.slice(separator + 1).trim()) {
      throw new Error(`FAQ line ${index + 1} needs a question and answer separated by |.`);
    }
    return { question: row.slice(0, separator).trim(), answer: row.slice(separator + 1).trim() };
  });
}

export default function ChatbotAdmin() {
  const [config, setConfig] = useState(initialConfig);
  const [apiKey, setApiKey] = useState('');
  const [quickRepliesText, setQuickRepliesText] = useState('');
  const [faqsText, setFaqsText] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [thread, setThread] = useState([]);
  const [reply, setReply] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadConfig() {
    const data = await invokeChatbot({ action: 'admin_get_config' });
    setConfig({ ...initialConfig, ...data });
    setQuickRepliesText((data.quickReplies || []).join('\n'));
    setFaqsText(faqText(data.faqItems));
  }

  async function loadConversations(selectId = selectedId) {
    const data = await invokeChatbot({ action: 'admin_list_conversations' });
    setConversations(data.conversations || []);
    if (selectId && (data.conversations || []).some(item => item.id === selectId)) {
      setSelectedId(selectId);
      await loadThread(selectId);
    }
  }

  async function loadThread(id) {
    const data = await invokeChatbot({ action: 'admin_get_thread', conversationId: id });
    setSelectedId(id);
    setThread(data.messages || []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      invokeChatbot({ action: 'admin_get_config' }),
      invokeChatbot({ action: 'admin_list_conversations' })
    ]).then(([data, list]) => {
      if (!active) return;
      setConfig({ ...initialConfig, ...data });
      setQuickRepliesText((data.quickReplies || []).join('\n'));
      setFaqsText(faqText(data.faqItems));
      setConversations(list.conversations || []);
    }).catch(error => {
      if (active) setStatus(error.message || 'Chatbot management could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function formValues() {
    const quickReplies = quickRepliesText.split('\n').map(item => item.trim()).filter(Boolean);
    if (quickReplies.length > 10 || quickReplies.some(item => item.length > 70)) {
      throw new Error('Use up to 10 quick replies, each no longer than 70 characters.');
    }
    return {
      enabled: config.enabled,
      provider: config.provider,
      apiUrl: config.apiUrl.trim(),
      model: config.model.trim(),
      welcomeMessage: config.welcomeMessage.trim(),
      quickReplies,
      faqItems: parseFaqText(faqsText),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
    };
  }

  async function saveSettings(event) {
    event.preventDefault();
    setBusy('save');
    setStatus('');
    try {
      const saved = await invokeChatbot({ action: 'admin_save_config', ...formValues() });
      setConfig(previous => ({ ...previous, keyConfigured: saved.keyConfigured }));
      setApiKey('');
      setStatus('Chatbot settings saved securely.');
    } catch (error) {
      setStatus(error.message || 'Chatbot settings could not be saved.');
    } finally { setBusy(''); }
  }

  async function testConnection() {
    setBusy('test');
    setStatus('');
    try {
      const result = await invokeChatbot({ action: 'admin_test', ...formValues() });
      setStatus(result.connected ? 'Connection successful. The configured AI provider responded.' : 'The provider did not respond.');
    } catch (error) {
      setStatus(error.message || 'The AI provider connection failed.');
    } finally { setBusy(''); }
  }

  async function refreshInbox() {
    setBusy('refresh');
    setStatus('');
    try { await loadConversations(); }
    catch (error) { setStatus(error.message || 'The conversation list could not be refreshed.'); }
    finally { setBusy(''); }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setBusy('reply');
    try {
      await invokeChatbot({ action: 'admin_reply', conversationId: selectedId, message: reply.trim() });
      setReply('');
      await loadThread(selectedId);
      await loadConversations(selectedId);
      setStatus('Reply sent to the customer conversation.');
    } catch (error) {
      setStatus(error.message || 'Reply could not be sent.');
    } finally { setBusy(''); }
  }

  async function setConversationStatus(nextStatus) {
    if (!selectedId) return;
    setBusy('status');
    try {
      await invokeChatbot({ action: 'admin_set_status', conversationId: selectedId, status: nextStatus });
      await loadConversations(selectedId);
      setStatus(`Conversation marked ${nextStatus}.`);
    } catch (error) {
      setStatus(error.message || 'Conversation status could not be updated.');
    } finally { setBusy(''); }
  }

  if (loading) return <div className="chatbot-admin-loading"><LoaderCircle size={18}/> Loading secure chatbot settings…</div>;
  const visibleConversations = conversations.filter(conversation => conversationFilter === 'all' || conversation.status === conversationFilter);
  const unresolvedCount = conversations.filter(conversation => conversation.status !== 'closed').length;

  return <section className="chatbot-admin">
    <div className="chatbot-admin-intro">
      <span><Bot size={19}/></span>
      <div><h3>Chatbot management</h3><p>Configure ETOE’s assistant and respond to customer conversations. Provider credentials are encrypted server-side and never returned to this dashboard.</p></div>
    </div>
    {status && <div className="chatbot-admin-status" role="status"><CircleAlert size={16}/>{status}</div>}
    <div className="chatbot-admin-grid">
      <form className="chatbot-admin-settings" onSubmit={saveSettings}>
        <div className="chatbot-admin-section-title"><Settings2 size={17}/><div><strong>AI configuration</strong><small>Credentials are sent directly to the secured Edge Function.</small></div></div>
        <label className="chatbot-admin-toggle"><span><strong>Enable customer chatbot</strong><small>When disabled, the launcher keeps service and support navigation available.</small></span><input type="checkbox" checked={config.enabled} onChange={event => setConfig({ ...config, enabled: event.target.checked })}/></label>
        <div className="chatbot-admin-form-grid">
          <label>AI provider<select value={config.provider} onChange={event => setConfig({ ...config, provider: event.target.value })}><option value="openai-compatible">OpenAI-compatible</option><option value="anthropic">Anthropic</option></select></label>
          <label>Model<input value={config.model} onChange={event => setConfig({ ...config, model: event.target.value })} placeholder="Provider model name" required/></label>
        </div>
        <label>Provider API URL<input type="url" value={config.apiUrl} onChange={event => setConfig({ ...config, apiUrl: event.target.value })} placeholder="https://api.openai.com/v1/chat/completions" required/><small>HTTPS only; allowlisted provider hosts are enforced by the server.</small></label>
        <label>AI API key<input type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={config.keyConfigured ? 'Saved securely · leave blank to keep current key' : 'Paste provider API key'} autoCapitalize="off" spellCheck="false"/><small>{config.keyConfigured ? 'A key is configured. Its value cannot be viewed again.' : 'Not configured. Set it here or provide AI_API_KEY as a server secret.'}</small></label>
        <label>Welcome message<textarea rows="4" maxLength={1000} value={config.welcomeMessage} onChange={event => setConfig({ ...config, welcomeMessage: event.target.value })} required/></label>
        <label>Quick replies <small>One per line, up to 10.</small><textarea rows="4" value={quickRepliesText} onChange={event => setQuickRepliesText(event.target.value)} placeholder="Book a Service&#10;Explore Services&#10;My Bookings"/></label>
        <label>FAQs <small>One per line: Question | Answer. Up to 30.</small><textarea rows="6" value={faqsText} onChange={event => setFaqsText(event.target.value)} placeholder="How can I track a booking? | Open My Bookings and select Track."/></label>
        <div className="chatbot-admin-buttons">
          <button className="btn btn-primary" type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving securely…' : 'Save chatbot settings'}</button>
          <button className="btn btn-light" type="button" onClick={testConnection} disabled={Boolean(busy)}>{busy === 'test' ? <LoaderCircle size={15}/> : <ShieldCheck size={15}/>} Test connection</button>
        </div>
      </form>

      <section className="chatbot-admin-inbox">
        <div className="chatbot-admin-section-title"><Headset size={17}/><div><strong>Customer conversations</strong><small>{conversations.length} recent chats · refresh to load updates</small></div><button type="button" aria-label="Refresh conversations" onClick={refreshInbox} disabled={Boolean(busy)}><RefreshCw size={15}/></button></div>
        <div className="chatbot-admin-metrics"><div><small>Recent chats</small><strong>{conversations.length}</strong></div><div><small>Unresolved</small><strong>{unresolvedCount}</strong></div><div><small>With support</small><strong>{conversations.filter(item => item.status === 'human').length}</strong></div><div><small>Closed</small><strong>{conversations.filter(item => item.status === 'closed').length}</strong></div></div>
        {!conversations.length ? <div className="chatbot-admin-empty"><MessageSquare size={24}/><strong>No conversations yet</strong><span>Customer chats will appear here after the function and database migration are deployed.</span></div> : <div className="chatbot-admin-conversations">
          <div className="chatbot-admin-list">
            <div className="chatbot-admin-filter">{[['all','All'],['open','Open'],['human','Support'],['closed','Closed']].map(([value,label]) => <button type="button" key={value} className={conversationFilter === value ? 'active' : ''} onClick={() => setConversationFilter(value)}>{label}</button>)}</div>
            {visibleConversations.map(conversation => <button key={conversation.id} className={selectedId === conversation.id ? 'active' : ''} onClick={() => loadThread(conversation.id)}>
              <span className={`chatbot-status-dot ${conversation.status}`}/><strong>{conversation.subject || 'Customer chat'}</strong><small>{conversation.profile_id ? `Customer ${conversation.profile_id.slice(0, 8)}` : 'Guest'} · {new Date(conversation.updated_at).toLocaleString()}</small><span>{conversation.last_message}</span>
            </button>)}
            {!visibleConversations.length && <div className="chatbot-admin-empty"><span>No conversations in this status.</span></div>}
          </div>
          <div className="chatbot-admin-thread">
            {!selectedId ? <div className="chatbot-admin-empty"><MessageSquare size={22}/><span>Select a conversation to view its messages.</span></div> : <>
              <div className="chatbot-admin-thread-head"><strong>Conversation</strong><span>{conversations.find(item => item.id === selectedId)?.status}</span><div><button type="button" onClick={() => setConversationStatus('human')}>Assign to support</button><button type="button" onClick={() => setConversationStatus('closed')}>Close</button></div></div>
              <div className="chatbot-admin-thread-messages">{thread.map(message => <article className={message.sender_role} key={message.id}><small>{message.sender_role === 'customer' ? 'Customer' : message.sender_role === 'agent' ? 'ETOE Support' : 'ETOE Assistant'} · {new Date(message.created_at).toLocaleString()}</small><p>{message.content}</p></article>)}</div>
              <form className="chatbot-admin-reply" onSubmit={sendReply}><textarea value={reply} onChange={event => setReply(event.target.value)} maxLength={3000} placeholder="Reply to customer…" required/><button className="btn btn-primary" disabled={Boolean(busy)}><Send size={14}/> Send reply</button></form>
            </>}
          </div>
        </div>}
        <div className="chatbot-admin-note"><Check size={14}/> Customer conversations and API credentials are accessible only through this authenticated admin backend.</div>
      </section>
    </div>
  </section>;
}
