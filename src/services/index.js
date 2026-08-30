/**
 * Service layer entry — foundation for platform features.
 * UI hooks can opt into these when VITE_USE_SUPABASE=true.
 */

export { basesService } from './basesService';
export { newsService } from './newsService';
export { reportsService } from './reportsService';
export { calendarService, directoryService } from './catalogService';
export { authService } from './authService';
export { mediaService } from './mediaService';
export {
  bookingsService,
  notificationsService,
  paymentsService,
} from './platformService';
export { bookingService } from './bookingService';
export { lunarCalendarService } from './lunarCalendarService';
export { reportSocialService } from './reportSocialService';
export { forumService } from './forumService';
export { notificationService } from './notificationService';
export { emailOutbox } from './email/emailOutbox';
export { digestBuilder } from './email/digestBuilder';
export { plansService } from './plansService';
export { paymentService } from './paymentService';
export { advertisingService } from './advertisingService';
