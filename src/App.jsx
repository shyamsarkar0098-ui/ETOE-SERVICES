import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, Clock3, ClipboardList, Headset, Home, Layers, MapPin, Menu, Search,
  ShieldCheck, Sofa, Sparkles, Star, Users, X, Phone, Bug, Droplets, Activity,
  CircleCheck, Upload, Plus, Tag, Heart, HeartHandshake, Timer, Wrench, LayoutDashboard,
  BriefcaseBusiness, Bell, Wallet, LogOut, PackageCheck, UserRound, Smartphone, Volume2,
  ShoppingCart, Gift, TicketCheck, Copy, Coins
} from 'lucide-react';
import { mainCategories, services as defaultServices, initialBookings, initialOffers, statuses } from './data.js';
import { fetchPublicCatalogue, requestPasswordReset, signInWithPassword, signOutApp, signUpWithPassword, supabase, supabaseConfigured } from './lib/supabase.js';
import ChatbotAdmin from './components/ChatbotAdmin.jsx';
import ChatbotWidget from './components/ChatbotWidget.jsx';

const iconMap = { home: Home, building: Building2, sofa: Sofa, layers: Layers, bug: Bug, users: Users, building2: Building2, droplets: Droplets, sparkles: Sparkles, wrench: Wrench, badge: BadgeCheck };
const serviceSubcategories = {
  housekeeping: [
    { title: 'Home & everyday cleaning', serviceIds: ['regular-housekeeping', 'home-cleaning', 'bathroom-cleaning', 'kitchen-cleaning', 'floor-cleaning', 'glass-cleaning'] },
    { title: 'Workplace cleaning', serviceIds: ['office-cleaning'] }
  ],
  ifm: [
    { title: 'Facility operations', serviceIds: ['ifms', 'facility-operations', 'housekeeping-management', 'facility-supervision'] },
    { title: 'Office maintenance', serviceIds: ['office-maintenance'] }
  ],
  'deep-cleaning': [
    { title: 'Home deep cleaning', serviceIds: ['home', 'bathroom', 'kitchen', 'move-cleaning'] },
    { title: 'Upholstery & floor care', serviceIds: ['sofa', 'carpet', 'mattress-cleaning'] },
    { title: 'Commercial deep cleaning', serviceIds: ['office'] }
  ],
  'pest-control': [
    { title: 'General & household pest control', serviceIds: ['pest', 'cockroach-control', 'mosquito-control', 'rodent-control'] },
    { title: 'Termite control', serviceIds: ['termite-control'] }
  ],
  'technical-maintenance': [
    { title: 'Repairs & plumbing', serviceIds: ['electrical-services', 'plumbing', 'general-repairs'] },
    { title: 'Equipment & AC maintenance', serviceIds: ['ac-services', 'equipment-maintenance'] }
  ],
  manpower: [
    { title: 'Office & pantry staff', serviceIds: ['office-staff', 'pantry-staff'] },
    { title: 'Housekeeping & facility staff', serviceIds: ['housekeeping-staff', 'facility-staff'] },
    { title: 'Flexible staffing', serviceIds: ['temporary-manpower', 'contract-manpower'] }
  ]
};
const categories = ['All Services', ...mainCategories.map(item => item.title)];
const readStored = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Unable to load ${key} from local storage.`, error);
    return fallback;
  }
};
const readServices = () => {
  const stored = readStored('etoeServices', defaultServices);
  const saved = Array.isArray(stored) ? stored : defaultServices;
  const savedById = new Map(saved.map(service => [service.id, service]));
  return defaultServices.map(service => {
    const existing = savedById.get(service.id);
    return existing ? { ...existing, ...service, price: existing.price } : service;
  });
};
const routeFromLocation = (pathname = window.location.pathname, hash = window.location.hash) => {
  const path = decodeURIComponent(pathname.replace(/\/+$/, '') || '/home');
  const legacyCategory = hash.match(/^#category\/(.+)$/)?.[1];
  if ((path === '/' || path === '/home') && legacyCategory && mainCategories.some(item => item.id === legacyCategory)) {
    return { page: 'category', categoryId: legacyCategory };
  }
  if (path === '/' || path === '/home') return { page: 'home' };
  if (path === '/explore' || path === '/services') return { page: 'explore' };
  const categoryMatch = path.match(/^\/services\/([^/]+)$/);
  if (categoryMatch) return { page: 'category', categoryId: categoryMatch[1] };
  const serviceMatch = path.match(/^\/service\/([^/]+)$/);
  if (serviceMatch) return { page: 'service', serviceId: serviceMatch[1] };
  if (path === '/cart') return { page: 'cart' };
  if (path === '/checkout') return { page: 'checkout', fromCart: true };
  if (path === '/rewards') return { page: 'rewards' };
  if (path === '/referrals') return { page: 'referrals' };
  if (path === '/my-bookings') return { page: 'bookings' };
  if (path === '/profile') return { page: 'profile' };
  if (path === '/support') return { page: 'support' };
  const trackingMatch = path.match(/^\/booking\/([^/]+)\/track$/);
  if (trackingMatch) return { page: 'track', bookingId: trackingMatch[1] };
  const bookingMatch = path.match(/^\/booking\/([^/]+)$/);
  if (bookingMatch) return { page: 'booking', bookingId: bookingMatch[1] };
  const checkoutMatch = path.match(/^\/checkout\/([^/]+)$/);
  if (checkoutMatch) return { page: 'checkout', serviceId: checkoutMatch[1] };
  if (path === '/offers') return { page: 'home', section: 'offers' };
  return { page: 'not-found' };
};
const money = amount => amount === 0 ? 'Request a quote' : `₹${Number(amount).toLocaleString('en-IN')}`;
const formatAddress = address => [address.address, address.landmark, address.city, address.postal_code].filter(Boolean).join(', ');
const imageUrl = (image, width = 900) => image?.startsWith('data:') || image?.startsWith('http')
  ? image
  : `https://images.unsplash.com/${image}?auto=format&fit=crop&w=${width}&q=85`;
const isOfferLive = (offer, date) => offer.active && offer.startDate <= date && offer.expiryDate >= date;
const expiryLabel = date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const offerSavingsLabel = offer => offer.discountType === 'fixed' ? `SAVE ${money(offer.discount)}` : `${offer.discount}% OFF`;
const isFeaturedService = service => service.popular ?? ['Bestseller', 'Popular'].includes(service.tag);
const legacyStatusMap = {
  'Booking Received': 'Booking Confirmed',
  'Customer Confirmation Completed': 'Booking Confirmed',
  'Team Assigned': 'Service Team Assigned',
  'Team Dispatched': 'Team On The Way',
  'Team on the Way': 'Team On The Way',
  'Team Reached': 'Team Arrived at Customer Location',
  'Team Arrived': 'Team Arrived at Customer Location',
  'Team Delayed': 'Service Team Assigned',
  'Service In Progress': 'Service Started',
  'Feedback Pending': 'Service Completed',
  Closed: 'Service Completed',
  'Booking Cancelled': 'Cancelled',
  Cancelled: 'Cancelled'
};
const normalizeStatus = status => statuses.includes(status) ? status : legacyStatusMap[status] || 'Booking Confirmed';
const readBookings = () => {
  const initialById = new Map(initialBookings.map(booking => [booking.id, booking]));
  return readStored('etoeBookings', initialBookings).map(storedBooking => {
    const demoInitial = initialById.get(storedBooking.id);
    const booking = demoInitial ? { ...demoInitial, ...storedBooking } : storedBooking;
    return {
      ...booking,
      status: normalizeStatus(booking.status),
      team: booking.team && booking.team !== 'Not Assigned' ? booking.team : 'ETOE Service Team',
      estimatedArrival: booking.estimatedArrival || booking.slot?.split(' - ')[0] || 'As scheduled',
      paymentStatus: booking.paymentStatus || booking.payment || 'Pending',
      adminStatus: booking.adminStatus || demoInitial?.adminStatus || 'Confirmed',
      acceptanceStatus: booking.acceptanceStatus || demoInitial?.acceptanceStatus || 'Not Assigned',
      acceptanceDeadline: booking.acceptanceDeadline || demoInitial?.acceptanceDeadline,
      history: Array.isArray(booking.history)
        ? booking.history.map(update => ({ ...update, status: normalizeStatus(update.status) }))
        : [{ status: normalizeStatus(booking.status), time: new Date().toISOString() }]
    };
  });
};

