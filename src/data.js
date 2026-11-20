export const mainCategories = [
  { id: 'housekeeping', title: 'Housekeeping', description: 'Everyday care for cleaner, more comfortable spaces.', icon: 'home', image: 'photo-1581578731548-c64695cc6952' },
  { id: 'ifm', title: 'IFM (Integrated Facility Management)', description: 'Coordinated facility operations and on-site management.', icon: 'building', image: 'photo-1497366811353-6870744d04b2' },
  { id: 'deep-cleaning', title: 'Deep Cleaning', description: 'Detailed cleans for the spaces and surfaces that need extra care.', icon: 'sparkles', image: 'photo-1600585154340-be6161a56a0c' },
  { id: 'pest-control', title: 'Pest Control', description: 'Practical pest treatments for homes and workplaces.', icon: 'bug', image: 'photo-1584622650111-993a426fbf0a' },
  { id: 'technical-maintenance', title: 'Technical & Maintenance', description: 'Skilled help for essential repairs and equipment upkeep.', icon: 'wrench', image: 'photo-1621905251189-08b45d6a269e' },
  { id: 'manpower', title: 'Manpower Services', description: 'Dependable staffing support for your day-to-day operations.', icon: 'users', image: 'photo-1521737711867-e3b97375f902' }
];

export const services = [
  { id: 'regular-housekeeping', title: 'Regular Housekeeping', category: 'Housekeeping', description: 'Reliable routine cleaning and upkeep tailored to your space.', price: 799, icon: 'home', image: 'photo-1581578731548-c64695cc6952', tag: '' },
  { id: 'home-cleaning', title: 'Home Cleaning', category: 'Housekeeping', description: 'Refresh your everyday living spaces with a careful home clean.', price: 1499, icon: 'home', image: 'photo-1600210492486-724fe5c67fb0', tag: 'Popular' },
  { id: 'office-cleaning', title: 'Office Cleaning', category: 'Housekeeping', description: 'Keep your workplace clean, comfortable and ready for the team.', price: 2499, icon: 'building', image: 'photo-1497366754035-f200968a6e72', tag: '' },
  { id: 'bathroom-cleaning', title: 'Bathroom Cleaning', category: 'Housekeeping', description: 'A focused clean for bathroom floors, fixtures and surfaces.', price: 599, icon: 'droplets', image: 'photo-1620626011761-996317b8d101', tag: '' },
  { id: 'kitchen-cleaning', title: 'Kitchen Cleaning', category: 'Housekeeping', description: 'Detailed cleaning for kitchen counters, cupboards and appliances.', price: 899, icon: 'sparkles', image: 'photo-1556911220-e15b29be8c8f', tag: '' },
  { id: 'floor-cleaning', title: 'Floor Cleaning', category: 'Housekeeping', description: 'A thorough clean to help floors look their best.', price: 699, icon: 'layers', image: 'photo-1600607687939-ce8a6c25118c', tag: '' },
  { id: 'glass-cleaning', title: 'Glass Cleaning', category: 'Housekeeping', description: 'Streak-conscious cleaning for windows and glass surfaces.', price: 899, icon: 'sparkles', image: 'photo-1524758631624-e2822e304c36', tag: '' },

  { id: 'ifms', title: 'Integrated Facility Management', category: 'IFM (Integrated Facility Management)', description: 'A coordinated approach to facility services and site operations.', price: 0, icon: 'building', image: 'photo-1497366811353-6870744d04b2', tag: 'Enquiry' },
  { id: 'facility-operations', title: 'Facility Operations', category: 'IFM (Integrated Facility Management)', description: 'Reliable day-to-day coordination for your managed facilities.', price: 0, icon: 'building', image: 'photo-1497366754035-f200968a6e72', tag: 'Enquiry' },
  { id: 'housekeeping-management', title: 'Housekeeping Management', category: 'IFM (Integrated Facility Management)', description: 'Managed housekeeping operations for professional environments.', price: 0, icon: 'users', image: 'photo-1521737711867-e3b97375f902', tag: 'Enquiry' },
  { id: 'facility-supervision', title: 'Facility Supervision', category: 'IFM (Integrated Facility Management)', description: 'On-site supervision to support consistent service delivery.', price: 0, icon: 'badge', image: 'photo-1497366754035-f200968a6e72', tag: 'Enquiry' },
  { id: 'office-maintenance', title: 'Office Maintenance', category: 'IFM (Integrated Facility Management)', description: 'Practical ongoing maintenance support for office facilities.', price: 0, icon: 'wrench', image: 'photo-1497366811353-6870744d04b2', tag: 'Enquiry' },

  { id: 'home', title: 'Full Home Deep Cleaning', category: 'Deep Cleaning', description: 'A complete top-to-bottom refresh for kitchens, bathrooms and living spaces.', price: 2499, icon: 'home', image: 'photo-1581578731548-c64695cc6952', tag: 'Bestseller' },
  { id: 'bathroom', title: 'Bathroom Deep Cleaning', category: 'Deep Cleaning', description: 'Targeted bathroom cleaning for tiles, fixtures and hard-to-reach corners.', price: 699, icon: 'droplets', image: 'photo-1620626011761-996317b8d101', tag: '' },
  { id: 'kitchen', title: 'Kitchen Deep Cleaning', category: 'Deep Cleaning', description: 'Bring back the sparkle with a detailed clean of your kitchen surfaces.', price: 999, icon: 'sparkles', image: 'photo-1556911220-e15b29be8c8f', tag: '' },
  { id: 'sofa', title: 'Sofa Cleaning', category: 'Deep Cleaning', description: 'Lift everyday dirt and refresh upholstery with expert care.', price: 799, icon: 'sofa', image: 'photo-1555041469-a586c61ea9bc', tag: 'Popular' },
  { id: 'carpet', title: 'Carpet Cleaning', category: 'Deep Cleaning', description: 'A deep clean for carpets and rugs to refresh the rooms you live in.', price: 999, icon: 'layers', image: 'photo-1600210492486-724fe5c67fb0', tag: '' },
  { id: 'mattress-cleaning', title: 'Mattress Cleaning', category: 'Deep Cleaning', description: 'A careful refresh for the surface where you rest every day.', price: 899, icon: 'layers', image: 'photo-1631049307264-da0ec9d70304', tag: '' },
  { id: 'office', title: 'Office Deep Cleaning', category: 'Deep Cleaning', description: 'A healthier, cleaner workplace with a professional site-ready team.', price: 4799, icon: 'building', image: 'photo-1497366754035-f200968a6e72', tag: '' },
  { id: 'move-cleaning', title: 'Move-in / Move-out Cleaning', category: 'Deep Cleaning', description: 'Prepare a property for its next chapter with a detailed clean.', price: 2999, icon: 'home', image: 'photo-1600607687939-ce8a6c25118c', tag: '' },

  { id: 'cockroach-control', title: 'Cockroach Control', category: 'Pest Control', description: 'Targeted treatment to help manage cockroach activity.', price: 899, icon: 'bug', image: 'photo-1584622650111-993a426fbf0a', tag: '' },
  { id: 'termite-control', title: 'Termite Control', category: 'Pest Control', description: 'Assessment and treatment options for termite concerns.', price: 1999, icon: 'bug', image: 'photo-1600607687939-ce8a6c25118c', tag: '' },
  { id: 'mosquito-control', title: 'Mosquito Control', category: 'Pest Control', description: 'Treatment options to help reduce mosquito activity.', price: 999, icon: 'bug', image: 'photo-1500382017468-9049fed747ef', tag: '' },
  { id: 'rodent-control', title: 'Rodent Control', category: 'Pest Control', description: 'Practical rodent management for residential and business spaces.', price: 1199, icon: 'bug', image: 'photo-1584622650111-993a426fbf0a', tag: '' },
  { id: 'pest', title: 'General Pest Control', category: 'Pest Control', description: 'Reliable home and commercial pest treatment options.', price: 999, icon: 'bug', image: 'photo-1584622650111-993a426fbf0a', tag: '' },

  { id: 'electrical-services', title: 'Electrical Services', category: 'Technical & Maintenance', description: 'Help with common electrical repairs and installations.', price: 499, icon: 'wrench', image: 'photo-1621905251189-08b45d6a269e', tag: '' },
  { id: 'plumbing', title: 'Plumbing', category: 'Technical & Maintenance', description: 'Support for leaks, fittings and everyday plumbing needs.', price: 499, icon: 'droplets', image: 'photo-1607472586893-edb57bdc0e39', tag: '' },
  { id: 'ac-services', title: 'AC Services', category: 'Technical & Maintenance', description: 'Maintenance and service support for your air conditioner.', price: 799, icon: 'wrench', image: 'photo-1581092921461-eab62e97a780', tag: '' },
  { id: 'equipment-maintenance', title: 'Equipment Maintenance', category: 'Technical & Maintenance', description: 'Scheduled support to help keep essential equipment running.', price: 0, icon: 'wrench', image: 'photo-1581092921461-eab62e97a780', tag: 'Enquiry' },
  { id: 'general-repairs', title: 'General Repairs', category: 'Technical & Maintenance', description: 'Practical repair help for common household and workplace issues.', price: 499, icon: 'wrench', image: 'photo-1581578731548-c64695cc6952', tag: '' },

  { id: 'office-staff', title: 'Office Staff', category: 'Manpower Services', description: 'Staffing support for day-to-day office operations.', price: 0, icon: 'users', image: 'photo-1521737711867-e3b97375f902', tag: 'Enquiry' },
  { id: 'housekeeping-staff', title: 'Housekeeping Staff', category: 'Manpower Services', description: 'Dependable housekeeping staff for your premises.', price: 0, icon: 'users', image: 'photo-1581578731548-c64695cc6952', tag: 'Enquiry' },
  { id: 'pantry-staff', title: 'Pantry Staff', category: 'Manpower Services', description: 'Pantry team staffing tailored to your workplace needs.', price: 0, icon: 'users', image: 'photo-1556911220-e15b29be8c8f', tag: 'Enquiry' },
  { id: 'facility-staff', title: 'Facility Staff', category: 'Manpower Services', description: 'On-site staffing support for facility operations.', price: 0, icon: 'users', image: 'photo-1497366811353-6870744d04b2', tag: 'Enquiry' },
  { id: 'temporary-manpower', title: 'Temporary Manpower', category: 'Manpower Services', description: 'Flexible short-term staffing for changing requirements.', price: 0, icon: 'users', image: 'photo-1521737711867-e3b97375f902', tag: 'Enquiry' },
  { id: 'contract-manpower', title: 'Contract Manpower', category: 'Manpower Services', description: 'Contract staffing solutions for ongoing operational needs.', price: 0, icon: 'users', image: 'photo-1521737711867-e3b97375f902', tag: 'Enquiry' }
];

