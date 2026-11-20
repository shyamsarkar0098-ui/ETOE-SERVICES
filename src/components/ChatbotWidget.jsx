import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Bot, CalendarDays,   ChevronDown, CircleHelp, Headset,
  MessageCircle, Minus, Send, Sparkles, Tag, TicketCheck, UserRound, X
} from 'lucide-react';
import { invokeChatbot } from '../lib/chatbot.js';

const welcomeMessage = 'Namaste! Welcome to ETOE Service 👋\n\nHow can I help you today?\n\nYou can book a service, explore our services, track your booking, check rewards, or contact support.';
const defaultQuickReplies = [
  'Book a Service', 'Explore Services', 'My Bookings', 'Track Booking',
  'Rewards & Points', 'Offers & Coupons', 'Contact Support'
];
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function createSessionKey() {
  try {
    let key = localStorage.getItem('etoeChatSessionId');
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem('etoeChatSessionId', key);
    }
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

function navigateQuickAction(action, navigatePath, sendMessage) {
  const value = action.toLowerCase();
  if (value.includes('book a service')) return navigatePath('/explore');
  if (value.includes('explore')) return navigatePath('/explore');
  if (value.includes('my booking')) return navigatePath('/my-bookings');
  if (value.includes('track')) return navigatePath('/my-bookings');
  if (value.includes('reward') || value.includes('point')) return navigatePath('/rewards');
  if (value.includes('offer') || value.includes('coupon')) return navigatePath('/home#offers');
  if (value.includes('support') || value.includes('help')) return sendMessage('I want to contact human support.');
  return sendMessage(action);
}

function ChatCard({ card, onNavigate, onSupport }) {
  if (card.type === 'service') return <article className="etoe-chat-card">
    <div><small>{card.category || 'ETOE SERVICE'}</small><strong>{card.title}</strong><p>{card.description}</p></div>
    <div className="etoe-chat-card-foot"><strong>{inr.format(Number(card.price || 0))}<small> starting</small></strong><button onClick={() => onNavigate(`/service/${encodeURIComponent(card.id)}`)}>View service <ArrowRight size={14}/></button></div>
  </article>;

  if (card.type === 'offer') return <article className="etoe-chat-card etoe-chat-offer">
    <span><Tag size={14}/> {card.discountLabel || 'Active offer'}</span><strong>{card.title}</strong><p>{card.description}</p>
    <small>{card.serviceTitle}{card.couponCode ? ` · Code ${card.couponCode}` : ''}{card.minBookingAmount > 0 ? ` · Min. ${inr.format(card.minBookingAmount)}` : ''}{card.expiresAt ? ` · Ends ${new Date(card.expiresAt).toLocaleDateString()}` : ''}</small>
    {card.price !== null && <div className="etoe-chat-offer-price"><del>{inr.format(Number(card.originalPrice || 0))}</del><strong>{inr.format(Number(card.price))}</strong></div>}
    <button onClick={() => onNavigate(`/service/${encodeURIComponent(card.serviceId)}`)}>Explore offer <ArrowRight size={14}/></button>
  </article>;

  if (card.type === 'booking') return <article className="etoe-chat-card etoe-chat-booking">
    <div><small>BOOKING · {card.id}</small><strong>{card.title}</strong><p><b>{card.status}</b>{card.team ? ` · ${card.team}` : ''}</p><small><CalendarDays size={13}/> {card.schedule}</small></div>
    <div className="etoe-chat-card-foot"><strong>{inr.format(Number(card.amount || 0))}</strong><button onClick={() => onNavigate(`/booking/${encodeURIComponent(card.id)}/track`)}>Track <ArrowRight size={14}/></button></div>
  </article>;

  if (card.type === 'support') return <article className="etoe-chat-card etoe-chat-support">
    <Headset size={18}/><div><strong>Would you like ETOE Support to help?</strong><small>Share this conversation with the support team or visit Help & Support.</small></div>
    <button onClick={onSupport}>Create a support request</button>
  </article>;
  return null;
}

export default function ChatbotWidget({ appSession, navigatePath }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [conversationStatus, setConversationStatus] = useState('open');
  const [chatConfig, setChatConfig] = useState({ enabled: false, welcomeMessage, quickReplies: defaultQuickReplies });
  const [notice, setNotice] = useState('');
  const endRef = useRef(null);
  const sessionKey = useRef(createSessionKey());
  const realCustomer = Boolean(appSession?.id && !appSession.demo && appSession.role === 'customer');

  useEffect(() => {
    if (!open || minimized) return undefined;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return undefined;
  }, [messages, loading, open, minimized]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setBooting(true);
    Promise.all([
      invokeChatbot({ action: 'public_config' }),
      invokeChatbot({ action: 'customer_history', sessionKey: sessionKey.current })
    ]).then(([config, history]) => {
      if (!active) return;
      setChatConfig({
        enabled: Boolean(config.enabled),
        welcomeMessage: config.welcomeMessage || welcomeMessage,
        quickReplies: Array.isArray(config.quickReplies) ? config.quickReplies : defaultQuickReplies
      });
      if (history.conversation) {
        setConversationId(history.conversation.id);
        setConversationStatus(history.conversation.status);
        setMessages((history.messages || []).map(message => ({
          id: message.id,
          role: message.sender_role,
          content: message.content,
          createdAt: message.created_at
        })));
      } else {
        setConversationId('');
        setConversationStatus('open');
      }
      setNotice('');
    }).catch(error => {
      if (!active) return;
      setNotice(error.message || 'Chat is not connected yet.');
    }).finally(() => {
      if (active) setBooting(false);
    });
    return () => { active = false; };
  }, [open, realCustomer]);

  useEffect(() => {
    if (!open || minimized || !conversationId || conversationStatus === 'closed') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const result = await invokeChatbot({
          action: 'customer_poll',
          conversationId,
          sessionKey: sessionKey.current
        });
        setConversationStatus(result.conversation.status);
        setMessages((result.messages || []).map(message => ({
          id: message.id,
          role: message.sender_role,
          content: message.content,
          createdAt: message.created_at
        })));
      } catch (error) {
        console.error('Unable to refresh ETOE support chat.', error);
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [open, minimized, conversationStatus, conversationId]);

  async function sendMessage(value = draft) {
    const content = value.trim();
    if (!content || loading || content.length > 1500) return;
    const customerMessage = { id: crypto.randomUUID(), role: 'customer', content, createdAt: new Date().toISOString() };
    setMessages(previous => [...previous, customerMessage]);
    setDraft('');
    setLoading(true);
    setNotice('');
    try {
      const result = await invokeChatbot({
        action: 'chat',
        message: content,
        sessionKey: sessionKey.current,
        ...(conversationId ? { conversationId } : {})
      });
      setConversationId(result.conversationId);
      setConversationStatus(result.status || 'open');
      setMessages(previous => [...previous, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.reply,
        cards: result.cards || [],
        createdAt: new Date().toISOString()
      }]);
    } catch (error) {
      setNotice(error.message || 'The assistant could not respond.');
      setMessages(previous => [...previous, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I can still help you navigate ETOE. Use the quick links below for services, bookings, rewards, or support.',
        cards: [{ type: 'support' }],
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function requestHumanSupport() {
    if (!realCustomer) {
      setNotice('Sign in to create a support request from chat. You can also call ETOE Support from the Support page.');
      navigatePath('/support');
      return;
    }
    if (!conversationId) {
      await sendMessage('I want to contact human support.');
      return;
    }
    setLoading(true);
    try {
      const result = await invokeChatbot({ action: 'request_human', conversationId });
      setConversationStatus('human');
      setMessages(previous => [...previous, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Your support request has been created (reference ${String(result.ticketId).slice(0, 8).toUpperCase()}). The ETOE team can review this conversation and reply here.`,
        createdAt: new Date().toISOString()
      }]);
    } catch (error) {
      setNotice(error.message || 'A support request could not be created.');
    } finally {
      setLoading(false);
    }
  }

  function closePanel() {
    setOpen(false);
    setMinimized(false);
  }

  return <div className={`etoe-chat-widget ${open ? 'is-open' : ''}`}>
    {open && !minimized && <section className="etoe-chat-panel" role="dialog" aria-modal="false" aria-labelledby="etoe-chat-title">
      <header className="etoe-chat-header">
        <span className="etoe-chat-avatar"><Sparkles size={18}/></span>
        <div><strong id="etoe-chat-title">ETOE Assistant</strong><small>{conversationStatus === 'human' ? 'ETOE Support will reply here' : 'Services · Bookings · Rewards'}</small></div>
        <button aria-label="Minimize chat" onClick={() => setMinimized(true)}><Minus size={17}/></button>
        <button aria-label="Close chat" onClick={closePanel}><X size={18}/></button>
      </header>
      <div className="etoe-chat-content">
        <div className="etoe-chat-messages" aria-live="polite">
          <div className="etoe-chat-message assistant"><span className="etoe-chat-message-avatar"><Bot size={15}/></span><p>{chatConfig.welcomeMessage}</p></div>
          {messages.map(message => <div className={`etoe-chat-message ${message.role === 'customer' ? 'customer' : message.role === 'agent' ? 'agent' : 'assistant'}`} key={message.id}>
            {message.role !== 'customer' && <span className="etoe-chat-message-avatar">{message.role === 'agent' ? <Headset size={14}/> : <Bot size={15}/>}</span>}
            <div className="etoe-chat-message-body"><p>{message.content}</p>{message.cards?.map((card, index) => <ChatCard key={`${message.id}-${card.type}-${card.id || index}`} card={card} onNavigate={navigatePath} onSupport={requestHumanSupport}/>)}</div>
          </div>)}
          {loading && <div className="etoe-chat-typing"><i/><i/><i/><span>ETOE Assistant is thinking</span></div>}
          {booting && messages.length === 0 && <div className="etoe-chat-status">Connecting securely to ETOE…</div>}
          <div ref={endRef}/>
        </div>
        {notice && <div className="etoe-chat-notice" role="status"><CircleHelp size={15}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14}/></button></div>}
        {!booting && <div className="etoe-chat-quick-actions" aria-label="Quick actions">
          {(chatConfig.quickReplies || defaultQuickReplies).map(action => <button key={action} onClick={() => navigateQuickAction(action, navigatePath, sendMessage)}>{action}</button>)}
        </div>}
        <div className="etoe-chat-contact">
          <a href="tel:+917597337666"><Headset size={14}/> Call support</a>
          <a href="https://wa.me/917597337666" target="_blank" rel="noreferrer"><MessageCircle size={14}/> WhatsApp</a>
          <button onClick={() => navigatePath('/support')}><TicketCheck size={14}/> Support page</button>
        </div>
      </div>
      <form className="etoe-chat-compose" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
        <input aria-label="Message ETOE Assistant" value={draft} maxLength={1500} onChange={event => setDraft(event.target.value)} placeholder="Ask in Hindi, English or Hinglish" disabled={loading}/>
        <button type="submit" aria-label="Send message" disabled={loading || !draft.trim()}><Send size={17}/></button>
      </form>
      <div className="etoe-chat-privacy">ETOE answers use your account data only after sign-in. <button onClick={() => realCustomer ? navigatePath('/profile') : navigatePath('/profile')}><UserRound size={12}/>{realCustomer ? 'Account' : 'Sign in'}</button></div>
    </section>}
    {open && minimized && <button className="etoe-chat-minimized" onClick={() => setMinimized(false)}><ChevronDown size={16}/> ETOE Assistant <span>Reopen chat</span></button>}
    {!open && <button className="etoe-chat-launcher" onClick={() => { setOpen(true); setMinimized(false); }} aria-label="Chat with ETOE Assistant">
      <MessageCircle size={22}/><span>Chat with us</span>
    </button>}
  </div>;
}