export default function App() {
  const [bookings, setBookings] = useState(readBookings);
  const [offers, setOffers] = useState(() => readStored('etoeOffers', initialOffers));
  const [catalogueCategories, setCatalogueCategories] = useState(() => readStored('etoeHomeCategories', mainCategories.map(category => ({ ...category, image_url: category.image, active: true }))));
  const [serviceList, setServiceList] = useState(readServices);
  const [selected, setSelected] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);
  const [actionValue, setActionValue] = useState('');
  const [trackId, setTrackId] = useState('');
  const [tracked, setTracked] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState('Bookings');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Services');
  const [serviceSort, setServiceSort] = useState('recommended');
  const [route, setRoute] = useState(routeFromLocation);
  const [bookingFilter, setBookingFilter] = useState('Upcoming');
  const selectedCategoryId = route.page === 'category' ? route.categoryId : null;
  const [slide, setSlide] = useState(0);
  const [form, setForm] = useState({ customer: '', phone: '', date: '', slot: '', address: '', notes: '' });
  const [supportForm, setSupportForm] = useState({ name: '', phone: '', bookingId: '', message: '' });
  const [addresses, setAddresses] = useState(() => readStored('etoeAddresses', []));
  const [cartItems, setCartItems] = useState(() => readStored('etoeCart', []));
  const [homeLocationOpen, setHomeLocationOpen] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [rewardAccount, setRewardAccount] = useState(null);
  const [expiringRewardPoints, setExpiringRewardPoints] = useState(0);
  const [rewardTransactions, setRewardTransactions] = useState([]);
  const [referralEntries, setReferralEntries] = useState([]);
  const [loyaltySettings, setLoyaltySettings] = useState(null);
  const [adminRewardAccounts, setAdminRewardAccounts] = useState([]);
  const [adminRewardTransactions, setAdminRewardTransactions] = useState([]);
  const [adminSupportTickets, setAdminSupportTickets] = useState([]);
  const [manualRewardAdjustment, setManualRewardAdjustment] = useState({ customerId: '', points: '', reason: '' });
  const [loyaltyForm, setLoyaltyForm] = useState({
    active: false, points_per_100: 0, point_value: 0, first_booking_bonus: 0,
    referral_referrer_bonus: 0, referral_customer_bonus: 0,
    gold_spend_threshold: 0, platinum_spend_threshold: 0, point_expiry_days: 0
  });
  const [serviceReviews, setServiceReviews] = useState([]);
  const [homeServiceRatings, setHomeServiceRatings] = useState({});
  const [couponCode, setCouponCode] = useState('');
  const [rewardPoints, setRewardPoints] = useState(0);
  const [referralCodeForm, setReferralCodeForm] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');
  const [supportTickets, setSupportTickets] = useState([]);
  const [addressEditor, setAddressEditor] = useState(null);
  const [addressForm, setAddressForm] = useState({ label: 'Home', address: '', landmark: '', city: 'Jaipur', postal_code: '' });
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [favorites, setFavorites] = useState(() => readStored('etoeFavorites', []));
  const [offerForm, setOfferForm] = useState({ title: '', description: '', discount: 20, serviceId: 'home', startDate: new Date().toISOString().slice(0, 10), expiryDate: '', image: '' });
  const [toast, setToast] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(supabaseConfigured);
  const [catalogError, setCatalogError] = useState('');
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appMode, setAppMode] = useState(() => window.location.hash.startsWith('#app/team')
    ? 'team'
    : window.location.hash.startsWith('#app/customer')
      ? 'customer'
      : null);
  const [appAuthOpen, setAppAuthOpen] = useState(false);
  const readAppSession = () => {
    try {
      const saved = localStorage.getItem('etoeAppSession');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };
  const [appSession, setAppSession] = useState(readAppSession);
  const [teamRole, setTeamRole] = useState('tracking_team');
  const [appTab, setAppTab] = useState('Dashboard');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [customerAuthMode, setCustomerAuthMode] = useState('signin');
  const [authFullName, setAuthFullName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [notifications, setNotifications] = useState(() => readStored('etoeNotifications', []));
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('etoeNotificationSound') !== 'off');
  const [acceptanceCountdown, setAcceptanceCountdown] = useState({});

  const liveOffers = useMemo(() => offers.filter(offer => isOfferLive(offer, currentDate)), [offers, currentDate]);
  const offerForService = serviceId => liveOffers.find(offer => offer.serviceId === serviceId || offer.serviceIds?.includes(serviceId));
  const selectedCategory = mainCategories.find(item => item.id === selectedCategoryId);
  const selectedHomeAddress = addresses.find(address => String(address.id) === selectedAddressId) || addresses[0];
  const checkoutService = route.page === 'checkout' ? serviceList.find(item => item.id === route.serviceId) : selected;
  const cartServices = cartItems.map(item => ({
    ...item,
    service: serviceList.find(service => service.id === item.serviceId)
  })).filter(item => item.service);
  const cartCount = cartItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const cartSubtotal = cartServices.reduce((total, item) => total + item.service.price * item.quantity, 0);
  const estimateOfferDiscount = lines => {
    const offer = liveOffers.find(candidate => !candidate.couponCode
      && lines.some(item => candidate.serviceId === item.serviceId || candidate.serviceIds?.includes(item.serviceId)));
    if (!offer) return 0;
    const eligibleSubtotal = lines.reduce((total, item) =>
      offer.serviceId === item.serviceId || offer.serviceIds?.includes(item.serviceId)
        ? total + item.service.price * item.quantity
        : total, 0);
    return Math.min(eligibleSubtotal, offer.discountType === 'fixed'
      ? offer.discount
      : Math.round(eligibleSubtotal * offer.discount / 100));
  };
  const cartOfferTotal = Math.max(0, cartSubtotal - estimateOfferDiscount(cartServices));
  const checkoutLines = route.fromCart
    ? cartServices
    : checkoutService ? [{ serviceId: checkoutService.id, quantity: 1, service: checkoutService }] : [];
  const checkoutSubtotal = checkoutLines.reduce((total, item) => total + item.service.price * item.quantity, 0);
  const checkoutOfferTotal = Math.max(0, checkoutSubtotal - estimateOfferDiscount(checkoutLines));
  const checkoutEstimatedTotal = couponCode.trim() ? checkoutSubtotal : checkoutOfferTotal;
  const checkoutRewardDiscount = Math.min(checkoutEstimatedTotal, Number(rewardPoints || 0) * Number(loyaltySettings?.point_value || 0));
  const featuredServices = serviceList.filter(isFeaturedService).slice(0, 3);
  const homePopularServices = serviceList.filter(isFeaturedService).slice(0, 8);
  const bookingForRoute = route.bookingId
    ? bookings.find(booking => booking.id.toLowerCase() === route.bookingId.toLowerCase())
      || (tracked?.id.toLowerCase() === route.bookingId.toLowerCase() ? tracked : null)
    : null;
  const visibleBookings = bookings.filter(booking => {
    const status = booking.status;
    if (bookingFilter === 'Cancelled') return ['Cancelled', 'Team Rejected'].includes(status);
    if (bookingFilter === 'Completed') return ['Service Completed', 'Payment Completed'].includes(status);
    if (bookingFilter === 'Active') return ['Team Accepted', 'Team On The Way', 'Team Arrived at Customer Location', 'Service Started'].includes(status);
    return !['Cancelled', 'Team Rejected', 'Service Completed', 'Payment Completed', 'Team Accepted', 'Team On The Way', 'Team Arrived at Customer Location', 'Service Started'].includes(status);
  });
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matchingCategoryNames = mainCategories
      .filter(item => `${item.title} ${item.description}`.toLowerCase().includes(search))
      .map(item => item.title);
    const results = serviceList.filter(service =>
      (!selectedCategory || service.category === selectedCategory.title) &&
      (category === 'All Services' || service.category === category) &&
      (!search || `${service.title} ${service.category} ${service.description}`.toLowerCase().includes(search) || matchingCategoryNames.includes(service.category))
    );
    return results.sort((left, right) => {
      if (serviceSort === 'price-low') return left.price - right.price;
      if (serviceSort === 'price-high') return right.price - left.price;
      if (serviceSort === 'name') return left.title.localeCompare(right.title);
      return Number(Boolean(right.popular)) - Number(Boolean(left.popular)) || left.title.localeCompare(right.title);
    });
  }, [serviceList, category, query, selectedCategory, serviceSort]);
  const homeSearchSuggestions = query.trim()
    ? serviceList.filter(service => `${service.title} ${service.category} ${service.description}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];
  const categoryServiceGroups = selectedCategory
    ? (serviceSubcategories[selectedCategory.id] || []).map(group => ({
        title: group.title,
        services: filtered.filter(service => group.serviceIds.includes(service.id))
      })).filter(group => group.services.length)
    : [];
  const groupedServiceIds = new Set(categoryServiceGroups.flatMap(group => group.services.map(service => service.id)));
  const ungroupedCategoryServices = filtered.filter(service => !groupedServiceIds.has(service.id));
  useEffect(() => { if (!supabaseConfigured) localStorage.setItem('etoeBookings', JSON.stringify(bookings)); }, [bookings]);
  useEffect(() => { if (!supabaseConfigured) localStorage.setItem('etoeHomeCategories', JSON.stringify(catalogueCategories)); }, [catalogueCategories]);
  useEffect(() => { if (!supabaseConfigured) localStorage.setItem('etoeNotifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('etoeNotificationSound', soundEnabled ? 'on' : 'off'); }, [soundEnabled]);
  useEffect(() => {
    const waiting = bookings.filter(booking => booking.acceptanceStatus === 'Awaiting Team Acceptance' && booking.acceptanceDeadline);
    const updateCountdown = () => {
      const next = {};
      waiting.forEach(booking => {
        const remaining = Math.max(0, new Date(booking.acceptanceDeadline).getTime() - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        next[booking.id] = remaining === 0 ? 'Acceptance timed out' : `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        if (remaining === 0) {
          setBookings(previous => previous.map(item => item.id === booking.id && item.acceptanceStatus === 'Awaiting Team Acceptance'
            ? {
                ...item,
                acceptanceStatus: 'Acceptance Timeout',
                status: 'Acceptance Pending',
                history: [...(item.history || []), { status: 'Acceptance Pending', time: new Date().toISOString() }]
              }
            : item));
          setNotifications(previous => previous.some(item => item.type === 'acceptance_timeout' && item.bookingId === booking.id) ? previous : [{
            id: `acceptance_timeout-${booking.id}-${Date.now()}`,
            type: 'acceptance_timeout',
            title: 'Team acceptance timed out',
            message: `${booking.id} requires reassignment`,
            bookingId: booking.id,
            role: 'admin',
            read: false,
            createdAt: new Date().toISOString()
          }, ...previous].slice(0, 100));
        }
      });
      setAcceptanceCountdown(next);
    };
    updateCountdown();
    if (!waiting.length) return undefined;
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [bookings]);
  useEffect(() => {
    if (supabaseConfigured) return undefined;
    const syncBookings = event => {
      if (event.key !== 'etoeBookings') return;
      try {
        const saved = JSON.parse(event.newValue || '[]');
        const normalizedSaved = saved.length ? saved : initialBookings;
        setBookings(previous => JSON.stringify(previous) === JSON.stringify(normalizedSaved) ? previous : normalizedSaved);
      } catch (error) {
        console.error('Unable to sync booking updates across app tabs.', error);
      }
    };
    window.addEventListener('storage', syncBookings);
    return () => window.removeEventListener('storage', syncBookings);
  }, []);
  useEffect(() => { if (!supabaseConfigured) localStorage.setItem('etoeOffers', JSON.stringify(offers)); }, [offers]);
  useEffect(() => { if (!supabaseConfigured) localStorage.setItem('etoeServices', JSON.stringify(serviceList)); }, [serviceList]);
  useEffect(() => { if (!supabaseConfigured) localStorage.setItem('etoeAddresses', JSON.stringify(addresses)); }, [addresses]);
  useEffect(() => {
    if (!supabaseConfigured || !appSession?.id || appSession.demo || !supabase) {
      localStorage.setItem('etoeCart', JSON.stringify(cartItems));
    }
  }, [cartItems, appSession?.id]);
  useEffect(() => { localStorage.setItem('etoeFavorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => {
    if (appSession) localStorage.setItem('etoeAppSession', JSON.stringify(appSession));
    else localStorage.removeItem('etoeAppSession');
  }, [appSession]);
  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined;
    if (!appSession?.id || appSession.demo) {
      setAddresses([]);
      return undefined;
    }
    let active = true;
    supabase.from('addresses').select('*').eq('customer_id', appSession.id).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Unable to load saved addresses.', error);
          notify(error.message || 'Saved addresses could not be loaded.');
          return;
        }
        setAddresses(data || []);
      });
    return () => { active = false; };
  }, [appSession?.id]);
  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined;
    if (!appSession?.id || appSession.demo) {
      setCartItems([]);
      setCartBusy(false);
      return undefined;
    }
    let active = true;
    setCartItems([]);
    setCartBusy(true);
    supabase.from('customer_cart_items')
      .select('service_id,quantity')
      .eq('profile_id', appSession.id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Unable to load the customer cart.', error);
          notify(error.message || 'Your cart could not be loaded.');
          setCartBusy(false);
          return;
        }
        setCartItems((data || []).map(item => ({ serviceId: item.service_id, quantity: item.quantity })));
        setCartBusy(false);
      });
    return () => { active = false; };
  }, [appSession?.id]);
  useEffect(() => {
      if (!supabaseConfigured || !supabase) return undefined;
      if (!appSession?.id || appSession.demo || appSession.role !== 'customer') {
        setBookings([]);
        setTracked(null);
        return undefined;
      }
      let active = true;
      setBookings([]);
      const loadCustomerBookings = async () => {
        const { data, error } = await supabase.from('bookings')
          .select('*,services(title,image_url),teams(name),booking_items(quantity,services(title))')
          .eq('customer_id', appSession.id)
          .order('created_at', { ascending: false });
        if (!active) return;
        if (error) {
          console.error('Unable to load customer bookings.', error);
          notify(error.message || 'Your bookings could not be loaded.');
          return;
        }
        setBookings((data || []).map(booking => ({
          id: booking.booking_ref,
          uuid: booking.id,
          customer: booking.customer_name,
          phone: booking.customer_phone,
          service: booking.booking_items?.length
            ? booking.booking_items.map(item => `${item.services?.title || 'ETOE Service'}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')
            : booking.services?.title || 'ETOE Service',
          serviceId: booking.service_id,
          date: booking.scheduled_date,
          slot: booking.time_slot,
          address: booking.address,
          amount: Number(booking.amount),
          status: normalizeStatus(booking.status),
          team: booking.teams?.name || 'Team assignment pending',
          paymentStatus: booking.payment_status,
          adminStatus: booking.admin_status,
          acceptanceStatus: booking.acceptance_status,
          estimatedArrival: booking.estimated_arrival,
          createdAt: booking.created_at,
          history: [{ status: normalizeStatus(booking.status), time: booking.updated_at || booking.created_at }]
        })));
      };
      loadCustomerBookings();
      const channel = supabase.channel(`etoe-customer-bookings-${appSession.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${appSession.id}`
        }, loadCustomerBookings)
        .subscribe();
      return () => {
        active = false;
        supabase.removeChannel(channel);
      };
  }, [appSession?.id, appSession?.role]);
  useEffect(() => {
    if (!['rewards', 'referrals', 'checkout'].includes(route.page) && !(adminOpen && adminTab === 'Rewards')) return undefined;
    if (!supabaseConfigured || !supabase || !appSession?.id || appSession.demo) {
      setRewardAccount(null);
      setRewardTransactions([]);
      setReferralEntries([]);
      return undefined;
    }
    let active = true;
    (async () => {
      const { error: expiryError } = await supabase.rpc('expire_customer_points', { target_profile_id: appSession.id });
      if (expiryError) throw expiryError;
      const [accountResult, transactionsResult, referralsResult, settingsResult, expiringResult] = await Promise.all([
        supabase.from('customer_rewards').select('*').eq('profile_id', appSession.id).maybeSingle(),
        supabase.from('reward_transactions').select('*').eq('profile_id', appSession.id).neq('points_delta', 0).order('created_at', { ascending: false }).limit(50),
        supabase.from('referrals').select('id,referral_code,status,created_at,qualified_at').eq('referrer_profile_id', appSession.id).order('created_at', { ascending: false }),
        supabase.from('loyalty_settings').select('*').eq('singleton', true).maybeSingle(),
        supabase.rpc('get_expiring_reward_points')
      ]);
      if (!active) return;
      const failed = [accountResult, transactionsResult, referralsResult, settingsResult, expiringResult].find(result => result.error);
      if (failed) throw failed.error;
      setRewardAccount(accountResult.data);
      setRewardTransactions(transactionsResult.data || []);
      setReferralEntries(referralsResult.data || []);
      setLoyaltySettings(settingsResult.data);
      setExpiringRewardPoints(Number(expiringResult.data) || 0);
      if (settingsResult.data) setLoyaltyForm(settingsResult.data);
    })().catch(error => {
      if (!active) return;
      console.error('Unable to load customer rewards.', error);
      notify(error.message || 'Rewards could not be loaded. Apply the latest Supabase migration.');
    });
    return () => { active = false; };
  }, [route.page, adminOpen, adminTab, appSession?.id]);
  useEffect(() => {
    if (!adminOpen || adminTab !== 'Rewards' || !supabase || !['owner', 'admin'].includes(appSession?.role)) return undefined;
    let active = true;
    Promise.all([
      supabase.from('customer_rewards').select('profile_id,referral_code,points_balance,total_points_earned,total_points_redeemed,lifetime_spend,membership_level').order('points_balance', { ascending: false }).limit(500),
      supabase.from('reward_transactions').select('profile_id,transaction_type,points_delta,reason,created_at').neq('points_delta', 0).order('created_at', { ascending: false }).limit(500)
    ]).then(([accountsResult, transactionsResult]) => {
      if (!active) return;
      const failed = accountsResult.error || transactionsResult.error;
      if (failed) {
        console.error('Unable to load admin rewards report.', failed);
        notify(failed.message || 'Rewards report could not be loaded.');
        return;
      }
      setAdminRewardAccounts(accountsResult.data || []);
      setAdminRewardTransactions(transactionsResult.data || []);
    });
    return () => { active = false; };
  }, [adminOpen, adminTab, appSession?.role]);
  useEffect(() => {
    if (!adminOpen || adminTab !== 'Support' || !supabase || !['owner', 'admin', 'manager'].includes(appSession?.role)) return undefined;
    let active = true;
    supabase.from('support_tickets').select('id,profile_id,booking_id,subject,message,status,created_at')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Unable to load support ticket queue.', error);
          notify(error.message || 'Support tickets could not be loaded.');
          return;
        }
        setAdminSupportTickets(data || []);
      });
    return () => { active = false; };
  }, [adminOpen, adminTab, appSession?.role]);
  useEffect(() => {
    if (route.page !== 'service' || !route.serviceId || !supabaseConfigured || !supabase) {
      setServiceReviews([]);
      return undefined;
    }
    let active = true;
    supabase.from('reviews').select('rating,review,created_at')
      .eq('service_id', route.serviceId).eq('published', true)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Unable to load service reviews.', error);
          notify(error.message || 'Service reviews could not be loaded.');
          return;
        }
        setServiceReviews(data || []);
      });
    return () => { active = false; };
  }, [route.page, route.serviceId]);
  useEffect(() => {
    if (appMode !== 'customer' || route.page !== 'home' || !supabaseConfigured || !supabase) {
      setHomeServiceRatings({});
      return undefined;
    }
    let active = true;
    supabase.from('reviews').select('service_id,rating').eq('published', true).limit(500)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Unable to load homepage service ratings.', error);
          notify(error.message || 'Service ratings could not be loaded.');
          return;
        }
        const grouped = (data || []).reduce((result, review) => {
          if (!review.service_id) return result;
          const current = result[review.service_id] || { total: 0, count: 0 };
          result[review.service_id] = { total: current.total + Number(review.rating || 0), count: current.count + 1 };
          return result;
        }, {});
        setHomeServiceRatings(grouped);
      });
    return () => { active = false; };
  }, [appMode, route.page]);
  useEffect(() => {
    if (route.page !== 'support' || !supabaseConfigured || !supabase || !appSession?.id || appSession.demo) {
      setSupportTickets([]);
      return undefined;
    }
    let active = true;
    supabase.from('support_tickets').select('id,subject,message,status,created_at,booking_id')
      .eq('profile_id', appSession.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Unable to load support tickets.', error);
          notify(error.message || 'Support history could not be loaded.');
          return;
        }
        setSupportTickets(data || []);
      });
    return () => { active = false; };
  }, [route.page, appSession?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date().toISOString().slice(0, 10)), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let cancelled = false;
    fetchPublicCatalogue()
      .then(catalogue => {
        if (cancelled) return;
        setCatalogueCategories(catalogue.categories);
        setServiceList(catalogue.services);
        setOffers(catalogue.offers);
        setCatalogError('');
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Unable to load the ETOE catalogue from Supabase.', error);
        setCatalogError(error.message || 'The shared catalogue could not be loaded.');
        notify('Could not connect to the shared ETOE catalogue.');
      })
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined;
    if (!appSession?.id || appSession.demo) {
      setNotifications([]);
      return undefined;
    }
    setNotifications([]);
    let active = true;
    supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', appSession.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          console.error('Unable to load notifications.', error);
          return;
        }
        if (active && data) setNotifications(data.map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          bookingId: item.payload?.booking_id,
          role: appSession.role,
          read: Boolean(item.read_at),
          createdAt: item.created_at
        })));
      });
    const channel = supabase.channel(`etoe-notifications-${appSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${appSession.id}`
      }, payload => {
        const item = payload.new;
        const notification = {
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          bookingId: item.payload?.booking_id,
          role: appSession.role,
          read: false,
          createdAt: item.created_at
        };
        setNotifications(previous => [notification, ...previous.filter(existing => existing.id !== item.id)].slice(0, 100));
        playOrderSound();
        pushBrowserNotification(notification.title, notification.message);
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [appSession?.id]);
  useEffect(() => {
    const syncLocation = () => {
      setRoute(routeFromLocation());
      if (window.location.hash.startsWith('#app/team')) setAppMode('team');
      else if (window.location.hash.startsWith('#app/customer')) setAppMode('customer');
      else setAppMode(null);
      setCategory('All Services');
      setQuery('');
    };
    if (window.location.pathname === '/' && window.location.hash.startsWith('#category/')) {
      const current = routeFromLocation();
      window.history.replaceState({}, '', `/services/${current.categoryId}`);
      setRoute(current);
    } else if (window.location.pathname === '/' && !window.location.hash.startsWith('#app/')) {
      window.history.replaceState({}, '', '/home');
      setRoute({ page: 'home' });
    }
    window.addEventListener('popstate', syncLocation);
    window.addEventListener('hashchange', syncLocation);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('hashchange', syncLocation);
    };
  }, []);
  useEffect(() => {
    if (appMode && appSession?.appMode && appSession.appMode !== appMode) setAppSession(null);
  }, [appMode, appSession]);
  useEffect(() => {
    if (liveOffers.length < 2) return undefined;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % liveOffers.length), 5500);
    return () => window.clearInterval(timer);
  }, [liveOffers.length]);
  useEffect(() => { if (slide >= liveOffers.length) setSlide(0); }, [liveOffers.length, slide]);
  useEffect(() => {
    if (!tracked) return;
    const latest = bookings.find(booking => booking.id === tracked.id);
    if (latest && latest.status !== tracked.status) {
      setTracked(latest);
      notify(`Booking ${latest.id} updated: ${latest.status}`);
    }
  }, [bookings, tracked?.id]);
  useEffect(() => {
    if (!['booking', 'track'].includes(route.page) || !route.bookingId) return;
    const reference = route.bookingId.toLowerCase();
    const localBooking = bookings.find(booking => booking.id.toLowerCase() === reference);
    if (localBooking) {
      setTrackId(localBooking.id);
      setTracked(localBooking);
      return;
    }
    if (!supabaseConfigured || !supabase) {
      setTracked(null);
      return;
    }
    let active = true;
    const bookingQuery = supabase.from('bookings').select('*, services(title,image_url), teams(name), booking_items(quantity,services(title))');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(route.bookingId);
    (isUuid ? bookingQuery.eq('id', route.bookingId) : bookingQuery.eq('booking_ref', route.bookingId))
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Booking page lookup failed.', error);
          notify(error.message || 'Booking could not be loaded.');
          setTracked(null);
          return;
        }
        if (!data) {
          setTracked(null);
          return;
        }
        const { data: history, error: historyError } = await supabase.from('booking_status_history')
          .select('*')
          .eq('booking_id', data.id)
          .order('created_at');
        if (!active) return;
        if (historyError) console.error('Booking status history lookup failed.', historyError);
        const booking = {
          id: data.booking_ref,
          uuid: data.id,
          customer: data.customer_name,
          phone: data.customer_phone,
          service: data.booking_items?.length
            ? data.booking_items.map(item => `${item.services?.title || 'ETOE Service'}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')
            : data.services?.title || 'ETOE Service',
          date: data.scheduled_date,
          slot: data.time_slot,
          address: data.address,
          team: data.teams?.name || 'Team assignment pending',
          amount: data.amount,
          status: data.status,
          paymentStatus: data.payment_status,
          estimatedArrival: data.estimated_arrival,
          adminStatus: data.admin_status,
          acceptanceStatus: data.acceptance_status,
          history: (history || []).map(item => ({ status: item.status, time: item.created_at }))
        };
        setTrackId(booking.id);
        setTracked(booking);
        if (data.booking_ref.toLowerCase() !== route.bookingId.toLowerCase()) {
          const canonicalPath = `/booking/${encodeURIComponent(data.booking_ref)}${route.page === 'track' ? '/track' : ''}`;
          const appHash = window.location.hash === '#app/customer' ? '#app/customer' : '';
          window.history.replaceState({}, '', `${canonicalPath}${appHash}`);
          setRoute(routeFromLocation(canonicalPath, ''));
        }
      })
      .catch(error => {
        if (!active) return;
        console.error('Booking page lookup failed.', error);
        notify(error.message || 'Booking could not be loaded.');
        setTracked(null);
      });
    return () => { active = false; };
  }, [route.page, route.bookingId, bookings]);
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !tracked?.uuid) return undefined;
    const channel = supabase.channel(`booking-${tracked.uuid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${tracked.uuid}`
      }, payload => {
        setTracked(previous => previous ? {
          ...previous,
          status: payload.new.status,
          paymentStatus: payload.new.payment_status,
          team: payload.new.assigned_team_id ? previous.team : 'Team assignment pending',
          estimatedArrival: payload.new.estimated_arrival,
          adminStatus: payload.new.admin_status,
          acceptanceStatus: payload.new.acceptance_status
        } : previous);
        playOrderSound();
        notify(`Booking updated: ${payload.new.status}`);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [tracked?.uuid]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }
  function openActionDialog(action, bookingId) {
    setActionDialog({ action, bookingId });
    setActionValue('');
  }
  function submitActionDialog(event) {
    event.preventDefault();
    if (!actionDialog || !actionValue.trim()) return;
    const { action, bookingId } = actionDialog;
    if (action === 'admin-reject') adminRejectBooking(bookingId, actionValue.trim());
    if (action === 'team-reject') teamRejectBooking(bookingId, actionValue.trim());
    if (action === 'reschedule') rescheduleBooking(bookingId, actionValue);
    if (action === 'assign-team') {
      if (supabaseConfigured && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actionValue.trim())) {
        notify('Enter a valid Team ID to reassign this order.');
        return;
      }
      updateTeam(bookingId, actionValue.trim());
    }
    setActionDialog(null);
  }
  function playOrderSound() {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.36);
    } catch (error) {
      console.warn('Notification sound could not be played.', error);
    }
  }
  function pushBrowserNotification(title, message) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/images/etoe-logo.png', tag: `etoe-${Date.now()}` });
    }
  }
  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      notify('Browser notifications are not supported here.');
      return;
    }
    Notification.requestPermission().then(permission => {
      notify(permission === 'granted' ? 'Browser notifications enabled.' : 'Browser notifications were not enabled.');
    });
  }
  function addNotification({ type, title, message, bookingId, role = 'admin' }) {
    const item = {
      id: `${type}-${bookingId}-${Date.now()}`,
      type, title, message, bookingId, role,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications(previous => [item, ...previous].slice(0, 100));
    playOrderSound();
    pushBrowserNotification(title, message);
  }
  function markNotificationRead(id) {
    if (supabaseConfigured && appSession?.id) {
      supabase.from('notifications').update({ read_at: new Date().toISOString(), delivery_state: 'read' }).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('Unable to mark notification read.', error);
          notify(error.message || 'Notification could not be updated.');
          return;
        }
        setNotifications(previous => previous.map(item => item.id === id ? { ...item, read: true } : item));
      });
      return;
    }
    setNotifications(previous => previous.map(item => item.id === id ? { ...item, read: true } : item));
  }
  function markAllNotificationsRead() {
    if (supabaseConfigured && appSession?.id) {
      supabase.from('notifications')
        .update({ read_at: new Date().toISOString(), delivery_state: 'read' })
        .eq('profile_id', appSession.id)
        .is('read_at', null)
        .then(({ error }) => {
          if (error) {
            console.error('Unable to mark all notifications read.', error);
            notify(error.message || 'Notifications could not be updated.');
            return;
          }
          setNotifications(previous => previous.map(item => ({ ...item, read: true })));
        });
      return;
    }
    setNotifications(previous => previous.map(item => ({ ...item, read: true })));
  }
  function openNotification(item) {
    markNotificationRead(item.id);
    setNotificationOpen(false);
    if (!item.bookingId) return;
    const booking = bookings.find(entry => entry.id === item.bookingId || entry.uuid === item.bookingId);
    const bookingRef = booking?.id || item.bookingRef || item.bookingId;
    navigatePath(`/booking/${encodeURIComponent(bookingRef)}/track`);
  }
  function openApp(mode) {
    const appPath = mode === 'customer' ? '/home#app/customer' : `${window.location.pathname}#app/team`;
    const nextRoute = routeFromLocation(appPath.split('#')[0], '');
    setRoute(nextRoute);
    setAppMode(mode);
    window.history.pushState({}, '', appPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeApp() {
    setAppMode(null);
    setAppAuthOpen(false);
    window.history.pushState({}, '', window.location.pathname === '/' ? '/home' : window.location.pathname);
    setRoute(routeFromLocation());
  }
  function navigatePath(path) {
    setMobileMenu(false);
    setAppAuthOpen(false);
    setHomeLocationOpen(false);
    setWalletInfoOpen(false);
    const [pathname, hashPart = ''] = path.split('#');
    const appHash = appMode === 'customer' ? '#app/customer' : hashPart ? `#${hashPart}` : '';
    const nextRoute = routeFromLocation(pathname, appMode === 'customer' ? '' : hashPart ? `#${hashPart}` : '');
    const target = `${pathname}${appHash}`;
    if (`${window.location.pathname}${window.location.hash}` !== target) window.history.pushState({}, '', target);
    setRoute(nextRoute);
    setCategory('All Services');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (hashPart) window.setTimeout(() => document.getElementById(hashPart)?.scrollIntoView({ behavior: 'smooth' }), 100);
  }
  function useDemoLogin() {
    setAuthForm({ email: 'demo@etoe.services', password: '123456' });
  }
  async function submitAppAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      if (!supabaseConfigured) {
        if (appMode === 'team') setAppSession({ email: authForm.email || 'demo.team@etoe.services', role: teamRole, demo: true, appMode: 'team' });
        else setAppSession({ email: authForm.email || 'demo.customer@etoe.services', role: 'customer', demo: true, appMode: 'customer' });
        notify('Demo app session started.');
      } else {
        const data = appMode === 'customer' && customerAuthMode === 'signup'
          ? await signUpWithPassword(authForm.email, authForm.password, authFullName.trim(), referralCodeForm)
          : await signInWithPassword(authForm.email, authForm.password);
        if (appMode === 'customer' && customerAuthMode === 'signup' && (!data.session || !data.user)) {
          notify('Account created. Check your email to confirm the account, then sign in.');
          return;
        }
        let role = appMode === 'customer' ? 'customer' : teamRole;
        if (supabase && data.user) {
          const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
          if (profile?.role) role = profile.role;
        }
        setAppSession({ ...data.user, email: data.user.email, role, fullName: data.user.user_metadata?.full_name, appMode });
        notify(appMode === 'customer' && customerAuthMode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.');
      }
      setAppAuthOpen(false);
    } catch (error) {
      console.error('App sign-in failed.', error);
      notify(error.message || 'Sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  }
  async function sendCustomerPasswordReset() {
    if (!authForm.email.trim()) {
      notify('Enter your account email first.');
      return;
    }
    try {
      await requestPasswordReset(authForm.email.trim());
      notify('If the account exists, a password reset email has been sent.');
    } catch (error) {
      console.error('Password reset request failed.', error);
      notify(error.message || 'Password reset could not be requested.');
    }
  }
  async function logoutApp() {
    await signOutApp();
    setAppSession(null);
  }
  function openBooking(service) {
    setSelected(service);
    const savedAddress = addresses[0];
    setSelectedAddressId(savedAddress?.id || '');
    setForm({ customer: '', phone: '', date: '', slot: '', address: savedAddress ? formatAddress(savedAddress) : '', notes: '' });
    if (appMode === 'customer') {
      navigatePath(`/checkout/${encodeURIComponent(service.id)}`);
      return;
    }
    setBookingOpen(true);
  }
  async function addToCart(service) {
    if (!service) return;
    const currentQuantity = cartItems.find(item => item.serviceId === service.id)?.quantity || 0;
    const nextQuantity = Math.min(20, currentQuantity + 1);
    if (supabaseConfigured && (!appSession?.id || appSession.demo)) {
      notify('Sign in to save your cart to your ETOE account.');
      openApp('customer');
      return;
    }
    if (supabaseConfigured && supabase) {
      setCartBusy(true);
      const { error } = await supabase.from('customer_cart_items').upsert({
        profile_id: appSession.id,
        service_id: service.id,
        quantity: nextQuantity,
        updated_at: new Date().toISOString()
      }, { onConflict: 'profile_id,service_id' });
      setCartBusy(false);
      if (error) {
        console.error('Unable to add service to cart.', error);
        notify(error.message || 'Service could not be added to your cart.');
        return;
      }
    }
    setCartItems(previous => {
      const exists = previous.some(item => item.serviceId === service.id);
      return exists
        ? previous.map(item => item.serviceId === service.id ? { ...item, quantity: nextQuantity } : item)
        : [...previous, { serviceId: service.id, quantity: nextQuantity }];
    });
    notify(`${service.title} added to your cart.`);
  }
  async function setCartQuantity(serviceId, quantity) {
    const nextQuantity = Math.max(1, Math.min(20, Number(quantity) || 1));
    if (supabaseConfigured && supabase && appSession?.id && !appSession.demo) {
      const { error } = await supabase.from('customer_cart_items')
        .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
        .eq('profile_id', appSession.id).eq('service_id', serviceId);
      if (error) {
        console.error('Unable to update cart quantity.', error);
        notify(error.message || 'Cart quantity could not be updated.');
        return;
      }
    }
    setCartItems(previous => previous.map(item => item.serviceId === serviceId ? { ...item, quantity: nextQuantity } : item));
  }
  async function removeCartItem(serviceId) {
    if (supabaseConfigured && supabase && appSession?.id && !appSession.demo) {
      const { error } = await supabase.from('customer_cart_items').delete()
        .eq('profile_id', appSession.id).eq('service_id', serviceId);
      if (error) {
        console.error('Unable to remove service from cart.', error);
        notify(error.message || 'Service could not be removed from your cart.');
        return;
      }
    }
    setCartItems(previous => previous.filter(item => item.serviceId !== serviceId));
  }
  async function clearCart() {
    if (supabaseConfigured && supabase && appSession?.id && !appSession.demo) {
      const { error } = await supabase.from('customer_cart_items').delete().eq('profile_id', appSession.id);
      if (error) {
        console.error('Unable to clear the customer cart.', error);
        notify(error.message || 'Booking was created, but the cart could not be cleared.');
        return;
      }
    }
    setCartItems([]);
  }
  function discountedPrice(service) {
    const offer = offerForService(service.id);
    if (!offer || (offer.couponCode && offer.couponCode.toUpperCase() !== couponCode.trim().toUpperCase())) return service.price;
    return priceAfterOffer(service, offer);
  }
  function priceAfterOffer(service, offer) {
    return offer.discountType === 'fixed'
      ? Math.max(0, service.price - offer.discount)
      : Math.round(service.price * (100 - offer.discount) / 100);
  }
  function submitBooking(event) {
    event.preventDefault();
    const service = route.page === 'checkout' && !route.fromCart
      ? serviceList.find(item => item.id === route.serviceId)
      : selected;
    const bookingLines = route.fromCart ? cartServices : service ? [{ serviceId: service.id, quantity: 1, service }] : [];
    if (!bookingLines.length) {
      notify('Select a service before continuing.');
      return;
    }
    if (supabaseConfigured) {
      if (!appSession?.id || appSession.demo) {
        notify('Please sign in before creating a booking.');
        openApp('customer');
        setBookingOpen(false);
        return;
      }
      supabase.rpc('create_customer_booking_with_items', {
        p_items: bookingLines.map(item => ({ service_id: item.serviceId, quantity: Number(item.quantity) })),
        p_customer_name: form.customer,
        p_customer_phone: form.phone,
        p_scheduled_date: form.date,
        p_time_slot: form.slot,
        p_address: form.address,
        p_instructions: form.notes,
        p_coupon_code: couponCode.trim() || null,
        p_reward_points: Number(rewardPoints) || 0
      }).then(async ({ data, error }) => {
        if (error) {
          console.error('Secure booking creation failed.', error);
          notify(error.message || 'Booking could not be created.');
          return;
        }
        setBookingOpen(false);
        setTrackId(data.booking_ref);
        setTracked({
          id: data.booking_ref,
          uuid: data.id,
          service: bookingLines.map(item => item.service.title).join(', '),
          customer: form.customer,
          phone: form.phone,
          date: data.scheduled_date,
          slot: data.time_slot,
          address: data.address,
          amount: data.amount,
          status: data.status,
          team: 'Team assignment pending',
          paymentStatus: data.payment_status,
          history: [{ status: 'Booking Confirmed', time: data.created_at }]
        });
        if (route.fromCart) await clearCart();
        navigatePath(`/booking/${encodeURIComponent(data.booking_ref)}/track`);
        notify(`Booking created: ${data.booking_ref}`);
      });
      return;
    }
    const id = `ETOE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const total = route.fromCart ? checkoutEstimatedTotal : discountedPrice(service);
    const booking = {
      id, ...form, service: bookingLines.map(item => item.service.title).join(', '), amount: total, status: 'Booking Confirmed',
      payment: 'Pending', paymentStatus: 'Pending', team: 'Not Assigned',
      adminStatus: 'Pending Admin Confirmation', acceptanceStatus: 'Not Assigned',
      history: [{ status: 'Booking Confirmed', time: new Date().toISOString() }]
    };
    setBookings(previous => [booking, ...previous]);
    addNotification({
      type: 'new_booking',
      title: 'New booking received',
      message: `${id} · ${form.customer} · ${booking.service}`,
      bookingId: id,
      role: 'admin'
    });
    setBookingOpen(false);
    if (route.fromCart) clearCart();
    setTrackId(id);
    setTracked(booking);
    notify(`Booking confirmed. Your Booking ID is ${id}`);
    navigatePath(`/booking/${encodeURIComponent(id)}/track`);
  }
  function findBooking(event) {
    event?.preventDefault();
    if (supabaseConfigured) {
      supabase.from('bookings')
        .select('*, services(title,image_url), teams(name), booking_items(quantity,services(title))')
        .eq('booking_ref', trackId.trim().toUpperCase())
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) { console.error('Booking lookup failed.', error); notify(error.message || 'Booking lookup failed.'); return; }
          if (!data) { setTracked(null); notify('Booking ID not found.'); return; }
          supabase.from('booking_status_history').select('*').eq('booking_id', data.id).order('created_at').then(({ data: history }) => {
            setTracked({
              id: data.booking_ref,
              customer: data.customer_name,
              phone: data.customer_phone,
              service: data.booking_items?.length
                ? data.booking_items.map(item => `${item.services?.title || 'ETOE Service'}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')
                : data.services?.title || 'ETOE Service',
              date: data.scheduled_date,
              slot: data.time_slot,
              address: data.address,
              team: data.teams?.name || 'Team assignment pending',
              amount: data.amount,
              status: data.status,
              paymentStatus: data.payment_status,
              estimatedArrival: data.estimated_arrival,
              adminStatus: data.admin_status,
              acceptanceStatus: data.acceptance_status,
              history: (history || []).map(item => ({ status: item.status, time: item.created_at }))
            });
            navigatePath(`/booking/${encodeURIComponent(data.booking_ref)}/track`);
          });
        });
      return;
    }
    const result = bookings.find(booking => booking.id.toLowerCase() === trackId.trim().toLowerCase());
    setTracked(result || null);
    if (!result) notify('Booking ID not found. Please check and try again.');
    else navigatePath(`/booking/${encodeURIComponent(result.id)}/track`);
  }
  function updateStatus(id, status) {
    if (supabaseConfigured) {
      supabase.rpc('update_booking_service_status', { p_booking_id: id, p_status: status }).then(({ error }) => {
        if (error) {
          console.error('Status update failed.', error);
          notify(error.message || 'Status update failed.');
          return;
        }
        notify('Booking status updated.');
      });
      return;
    }
    const time = new Date().toISOString();
    setBookings(previous => previous.map(booking => booking.id === id
      ? {
          ...booking,
          status,
          acceptanceStatus: status === 'Team Accepted' ? 'Accepted' : status === 'Team Rejected' ? 'Rejected' : booking.acceptanceStatus,
          acceptedAt: status === 'Team Accepted' ? time : booking.acceptedAt,
          history: [...(booking.history || []), { status, time }]
        }
      : booking));
    setTracked(previous => previous?.id === id ? { ...previous, status, history: [...(previous.history || []), { status, time }] } : previous);
    addNotification({
      type: 'booking_status',
      title: 'Booking status updated',
      message: `${id} · ${status}`,
      bookingId: id,
      role: 'admin'
    });
    notify('Booking status updated.');
  }
  function updateTeam(id, team) {
    if (supabaseConfigured) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(team)) {
        notify('Enter a valid Team ID to reassign this order.');
        return;
      }
      supabase.rpc('assign_booking_team', { p_booking_id: id, p_team_id: team }).then(({ error }) => {
        if (error) { console.error('Team assignment failed.', error); notify(error.message || 'Team assignment failed.'); return; }
        notify('Team assigned.');
      });
      return;
    }
    setBookings(previous => previous.map(booking => booking.id === id ? {
      ...booking,
      team,
      acceptanceStatus: 'Awaiting Team Acceptance',
      acceptanceDeadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status: 'Service Team Assigned',
      history: [...(booking.history || []), { status: 'Service Team Assigned', time: new Date().toISOString() }]
    } : booking));
    setTracked(previous => previous?.id === id ? { ...previous, team } : previous);
  }
  function adminConfirmBooking(id) {
    if (supabaseConfigured) {
      supabase.rpc('admin_confirm_booking', { p_booking_id: id }).then(({ error }) => {
        if (error) { console.error('Admin confirmation failed.', error); notify(error.message || 'Confirmation failed.'); return; }
        notify('Order confirmed.');
      });
      return;
    }
    setBookings(previous => previous.map(booking => booking.id === id ? {
      ...booking,
      adminStatus: 'Confirmed',
      status: 'Order Confirmed',
      acceptanceStatus: booking.team && booking.team !== 'Not Assigned' ? 'Awaiting Team Acceptance' : 'Not Assigned',
      acceptanceDeadline: booking.team && booking.team !== 'Not Assigned' ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null,
      history: [...(booking.history || []), { status: 'Order Confirmed', time: new Date().toISOString() }]
    } : booking));
    addNotification({
      type: 'admin_confirmed',
      title: 'Order confirmed',
      message: `${id} confirmed and sent to the service team`,
      bookingId: id,
      role: 'team'
    });
  }
  function adminRejectBooking(id, reason) {
    if (supabaseConfigured) {
      supabase.rpc('admin_reject_booking', { p_booking_id: id, p_reason: reason }).then(({ error }) => {
        if (error) { console.error('Admin rejection failed.', error); notify(error.message || 'Rejection failed.'); return; }
        notify('Booking rejected.');
      });
      return;
    }
    setBookings(previous => previous.map(booking => booking.id === id ? {
      ...booking,
      adminStatus: 'Rejected',
      status: 'Cancelled',
      acceptanceStatus: 'Not Assigned',
      rejectionReason: reason,
      history: [...(booking.history || []), { status: 'Cancelled', time: new Date().toISOString() }]
    } : booking));
    addNotification({
      type: 'booking_rejected',
      title: 'Booking rejected',
      message: `${id} · ${reason || 'No reason provided'}`,
      bookingId: id,
      role: 'customer'
    });
  }
  function teamAcceptBooking(id) {
    if (supabaseConfigured) {
      supabase.rpc('team_accept_booking', { p_booking_id: id }).then(({ error }) => {
        if (error) { console.error('Team acceptance failed.', error); notify(error.message || 'Acceptance failed.'); return; }
        notify('Order accepted.');
      });
      return;
    }
    setBookings(previous => previous.map(booking => booking.id === id ? {
      ...booking,
      status: 'Team Accepted',
      acceptanceStatus: 'Accepted',
      acceptedBy: appSession?.email || 'Demo Team Member',
      acceptedAt: new Date().toISOString(),
      history: [...(booking.history || []), { status: 'Team Accepted', time: new Date().toISOString() }]
    } : booking));
    addNotification({ type: 'team_accepted', title: 'Team accepted order', message: `${id} accepted by the service team`, bookingId: id, role: 'admin' });
  }
  function teamRejectBooking(id, reason) {
    if (supabaseConfigured) {
      supabase.rpc('team_reject_booking', { p_booking_id: id, p_reason: reason }).then(({ error }) => {
        if (error) { console.error('Team rejection failed.', error); notify(error.message || 'Rejection failed.'); return; }
        notify('Order rejected and returned to Admin.');
      });
      return;
    }
    setBookings(previous => previous.map(booking => booking.id === id ? {
      ...booking,
      status: 'Team Rejected',
      acceptanceStatus: 'Rejected',
      rejectionReason: reason,
      team: 'Not Assigned',
      history: [...(booking.history || []), { status: 'Team Rejected', time: new Date().toISOString() }]
    } : booking));
    addNotification({ type: 'team_rejected', title: 'Team rejected order', message: `${id} · ${reason}`, bookingId: id, role: 'admin' });
  }
  function cancelBooking(id) {
    if (supabaseConfigured) {
      notify('Secure cancellation requires the connected booking API.');
      return;
    }
    if (!window.confirm('Cancel this booking? This action cannot be undone.')) return;
    setBookings(previous => previous.map(booking => booking.id === id
      ? { ...booking, status: 'Cancelled', history: [...(booking.history || []), { status: 'Cancelled', time: new Date().toISOString() }] }
      : booking));
    setTracked(previous => previous?.id === id ? { ...previous, status: 'Cancelled' } : previous);
    notify('Booking cancelled.');
  }
  function rescheduleBooking(id, date) {
    if (supabaseConfigured) {
      notify('Secure rescheduling requires the connected booking API.');
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setBookings(previous => previous.map(booking => booking.id === id
      ? { ...booking, date, history: [...(booking.history || []), { status: 'Booking Rescheduled', time: new Date().toISOString() }] }
      : booking));
    setTracked(previous => previous?.id === id ? { ...previous, date } : previous);
    notify(`Booking rescheduled to ${date}.`);
  }
  async function submitReview(id) {
    if (!reviewText.trim()) {
      notify('Please share a short review.');
      return;
    }
    const review = { rating: reviewRating, text: reviewText.trim(), time: new Date().toISOString() };
    if (supabaseConfigured) {
      const booking = bookings.find(item => item.id === id) || (tracked?.id === id ? tracked : null);
      if (!appSession?.id || appSession.demo || !booking?.uuid) {
        notify('Sign in to the customer account linked to this completed booking to submit a review.');
        return;
      }
      const { error } = await supabase.from('reviews').insert({
        booking_id: booking.uuid,
        customer_id: appSession.id,
        rating: review.rating,
        review: review.text
      });
      if (error) {
        console.error('Unable to submit booking review.', error);
        notify(error.message || 'Review could not be submitted.');
        return;
      }
    }
    setBookings(previous => previous.map(booking => booking.id === id ? { ...booking, review } : booking));
    setTracked(previous => previous?.id === id ? { ...previous, review } : previous);
    setReviewText('');
    notify(supabaseConfigured ? 'Thank you for your review.' : 'Demo review saved on this device.');
  }
  function isCatalogAdmin() {
    return Boolean(supabase && appSession?.id && !appSession.demo && ['owner', 'admin'].includes(appSession.role));
  }
  async function persistOfferImage(image, offerId) {
    if (!image?.startsWith('data:image/')) return image || '';
    const blob = await (await fetch(image)).blob();
    const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const path = `${offerId}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('offer-images').upload(path, blob, { contentType: blob.type, upsert: true });
    if (error) throw error;
    return supabase.storage.from('offer-images').getPublicUrl(path).data.publicUrl;
  }
  async function loadAdminCategories() {
    if (!supabaseConfigured || !supabase) return;
    if (!isCatalogAdmin()) {
      notify('Sign in with an owner or admin account to manage categories.');
      return;
    }
    const { data, error } = await supabase.from('categories')
      .select('id,title,description,icon,image_url,active,sort_order')
      .order('sort_order');
    if (error) {
      console.error('Unable to load category administration.', error);
      notify(error.message || 'Categories could not be loaded.');
      return;
    }
    setCatalogueCategories(data || []);
  }
  async function loadAdminOffers() {
    if (!supabaseConfigured || !supabase) return;
    if (!isCatalogAdmin()) {
      notify('Sign in with an owner or admin account to manage offers.');
      return;
    }
    const { data, error } = await supabase.from('offers')
      .select('id,title,description,discount_type,discount_value,image_url,coupon_code,starts_at,expires_at,active,priority,offer_services(service_id)')
      .order('priority', { ascending: false });
    if (error) {
      console.error('Unable to load offer administration.', error);
      notify(error.message || 'Offers could not be loaded.');
      return;
    }
    setOffers((data || []).map(offer => {
      const serviceIds = (offer.offer_services || []).map(item => item.service_id);
      return {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        discountType: offer.discount_type,
        discount: Number(offer.discount_value),
        serviceIds,
        serviceId: serviceIds[0] || '',
        startDate: offer.starts_at.slice(0, 10),
        expiryDate: offer.expires_at.slice(0, 10),
        active: offer.active,
        priority: offer.priority,
        image: offer.image_url,
        couponCode: offer.coupon_code
      };
    }));
  }
  async function setCategoryActive(category, active) {
    if (supabaseConfigured) {
      if (!isCatalogAdmin()) {
        notify('Sign in with an owner or admin account to manage categories.');
        return;
      }
      const { error } = await supabase.from('categories')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', category.id);
      if (error) {
        console.error('Unable to update category visibility.', error);
        notify(error.message || 'Category visibility could not be updated.');
        return;
      }
    }
    setCatalogueCategories(previous => previous.map(item => item.id === category.id ? { ...item, active } : item));
    notify(`${category.title} ${active ? 'shown' : 'hidden'} on the home screen.`);
  }
  async function toggleFeaturedService(service) {
    const popular = !isFeaturedService(service);
    if (supabaseConfigured) {
      if (!isCatalogAdmin()) {
        notify('Sign in with an owner or admin account to feature services.');
        return;
      }
      const { error } = await supabase.from('services').update({ popular, updated_at: new Date().toISOString() }).eq('id', service.id);
      if (error) {
        console.error('Unable to update featured service.', error);
        notify(error.message || 'Featured service could not be updated.');
        return;
      }
    }
    setServiceList(previous => previous.map(item => item.id === service.id ? { ...item, popular } : item));
    notify(`${service.title} ${popular ? 'added to' : 'removed from'} popular services.`);
  }
  async function saveOffer(event) {
    event.preventDefault();
    if (!offerForm.title || !offerForm.expiryDate) return;
    const id = `offer-${Date.now()}`;
    let image = offerForm.image || imageUrl(serviceList.find(service => service.id === offerForm.serviceId)?.image, 1400);
    if (supabaseConfigured) {
      if (!isCatalogAdmin()) {
        notify('Sign in with an owner or admin account to manage offers.');
        return;
      }
      try {
        image = await persistOfferImage(image, id);
      } catch (error) {
        console.error('Unable to upload offer image.', error);
        notify(error.message || 'Offer image could not be uploaded.');
        return;
      }
      const row = {
        id,
        title: offerForm.title.trim(),
        description: offerForm.description.trim(),
        discount_type: 'percentage',
        discount_value: Number(offerForm.discount),
        image_url: image,
        coupon_code: null,
        starts_at: new Date(`${offerForm.startDate}T00:00:00.000Z`).toISOString(),
        expires_at: new Date(`${offerForm.expiryDate}T23:59:59.999Z`).toISOString(),
        active: true,
        priority: 0,
        created_by: appSession.id
      };
      const { error } = await supabase.from('offers').insert(row);
      if (error) {
        console.error('Unable to create offer.', error);
        notify(error.message || 'Offer could not be created.');
        return;
      }
      const { error: serviceError } = await supabase.from('offer_services').insert({ offer_id: id, service_id: offerForm.serviceId });
      if (serviceError) {
        console.error('Unable to link offer to service.', serviceError);
        const { error: cleanupError } = await supabase.from('offers').delete().eq('id', id);
        if (cleanupError) console.error('Unable to remove offer after service linking failed.', cleanupError);
        notify(serviceError.message || 'Offer could not be linked to its service.');
        return;
      }
    }
    setOffers(previous => [{
      ...offerForm,
      id,
      discount: Number(offerForm.discount),
      image,
      serviceIds: [offerForm.serviceId],
      active: true
    }, ...previous]);
    setOfferForm({ title: '', description: '', discount: 20, serviceId: 'home', startDate: new Date().toISOString().slice(0, 10), expiryDate: '', image: '' });
    notify('Offer created and activated.');
  }
  async function saveOfferEdits(offer) {
    if (supabaseConfigured) {
      if (!isCatalogAdmin()) {
        notify('Sign in with an owner or admin account to manage offers.');
        return;
      }
      let image;
      try {
        image = await persistOfferImage(offer.image, offer.id);
      } catch (error) {
        console.error('Unable to upload updated offer image.', error);
        notify(error.message || 'Offer image could not be uploaded.');
        return;
      }
      const { error } = await supabase.from('offers').update({
        title: offer.title.trim(),
        description: offer.description.trim(),
        discount_type: offer.discountType || 'percentage',
        discount_value: Number(offer.discount),
        image_url: image,
        starts_at: new Date(`${offer.startDate}T00:00:00.000Z`).toISOString(),
        expires_at: new Date(`${offer.expiryDate}T23:59:59.999Z`).toISOString(),
        active: Boolean(offer.active),
        updated_at: new Date().toISOString()
      }).eq('id', offer.id);
      if (error) {
        console.error('Unable to save offer changes.', error);
        notify(error.message || 'Offer changes could not be saved.');
        return;
      }
      setOffers(previous => previous.map(item => item.id === offer.id ? { ...item, image } : item));
    }
    notify('Offer changes saved.');
  }
  async function toggleOfferActive(offer) {
    const active = !offer.active;
    if (supabaseConfigured) {
      if (!isCatalogAdmin()) {
        notify('Sign in with an owner or admin account to manage offers.');
        return;
      }
      const { error } = await supabase.from('offers').update({ active, updated_at: new Date().toISOString() }).eq('id', offer.id);
      if (error) {
        console.error('Unable to update offer status.', error);
        notify(error.message || 'Offer status could not be updated.');
        return;
      }
    }
    setOffers(previous => previous.map(item => item.id === offer.id ? { ...item, active } : item));
  }
  function handleOfferImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify('Please choose an image smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setOfferForm(previous => ({ ...previous, image: String(reader.result) }));
    reader.onerror = () => notify('The offer image could not be read.');
    reader.readAsDataURL(file);
  }
  function updateOfferImage(event, id) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      notify('Choose an image file smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setOffers(previous => previous.map(offer => offer.id === id ? { ...offer, image: String(reader.result) } : offer));
    reader.onerror = () => notify('The offer image could not be read.');
    reader.readAsDataURL(file);
  }
  function navigateTo(id) {
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
  function openAdmin() {
    if (supabaseConfigured) {
      if (!appSession?.id || appSession.demo || !['owner', 'admin'].includes(appSession.role)) {
        notify('Sign in with an owner or admin account to manage the platform.');
        openApp('team');
        return;
      }
    }
    setAdminOpen(true);
  }
  function openLogin() {
    notify(supabaseConfigured
      ? 'Customer sign-in and OTP delivery have not been configured yet.'
      : 'Enter your details when you book a service to get started.');
  }
  async function submitSupportRequest(event) {
    event.preventDefault();
    if (supabaseConfigured && supabase) {
      if (!appSession?.id || appSession.demo) {
        notify('Sign in to submit and track a support ticket.');
        openApp('customer');
        return;
      }
      let bookingId = null;
      if (supportForm.bookingId.trim()) {
        const lookup = await supabase.from('bookings').select('id')
          .eq('customer_id', appSession.id)
          .eq('booking_ref', supportForm.bookingId.trim().toUpperCase())
          .maybeSingle();
        if (lookup.error) {
          console.error('Unable to verify the support booking reference.', lookup.error);
          notify(lookup.error.message || 'Booking reference could not be verified.');
          return;
        }
        if (!lookup.data) {
          notify('That Booking ID was not found on your account.');
          return;
        }
        bookingId = lookup.data.id;
      }
      const { data, error } = await supabase.from('support_tickets').insert({
        profile_id: appSession.id,
        booking_id: bookingId,
        subject: 'Customer support request',
        message: `Name: ${supportForm.name.trim()}\nPhone: ${supportForm.phone.trim()}\n\n${supportForm.message.trim()}`
      }).select('id,subject,message,status,created_at,booking_id').single();
      if (error) {
        console.error('Unable to submit support ticket.', error);
        notify(error.message || 'Support request could not be submitted.');
        return;
      }
      setSupportTickets(previous => [data, ...previous]);
      setSupportForm({ name: '', phone: '', bookingId: '', message: '' });
      notify(`Support ticket submitted: ${data.id.slice(0, 8).toUpperCase()}`);
      return;
    }
    const subject = encodeURIComponent(`ETOE support${supportForm.bookingId ? ` · ${supportForm.bookingId}` : ''}`);
    const body = encodeURIComponent(`Name: ${supportForm.name}\nPhone: ${supportForm.phone}\nBooking ID: ${supportForm.bookingId || 'Not provided'}\n\n${supportForm.message}`);
    window.location.href = `mailto:info@etoe.services?subject=${subject}&body=${body}`;
    notify('Your email app will open with the support request ready to send.');
  }
  async function saveLoyaltySettings(event) {
    event.preventDefault();
    if (!supabase || !appSession?.id || !['owner', 'admin'].includes(appSession.role)) {
      notify('Only an authenticated owner or admin can save reward rules.');
      return;
    }
    const values = {
      active: Boolean(loyaltyForm.active),
      points_per_100: Number(loyaltyForm.points_per_100) || 0,
      point_value: Number(loyaltyForm.point_value) || 0,
      first_booking_bonus: Number(loyaltyForm.first_booking_bonus) || 0,
      referral_referrer_bonus: Number(loyaltyForm.referral_referrer_bonus) || 0,
      referral_customer_bonus: Number(loyaltyForm.referral_customer_bonus) || 0,
      point_expiry_days: Number(loyaltyForm.point_expiry_days) || 0,
      gold_spend_threshold: Number(loyaltyForm.gold_spend_threshold) || 0,
      platinum_spend_threshold: Number(loyaltyForm.platinum_spend_threshold) || 0,
      updated_by: appSession.id,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('loyalty_settings')
      .update(values).eq('singleton', true).select().single();
    if (error) {
      console.error('Unable to save loyalty settings.', error);
      notify(error.message || 'Reward rules could not be saved.');
      return;
    }
    setLoyaltySettings(data);
    setLoyaltyForm(data);
    notify('Reward rules saved.');
  }
  async function updateSupportTicket(ticketId, status) {
    if (!supabase || !['owner', 'admin', 'manager'].includes(appSession?.role)) {
      notify('Only authorized operations staff can update support tickets.');
      return;
    }
    const { data, error } = await supabase.from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId).select('id,status').single();
    if (error) {
      console.error('Unable to update support ticket.', error);
      notify(error.message || 'Ticket status could not be updated.');
      return;
    }
    setAdminSupportTickets(previous => previous.map(ticket => ticket.id === ticketId ? { ...ticket, status: data.status } : ticket));
    notify('Support ticket status updated.');
  }
  async function submitRewardAdjustment(event) {
    event.preventDefault();
    if (!supabase || !['owner', 'admin'].includes(appSession?.role)) {
      notify('Only an authenticated owner or admin can adjust reward points.');
      return;
    }
    const points = Number(manualRewardAdjustment.points);
    if (!manualRewardAdjustment.customerId || !Number.isInteger(points) || points === 0 || manualRewardAdjustment.reason.trim().length < 5) {
      notify('Choose a customer, enter a non-zero whole number of points, and provide a reason.');
      return;
    }
    const { error } = await supabase.rpc('admin_adjust_reward_points', {
      target_profile_id: manualRewardAdjustment.customerId,
      point_delta: points,
      adjustment_reason: manualRewardAdjustment.reason.trim()
    });
    if (error) {
      console.error('Reward point adjustment failed.', error);
      notify(error.message || 'Reward adjustment could not be saved.');
      return;
    }
    setAdminRewardAccounts(previous => previous.map(account => account.profile_id === manualRewardAdjustment.customerId
      ? {
          ...account,
          points_balance: account.points_balance + points,
          total_points_earned: account.total_points_earned + Math.max(points, 0),
          total_points_redeemed: account.total_points_redeemed + Math.max(-points, 0)
        }
      : account));
    const { data } = await supabase.from('reward_transactions')
      .select('profile_id,transaction_type,points_delta,reason,created_at')
      .order('created_at', { ascending: false }).limit(500);
    if (data) setAdminRewardTransactions(data);
    setManualRewardAdjustment({ customerId: '', points: '', reason: '' });
    notify('Reward adjustment recorded in the audit ledger.');
  }
  function exportRewardReport() {
    const rows = [
      ['Customer ID', 'Referral code', 'Points balance', 'Points earned', 'Points redeemed', 'Lifetime spend', 'Membership'],
      ...adminRewardAccounts.map(account => [
        account.profile_id, account.referral_code, account.points_balance, account.total_points_earned,
        account.total_points_redeemed, account.lifetime_spend, account.membership_level
      ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'etoe-rewards-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  async function copyReferralLink() {
    if (!navigator.clipboard?.writeText) {
      notify('Copy is unavailable in this browser. You can select and copy the referral link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(referralUrl);
      notify('Referral link copied.');
    } catch (error) {
      console.error('Unable to copy referral link.', error);
      notify('Could not copy the link. You can select and copy it manually.');
    }
  }
  function openAddressEditor(address = null) {
    setAddressEditor(address ? { id: address.id } : { id: null });
    setAddressForm(address
      ? { label: address.label || 'Home', address: address.address || '', landmark: address.landmark || '', city: address.city || 'Jaipur', postal_code: address.postal_code || '' }
      : { label: 'Home', address: '', landmark: '', city: 'Jaipur', postal_code: '' });
  }
  async function saveAddress(event) {
    event.preventDefault();
    const values = {
      label: addressForm.label.trim(),
      address: addressForm.address.trim(),
      landmark: addressForm.landmark.trim(),
      city: addressForm.city.trim(),
      postal_code: addressForm.postal_code.trim()
    };
    if (supabaseConfigured) {
      if (!appSession?.id || appSession.demo) {
        notify('Sign in with a customer account to save addresses.');
        return;
      }
      let result;
      if (addressEditor?.id) {
        result = await supabase.from('addresses').update(values).eq('id', addressEditor.id).eq('customer_id', appSession.id).select().single();
      } else {
        result = await supabase.from('addresses').insert({ ...values, customer_id: appSession.id }).select().single();
      }
      if (result.error) {
        console.error('Unable to save address.', result.error);
        notify(result.error.message || 'Address could not be saved.');
        return;
      }
      setAddresses(previous => addressEditor?.id
        ? previous.map(item => item.id === addressEditor.id ? result.data : item)
        : [result.data, ...previous]);
    } else {
      const saved = { ...values, id: addressEditor?.id || `address-${Date.now()}` };
      setAddresses(previous => addressEditor?.id
        ? previous.map(item => item.id === addressEditor.id ? saved : item)
        : [saved, ...previous]);
    }
    setAddressEditor(null);
    notify('Address saved.');
  }
  async function removeAddress(address) {
    if (supabaseConfigured) {
      if (!appSession?.id || appSession.demo) {
        notify('Sign in with a customer account to manage saved addresses.');
        return;
      }
      const { error } = await supabase.from('addresses').delete().eq('id', address.id).eq('customer_id', appSession.id);
      if (error) {
        console.error('Unable to delete address.', error);
        notify(error.message || 'Address could not be deleted.');
        return;
      }
    }
    setAddresses(previous => previous.filter(item => item.id !== address.id));
    notify('Address removed.');
  }
  function toggleFavorite(serviceId) {
    setFavorites(previous => previous.includes(serviceId)
      ? previous.filter(id => id !== serviceId)
      : [...previous, serviceId]);
  }
  function navigateSection(id) {
    if (id === 'home') return navigatePath('/home');
    if (id === 'services' || id === 'explore') return navigatePath('/explore');
    if (id === 'tracking' || id === 'bookings') return navigatePath('/my-bookings');
    if (id === 'offers') return navigatePath('/home#offers');
    return navigatePath('/support');
  }
  function openCategory(item) {
    if (!item) return;
    setQuery('');
    setCategory('All Services');
    navigatePath(`/services/${encodeURIComponent(item.id)}`);
  }
  function openHomeCategory(categoryId, searchTerm = '') {
    const item = mainCategories.find(categoryItem => categoryItem.id === categoryId);
    if (!item) return;
    openCategory(item);
    if (searchTerm) setQuery(searchTerm);
  }
  function returnHome() {
    navigatePath('/home');
  }
  function renderServiceCards(list) {
    return list.map(service => {
      const Icon = iconMap[service.icon] || Sparkles;
      const offer = offerForService(service.id);
      return <article className="service-card" key={service.id}>
        <button className="service-photo" onClick={() => navigatePath(`/service/${encodeURIComponent(service.id)}`)} aria-label={`View ${service.title} details`}>
          <img src={imageUrl(service.image)} alt={service.title} loading="lazy"/>
          {offer ? <span className="service-sale">{offerSavingsLabel(offer)}</span> : service.tag && <span className="service-sale muted-sale">{service.tag}</span>}
        </button>
        <div className="service-card-content">
          <div className="service-card-meta"><div className="service-category"><Icon size={14}/>{service.category}</div>{appMode === 'customer' && <button className={`service-favorite ${favorites.includes(service.id) ? 'active' : ''}`} onClick={() => toggleFavorite(service.id)} aria-label={`${favorites.includes(service.id) ? 'Remove' : 'Save'} ${service.title} as a favorite`}><Heart size={17} fill={favorites.includes(service.id) ? 'currentColor' : 'none'}/></button>}</div><h3>{service.title}</h3><p>{service.description}</p>
          <div className="service-bottom"><div><small>STARTING AT</small><strong>{offer && service.price > 0 ? <><del>{money(service.price)}</del> {money(discountedPrice(service))}</> : money(service.price)}</strong></div><div className="service-card-actions"><button className="btn btn-light book-small" onClick={() => navigatePath(`/service/${encodeURIComponent(service.id)}`)}>Details</button><button className="btn btn-primary book-small" onClick={() => openBooking(service)}>Book</button><button className="service-cart-add" onClick={() => addToCart(service)} aria-label={`Add ${service.title} to cart`} title="Add to cart" disabled={cartBusy}><ShoppingCart size={15}/></button></div></div>
        </div>
      </article>;
    });
  }
  const currentOffer = liveOffers[slide];
  const offerService = currentOffer && serviceList.find(service => service.id === currentOffer.serviceId);
  const detailService = route.page === 'service' ? serviceList.find(item => item.id === route.serviceId) : null;
  const averageServiceRating = serviceReviews.length
    ? (serviceReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / serviceReviews.length).toFixed(1)
    : null;
  const referralUrl = rewardAccount?.referral_code
    ? `${window.location.origin}/home?ref=${encodeURIComponent(rewardAccount.referral_code)}`
    : '';
  const appPageTitle = ({
    home: 'Home',
    explore: 'Explore services',
    category: selectedCategory?.title || 'Services',
    service: detailService?.title || 'Service details',
    cart: 'Your cart',
    rewards: 'Rewards',
    referrals: 'Refer a friend',
    checkout: 'Book a service',
    bookings: 'My bookings',
    booking: 'Booking details',
    track: 'Track booking',
    profile: 'Your profile',
    support: 'Help & support'
  })[route.page] || 'ETOE Services';
  const renderOfferBanner = () => currentOffer && offerService && <section className="offer-ribbon" aria-label="Featured offer">
    <button className="offer-arrow prev" onClick={() => setSlide(current => (current - 1 + liveOffers.length) % liveOffers.length)} aria-label="Previous offer"><ChevronLeft/></button>
    <button className="offer-feature" onClick={() => navigatePath(`/service/${encodeURIComponent(offerService.id)}`)} style={{ backgroundImage: `linear-gradient(90deg,rgba(27,13,9,.88),rgba(40,18,8,.56) 52%,rgba(22,12,8,.08)),url("${imageUrl(currentOffer.image, 1800)}")` }}>
      <div className="offer-content">
        <span className="offer-kicker"><Sparkles size={15}/> JAIPUR EXCLUSIVE · LIMITED TIME</span>
        <strong className="offer-discount">{currentOffer.discountType === 'fixed' ? <>SAVE <span>{money(currentOffer.discount)}</span></> : <>UP TO {currentOffer.discount}% <span>OFF</span></>}</strong>
        <h2>{currentOffer.title}</h2><p>{currentOffer.description}</p>
        <span className="offer-cta">Explore offer <ArrowRight size={17}/></span>
      </div>
      <span className="offer-expiry"><Timer size={15}/> Offer ends {expiryLabel(currentOffer.expiryDate)}</span>
    </button>
    {liveOffers.length > 1 && <>
      <button className="offer-arrow next" onClick={() => setSlide(current => (current + 1) % liveOffers.length)} aria-label="Next offer"><ChevronRight/></button>
      <div className="offer-dots">{liveOffers.map((offer, index) => <button key={offer.id} className={index === slide ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Show offer ${index + 1}`}/>)}</div>
    </>}
  </section>;

  if (appMode === 'customer' && !appSession) {
    return <div className="etoe-app-shell customer-app-shell app-auth-shell">
      <header className="etoe-app-header">
        <button className="etoe-app-brand" onClick={closeApp} aria-label="Return to ETOE website"><img src="/images/etoe-logo.png" alt="ETOE Services"/></button>
        <div className="etoe-app-title"><small>ETOE CUSTOMER APP</small><strong>Welcome to ETOE</strong></div>
      </header>
      <main className="etoe-app-auth">
        <div className="etoe-app-auth-card">
          <span className="etoe-app-auth-icon"><Sparkles/></span>
          <div className="eyebrow">BOOK & TRACK CARE</div>
          <h1>{customerAuthMode === 'signup' ? 'Create your account' : 'Sign in to ETOE'}</h1>
          <p>Manage bookings, saved addresses and service updates in one place.</p>
          <form onSubmit={submitAppAuth}>
            {customerAuthMode === 'signup' && <label className="etoe-app-field">Full name<input type="text" required value={authFullName} onChange={event => setAuthFullName(event.target.value)} placeholder="Your full name"/></label>}
            {customerAuthMode === 'signup' && <label className="etoe-app-field">Referral code <span className="optional">(optional)</span><input type="text" value={referralCodeForm} onChange={event => setReferralCodeForm(event.target.value.toUpperCase())} placeholder="ETOE-XXXXXXXXXX"/></label>}
            <label className="etoe-app-field">Email<input type="email" required value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} placeholder="name@example.com"/></label>
            <label className="etoe-app-field">Password<input type="password" required minLength={customerAuthMode === 'signup' ? 8 : undefined} value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} placeholder={customerAuthMode === 'signup' ? 'At least 8 characters' : 'Enter password'}/></label>
            <button className="btn btn-primary full" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : customerAuthMode === 'signup' ? 'Create account' : 'Sign in'}</button>
          </form>
          {supabaseConfigured ? <div className="customer-auth-links">
            {customerAuthMode === 'signin' && <button type="button" onClick={sendCustomerPasswordReset}>Forgot password?</button>}
            <button type="button" onClick={() => setCustomerAuthMode(customerAuthMode === 'signin' ? 'signup' : 'signin')}>{customerAuthMode === 'signin' ? 'New to ETOE? Create an account' : 'Already have an account? Sign in'}</button>
          </div> : <><button className="etoe-app-demo-fill" type="button" onClick={useDemoLogin}>Use demo login</button><small className="etoe-app-demo-note">Demo mode is stored on this device and is not a live account.</small></>}
          <button className="etoe-app-back" onClick={closeApp}><ChevronLeft size={16}/> Return to website</button>
        </div>
      </main>
      <ChatbotWidget appSession={appSession} navigatePath={navigatePath}/>
      {toast && <div className="toast"><CircleCheck size={18}/>{toast}</div>}
    </div>;
  }

  if (appMode === 'team') {
    const teamRoleLabels = {
      owner: 'Owner / Super Admin',
      admin: 'Admin',
      manager: 'Manager',
      tracking_team: 'Tracking Team',
      field_officer: 'Field Officer',
      service_staff: 'Service Staff'
    };
    const teamFeatures = {
      owner: ['Complete dashboard', 'Bookings', 'Revenue', 'Customers', 'Teams', 'Offers', 'Reports', 'Payments', 'Settings'],
      admin: ['Dashboard', 'Bookings', 'Customers', 'Services', 'Offers', 'Employees', 'Payments', 'Complaints'],
      manager: ['Assigned bookings', 'Team management', 'Job monitoring', 'Operational updates', 'Reports'],
      tracking_team: ['All bookings', 'Search Booking ID', 'Assign teams', 'Status updates', 'Customer contact'],
      field_officer: ['Assigned visits', 'Customer details', 'Visit schedule', 'Inspection reports', 'Job updates'],
      service_staff: ['Today’s jobs', 'Accept assignment', 'On the way', 'Reached', 'Start / complete job', 'Before & after photos', 'Attendance', 'Leaves']
    };
    const role = appSession?.role || teamRole;
    return <div className={`etoe-app-shell ${appMode}`}>
      <header className="etoe-app-header">
        <button className="etoe-app-brand" onClick={closeApp} aria-label="Return to ETOE website">
          <img src="/images/etoe-logo.png" alt="ETOE Services"/>
        </button>
        <div className="etoe-app-title">
          <small>{appMode === 'customer' ? 'CUSTOMER APP' : 'INTERNAL APP'}</small>
          <strong>{appMode === 'customer' ? 'Welcome to ETOE' : teamRoleLabels[role] || 'Team App'}</strong>
        </div>
        <button className="etoe-app-profile" onClick={() => setAppAuthOpen(true)} aria-label="Open account"><UserRound size={18}/></button>
      </header>

      {!appSession ? <main className="etoe-app-auth">
        <div className="etoe-app-auth-card">
          <span className="etoe-app-auth-icon">{appMode === 'customer' ? <Sparkles/> : <BriefcaseBusiness/>}</span>
          <div className="eyebrow">{appMode === 'customer' ? 'BOOK & TRACK CARE' : 'ETOE WORKSPACE'}</div>
          <h1>{appMode === 'customer' ? 'Sign in to ETOE' : 'Team sign in'}</h1>
          <p>{appMode === 'customer'
            ? 'Manage bookings, saved addresses and service updates in one place.'
            : 'Use your assigned role account to manage jobs and operations.'}</p>
          {appMode === 'team' && <label className="etoe-app-field">Your role
            <select value={teamRole} onChange={event => setTeamRole(event.target.value)}>
              {Object.entries(teamRoleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>}
          <form onSubmit={submitAppAuth}>
            <label className="etoe-app-field">Email or username<input type="text" required value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} placeholder="name@etoe.services"/></label>
            <label className="etoe-app-field">Password<input type="password" required value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} placeholder="Enter password"/></label>
            <button className="btn btn-primary full" type="submit" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {!supabaseConfigured && <><button className="etoe-app-demo-fill" type="button" onClick={useDemoLogin}>Use demo login</button><small className="etoe-app-demo-note">Demo mode: any real-looking details work.</small></>}
          <button className="etoe-app-back" onClick={closeApp}><ChevronLeft size={16}/> Return to website</button>
        </div>
      </main> : appMode === 'customer' ? <main className="etoe-app-main">
        <section className="etoe-app-welcome">
          <div><small>GOOD MORNING</small><h1>How can we help today?</h1></div>
          <button aria-label="Notifications" onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={19}/><span>{notifications.filter(item => !item.read).length}</span></button>
        </section>
        <button className="etoe-app-search" onClick={() => navigatePath('/explore')}><Search size={19}/><span>What service are you looking for?</span></button>
        <section className="etoe-app-section"><div className="etoe-app-section-head"><h2>Services</h2><button onClick={() => navigatePath('/explore')}>View all</button></div><div className="etoe-app-service-grid">
          {[{ title: 'Housekeeping', Icon: Users, id: 'housekeeping' }, { title: 'IFM Services', Icon: Building2, id: 'ifm' }, { title: 'Deep Cleaning', Icon: Sparkles, id: 'deep-cleaning' }, { title: 'Pest Control', Icon: Bug, id: 'pest-control' }].map(item =>
            <button key={item.id} onClick={() => openCategory(mainCategories.find(category => category.id === item.id))}><span><item.Icon/></span><strong>{item.title}</strong></button>
          )}
        </div></section>
        {liveOffers.length > 0 && <section className="etoe-app-offer" style={{ backgroundImage: `linear-gradient(90deg,#21130cdd,#21130c45),url("${imageUrl(liveOffers[0].image, 900)}")` }}><span>{offerSavingsLabel(liveOffers[0])}</span><h2>{liveOffers[0].title}</h2><button onClick={() => openBooking(offerService || serviceList[0])}>Book now <ArrowRight size={15}/></button></section>}
        <section className="etoe-app-section"><div className="etoe-app-section-head"><h2>My bookings</h2><button onClick={() => navigatePath('/my-bookings')}>View all</button></div>
          <div className="etoe-app-booking-card">{bookings.slice(0, 3).map(booking => <button key={booking.id} onClick={() => { setTrackId(booking.id); setTracked(booking); navigatePath(`/booking/${encodeURIComponent(booking.id)}`); }}><span><CalendarDays size={18}/></span><div><strong>{booking.service}</strong><small>{booking.id} · {booking.date}</small><em>{booking.status}</em></div><ChevronRight size={17}/></button>)}</div>
        </section>
        <nav className="etoe-app-nav"><button className="active" onClick={() => navigatePath('/home')}><Home/>Home</button><button onClick={() => navigatePath('/explore')}><Search/>Explore</button><button onClick={() => navigatePath('/my-bookings')}><ClipboardList/>Bookings</button><button onClick={() => navigatePath('/profile')}><Users/>Profile</button></nav>
      </main> : <main className="etoe-app-main team-main">
        <section className="team-welcome"><div><small>{teamRoleLabels[role]}</small><h1>{role === 'tracking_team' ? 'Tracking overview' : role === 'service_staff' ? 'Your workday' : 'Operations overview'}</h1></div><button aria-label="Notifications" onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={18}/><span>{notifications.filter(item => !item.read).length}</span></button></section>
        <div className="team-stat-grid">{[
          ['Today', bookings.filter(booking => booking.date === currentDate).length, 'Calendar'],
          ['Pending', bookings.filter(booking => !['Service Completed', 'Cancelled'].includes(booking.status)).length, 'Clock'],
          ['Completed', bookings.filter(booking => booking.status === 'Service Completed').length, 'Check'],
          ['Active teams', 2, 'Users']
        ].map(([label, value, type]) => <div key={label}><span>{type === 'Users' ? <Users/> : type === 'Check' ? <Check/> : type === 'Clock' ? <Clock3/> : <CalendarDays/>}</span><strong>{value}</strong><small>{label}</small></div>)}</div>
        <section className="team-panel"><div className="etoe-app-section-head"><h2>{role === 'tracking_team' ? 'Live bookings' : 'Assigned jobs'}</h2><button>View all</button></div>
          <div className="team-job-list">{bookings.slice(0, 5).map(booking => <article key={booking.id}>
            <span className="team-job-icon"><PackageCheck size={17}/></span>
            <div><strong>{booking.service}</strong><small>{booking.id} · {booking.address}</small>{booking.acceptanceStatus === 'Awaiting Team Acceptance' && <small className="team-deadline">Accept within {acceptanceCountdown[booking.id] || '10:00'}</small>}</div>
            {booking.acceptanceStatus === 'Awaiting Team Acceptance' && <div className="team-order-actions"><button onClick={() => teamAcceptBooking(booking.id)}>Accept</button><button className="reject" onClick={() => openActionDialog('team-reject', booking.id)}>Reject</button></div>}
            {['tracking_team','field_officer','service_staff','manager','admin','owner'].includes(role) ? <select className="team-status-select" aria-label={`Update status for ${booking.id}`} value={booking.status} onChange={event => updateStatus(booking.id, event.target.value)}>
              {statuses.filter(status => status !== 'Payment Completed').map(status => <option key={status}>{status}</option>)}
            </select> : <span className="team-job-status">{booking.status}</span>}
          </article>)}</div>
        </section>
        {role === 'tracking_team' && <section className="team-panel"><h2>Quick actions</h2><div className="team-actions"><button onClick={() => notify('Booking search is ready. Enter a Booking ID on the website tracker.')}><Search/> Find Booking</button><button onClick={() => notify('Select a booking below to assign an available team.')}><Users/> Assign Team</button><button onClick={() => notify('Open the bookings table to update the manual status timeline.')}><MapPin/> Update Status</button></div></section>}
        <section className="team-feature-list"><h2>Role features</h2>{(teamFeatures[role] || []).map(feature => <div key={feature}><CircleCheck size={15}/><span>{feature}</span><ChevronRight size={15}/></div>)}</section>
        <nav className="etoe-app-nav"><button className={appTab === 'Dashboard' ? 'active' : ''} onClick={() => setAppTab('Dashboard')}><LayoutDashboard/>Dashboard</button><button className={appTab === 'Jobs' ? 'active' : ''} onClick={() => { setAppTab('Jobs'); document.querySelector('.team-job-list')?.scrollIntoView({ behavior: 'smooth' }); }}><BriefcaseBusiness/>Jobs</button><button className={appTab === 'Updates' ? 'active' : ''} onClick={() => { setAppTab('Updates'); notify('No new updates beyond the latest booking statuses.'); }}><Bell/>Updates</button><button className={appTab === 'Profile' ? 'active' : ''} onClick={() => { setAppTab('Profile'); setAppAuthOpen(true); }}><Users/>Profile</button></nav>
      </main>}
      {appAuthOpen && appSession && <div className="etoe-app-account-popover" onClick={() => setAppAuthOpen(false)}><div onClick={event => event.stopPropagation()}><strong>{appSession.fullName || appSession.email || 'ETOE Account'}</strong><small>{appSession.demo ? 'Demo session' : teamRoleLabels[appSession.role] || 'Customer account'}</small><button onClick={logoutApp}><LogOut size={15}/> Sign out</button></div></div>}
      {notificationOpen && <div className="etoe-app-notifications" onClick={() => setNotificationOpen(false)}><div onClick={event => event.stopPropagation()}><div className="etoe-app-notification-head"><strong>Notifications</strong><button onClick={() => setNotifications(previous => previous.map(item => ({ ...item, read: true })))}>Mark all read</button></div>{notifications.length === 0 ? <small>No notifications yet</small> : notifications.slice(0, 12).map(item => <button className={`etoe-app-notification ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => { markNotificationRead(item.id); setNotificationOpen(false); if (item.bookingId) { setTrackId(item.bookingId); const booking = bookings.find(entry => entry.id === item.bookingId); if (booking) setTracked(booking); navigatePath(`/booking/${encodeURIComponent(item.bookingId)}/track`); } }}><span>{item.type === 'new_booking' ? <PackageCheck/> : <Bell/>}</span><div><strong>{item.title}</strong><small>{item.message}</small></div></button>)}</div></div>}
    </div>;
  }

  return <div className={`app ${appMode === 'customer' ? 'customer-app-shell' : ''}`}>
    {appMode === 'customer' ? <header className={`customer-app-header ${route.page === 'home' ? 'customer-home-header' : ''}`}>
      {route.page === 'home' ? <>
        <div className="customer-home-header-top">
          <button className="customer-app-brand" onClick={() => navigatePath('/home')} aria-label="ETOE Services home"><img src="/images/etoe-logo.png" alt="ETOE Services"/></button>
          <div className="customer-home-header-actions">
            <button className="customer-wallet-button" onClick={() => setWalletInfoOpen(open => !open)} aria-expanded={walletInfoOpen} aria-label="Open ETOE Wallet information"><Wallet size={19}/><span><small>ETOE</small>Wallet</span></button>
            <button className="customer-app-icon cart-header-icon" onClick={() => navigatePath('/cart')} aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}><ShoppingCart size={18}/>{cartCount > 0 && <span>{cartCount}</span>}</button>
            <button className="customer-app-icon" onClick={() => setNotificationOpen(!notificationOpen)} aria-label={`Notifications${notifications.filter(item => !item.read).length ? `, ${notifications.filter(item => !item.read).length} unread` : ''}`}><Bell size={19}/>{notifications.some(item => !item.read) && <span>{notifications.filter(item => !item.read).length}</span>}</button>
            <button className="customer-app-icon customer-home-profile" onClick={() => navigatePath('/profile')} aria-label="Open profile"><UserRound size={20}/></button>
          </div>
        </div>
        <div className="customer-home-location-wrap">
          <div className="customer-home-availability"><span>TODAY'S SERVICE AVAILABILITY</span><small>Select a service to see available time slots</small></div>
          <button className="customer-home-location" onClick={() => setHomeLocationOpen(open => !open)} aria-expanded={homeLocationOpen}>
            <MapPin size={17}/><span><small>SERVICE ADDRESS</small><strong>{selectedHomeAddress ? `${selectedHomeAddress.label || 'Saved address'} · ${formatAddress(selectedHomeAddress)}` : 'Jaipur, Rajasthan'}</strong></span><ChevronDown size={16}/>
          </button>
          {homeLocationOpen && <div className="customer-home-location-menu">
            <strong>Choose a service address</strong>
            {addresses.length ? addresses.map(address => <button key={address.id} onClick={() => { setSelectedAddressId(String(address.id)); setHomeLocationOpen(false); notify(`${address.label || 'Address'} selected for your next booking.`); }}><MapPin size={15}/><span><b>{address.label || 'Saved address'}</b><small>{formatAddress(address)}</small></span>{String(address.id) === String(selectedHomeAddress?.id) && <Check size={16}/>}</button>) : <p>Add a saved address to select it here.</p>}
            <button className="customer-home-manage-addresses" onClick={() => { setHomeLocationOpen(false); navigatePath('/profile'); }}>Manage saved addresses <ArrowRight size={15}/></button>
          </div>}
        </div>
        {walletInfoOpen && <div className="customer-wallet-popover" role="dialog" aria-label="ETOE Wallet">
          <button className="customer-wallet-close" onClick={() => setWalletInfoOpen(false)} aria-label="Close wallet information"><X size={15}/></button>
          <span><Wallet size={18}/></span><strong>ETOE Wallet</strong>
          <p>Wallet balances and payments are not enabled for this account yet. Your available service rewards are managed separately.</p>
          <button onClick={() => navigatePath('/rewards')}>View rewards <ArrowRight size={15}/></button>
        </div>}
      </> : <>
        <button className="customer-app-brand" onClick={() => navigatePath('/home')} aria-label="ETOE Services home"><img src="/images/etoe-logo.png" alt="ETOE Services"/></button>
        <div className="customer-app-context"><small>JAIPUR, RAJASTHAN</small><strong>{appPageTitle}</strong></div>
        <div className="customer-app-header-actions">
          <button className="customer-app-icon cart-header-icon" onClick={() => navigatePath('/cart')} aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}><ShoppingCart size={19}/>{cartCount > 0 && <span>{cartCount}</span>}</button>
          <button className="customer-app-icon" onClick={() => setNotificationOpen(!notificationOpen)} aria-label={`Notifications${notifications.filter(item => !item.read).length ? `, ${notifications.filter(item => !item.read).length} unread` : ''}`}><Bell size={20}/>{notifications.some(item => !item.read) && <span>{notifications.filter(item => !item.read).length}</span>}</button>
          <button className="customer-app-icon" onClick={() => navigatePath('/profile')} aria-label="Open profile"><UserRound size={20}/></button>
        </div>
      </>}
    </header> : <header className="header">
      <a className="brand" href="/home" aria-label="ETOE Services home" onClick={event => { event.preventDefault(); navigatePath('/home'); }}><img src="/images/etoe-logo.png" alt="ETOE Services logo" /></a>
      <button className="location" onClick={() => notify('Serving Jaipur, Rajasthan')}><MapPin size={16}/><span><small>YOUR LOCATION</small>Jaipur</span><ChevronDown size={14}/></button>
      <nav className={mobileMenu ? 'nav open' : 'nav'}>
        <a href="/home" aria-current={route.page === 'home' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigatePath('/home'); }}>Home</a>
        <a href="/explore" aria-current={route.page === 'explore' || route.page === 'category' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigatePath('/explore'); }}>Explore Services</a>
        <a href="/my-bookings" aria-current={route.page === 'bookings' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigatePath('/my-bookings'); }}>My Bookings</a>
        <a href="/rewards" aria-current={route.page === 'rewards' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigatePath('/rewards'); }}>Rewards</a>
        <a href="/profile" aria-current={route.page === 'profile' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigatePath('/profile'); }}>Profile</a>
        <a href="/support" aria-current={route.page === 'support' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigatePath('/support'); }}>Support</a>
      </nav>
      <div className="header-actions">
        <button className="header-icon" aria-label="Search services" onClick={() => { navigatePath('/explore'); window.setTimeout(() => document.getElementById('service-query')?.focus(), 100); }}><Search size={19}/></button>
        <button className="header-icon cart-header-icon" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} onClick={() => navigatePath('/cart')}><ShoppingCart size={19}/>{cartCount > 0 && <span>{cartCount}</span>}</button>
        <button className="text-button bookings-link" onClick={() => navigatePath('/my-bookings')}>My Bookings</button>
        <button className="text-button login-link" onClick={openLogin}>Login / Signup</button>
        <button className="btn btn-primary header-book" onClick={() => openBooking(serviceList[0])}>Book a Service</button>
        <button className="admin-shortcut" onClick={openAdmin} aria-label="Open admin dashboard" title="Admin dashboard"><ClipboardList size={18}/></button>
      </div>
      <button className="menu-btn" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button>
    </header>}

    {route.page === 'home' && appMode !== 'customer' && renderOfferBanner()}

    {catalogLoading && <div className="catalog-status" role="status">Connecting to the shared service catalogue…</div>}
    {catalogError && <div className="catalog-error" role="alert">The live service catalogue could not be loaded: {catalogError}</div>}

    <main>
      {selectedCategory ? <section className="category-page section">
        <div className="category-breadcrumb"><button onClick={returnHome}>Home</button><span>/</span><span>{selectedCategory.title}</span></div>
        <div className="category-page-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(26,19,14,.82),rgba(26,19,14,.24)),url("${imageUrl(selectedCategory.image, 1500)}")` }}>
          <div className="category-page-copy"><div className="eyebrow"><MapPin size={14}/> TRUSTED SERVICES IN JAIPUR</div><h1>{selectedCategory.title}</h1><p>{selectedCategory.description}</p></div>
        </div>
        <div className="section-heading category-results-heading"><div><div className="eyebrow">EXPLORE THE CATEGORY</div><h2>{selectedCategory.title} services</h2><p>{filtered.length} services available. Choose a subcategory, then select a service.</p></div></div>
        <div className="quick-search category-search" id="service-search"><Search size={20}/><input id="service-query" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${selectedCategory.title.toLowerCase()} services`}/><button className="btn btn-primary" onClick={() => document.getElementById('category-services')?.scrollIntoView({ behavior: 'smooth' })}>Search</button></div>
        <div className="service-toolbar"><span>{filtered.length} matching services</span><label>Sort by<select value={serviceSort} onChange={event => setServiceSort(event.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label></div>
        <div id="category-services">{categoryServiceGroups.map(group => <section className="subcategory-section" key={group.title}>
          <div className="subcategory-heading"><h3>{group.title}</h3><span>{group.services.length} services</span></div>
          <div className="service-grid category-service-grid">{renderServiceCards(group.services)}</div>
        </section>)}
          {ungroupedCategoryServices.length > 0 && <section className="subcategory-section"><div className="subcategory-heading"><h3>Other available services</h3><span>{ungroupedCategoryServices.length} services</span></div><div className="service-grid category-service-grid">{renderServiceCards(ungroupedCategoryServices)}</div></section>}
        </div>
        {filtered.length === 0 && <div className="empty"><Search/><strong>No services found</strong><span>Try another search in {selectedCategory.title}.</span></div>}
        <button className="btn btn-light category-back" onClick={returnHome}><ChevronLeft size={17}/> Browse all categories</button>
      </section> : route.page === 'home' ? appMode === 'customer' ? <section className="customer-home">
        <div className="customer-home-search">
          <label className="customer-home-searchbar">
            <Search size={20}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for a service" aria-label="Search for a service"/>
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17}/></button>}
          </label>
          {query.trim() && <div className="customer-home-suggestions" role="listbox" aria-label="Service suggestions">
            {homeSearchSuggestions.length ? homeSearchSuggestions.map(service => <button key={service.id} role="option" onClick={() => navigatePath(`/service/${encodeURIComponent(service.id)}`)}>
              <img src={imageUrl(service.image, 120)} alt=""/><span><strong>{service.title}</strong><small>{service.category} · from {money(service.price)}</small></span><ChevronRight size={17}/>
            </button>) : <div className="customer-home-no-suggestions">No matching services. <button onClick={() => navigatePath('/explore')}>Explore all services</button></div>}
          </div>}
        </div>
        {renderOfferBanner()}
        <section className="customer-home-categories">
          <div className="customer-home-section-heading"><div><span>MADE FOR YOUR SPACE</span><h2>Explore services</h2></div><button onClick={() => navigatePath('/explore')}>View all <ArrowRight size={15}/></button></div>
          <div className="customer-home-category-grid">
            {[
              { title: 'Housekeeping', categoryId: 'housekeeping', serviceId: 'regular-housekeeping' },
              { title: 'Deep Cleaning', categoryId: 'deep-cleaning', serviceId: 'home' },
              { title: 'Bathroom Cleaning', categoryId: 'deep-cleaning', serviceId: 'bathroom', searchTerm: 'bathroom' },
              { title: 'Kitchen Cleaning', categoryId: 'deep-cleaning', serviceId: 'kitchen', searchTerm: 'kitchen' },
              { title: 'Sofa Cleaning', categoryId: 'deep-cleaning', serviceId: 'sofa', searchTerm: 'sofa' },
              { title: 'Pest Control', categoryId: 'pest-control', serviceId: 'pest' },
              { title: 'AC Services', categoryId: 'technical-maintenance', serviceId: 'ac-services', searchTerm: 'ac' },
              { title: 'Electrical Services', categoryId: 'technical-maintenance', serviceId: 'electrical-services', searchTerm: 'electrical' },
              { title: 'Plumbing', categoryId: 'technical-maintenance', serviceId: 'plumbing', searchTerm: 'plumbing' },
              { title: 'Painting', categoryId: 'technical-maintenance', serviceId: 'general-repairs', searchTerm: 'painting' },
              { title: 'Other Services', categoryId: 'manpower', serviceId: 'facility-staff' }
            ].map(item => {
              const service = serviceList.find(entry => entry.id === item.serviceId);
              const parent = mainCategories.find(entry => entry.id === item.categoryId);
              const categoryRecord = catalogueCategories.find(entry => entry.id === item.categoryId);
              if (categoryRecord && !categoryRecord.active) return null;
              const image = categoryRecord?.image_url || service?.image || parent?.image;
              const Icon = iconMap[service?.icon || parent?.icon] || Sparkles;
              return <button className="customer-home-category" key={item.title} onClick={() => openHomeCategory(item.categoryId, item.searchTerm)} aria-label={`Explore ${item.title}`}>
                <span className="customer-home-category-image"><img src={imageUrl(image, 320)} alt="" loading="lazy"/><i><Icon size={17}/></i></span>
                <strong>{item.title}</strong>
              </button>;
            })}
          </div>
        </section>
        <section className="customer-home-popular">
          <div className="customer-home-section-heading"><div><span>CUSTOMER FAVOURITES</span><h2>Popular services</h2></div><button onClick={() => navigatePath('/explore')}>See all <ArrowRight size={15}/></button></div>
          <div className="customer-home-popular-row">
            {(homePopularServices.length ? homePopularServices : featuredServices).map(service => {
              const rating = homeServiceRatings[service.id];
              const offer = offerForService(service.id);
              return <article className="customer-home-popular-card" key={service.id}>
                <button className="customer-home-popular-image" onClick={() => navigatePath(`/service/${encodeURIComponent(service.id)}`)} aria-label={`View ${service.title}`}>
                  <img src={imageUrl(service.image, 420)} alt={service.title} loading="lazy"/>{service.tag && <span>{service.tag}</span>}
                </button>
                <div className="customer-home-popular-copy">
                  <small>{service.category}</small><strong>{service.title}</strong>
                  <div className="customer-home-service-meta">
                    <span>{rating?.count ? <><Star size={13} fill="currentColor"/>{(rating.total / rating.count).toFixed(1)} <em>({rating.count})</em></> : <><Star size={13}/><em>No ratings yet</em></>}</span>
                    <span><Clock3 size={13}/>Time at booking</span>
                  </div>
                  <div className="customer-home-popular-price"><strong>{offer && service.price > 0 ? money(priceAfterOffer(service, offer)) : money(service.price)}</strong><button onClick={() => addToCart(service)} aria-label={`Add ${service.title} to cart`} disabled={cartBusy}><Plus size={16}/> Add</button></div>
                </div>
              </article>;
            })}
          </div>
        </section>
        <section className="customer-home-spotlight">
          <div className="customer-home-section-heading"><div><span>GOOD THINGS, PICKED FOR YOU</span><h2>In the Spotlight</h2></div><button onClick={() => liveOffers.length ? navigatePath('/home#offers') : navigatePath('/explore')}>Explore <ArrowRight size={15}/></button></div>
          <div className="customer-home-spotlight-row">
            {liveOffers.length ? liveOffers.slice(0, 4).map(offer => {
              const service = serviceList.find(entry => entry.id === offer.serviceId || offer.serviceIds?.includes(entry.id));
              if (!service) return null;
              return <button className="customer-home-spotlight-card" key={offer.id} onClick={() => navigatePath(`/service/${encodeURIComponent(service.id)}`)} style={{ backgroundImage: `linear-gradient(180deg,transparent 15%,rgba(29,20,16,.84)),url("${imageUrl(offer.image, 600)}")` }}>
                <span>{offerSavingsLabel(offer)}</span><strong>{offer.title}</strong><small>{service.title} · ends {expiryLabel(offer.expiryDate)}</small>
              </button>;
            }) : featuredServices.map(service => <button className="customer-home-spotlight-card" key={service.id} onClick={() => navigatePath(`/service/${encodeURIComponent(service.id)}`)} style={{ backgroundImage: `linear-gradient(180deg,transparent 15%,rgba(29,20,16,.84)),url("${imageUrl(service.image, 600)}")` }}>
              <span>{service.tag || 'ETOE favourite'}</span><strong>{service.title}</strong><small>Explore this service</small>
            </button>)}
          </div>
        </section>
        {bookings.length > 0 && <section className="customer-home-recent">
          <div className="customer-home-section-heading"><div><span>YOUR ETOE SERVICES</span><h2>Recently booked</h2></div><button onClick={() => navigatePath('/my-bookings')}>All bookings <ArrowRight size={15}/></button></div>
          <div className="app-recent-bookings">{bookings.slice(0, 3).map(booking => {
            const service = serviceList.find(item => item.title === booking.service);
            return <button className="app-recent-booking" key={booking.id} onClick={() => navigatePath(`/booking/${encodeURIComponent(booking.id)}`)}>
              {service?.image ? <img src={imageUrl(service.image, 240)} alt=""/> : <span><PackageCheck/></span>}
              <span className="app-recent-copy"><strong>{booking.service}</strong><small>{booking.date} · {booking.id}</small><em>{booking.status}</em></span><ChevronRight size={17}/>
            </button>;
          })}</div>
        </section>}
        {favorites.length > 0 && <section className="customer-home-favorites">
          <div className="customer-home-section-heading"><div><span>SAVED FOR LATER</span><h2>Your favourites</h2></div><button onClick={() => navigatePath('/profile')}>Manage <ArrowRight size={15}/></button></div>
          <div className="customer-home-popular-row">{renderServiceCards(serviceList.filter(service => favorites.includes(service.id)))}</div>
        </section>}
      </section> : <>
      <section className="category-section">
        <div className="explore-category-heading">
          <div>
            <div className="eyebrow">EXPLORE SERVICES</div>
            <h2>Explore Our Services</h2>
          </div>
          <button className="text-button see-all" onClick={() => navigatePath('/explore')}>View all services <ArrowRight size={16}/></button>
        </div>
        <div className="explore-category-grid">
          {[
            { id: 'housekeeping', title: 'Housekeeping', description: 'Everyday cleaning and upkeep', Icon: Users, tone: 'peach' },
            { id: 'ifm', title: 'IFM Services', description: 'Facility operations and support', Icon: Building2, tone: 'blue' },
            { id: 'deep-cleaning', title: 'Deep Cleaning', description: 'Detailed, complete cleaning', Icon: Sparkles, tone: 'orange' },
            { id: 'pest-control', title: 'Pest Control', description: 'Safe, expert pest solutions', Icon: Bug, tone: 'green' }
          ].map(item => {
            const category = mainCategories.find(entry => entry.id === item.id);
            if (!category) return null;
            const Icon = item.Icon;
            return <button
              className="explore-category-card"
              key={item.id}
              onClick={() => openCategory(category)}
              aria-label={`Explore ${item.title} services`}
            >
              <span className={`explore-category-icon ${item.tone}`}><Icon strokeWidth={1.7}/></span>
              <span className="explore-category-copy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <span className="explore-category-arrow"><ArrowRight size={17}/></span>
            </button>;
          })}
        </div>
      </section>

      <section className="hero" id="home">
        <div className="hero-content">
          <div className="eyebrow"><Sparkles size={16}/> CARE FOR THE SPACES YOU LOVE</div>
          <h1>Expert Services.<br/><span>Effortless Living.</span></h1>
          <p>Reliable cleaning, maintenance and facility management services delivered by trained professionals.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigatePath('/explore')}>Book a Service <ArrowRight size={18}/></button>
            <button className="btn btn-light" onClick={() => navigatePath('/explore')}>Explore Services</button>
          </div>
          <div className="hero-proof"><span><BadgeCheck/>Verified professionals</span><span><Star/>Loved across Jaipur</span></div>
        </div>
        <div className="hero-photo">
          <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=90" alt="Professional cleaning team caring for a bright modern home"/>
          <div className="photo-caption"><span className="caption-icon"><ShieldCheck/></span><div><strong>Care you can count on</strong><small>Trusted ETOE professionals</small></div><span className="caption-stars">★★★★★</span></div>
          <span className="hero-sticker"><Sparkles/> A cleaner kind of happy</span>
        </div>
      </section>

      <section className="search-wrap" id="service-search">
        <div className="quick-search"><Search size={22}/><input id="service-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="What service are you looking for?"/><button className="btn btn-primary" onClick={() => navigatePath('/explore')}>Find a service</button></div>
      </section>

      <section className="section services-section" id="services">
        <div className="section-heading"><div><div className="eyebrow">THE ETOE EDIT</div><h2>Popular services</h2><p>Thoughtful care, delivered by people who know their craft.</p></div><button className="text-button see-all" onClick={() => setCategory('All Services')}>All services <ArrowRight size={16}/></button></div>
        <div className="filter-row">
          <div className="filter-scroll">{categories.map(item => <button key={item} className={`filter-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
        </div>
        <div className="service-grid">{renderServiceCards(filtered.slice(0, 6))}</div>
        {filtered.length === 0 && <div className="empty"><Search/><strong>No services found</strong><span>Try another search or choose a different category.</span></div>}
      </section>

      {appMode === 'customer' && bookings.length > 0 && <section className="section app-recent-section">
        <div className="section-heading"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Recently booked</h2><p>Your latest service bookings, all in one place.</p></div><button className="text-button see-all" onClick={() => navigatePath('/my-bookings')}>All bookings <ArrowRight size={16}/></button></div>
        <div className="app-recent-bookings">{bookings.slice(0, 3).map(booking => {
          const service = serviceList.find(item => item.title === booking.service);
          return <button className="app-recent-booking" key={booking.id} onClick={() => navigatePath(`/booking/${encodeURIComponent(booking.id)}`)}>
            {service?.image ? <img src={imageUrl(service.image, 240)} alt=""/> : <span><PackageCheck/></span>}
            <span className="app-recent-copy"><strong>{booking.service}</strong><small>{booking.date} · {booking.id}</small><em>{booking.status}</em></span><ChevronRight size={17}/>
          </button>;
        })}</div>
      </section>}

      {appMode === 'customer' && favorites.length > 0 && <section className="section app-favorites-section">
        <div className="section-heading"><div><div className="eyebrow">SAVED FOR LATER</div><h2>Your favourites</h2></div><button className="text-button see-all" onClick={() => navigatePath('/profile')}>Manage <ArrowRight size={16}/></button></div>
        <div className="service-grid">{renderServiceCards(serviceList.filter(service => favorites.includes(service.id)))}</div>
      </section>}

      {liveOffers.length > 0 && <section className="section offers-section" id="offers">
        <div className="section-heading"><div><div className="eyebrow">A LITTLE SOMETHING EXTRA</div><h2>Special Offers for You</h2><p>Good things, for the spaces you love.</p></div><span className="limited-label"><Tag size={15}/> Limited time</span></div>
        <div className="offers-grid">{liveOffers.flatMap(offer => {
          const applicableServices = serviceList.filter(item => offer.serviceId === item.id || offer.serviceIds?.includes(item.id));
          return applicableServices.map(service => <article className="offer-card" key={`${offer.id}-${service.id}`}>
            <button className="offer-card-image" onClick={() => openBooking(service)}><img src={imageUrl(offer.image)} alt={offer.title} loading="lazy"/><span>{offerSavingsLabel(offer)}</span></button>
            <div className="offer-card-info"><div className="offer-card-title"><div><small>{service.category}</small><h3>{service.title}</h3></div><span className="offer-price">{money(priceAfterOffer(service, offer))}</span></div>
              <p>{offer.title}</p><div className="offer-card-meta"><span><CalendarDays size={15}/> Ends {expiryLabel(offer.expiryDate)}</span>{service.price > 0 && <span className="original-price">{money(service.price)}</span>}</div>
              {offer.couponCode && <div className="offer-coupon-code"><TicketCheck size={14}/> Use code <strong>{offer.couponCode}</strong> at checkout</div>}
              <button className="btn btn-primary offer-book" onClick={() => openBooking(service)}>Book this offer <ArrowRight size={17}/></button>
            </div>
          </article>);
        })}</div>
      </section>}

      <section className="section featured-services">
        <div className="section-heading"><div><div className="eyebrow">ETOE FAVOURITES</div><h2>Featured services</h2><p>Popular picks from the services customers book most.</p></div><button className="text-button see-all" onClick={() => navigatePath('/explore')}>Explore all <ArrowRight size={16}/></button></div>
        <div className="service-grid">{renderServiceCards(featuredServices.length ? featuredServices : serviceList.slice(0, 3))}</div>
      </section>

      <section className="trust-section" id="about">
        <div className="trust-intro"><div className="eyebrow">THE ETOE PROMISE</div><h2>Professional care.<br/>Peace of mind.</h2><p>We bring a little more ease to your everyday, with reliable people and service you can count on.</p></div>
        <div className="trust-grid">{[[BadgeCheck,'Verified Professionals','Carefully vetted teams, ready to help.'],[Clock3,'On-Time Service','Your time matters to us.'],[Headset,'24x7 Customer Support','Real help, whenever you need it.'],[Tag,'Transparent Pricing','Know the price before we begin.'],[HeartHandshake,'Satisfaction Guarantee','We care about getting it right.']].map(([Icon, title, description]) => <div className="trust-item" key={title}><span><Icon/></span><div><h3>{title}</h3><p>{description}</p></div></div>)}</div>
      </section>

      <section className="steps-section" id="how">
        <div className="section-heading centered"><div className="eyebrow">SIMPLE FROM THE START</div><h2>A better day, in three easy steps</h2><p>Great service, without the extra effort.</p></div>
        <div className="steps-grid">{[['01','Choose your service','Find the right care for your home or business.'],['02','Pick a time that works','Choose a date and time that suits your day.'],['03','Leave the rest to us','Our team will confirm and keep you updated.']].map(([number, title, description]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>
      <section className="home-booking-cta"><div><div className="eyebrow">YOUR NEXT STEP</div><h2>Ready to make more room for what matters?</h2><p>Choose your service and book a time that works for you.</p></div><button className="btn btn-primary" onClick={() => navigatePath('/explore')}>Browse services <ArrowRight size={18}/></button></section>

      </> : route.page === 'service' ? <section className="section route-page service-detail-page">
        {!detailService ? <div className="empty"><Search/><strong>Service not found</strong><span>Choose an available service to continue.</span><button className="btn btn-primary" onClick={() => navigatePath('/explore')}>Explore services</button></div> : <>
          <div className="category-breadcrumb"><button onClick={() => navigatePath('/explore')}>Explore services</button><span>/</span><button onClick={() => openCategory(mainCategories.find(item => item.title === detailService.category))}>{detailService.category}</button><span>/</span><span>{detailService.title}</span></div>
          <div className="service-detail-hero">
            <img src={imageUrl(detailService.image, 1400)} alt={detailService.title}/>
            <div className="service-detail-copy">
              <span className="eyebrow">{detailService.category}</span><h1>{detailService.title}</h1>
              <div className="service-detail-rating">{averageServiceRating ? <><Star size={16} fill="currentColor"/><strong>{averageServiceRating}</strong><span>({serviceReviews.length} published reviews)</span></> : <span>No published reviews yet</span>}</div>
              <p>{detailService.description}</p>
              <div className="service-detail-price"><small>STARTING AT</small><strong>{money(detailService.price)}</strong>{detailService.price > 0 && <span>Final scope and pricing are confirmed by the ETOE team.</span>}</div>
              <div className="service-detail-actions"><button className="btn btn-primary" onClick={() => openBooking(detailService)}>Book this service <ArrowRight size={17}/></button><button className="btn btn-light" onClick={() => addToCart(detailService)} disabled={cartBusy}><ShoppingCart size={16}/> Add to cart</button></div>
            </div>
          </div>
          <div className="service-detail-columns">
            <article className="booking-detail-card"><span className="eyebrow">ABOUT THIS SERVICE</span><h2>Professional service, thoughtfully delivered</h2><p>{detailService.description}</p><p>Service duration, package options and inclusions are confirmed by ETOE during booking; they are not currently configured in the shared service catalogue.</p></article>
            <article className="booking-detail-card service-review-panel"><span className="eyebrow">CUSTOMER FEEDBACK</span><h2>Reviews</h2>
              {!supabaseConfigured ? <p>Published reviews appear here when the shared backend is connected.</p> : serviceReviews.length === 0 ? <p>No published reviews for this service yet.</p> : serviceReviews.map((review, index) => <div className="service-review-row" key={`${review.created_at}-${index}`}><div><span>{Array.from({ length: 5 }, (_, star) => <Star key={star} size={13} fill={star < review.rating ? 'currentColor' : 'none'}/>)}</span><small>{new Date(review.created_at).toLocaleDateString()}</small></div><p>{review.review || 'Customer rating'}</p></div>)}
            </article>
          </div>
        </>}
      </section> : route.page === 'cart' ? <section className="section route-page cart-page">
        <div className="section-heading"><div><div className="eyebrow">YOUR SELECTION</div><h1>Your cart</h1><p>Review services before choosing a date and time.</p></div></div>
        {!cartServices.length ? <div className="empty"><ShoppingCart/><strong>Your cart is empty</strong><span>Add one or more services to prepare a booking.</span><button className="btn btn-primary" onClick={() => navigatePath('/explore')}>Explore services</button></div> : <div className="cart-layout">
          <div className="cart-lines">{cartServices.map(({ service, serviceId, quantity }) => <article className="cart-line" key={serviceId}><img src={imageUrl(service.image, 320)} alt={service.title}/><div className="cart-line-copy"><small>{service.category}</small><strong>{service.title}</strong><span>{money(service.price)} per service</span></div><div className="cart-line-controls"><button onClick={() => setCartQuantity(serviceId, quantity - 1)} aria-label={`Decrease ${service.title} quantity`} disabled={quantity <= 1}>−</button><strong>{quantity}</strong><button onClick={() => setCartQuantity(serviceId, quantity + 1)} aria-label={`Increase ${service.title} quantity`} disabled={quantity >= 20}>+</button></div><strong className="cart-line-total">{money(service.price * quantity)}</strong><button className="cart-remove" onClick={() => removeCartItem(serviceId)} aria-label={`Remove ${service.title}`}><X size={17}/></button></article>)}</div>
          <aside className="booking-detail-card cart-summary"><span className="eyebrow">PRICE SUMMARY</span><h2>{cartCount} service{cartCount === 1 ? '' : 's'}</h2><div className="checkout-price-row"><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></div>{cartOfferTotal < cartSubtotal && <div className="checkout-price-row discount"><span>Active service offers</span><strong>−{money(cartSubtotal - cartOfferTotal)}</strong></div>}<p>Offer estimates are confirmed against live service prices at booking.</p><div className="checkout-total"><span>Estimated total</span><strong>{money(cartOfferTotal)}</strong></div><button className="btn btn-primary full" onClick={() => navigatePath('/checkout')}>Continue to booking <ArrowRight size={16}/></button><button className="text-button cart-continue" onClick={() => navigatePath('/explore')}>Continue shopping</button></aside>
        </div>}
      </section> : route.page === 'rewards' ? <section className="section route-page rewards-page">
        <div className="section-heading"><div><div className="eyebrow">ETOE LOYALTY</div><h1>Rewards & membership</h1><p>Earn points after completed services. Rewards are credited by the booking system.</p></div></div>
        {!supabaseConfigured ? <div className="backend-notice"><Gift/><div><strong>Rewards need the shared backend</strong><span>Apply the customer marketplace migration and enable loyalty rules in the admin dashboard to use real balances.</span></div></div> : !appSession?.id || appSession.demo ? <div className="empty"><UserRound/><strong>Sign in to view your rewards</strong><span>Your points and membership are linked to your ETOE account.</span><button className="btn btn-primary" onClick={() => openApp('customer')}>Sign in</button></div> : <>
          <div className="rewards-overview">
            <article className="reward-balance-card"><span><Coins size={18}/> AVAILABLE POINTS</span><strong>{rewardAccount?.points_balance ?? '—'}</strong><small>{loyaltySettings?.active ? `${money(loyaltySettings.point_value)} per point at checkout` : 'The loyalty program is not active yet.'}</small>{expiringRewardPoints > 0 && <em>{expiringRewardPoints} points expire within 30 days</em>}</article>
            <article className="booking-detail-card reward-stat"><span className="eyebrow">MEMBERSHIP</span><strong>{rewardAccount?.membership_level || 'Silver'}</strong><small>Based on completed booking spend.</small><button className="text-button profile-link" onClick={() => navigatePath('/referrals')}>Refer a friend <ArrowRight size={15}/></button></article>
            <article className="booking-detail-card reward-stat"><span className="eyebrow">TOTAL EARNED</span><strong>{rewardAccount?.total_points_earned ?? '—'}</strong><small>Points credited after service completion.</small></article>
            <article className="booking-detail-card reward-stat"><span className="eyebrow">TOTAL REDEEMED</span><strong>{rewardAccount?.total_points_redeemed ?? '—'}</strong><small>Applied to confirmed bookings.</small></article>
          </div>
          <article className="booking-detail-card reward-history"><div className="profile-card-heading"><h2>Rewards history</h2><button className="text-button" onClick={() => navigatePath('/referrals')}><Gift size={15}/> Referrals</button></div>
            {rewardTransactions.length ? rewardTransactions.map(transaction => <div className="reward-transaction" key={transaction.id}><span className={transaction.points_delta > 0 ? 'earned' : 'redeemed'}>{transaction.points_delta > 0 ? '+' : ''}{transaction.points_delta}</span><div><strong>{transaction.transaction_type.replaceAll('_', ' ')}</strong><small>{transaction.reason}</small></div><time>{new Date(transaction.created_at).toLocaleDateString()}</time></div>) : <div className="empty compact"><Gift/><strong>No reward activity yet</strong><span>Points are earned only after a successful service completion.</span></div>}
          </article>
        </>}
      </section> : route.page === 'referrals' ? <section className="section route-page referrals-page">
        <div className="section-heading"><div><div className="eyebrow">SHARE THE ETOE EXPERIENCE</div><h1>Refer a friend</h1><p>Referral rewards are credited only after the referred customer completes a qualifying booking.</p></div></div>
        {!supabaseConfigured || !appSession?.id || appSession.demo || !rewardAccount ? <div className="empty"><Gift/><strong>{!supabaseConfigured ? 'Referral accounts need the shared backend' : 'Sign in to get your referral code'}</strong><span>Codes are generated by the database and rewards follow the active admin rules.</span>{supabaseConfigured && <button className="btn btn-primary" onClick={() => openApp('customer')}>Sign in</button>}</div> : <>
          <article className="referral-hero"><span><Gift size={24}/></span><div><small>YOUR PERSONAL REFERRAL CODE</small><strong>{rewardAccount.referral_code}</strong><p>Share your code with a friend. The configured referral reward is issued after their first qualifying service is completed.</p><div className="referral-actions"><button className="btn btn-light" onClick={copyReferralLink}><Copy size={15}/> Copy invite link</button><a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(`Book trusted services with ETOE. Use my referral link: ${referralUrl}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp <ArrowRight size={15}/></a></div></div></article>
          <article className="booking-detail-card reward-history"><h2>Referral history</h2>{referralEntries.length ? referralEntries.map(referral => <div className="reward-transaction" key={referral.id}><span className={referral.status === 'qualified' ? 'earned' : ''}><Users size={15}/></span><div><strong>{referral.status === 'qualified' ? 'Qualified' : referral.status === 'rejected' ? 'Not qualified' : 'Awaiting a completed booking'}</strong><small>Joined {new Date(referral.created_at).toLocaleDateString()}</small></div><time>{referral.qualified_at ? new Date(referral.qualified_at).toLocaleDateString() : 'Pending'}</time></div>) : <div className="empty compact"><Users/><strong>No referrals yet</strong><span>Share your code to see referral activity here.</span></div>}</article>
        </>}
      </section> : route.page === 'checkout' ? <section className="section route-page checkout-page">
        {!checkoutLines.length ? <div className="empty"><Search/><strong>{route.fromCart ? 'Your cart is empty' : 'Service not found'}</strong><span>Add an available service before continuing.</span><button className="btn btn-primary" onClick={() => navigatePath('/explore')}>Explore services</button></div> : <>
          <div className="category-breadcrumb"><button onClick={() => navigatePath('/explore')}>Explore services</button><span>/</span><span>Book a service</span></div>
          <div className="section-heading"><div><div className="eyebrow">YOUR SERVICE, YOUR SCHEDULE</div><h1>Review and book</h1><p>Choose a time and tell us where to meet you.</p></div></div>
          <div className="checkout-layout">
            <form className="booking-form checkout-form" onSubmit={submitBooking}>
              <h2>Booking details</h2>
              <div className="checkout-cart-lines">{checkoutLines.map(item => <div className="checkout-service-summary" key={item.serviceId}><img src={imageUrl(item.service.image, 420)} alt={item.service.title}/><div><small>{item.service.category}{item.quantity > 1 ? ` · Qty ${item.quantity}` : ''}</small><strong>{item.service.title}</strong><span>{item.service.description}</span></div></div>)}</div>
              <label>Your name<input required value={form.customer} onChange={event => setForm({ ...form, customer: event.target.value })} placeholder="Full name"/></label>
              <label>Phone number<input required type="tel" inputMode="numeric" pattern="[0-9]{10}" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="10-digit mobile number"/></label>
              <div className="form-grid"><label>Service date<input type="date" required min={currentDate} value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label><label>Time slot<select required value={form.slot} onChange={event => setForm({ ...form, slot: event.target.value })}><option value="">Select a time</option>{['09:00 AM - 12:00 PM','12:00 PM - 03:00 PM','03:00 PM - 06:00 PM','06:00 PM - 09:00 PM'].map(slot => <option key={slot}>{slot}</option>)}</select></label></div>
              {addresses.length > 0 && <label>Choose a saved address<select value={selectedAddressId} onChange={event => {
                const address = addresses.find(item => String(item.id) === event.target.value);
                setSelectedAddressId(event.target.value);
                if (address) setForm(previous => ({ ...previous, address: formatAddress(address) }));
              }}><option value="">Select saved address</option>{addresses.map(address => <option key={address.id} value={address.id}>{address.label || 'Address'} · {formatAddress(address)}</option>)}</select></label>}
              <label>Service address<textarea required rows="3" value={form.address} onChange={event => { setSelectedAddressId(''); setForm({ ...form, address: event.target.value }); }} placeholder="House / office, street, area, Jaipur"/></label>
              {appMode === 'customer' && <button className="text-button checkout-add-address" type="button" onClick={() => openAddressEditor()}><Plus size={15}/> Save a new address to your profile</button>}
              <label>Instructions <span className="optional">(optional)</span><textarea rows="2" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Landmark or service notes"/></label>
              <label>Coupon code <span className="optional">(optional)</span><input disabled={!supabaseConfigured} value={couponCode} onChange={event => setCouponCode(event.target.value.toUpperCase())} placeholder={supabaseConfigured ? 'Enter an active ETOE offer code' : 'Available when the shared backend is configured'}/></label>
              {loyaltySettings?.active && Number(rewardAccount?.points_balance) > 0 && <label>Redeem reward points <span className="optional">(optional · {rewardAccount.points_balance} available)</span><input type="number" min="0" max={rewardAccount.points_balance} step="1" value={rewardPoints} onChange={event => setRewardPoints(event.target.value)} placeholder="0"/></label>}
              <button className="btn btn-primary full checkout-submit" type="submit">Confirm booking <ArrowRight size={17}/></button>
            </form>
            <aside className="booking-detail-card checkout-summary">
              <span className="eyebrow">PRICE SUMMARY</span><h2>{checkoutLines.length} service{checkoutLines.length === 1 ? '' : 's'}</h2>
              {checkoutLines.map(item => <div className="checkout-price-row" key={item.serviceId}><span>{item.service.title} × {item.quantity}</span><strong>{money(item.service.price * item.quantity)}</strong></div>)}
              <div className="checkout-price-row"><span>Subtotal</span><strong>{money(checkoutSubtotal)}</strong></div>
              {!couponCode.trim() && checkoutOfferTotal < checkoutSubtotal && <div className="checkout-price-row discount"><span>Active service offers</span><strong>−{money(checkoutSubtotal - checkoutOfferTotal)}</strong></div>}
              {couponCode.trim() && <div className="checkout-price-row"><span>Coupon</span><strong>Validated securely at booking</strong></div>}
              {Number(rewardPoints) > 0 && <div className="checkout-price-row discount"><span>Reward points</span><strong>−{money(checkoutRewardDiscount)}</strong></div>}
              <div className="checkout-total"><span>Estimated total</span><strong>{money(Math.max(0, checkoutEstimatedTotal - checkoutRewardDiscount))}</strong></div>
              <p className="checkout-payment-note"><Wallet size={16}/> Coupon eligibility is validated by the booking API. Online payment is not configured; payment status remains pending.</p>
            </aside>
          </div>
        </>}
      </section> : route.page === 'track' ? <>
      <section className="tracking-section section route-page" id="tracking">
        <div className="tracking-page-head">
          <div><div className="eyebrow">MY BOOKINGS</div><h1>Track your service</h1></div>
          <form className="premium-track-form" onSubmit={findBooking}>
            <Search size={16}/>
            <input value={trackId} onChange={event => setTrackId(event.target.value)} placeholder="Enter Booking ID"/>
            <button type="submit">Track</button>
          </form>
        </div>

        {!tracked || tracked.id.toLowerCase() !== route.bookingId?.toLowerCase() ? <div className="booking-history-panel">
          <div className="booking-history-head"><div><span>Track a booking</span><small>Enter the Booking ID from your confirmation</small></div></div>
          <form className="premium-track-form tracking-empty-form" onSubmit={findBooking}>
            <Search size={16}/><input value={trackId} onChange={event => setTrackId(event.target.value)} placeholder="Enter Booking ID"/>
            <button type="submit">Track</button>
          </form>
        </div> : (() => {
          const service = serviceList.find(item => item.title === tracked.service);
          const stages = [
            { status: 'Booking Confirmed', label: 'Booking Confirmed', icon: CalendarDays },
            { status: 'Service Team Assigned', label: 'Team Assigned', icon: Users },
            { status: 'Team Accepted', label: 'Team Accepted', icon: CircleCheck },
            { status: 'Team On The Way', label: 'Team On The Way', icon: MapPin },
            { status: 'Team Arrived at Customer Location', label: 'Team Arrived', icon: MapPin },
            { status: 'Service Started', label: 'Service Started', icon: Clock3 },
            { status: 'Service Completed', label: 'Service Completed', icon: Sparkles }
          ];
          const isPaid = tracked.paymentStatus === 'Paid' || tracked.status === 'Payment Completed';
          const visibleStages = isPaid ? [...stages, { status: 'Payment Completed', label: 'Payment Completed', icon: Wallet }] : stages;
          const effectiveStatus = tracked.status === 'Order Confirmed' ? 'Booking Confirmed' : tracked.status;
          const statusIndex = stages.findIndex(stage => stage.status === effectiveStatus);
          const currentIndex = tracked.status === 'Payment Completed' ? visibleStages.length - 1 : Math.max(statusIndex, 0);
          const progress = tracked.status === 'Payment Completed' || (isPaid && tracked.status === 'Service Completed')
            ? 100
            : Math.round((currentIndex / (visibleStages.length - 1)) * 100);
          return <div className="premium-tracking-layout">
            <div className="premium-booking-summary">
              <div className="premium-progress-head">
                <span><small>CURRENT STATUS</small><strong>{tracked.status === 'Cancelled' ? 'Booking Cancelled' : tracked.status}</strong></span>
                <span className="premium-progress-value">{Math.max(progress, 8)}%</span>
              </div>
              <div className="premium-progress-bar"><span style={{ width: `${tracked.status === 'Cancelled' ? 100 : Math.max(progress, 8)}%` }}/></div>
              {tracked.status === 'Team On The Way' && <div className="arrival-estimate"><Clock3 size={17}/><div><small>ESTIMATED ARRIVAL</small><strong>{tracked.estimatedArrival || tracked.slot?.split(' - ')[0] || 'As scheduled'}</strong></div></div>}

              <div className="premium-timeline">
                {visibleStages.map(({ status, label, icon: Icon }, index) => {
                  const completed = tracked.status === 'Cancelled' ? false : index < currentIndex || (status === 'Payment Completed' && isPaid);
                  const current = tracked.status !== 'Cancelled' && index === currentIndex;
                  const pending = tracked.status === 'Cancelled' ? true : index > currentIndex && !(status === 'Payment Completed' && isPaid);
                  const update = (tracked.history || []).filter(item => item.status === status || (status === 'Service Team Assigned' && item.status === 'Team Assigned')).at(-1);
                  return <div className={`premium-timeline-item ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${pending ? 'pending' : ''}`} key={status}>
                    <div className="premium-timeline-rail"><span className="premium-timeline-icon">{completed ? <Check size={16}/> : <Icon size={16}/>}</span>{index < visibleStages.length - 1 && <i/>}</div>
                    <div className="premium-timeline-content"><strong>{label}</strong><small>{update ? new Date(update.time).toLocaleString() : completed && status === 'Payment Completed' ? 'Paid' : pending ? 'Pending' : 'Status update pending'}</small></div>
                  </div>;
                })}
              </div>
            </div>

            <aside className="premium-booking-details">
              <div className="premium-service-card">
                {service?.image ? <img src={imageUrl(service.image, 500)} alt={tracked.service}/> : <span className="premium-service-placeholder"><Sparkles size={28}/></span>}
                <div><small>SERVICE</small><strong>{tracked.service}</strong><span>{tracked.customer}</span></div>
              </div>
              <div className="premium-detail-row"><span><CalendarDays size={16}/>Booking ID</span><strong>{tracked.id}</strong></div>
              <div className="premium-detail-row"><span><Clock3 size={16}/>Schedule</span><strong>{tracked.date}<small>{tracked.slot}</small></strong></div>
              <div className="premium-detail-row"><span><MapPin size={16}/>Address</span><strong>{tracked.address}</strong></div>
              <div className="premium-detail-row"><span><Users size={16}/>Service team</span><strong>{tracked.team || 'Team assignment pending'}<small>{tracked.team && tracked.team !== 'Not Assigned' ? 'ETOE verified team' : ''}</small></strong></div>
              <div className="premium-payment-row"><div><small>PAYMENT</small><strong>{tracked.paymentStatus || tracked.payment || 'Pending'}</strong></div><div><small>AMOUNT</small><strong>{money(tracked.amount)}</strong></div></div>
              <div className="premium-actions">
                {tracked.status !== 'Cancelled' && tracked.status !== 'Service Completed' && tracked.status !== 'Payment Completed' && <button className="premium-action secondary" onClick={() => openActionDialog('reschedule', tracked.id)}><CalendarDays size={15}/> Reschedule</button>}
                {tracked.status !== 'Cancelled' && !['Service Started','Service Completed','Payment Completed'].includes(tracked.status) && <button className="premium-action danger" onClick={() => cancelBooking(tracked.id)}>Cancel booking</button>}
                {['Service Completed','Payment Completed'].includes(tracked.status) && !tracked.review && <div className="premium-review"><strong>How was your service?</strong><div className="premium-stars">{[1,2,3,4,5].map(rating => <button key={rating} onClick={() => setReviewRating(rating)} aria-label={`${rating} stars`}><Star size={20} fill={rating <= reviewRating ? 'currentColor' : 'none'}/></button>)}</div><textarea rows="2" value={reviewText} onChange={event => setReviewText(event.target.value)} placeholder="Share your experience"/><button className="premium-action" onClick={() => submitReview(tracked.id)}>Submit review</button></div>}
                {tracked.review && <div className="premium-review submitted"><CircleCheck size={18}/><div><strong>Review submitted</strong><small>{tracked.review.rating}/5 stars</small></div></div>}
              </div>
              <a className="premium-support" href="tel:+917597337666"><Headset size={16}/> Need help? Contact support</a>
            </aside>
          </div>;
        })()}
      </section>
      </> : route.page === 'explore' ? <section className="section route-page explore-page">
        <div className="section-heading"><div><div className="eyebrow">EXPLORE SERVICES</div><h1>Find the right service</h1><p>Browse categories, then choose from the services available in each.</p></div></div>
        <div className="quick-search"><Search size={20}/><input id="service-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="What service are you looking for?"/><button className="btn btn-primary">Search</button></div>
        <div className="service-toolbar"><span>{filtered.length} services available</span><label>Sort by<select value={serviceSort} onChange={event => setServiceSort(event.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label></div>
        <div className="explore-category-grid">
          {mainCategories.map(item => {
            const Icon = iconMap[item.icon] || Sparkles;
            return <button className="explore-category-card" key={item.id} onClick={() => openCategory(item)} aria-label={`Explore ${item.title} services`}>
              <span className={`explore-category-icon ${item.id === 'ifm' ? 'blue' : item.id === 'pest-control' ? 'green' : 'orange'}`}><Icon strokeWidth={1.7}/></span>
              <span className="explore-category-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
              <span className="explore-category-arrow"><ArrowRight size={17}/></span>
            </button>;
          })}
        </div>
        <div className="section-heading route-subheading"><div><div className="eyebrow">POPULAR PICKS</div><h2>Services across categories</h2></div></div>
        <div className="service-grid">{renderServiceCards(filtered)}</div>
      </section> : route.page === 'bookings' ? <section className="section route-page bookings-page">
        <div className="section-heading"><div><div className="eyebrow">YOUR ETOE SERVICES</div><h1>My Bookings</h1><p>View your upcoming, active and previous service bookings.</p></div></div>
        <div className="booking-filter-tabs" role="tablist" aria-label="Filter bookings">{['Upcoming', 'Active', 'Completed', 'Cancelled'].map(filter => <button key={filter} role="tab" aria-selected={bookingFilter === filter} className={bookingFilter === filter ? 'active' : ''} onClick={() => setBookingFilter(filter)}>{filter}<span>{bookings.filter(item => {
          if (filter === 'Cancelled') return ['Cancelled', 'Team Rejected'].includes(item.status);
          if (filter === 'Completed') return ['Service Completed', 'Payment Completed'].includes(item.status);
          if (filter === 'Active') return ['Team Accepted', 'Team On The Way', 'Team Arrived at Customer Location', 'Service Started'].includes(item.status);
          return !['Cancelled', 'Team Rejected', 'Service Completed', 'Payment Completed', 'Team Accepted', 'Team On The Way', 'Team Arrived at Customer Location', 'Service Started'].includes(item.status);
        }).length}</span></button>)}</div>
        <div className="booking-list-page">{visibleBookings.length ? visibleBookings.map(booking => <article className="booking-list-card" key={booking.id}>
          <div className="booking-list-card-head"><span className="booking-history-icon"><PackageCheck size={20}/></span><div><strong>{booking.service}</strong><small>{booking.id}</small></div><span className="booking-history-status">{booking.status}</span></div>
          <div className="booking-list-meta"><span><CalendarDays size={15}/>{booking.date}</span><span><Clock3 size={15}/>{booking.slot}</span><strong>{money(booking.amount)}</strong></div>
          <div className="booking-list-actions"><button className="btn btn-light" onClick={() => { setTracked(booking); navigatePath(`/booking/${encodeURIComponent(booking.id)}`); }}>View Details</button><button className="btn btn-primary" onClick={() => { setTracked(booking); setTrackId(booking.id); navigatePath(`/booking/${encodeURIComponent(booking.id)}/track`); }}>Track Booking</button></div>
        </article>) : <div className="empty"><PackageCheck/><strong>No {bookingFilter.toLowerCase()} bookings</strong><span>Bookings in this category will appear here.</span></div>}</div>
      </section> : route.page === 'booking' ? <section className="section route-page booking-detail-page">
        <div className="category-breadcrumb"><button onClick={() => navigatePath('/my-bookings')}>My Bookings</button><span>/</span><span>Booking details</span></div>
        {!bookingForRoute ? <div className="empty"><Search/><strong>Booking not found</strong><span>Check the Booking ID or return to your bookings.</span><button className="btn btn-light" onClick={() => navigatePath('/my-bookings')}>My Bookings</button></div> : <>
          <div className="section-heading"><div><div className="eyebrow">BOOKING DETAILS</div><h1>{bookingForRoute.service}</h1><p>Booking ID · {bookingForRoute.id}</p></div><span className="booking-history-status">{bookingForRoute.status}</span></div>
          <div className="booking-detail-layout">
            <article className="booking-detail-card">
              <div className="premium-detail-row"><span><CalendarDays size={16}/>Booking date</span><strong>{bookingForRoute.date}<small>{bookingForRoute.slot}</small></strong></div>
              <div className="premium-detail-row"><span><MapPin size={16}/>Service address</span><strong>{bookingForRoute.address}</strong></div>
              <div className="premium-detail-row"><span><Users size={16}/>Assigned team</span><strong>{bookingForRoute.team || 'Team assignment pending'}</strong></div>
              <div className="premium-payment-row"><div><small>PAYMENT</small><strong>{bookingForRoute.paymentStatus || bookingForRoute.payment || 'Pending'}</strong></div><div><small>AMOUNT</small><strong>{money(bookingForRoute.amount)}</strong></div></div>
              <div className="booking-list-actions">
                <button className="btn btn-light" onClick={() => { setTracked(bookingForRoute); setTrackId(bookingForRoute.id); navigatePath(`/booking/${encodeURIComponent(bookingForRoute.id)}/track`); }}>Track Booking</button>
                {bookingForRoute.status !== 'Cancelled' && bookingForRoute.status !== 'Service Completed' && <button className="btn btn-light" onClick={() => { setTracked(bookingForRoute); openActionDialog('reschedule', bookingForRoute.id); }}>Reschedule</button>}
                {bookingForRoute.status !== 'Cancelled' && !['Service Started','Service Completed','Payment Completed'].includes(bookingForRoute.status) && <button className="btn btn-light" onClick={() => { setTracked(bookingForRoute); cancelBooking(bookingForRoute.id); }}>Cancel booking</button>}
              </div>
            </article>
            <aside className="booking-detail-card booking-detail-service"><span className="eyebrow">SERVICE</span><h2>{bookingForRoute.service}</h2><p>{serviceList.find(item => item.title === bookingForRoute.service)?.description || 'ETOE professional service'}</p><a className="premium-support" href="tel:+917597337666"><Headset size={16}/> Contact support</a></aside>
          </div>
        </>}
      </section> : route.page === 'profile' ? <section className="section route-page profile-page">
        <div className="section-heading"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>Profile</h1><p>Personal details, saved service addresses and preferences.</p></div></div>
        <div className="profile-grid">
          <article className="booking-detail-card"><span className="profile-avatar"><UserRound size={25}/></span><h2>{appSession?.fullName || bookings[0]?.customer || 'ETOE Customer'}</h2><p>{appSession?.email || 'Sign in to manage your account details.'}</p>{appSession?.phone && <p>{appSession.phone}</p>}{appSession?.demo ? <small className="profile-demo-note">Demo account · stored on this device</small> : null}<button className="btn btn-light" onClick={() => appSession ? setAppAuthOpen(true) : openApp('customer')}>{appSession ? 'Account settings' : 'Login / Sign up'}</button></article>
          <article className="booking-detail-card profile-address-card"><div className="profile-card-heading"><h2>Saved addresses</h2><button className="text-button" onClick={() => openAddressEditor()}><Plus size={15}/> Add</button></div>{addresses.length ? addresses.map(address => <div className="profile-address" key={address.id}><MapPin size={16}/><span><strong>{address.label || 'Address'}</strong><small>{formatAddress(address)}</small></span><span className="profile-address-actions"><button onClick={() => openAddressEditor(address)}>Edit</button><button onClick={() => removeAddress(address)}>Remove</button></span></div>) : <p>Save an address to speed up your next booking.</p>}</article>
          <article className="booking-detail-card"><h2>Preferences</h2><label className="profile-toggle"><input type="checkbox" checked={soundEnabled} onChange={event => setSoundEnabled(event.target.checked)}/> Booking notification sounds</label><button className="btn btn-light profile-notification-button" onClick={requestNotificationPermission}><Bell size={16}/> Enable browser notifications</button><small className="profile-demo-note">Background push delivery requires a configured push service.</small><button className="text-button profile-link" onClick={() => navigatePath('/my-bookings')}>Booking history <ArrowRight size={16}/></button><button className="text-button profile-link" onClick={() => navigatePath('/rewards')}>Rewards & membership <Gift size={16}/></button><button className="text-button profile-link" onClick={() => navigatePath('/referrals')}>Referral program <Users size={16}/></button><button className="text-button profile-link" onClick={() => navigatePath('/cart')}>Shopping cart <ShoppingCart size={16}/></button></article>
          {favorites.length > 0 && <article className="booking-detail-card profile-favorites"><h2>Favourite services</h2>{serviceList.filter(service => favorites.includes(service.id)).map(service => <div className="profile-favorite" key={service.id}><span><Heart size={16} fill="currentColor"/></span><strong>{service.title}</strong><button onClick={() => openBooking(service)}>Book <ArrowRight size={14}/></button></div>)}</article>}
        </div>
      </section> : route.page === 'support' ? <section className="section route-page support-page">
        <div className="section-heading"><div><div className="eyebrow">WE’RE HERE TO HELP</div><h1>Customer Support</h1><p>Get help with a booking, service or payment.</p></div></div>
        <div className="support-grid">
          <article className="booking-detail-card"><h2>Frequently asked questions</h2>{[['How do I track a booking?', 'Open My Bookings, choose a booking, then select Track Booking.'], ['Can I change my appointment?', 'Open your booking details and choose Reschedule where available.'], ['How do I contact my service team?', 'Use the customer support phone option on your booking details or tracking page.'], ['When is payment due?', 'Your booking details show the current payment status and amount.']].map(([question, answer]) => <details className="support-faq" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</article>
          <article className="booking-detail-card"><h2>Contact or register a complaint</h2><p>Complete the details below to prepare a support email to our Jaipur team.</p><form className="support-form" onSubmit={submitSupportRequest}>
            <label>Your name<input required value={supportForm.name} onChange={event => setSupportForm({ ...supportForm, name: event.target.value })}/></label>
            <label>Phone number<input required type="tel" pattern="[0-9]{10}" value={supportForm.phone} onChange={event => setSupportForm({ ...supportForm, phone: event.target.value })}/></label>
            <label>Booking ID <span className="optional">(optional)</span><input value={supportForm.bookingId} onChange={event => setSupportForm({ ...supportForm, bookingId: event.target.value })}/></label>
            <label>How can we help?<textarea required rows="4" value={supportForm.message} onChange={event => setSupportForm({ ...supportForm, message: event.target.value })}/></label>
            <button className="btn btn-primary" type="submit"><Headset size={17}/> {supabaseConfigured ? 'Submit support ticket' : 'Prepare support email'}</button>
          </form><div className="support-actions"><a className="btn btn-light" href="tel:+917597337666"><Phone size={17}/> Call support</a><button className="text-button profile-link" onClick={() => navigatePath('/my-bookings')}>Get help with a booking <ArrowRight size={16}/></button></div>
          {supabaseConfigured && appSession?.id && !appSession.demo && <div className="support-ticket-list"><h3>Your support requests</h3>{supportTickets.length ? supportTickets.map(ticket => <article key={ticket.id}><span className="ticket-status">{ticket.status.replace('_', ' ')}</span><strong>{ticket.subject}</strong><small>{ticket.booking_id ? 'Linked to a booking' : 'General inquiry'} · {new Date(ticket.created_at).toLocaleDateString()}</small><p>{ticket.message.split('\n').slice(-1)[0]}</p></article>) : <small>No support requests yet.</small>}</div>}
        </article>
        </div>
      </section> : <section className="section route-page"><div className="empty"><Search/><strong>Page not found</strong><button className="btn btn-primary" onClick={() => navigatePath('/home')}>Go to Home</button></div></section>}
    </main>

    {(!appMode || appMode === 'customer') && <nav className={`mobile-bottom-nav ${appMode === 'customer' ? 'customer-app-bottom-nav' : ''}`} aria-label="Customer navigation">
      {appMode === 'customer' ? <>
        <button className={route.page === 'home' ? 'active' : ''} onClick={() => navigatePath('/home')}><Home size={19}/>Home</button>
        <button className={route.page === 'rewards' || route.page === 'referrals' ? 'active' : ''} onClick={() => navigatePath('/rewards')}><Gift size={19}/>Rewards</button>
        <button className={['bookings','booking','track'].includes(route.page) ? 'active' : ''} onClick={() => navigatePath('/my-bookings')}><ClipboardList size={19}/>My Bookings</button>
        <button className={route.page === 'profile' ? 'active' : ''} onClick={() => navigatePath('/profile')}><UserRound size={19}/>Account</button>
      </> : <>
        <button className={route.page === 'home' ? 'active' : ''} onClick={() => navigatePath('/home')}><Home size={18}/>Home</button>
        <button className={route.page === 'explore' || route.page === 'category' || route.page === 'service' ? 'active' : ''} onClick={() => navigatePath('/explore')}><Search size={18}/>Categories</button>
        <button className={['bookings','booking','track'].includes(route.page) ? 'active' : ''} onClick={() => navigatePath('/my-bookings')}><ClipboardList size={18}/>Bookings</button>
        <button className={route.page === 'rewards' || route.page === 'referrals' ? 'active' : ''} onClick={() => navigatePath('/rewards')}><Gift size={18}/>Rewards</button>
        <button className={route.page === 'profile' ? 'active' : ''} onClick={() => navigatePath('/profile')}><UserRound size={18}/>Account</button>
      </>}
    </nav>}
    {!appMode && <><footer className="footer"><div className="footer-brand"><img src="/images/etoe-logo.png" alt="ETOE Services"/><p>Professional care for homes and businesses in Jaipur.</p></div><div className="footer-links">
      <a href="/explore" onClick={event => { event.preventDefault(); navigatePath('/explore'); }}>Explore Services</a>
      <a href="/home#offers" onClick={event => { event.preventDefault(); navigatePath('/home#offers'); }}>Offers</a>
      <a href="/my-bookings" onClick={event => { event.preventDefault(); navigatePath('/my-bookings'); }}>My Bookings</a>
      <a href="/support" onClick={event => { event.preventDefault(); navigatePath('/support'); }}>Support</a>
      <button onClick={openAdmin}>Admin</button>
    </div><small>© {new Date().getFullYear()} ETOE Services. All rights reserved.</small></footer>
    <div className="app-launcher" aria-label="Open ETOE applications">
      <button onClick={() => openApp('customer')}><Smartphone/>Customer App</button>
      <button onClick={() => openApp('team')}><BriefcaseBusiness/>Team App</button>
    </div></>}

    {appMode === 'customer' && appAuthOpen && appSession && <div className="customer-app-popover" onClick={() => setAppAuthOpen(false)}><div onClick={event => event.stopPropagation()}><button className="customer-app-popover-close" onClick={() => setAppAuthOpen(false)} aria-label="Close account menu"><X size={17}/></button><span className="profile-avatar"><UserRound size={22}/></span><strong>{appSession.fullName || appSession.email || 'ETOE Account'}</strong><small>{appSession.demo ? 'Demo account · this device only' : appSession.role || 'Customer account'}</small><button className="btn btn-light" onClick={() => { setAppAuthOpen(false); navigatePath('/profile'); }}>View profile</button><button className="customer-app-signout" onClick={logoutApp}><LogOut size={15}/> Sign out</button></div></div>}
    {appMode === 'customer' && notificationOpen && <div className="customer-app-notifications" onClick={() => setNotificationOpen(false)}><section onClick={event => event.stopPropagation()}><div className="customer-app-notification-head"><div><small>ETOE UPDATES</small><strong>Notifications</strong></div><button onClick={markAllNotificationsRead} disabled={!notifications.some(item => !item.read)}>Mark all read</button></div>{notifications.length === 0 ? <div className="customer-app-notification-empty"><Bell size={22}/><strong>You’re all caught up</strong><span>Booking and service updates will appear here.</span></div> : notifications.slice(0, 20).map(item => <button className={`customer-app-notification ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => openNotification(item)}><span className="customer-app-notification-icon">{item.type === 'new_booking' ? <PackageCheck size={18}/> : <Bell size={18}/>}</span><span className="customer-app-notification-copy"><strong>{item.title}</strong><small>{item.message}</small><time>{new Date(item.createdAt).toLocaleString()}</time></span>{!item.read && <i/>}</button>)}</section></div>}

    {addressEditor && <div className="modal-backdrop" onClick={() => setAddressEditor(null)}><div className="modal address-editor-modal" role="dialog" aria-modal="true" aria-labelledby="address-editor-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">CUSTOMER PROFILE</div><h2 id="address-editor-title">{addressEditor.id ? 'Edit saved address' : 'Add a saved address'}</h2></div><button className="icon-btn" onClick={() => setAddressEditor(null)} aria-label="Close address editor"><X/></button></div><form className="booking-form" onSubmit={saveAddress}><label>Address label<select value={addressForm.label} onChange={event => setAddressForm({ ...addressForm, label: event.target.value })}>{['Home','Office','Other'].map(label => <option key={label}>{label}</option>)}</select></label><label>Street address<input required value={addressForm.address} onChange={event => setAddressForm({ ...addressForm, address: event.target.value })} placeholder="House / office, street, area"/></label><label>Landmark <span className="optional">(optional)</span><input value={addressForm.landmark} onChange={event => setAddressForm({ ...addressForm, landmark: event.target.value })} placeholder="Nearby landmark"/></label><div className="form-grid"><label>City<input required value={addressForm.city} onChange={event => setAddressForm({ ...addressForm, city: event.target.value })}/></label><label>Postal code<input value={addressForm.postal_code} onChange={event => setAddressForm({ ...addressForm, postal_code: event.target.value })} inputMode="numeric"/></label></div><button className="btn btn-primary full" type="submit">{addressEditor.id ? 'Save changes' : 'Save address'}</button></form></div></div>}

    {bookingOpen && <div className="modal-backdrop" onClick={() => setBookingOpen(false)}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">A FEW DETAILS, THEN WE’RE ON IT</div><h2>{selected?.title}</h2></div><button className="icon-btn" onClick={() => setBookingOpen(false)} aria-label="Close booking"><X/></button></div><form onSubmit={submitBooking} className="booking-form">
      <div className="form-grid"><label>Full name<input required value={form.customer} onChange={event => setForm({ ...form, customer: event.target.value })} placeholder="Your name"/></label><label>Phone number<input required type="tel" pattern="[0-9]{10}" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="10-digit mobile"/></label><label>Preferred date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label><label>Time slot<select required value={form.slot} onChange={event => setForm({ ...form, slot: event.target.value })}><option value="">Choose a time</option><option>09:00 AM - 11:00 AM</option><option>11:00 AM - 01:00 PM</option><option>01:00 PM - 03:00 PM</option><option>03:00 PM - 05:00 PM</option><option>05:00 PM - 07:00 PM</option></select></label></div>
      {addresses.length > 0 && <label>Choose a saved address<select value={selectedAddressId} onChange={event => { const address = addresses.find(item => String(item.id) === event.target.value); setSelectedAddressId(event.target.value); if (address) setForm(previous => ({ ...previous, address: formatAddress(address) })); }}><option value="">Select saved address</option>{addresses.map(address => <option key={address.id} value={address.id}>{address.label || 'Address'} · {formatAddress(address)}</option>)}</select></label>}
      <label>Service address<textarea required rows="2" value={form.address} onChange={event => { setSelectedAddressId(''); setForm({ ...form, address: event.target.value }); }} placeholder="Complete address, landmark, Jaipur"/></label><label>Anything else we should know? <span className="optional">(optional)</span><textarea rows="2" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Share any special instructions"/></label>
      <div className="price-summary"><span>Estimated service price</span><strong>{offerForService(selected?.id) && selected?.price > 0 && <del>{money(selected.price)}</del>} {money(selected ? discountedPrice(selected) : 0)}</strong></div><button className="btn btn-primary full" type="submit">Confirm booking <ArrowRight size={18}/></button><small className="demo-note">{supabaseConfigured ? 'Online bookings will be enabled after secure sign-in and booking APIs are connected.' : 'Demo only: this booking is saved in this browser and is not sent to ETOE.'}</small>
    </form></div></div>}

    {actionDialog && <div className="modal-backdrop" onClick={() => setActionDialog(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">ETOE SERVICES · ORDER ACTION</div><h2 id="action-dialog-title">{{
      'admin-reject': 'Reject booking',
      'team-reject': 'Reject assigned order',
      reschedule: 'Reschedule booking',
      'assign-team': 'Assign service team'
    }[actionDialog.action]}</h2></div><button className="icon-btn" type="button" onClick={() => setActionDialog(null)} aria-label="Close dialog"><X/></button></div><form className="booking-form" onSubmit={submitActionDialog}>
      <label>{actionDialog.action === 'reschedule' ? 'New preferred date' : actionDialog.action === 'assign-team' ? (supabaseConfigured ? 'Team UUID' : 'Team name') : 'Reason'}<input autoFocus required type={actionDialog.action === 'reschedule' ? 'date' : 'text'} min={actionDialog.action === 'reschedule' ? new Date().toISOString().slice(0, 10) : undefined} value={actionValue} onChange={event => setActionValue(event.target.value)} placeholder={actionDialog.action === 'assign-team' ? 'Enter the service team' : 'Enter a reason'}/></label>
      <button className="btn btn-primary full" type="submit">{actionDialog.action === 'admin-reject' || actionDialog.action === 'team-reject' ? 'Reject order' : actionDialog.action === 'reschedule' ? 'Save new date' : 'Assign team'}</button>
    </form></div></div>}

    {adminOpen && <div className="admin-overlay"><div className="admin-panel"><div className="admin-head"><div><div className="eyebrow">ETOE SERVICES · ADMIN</div><h2>Operations dashboard</h2></div><div className="admin-head-actions"><button className="notification-bell" onClick={() => setNotificationOpen(!notificationOpen)} aria-label="Open notifications"><Bell/><span>{notifications.filter(item => !item.read).length}</span></button><button className="icon-btn" onClick={() => setSoundEnabled(!soundEnabled)} aria-label={`${soundEnabled ? 'Mute' : 'Enable'} notification sound`}>{soundEnabled ? <Volume2/> : <Bell/>}</button><button className="icon-btn" onClick={() => setAdminOpen(false)} aria-label="Close dashboard"><X/></button></div></div>
      {notificationOpen && <div className="admin-notification-panel"><div className="admin-notification-head"><strong>Notifications</strong><button onClick={requestNotificationPermission}>Enable push</button><button onClick={() => setNotifications(previous => previous.map(item => ({ ...item, read: true })))}>Mark all read</button></div>{notifications.length === 0 ? <div className="admin-notification-empty">No new notifications</div> : notifications.slice(0, 12).map(item => <button className={`admin-notification-item ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => { markNotificationRead(item.id); setNotificationOpen(false); if (item.bookingId) { setTrackId(item.bookingId); const booking = bookings.find(entry => entry.id === item.bookingId); if (booking) setTracked(booking); } }}><span>{item.type === 'new_booking' ? <PackageCheck/> : <Bell/>}</span><div><strong>{item.title}</strong><small>{item.message}</small><time>{new Date(item.createdAt).toLocaleString()}</time></div></button>)}</div>}
      <div className="admin-stats"><div><small>Total bookings</small><strong>{bookings.length}</strong></div><div><small>In progress</small><strong>{bookings.filter(booking => booking.status !== 'Service Completed').length}</strong></div><div><small>Live offers</small><strong>{liveOffers.length}</strong></div><div><small>Services</small><strong>{serviceList.length}</strong></div></div>
      <div className="admin-tabs">{['Bookings', 'Order Center', 'Customers', 'Categories', 'Services', 'Offers', 'Rewards', 'Support', 'Chatbot'].map(tab => <button key={tab} className={adminTab === tab ? 'active' : ''} onClick={() => { setAdminTab(tab); if (tab === 'Categories') loadAdminCategories(); if (tab === 'Offers') loadAdminOffers(); }}>{tab === 'Order Center' ? `Order Center (${bookings.filter(b => b.adminStatus === 'Pending Admin Confirmation').length})` : tab}</button>)}</div>
      {adminTab === 'Bookings' && <><div className="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Service</th><th>Assign team</th><th>Status update</th></tr></thead><tbody>{bookings.map(booking => <tr key={booking.id}><td><strong>{booking.id}</strong><small>{booking.date} · {booking.slot}</small></td><td>{booking.customer}<small>{booking.phone}</small></td><td>{booking.service}<small>{money(booking.amount)}</small></td><td><input className="team-input" aria-label={`Tracking team for ${booking.id}`} value={booking.team || ''} onChange={event => updateTeam(booking.id, event.target.value)} placeholder="Assign team"/><small>{booking.address}</small></td><td><select value={booking.status} onChange={event => updateStatus(booking.id, event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div><div className="admin-note"><Activity size={16}/> Tracking status and team assignments are entered manually.</div></>}
      {adminTab === 'Order Center' && <div className="order-center">
        <div className="order-center-counters">{[
          ['New / Pending', bookings.filter(b => b.adminStatus === 'Pending Admin Confirmation').length],
          ['Confirmed', bookings.filter(b => b.adminStatus === 'Confirmed').length],
          ['Awaiting Team', bookings.filter(b => b.acceptanceStatus === 'Awaiting Team Acceptance').length],
          ['Accepted', bookings.filter(b => b.acceptanceStatus === 'Accepted').length],
          ['Active', bookings.filter(b => ['Team Accepted','Team On The Way','Team Arrived at Customer Location','Service Started'].includes(b.status)).length],
          ['Rejected / Timeout', bookings.filter(b => b.adminStatus === 'Rejected' || b.acceptanceStatus === 'Rejected' || b.acceptanceStatus === 'Acceptance Timeout').length]
        ].map(([label, count]) => <div key={label}><small>{label}</small><strong>{count}</strong></div>)}</div>
        <div className="order-center-list">{bookings.map(booking => <article className="order-center-card" key={booking.id}>
          <div className="order-center-main"><span className="order-center-icon"><PackageCheck/></span><div><strong>{booking.service}</strong><small>{booking.id}</small></div><span className={`order-state ${booking.adminStatus === 'Rejected' ? 'rejected' : ''}`}>{booking.acceptanceStatus === 'Accepted' ? 'Accepted' : booking.acceptanceStatus === 'Awaiting Team Acceptance' ? 'Awaiting Team Acceptance' : booking.adminStatus}</span></div>
          <div className="order-center-details"><span><strong>Customer</strong>{booking.customer} · {booking.phone}</span><span><strong>Schedule</strong>{booking.date} · {booking.slot}</span><span><strong>Address</strong>{booking.address}</span><span><strong>Amount</strong>{money(booking.amount)} · {booking.paymentStatus || booking.payment || 'Pending'}</span></div>
          {booking.rejectionReason && <div className="order-center-rejection">Rejection: {booking.rejectionReason}</div>}
          <div className="order-center-actions">
            {booking.adminStatus === 'Pending Admin Confirmation' && <><button className="btn btn-primary" onClick={() => adminConfirmBooking(booking.id)}>Confirm Order</button><button className="btn btn-light order-reject" onClick={() => openActionDialog('admin-reject', booking.id)}>Reject Order</button></>}
            {booking.acceptanceStatus === 'Not Assigned' || booking.acceptanceStatus === 'Rejected' || booking.acceptanceStatus === 'Acceptance Timeout' ? <button className="btn btn-primary" onClick={() => openActionDialog('assign-team', booking.id)}>Assign Team</button> : null}
            <button className="btn btn-light" onClick={() => { setTrackId(booking.id); setTracked(booking); setNotificationOpen(false); }}>View Details</button>
          </div>
        </article>)}</div>
      </div>}
      {adminTab === 'Customers' && <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Bookings</th><th>Most recent service</th><th>Latest address</th></tr></thead><tbody>{[...new Map(bookings.map(booking => [booking.phone, booking])).values()].map(customer => <tr key={customer.phone}><td><strong>{customer.customer}</strong></td><td>{customer.phone}</td><td>{bookings.filter(booking => booking.phone === customer.phone).length}</td><td>{customer.service}</td><td>{customer.address}</td></tr>)}</tbody></table></div>}
      {adminTab === 'Categories' && <div className="admin-services"><h3>Home service categories</h3><p>Choose which categories are visible in the customer app. Live visibility changes are saved to the shared catalogue.</p>{catalogueCategories.map(category => <div className="admin-category-row" key={category.id}><span><strong>{category.title}</strong><small>{category.description}</small></span><button className={`toggle ${category.active ? 'on' : ''}`} onClick={() => setCategoryActive(category, !category.active)} aria-label={`${category.active ? 'Hide' : 'Show'} ${category.title} category`}><span/></button></div>)}</div>}
      {adminTab === 'Services' && <div className="admin-services"><h3>Service catalogue & pricing</h3><p>Update starting prices and choose which services appear in popular sections.</p>{serviceList.map(service => <div className="admin-service-row" key={service.id}><span>{service.title}<small>{service.category}</small></span><div className="admin-price"><span>₹</span><input aria-label={`${service.title} price`} type="number" min="0" value={service.price} onChange={event => setServiceList(previous => previous.map(item => item.id === service.id ? { ...item, price: Number(event.target.value) } : item))}/></div><button className={`toggle ${isFeaturedService(service) ? 'on' : ''}`} onClick={() => toggleFeaturedService(service)} aria-label={`${isFeaturedService(service) ? 'Remove' : 'Feature'} ${service.title} in popular services`}><span/></button></div>)}</div>}
      {adminTab === 'Offers' && <div className="admin-offers"><div className="offer-form-wrap"><h3>Create an offer</h3><p>Offer cards and homepage promotions update as soon as you save.</p><form className="offer-form" onSubmit={saveOffer}>
        <label>Offer title<input required value={offerForm.title} onChange={event => setOfferForm({ ...offerForm, title: event.target.value })} placeholder="e.g. A brighter home for less"/></label>
        <label>Description<textarea required rows="2" value={offerForm.description} onChange={event => setOfferForm({ ...offerForm, description: event.target.value })} placeholder="Tell customers what makes this offer special"/></label>
        <div className="form-grid"><label>Discount (%)<input required type="number" min="1" max="90" value={offerForm.discount} onChange={event => setOfferForm({ ...offerForm, discount: event.target.value })}/></label><label>Service<select value={offerForm.serviceId} onChange={event => setOfferForm({ ...offerForm, serviceId: event.target.value })}>{serviceList.map(service => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label><label>Start date<input required type="date" value={offerForm.startDate} onChange={event => setOfferForm({ ...offerForm, startDate: event.target.value })}/></label><label>Expiry date<input required type="date" min={offerForm.startDate} value={offerForm.expiryDate} onChange={event => setOfferForm({ ...offerForm, expiryDate: event.target.value })}/></label></div>
        <label className="upload-field"><Upload size={17}/><span>{offerForm.image ? 'Offer image ready' : 'Upload promotional image'}</span><input type="file" accept="image/*" onChange={handleOfferImage}/></label>{offerForm.image && <img className="offer-preview" src={offerForm.image} alt="Offer image preview"/>}
        <button className="btn btn-primary" type="submit"><Plus size={17}/> Create offer</button>
      </form></div><div className="offer-admin-list"><h3>Manage offers & banners</h3>{offers.map(offer => <article className="admin-offer-row" key={offer.id}><img src={imageUrl(offer.image, 240)} alt=""/><div className="admin-offer-details"><label>Title<input aria-label={`Offer title ${offer.id}`} value={offer.title} onChange={event => setOffers(previous => previous.map(item => item.id === offer.id ? { ...item, title: event.target.value } : item))}/></label><div className="offer-edit-fields"><label>Discount %<input aria-label={`Offer discount ${offer.id}`} type="number" min="1" max="90" value={offer.discount} onChange={event => setOffers(previous => previous.map(item => item.id === offer.id ? { ...item, discount: Number(event.target.value) } : item))}/></label><label>Expiry<input aria-label={`Offer expiry ${offer.id}`} type="date" value={offer.expiryDate} onChange={event => setOffers(previous => previous.map(item => item.id === offer.id ? { ...item, expiryDate: event.target.value } : item))}/></label></div><label className="admin-image-upload"><Upload size={13}/> Replace image<input type="file" accept="image/*" onChange={event => updateOfferImage(event, offer.id)}/></label><small>{isOfferLive(offer, currentDate) ? 'Active now' : offer.active ? 'Scheduled or expired' : 'Inactive'}</small><button className="btn btn-light admin-offer-save" onClick={() => saveOfferEdits(offer)}>Save changes</button></div><button className={`toggle ${offer.active ? 'on' : ''}`} onClick={() => toggleOfferActive(offer)} aria-label={`${offer.active ? 'Deactivate' : 'Activate'} ${offer.title}`}><span/></button></article>)}</div></div>}
      {adminTab === 'Rewards' && (!supabaseConfigured || !['owner', 'admin'].includes(appSession?.role)) && <div className="backend-notice"><Gift/><div><strong>Rewards administration requires a live owner/admin session</strong><span>Apply the customer marketplace migration, then sign in with an owner or admin account in this browser.</span></div></div>}
      {adminTab === 'Rewards' && supabaseConfigured && ['owner', 'admin'].includes(appSession?.role) && <div className="admin-rewards">
        <div className="admin-rewards-heading"><div><h3>Loyalty rules</h3><p>Rules are disabled by default; configure values before activation.</p></div><button className="btn btn-light" onClick={exportRewardReport}><Upload size={15}/> Export balances</button></div>
        <form className="loyalty-settings-form" onSubmit={saveLoyaltySettings}>
          <label className="profile-toggle"><input type="checkbox" checked={Boolean(loyaltyForm.active)} onChange={event => setLoyaltyForm({ ...loyaltyForm, active: event.target.checked })}/> Activate points and referral rewards</label>
          <div className="form-grid">
            <label>Points per ₹100 spent<input type="number" min="0" step="0.1" value={loyaltyForm.points_per_100 ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, points_per_100: event.target.value })}/></label>
            <label>₹ value per point<input type="number" min="0" step="0.01" value={loyaltyForm.point_value ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, point_value: event.target.value })}/></label>
            <label>First completed booking bonus<input type="number" min="0" step="1" value={loyaltyForm.first_booking_bonus ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, first_booking_bonus: event.target.value })}/></label>
            <label>Referrer bonus points<input type="number" min="0" step="1" value={loyaltyForm.referral_referrer_bonus ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, referral_referrer_bonus: event.target.value })}/></label>
            <label>Referred customer bonus points<input type="number" min="0" step="1" value={loyaltyForm.referral_customer_bonus ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, referral_customer_bonus: event.target.value })}/></label>
            <label>Gold lifetime spend threshold<input type="number" min="0" step="1" value={loyaltyForm.gold_spend_threshold ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, gold_spend_threshold: event.target.value })}/></label>
            <label>Platinum lifetime spend threshold<input type="number" min="0" step="1" value={loyaltyForm.platinum_spend_threshold ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, platinum_spend_threshold: event.target.value })}/></label>
            <label>Points expire after (days; 0 = never)<input type="number" min="0" step="1" value={loyaltyForm.point_expiry_days ?? 0} onChange={event => setLoyaltyForm({ ...loyaltyForm, point_expiry_days: event.target.value })}/></label>
          </div>
          <button className="btn btn-primary" type="submit">Save reward rules</button>
        </form>
        <div className="admin-reward-adjust"><h3>Manual points adjustment</h3><form className="offer-form" onSubmit={submitRewardAdjustment}><label>Customer<select required value={manualRewardAdjustment.customerId} onChange={event => setManualRewardAdjustment({ ...manualRewardAdjustment, customerId: event.target.value })}><option value="">Select a customer</option>{adminRewardAccounts.map(account => <option key={account.profile_id} value={account.profile_id}>{account.profile_id} · {account.points_balance} pts</option>)}</select></label><div className="form-grid"><label>Points to add / remove<input type="number" required step="1" value={manualRewardAdjustment.points} onChange={event => setManualRewardAdjustment({ ...manualRewardAdjustment, points: event.target.value })}/></label><label>Mandatory reason<input required minLength="5" value={manualRewardAdjustment.reason} onChange={event => setManualRewardAdjustment({ ...manualRewardAdjustment, reason: event.target.value })}/></label></div><button className="btn btn-light" type="submit">Record audited adjustment</button></form></div>
        <div className="admin-reward-tables"><section><h3>Customer balances ({adminRewardAccounts.length})</h3><div className="table-wrap"><table><thead><tr><th>Profile ID</th><th>Points</th><th>Earned</th><th>Redeemed</th><th>Spend / tier</th></tr></thead><tbody>{adminRewardAccounts.map(account => <tr key={account.profile_id}><td><strong>{account.profile_id}</strong><small>{account.referral_code}</small></td><td>{account.points_balance}</td><td>{account.total_points_earned}</td><td>{account.total_points_redeemed}</td><td>{money(account.lifetime_spend)}<small>{account.membership_level}</small></td></tr>)}</tbody></table></div></section><section><h3>Recent audit ledger ({adminRewardTransactions.length})</h3><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Change</th><th>Reason</th><th>Date</th></tr></thead><tbody>{adminRewardTransactions.slice(0, 100).map((transaction, index) => <tr key={`${transaction.profile_id}-${transaction.created_at}-${index}`}><td>{transaction.profile_id}</td><td>{transaction.points_delta}</td><td>{transaction.reason}</td><td>{new Date(transaction.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></section></div>
      </div>}
      {adminTab === 'Support' && <div className="admin-reward-tables"><h3>Customer support tickets</h3>{!supabaseConfigured || !['owner', 'admin', 'manager'].includes(appSession?.role) ? <div className="backend-notice"><Headset/><div><strong>Support queue requires an authorized live account</strong><span>Sign in as an owner, admin or manager after applying the marketplace migration.</span></div></div> : adminSupportTickets.length ? <div className="table-wrap"><table><thead><tr><th>Request</th><th>Customer</th><th>Booking</th><th>Message</th><th>Status</th></tr></thead><tbody>{adminSupportTickets.map(ticket => <tr key={ticket.id}><td><strong>{ticket.subject}</strong><small>{new Date(ticket.created_at).toLocaleString()}</small></td><td>{ticket.profile_id}</td><td>{ticket.booking_id || 'General inquiry'}</td><td>{ticket.message}</td><td><select value={ticket.status} onChange={event => updateSupportTicket(ticket.id, event.target.value)}>{['open','in_progress','resolved','closed'].map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></td></tr>)}</tbody></table></div> : <div className="empty compact"><Headset/><strong>No support tickets</strong><span>New customer requests will appear here.</span></div>}</div>}
      {adminTab === 'Chatbot' && <ChatbotAdmin/>}
    </div></div>}

    {(!appMode || appMode === 'customer') && <ChatbotWidget appSession={appSession} navigatePath={navigatePath}/>}
    {toast && <div className="toast"><CircleCheck size={18}/>{toast}</div>}
  </div>;
}