const today = new Date();
const dateAfter = days => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const initialOffers = [
  { id: 'welcome-clean', title: 'A fresher home starts here', description: 'Get your home ready for a little extra sparkle. Book your first clean today.', discount: 25, serviceId: 'home', startDate: dateAfter(-1), expiryDate: dateAfter(21), active: true, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=85' },
  { id: 'sofa-refresh', title: 'Give your sofa a refresh', description: 'A little love for the place everyone gathers. Limited-time upholstery offer.', discount: 20, serviceId: 'sofa', startDate: dateAfter(-1), expiryDate: dateAfter(14), active: true, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1400&q=85' }
];

export const initialBookings = [
  { id: 'ETOE-2026-00125', customer: 'Demo Customer', phone: '9999999999', service: 'Full Home Deep Cleaning', date: dateAfter(3), slot: '10:00 AM - 12:00 PM', address: 'Jaipur, Rajasthan', amount: 2499, status: 'Order Confirmed', payment: 'Pending', paymentStatus: 'Pending', team: 'Cleaning Team A', adminStatus: 'Confirmed', acceptanceStatus: 'Awaiting Team Acceptance', acceptanceDeadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(), notes: '', history: [{ status: 'Booking Confirmed', time: new Date(Date.now() - 3600000).toISOString() }, { status: 'Order Confirmed', time: new Date(Date.now() - 1800000).toISOString() }] },
  { id: 'ETOE-2026-00126', customer: 'Demo Customer 2', phone: '8888888888', service: 'Office Deep Cleaning', date: dateAfter(4), slot: '02:00 PM - 04:00 PM', address: 'Jaipur, Rajasthan', amount: 4799, status: 'Team Accepted', payment: 'Paid', paymentStatus: 'Paid', team: 'Team B', adminStatus: 'Confirmed', acceptanceStatus: 'Accepted', notes: '', history: [{ status: 'Booking Confirmed', time: new Date(Date.now() - 86400000).toISOString() }, { status: 'Order Confirmed', time: new Date(Date.now() - 7200000).toISOString() }, { status: 'Team Accepted', time: new Date(Date.now() - 3600000).toISOString() }] }
];

export const statuses = [
  'Booking Confirmed',
  'Order Confirmed',
  'Service Team Assigned',
  'Team Accepted',
  'Team On The Way',
  'Team Arrived at Customer Location',
  'Service Started',
  'Service Completed',
  'Payment Completed'
];
