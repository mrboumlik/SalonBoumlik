import { subscribeToBarberProfiles } from './barberProfileStore';
import { subscribeToBarberRoster } from './barberRosterStore';
import { subscribeToBarberSchedules } from './barberScheduleStore';
import { subscribeToBookings } from './bookingStore';
import {
  subscribeToBarberDailyNotes,
  subscribeToCaisseCycles,
  subscribeToCaisseEntries,
  subscribeToCaisseSettings,
  subscribeToCaisseSettlements,
} from './caisseStore';
import {
  subscribeToCreditDisputes,
  subscribeToCreditSettlementRequests,
  subscribeToManualClientCredits,
} from './creditRegistryStore';
import { subscribeToCrmClients } from './crmStore';
import { subscribeToSalonProfileSettings } from './salonSettingsStore';
import { subscribeToShiftRequests } from './shiftPlannerStore';
import { subscribeToShopPricingConfig } from './shopPricingStore';
import { subscribeToWaitlist } from './waitlistStore';

const noop = () => {};

/**
 * Keeps core real-time Firestore streams warm at the app root so opening any modal
 * or switching views shows instant live data across devices without cold-start delays.
 */
export function bootstrapRealtimeSync(): () => void {
  const unsubs: (() => void)[] = [
    subscribeToSalonProfileSettings(noop),
    subscribeToShopPricingConfig(noop),
    subscribeToBarberRoster(noop),
    subscribeToBarberProfiles(noop),
    subscribeToBarberSchedules(noop),
    subscribeToBookings(noop),
    subscribeToCrmClients(noop),
    subscribeToCaisseEntries(noop),
    subscribeToCaisseSettings(noop),
    subscribeToCaisseSettlements(noop),
    subscribeToCaisseCycles(noop),
    subscribeToBarberDailyNotes(noop),
    subscribeToManualClientCredits(noop),
    subscribeToCreditDisputes(noop),
    subscribeToCreditSettlementRequests(noop),
    subscribeToWaitlist(noop),
    subscribeToShiftRequests(noop),
  ];

  return () => {
    unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    });
  };
}
