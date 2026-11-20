import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
  : null;

export async function fetchPublicCatalogue() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const now = new Date().toISOString();
  const [categoriesResult, servicesResult, offersResult] = await Promise.all([
    supabase.from('categories')
      .select('id,title,description,icon,image_url,active,sort_order')
      .eq('active', true)
      .order('sort_order'),
    supabase.from('services')
      .select('id,category_id,title,description,price,image_url,icon,tag,popular,sort_order,categories(title)')
      .eq('active', true)
      .order('sort_order'),
    supabase.from('offers')
      .select('id,title,description,discount_type,discount_value,image_url,coupon_code,starts_at,expires_at,active,priority,offer_services(service_id)')
      .eq('active', true)
      .lte('starts_at', now)
      .gt('expires_at', now)
      .order('priority', { ascending: false })
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (offersResult.error) throw offersResult.error;

  const services = (servicesResult.data || []).map(service => ({
    id: service.id,
    title: service.title,
    category: service.categories?.title || '',
    description: service.description,
    price: Number(service.price),
    image: service.image_url,
    icon: service.icon,
    tag: service.tag,
    popular: service.popular,
    categoryId: service.category_id
  }));
  const offers = (offersResult.data || []).map(offer => {
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
  }).filter(offer => offer.serviceIds.length > 0);

  return {
    categories: categoriesResult.data || [],
    services,
    offers
  };
}

export async function signInWithPassword(email, password) {
  if (!supabase) {
    throw new Error('Supabase password authentication is not configured.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, fullName, referralCode = '') {
  if (!supabase) {
    throw new Error('Supabase signup is not configured.');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, ...(referralCode.trim() ? { referral_code: referralCode.trim().toUpperCase() } : {}) },
      emailRedirectTo: `${window.location.origin}/home#app/customer`
    }
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email) {
  if (!supabase) {
    throw new Error('Supabase password recovery is not configured.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/home#app/customer`
  });
  if (error) throw error;
}

export async function signOutApp() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
