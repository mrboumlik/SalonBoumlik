import React, { useEffect, useMemo, useState } from 'react';
import { pickLang } from '../utils/i18n';
import { safeCompareDesc } from '../utils/safeCoerce';
import {
  Award,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Coins,
  Crown,
  Gift,
  LogOut,
  Scissors,
  Search,
  Sparkles,
  Ticket,
  UserCheck,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { AppointmentBooking } from '../types';
import {
  fetchAllBookingsOnce,
  findBookingsUniversal,
  getAllBookings,
  normalizeMoroccanPhoneDigits,
  subscribeToBookings,
} from '../utils/bookingStore';
import {
  getCrmDocId,
  redeemLoyaltyPointsForDiscount,
  useCrmClients,
} from '../utils/crmStore';
import {
  computeBookingLoyaltyPoints,
  computeClientPointsSummary,
  computeLoyaltyProgress,
  getMilestoneRewardLabel,
  getVerifiedVisitsCount,
  LOYALTY_POINT_TIERS,
  LoyaltyPointRewardKind,
} from '../utils/loyaltyEngine';
import {
  getRememberedPhones,
  getRememberedTickets,
  rememberTrackedPhone,
} from '../utils/clientReminderWatcher';
import { sendDualAlert, showToast } from '../utils/notifications';
import {
  getBrowserPushStatus,
  registerClientPushSubscription,
} from '../utils/webPushClient';
import { LoyaltyProgressCard } from './LoyaltyProgressCard';

interface LoyaltyProgramSectionProps {
  activeClientPhone?: string;
  onClientIdentified?: (phone: string) => void;
  onClearClient?: () => void;
  onOpenBooking: () => void;
  onOpenTrackBooking?: (query?: string) => void;
}

export const LoyaltyProgramSection: React.FC<LoyaltyProgramSectionProps> = ({
  activeClientPhone,
  onClientIdentified,
  onClearClient,
  onOpenBooking,
  onOpenTrackBooking,
}) => {
  const { lang, isRtl } = useLanguage();
  const [liveBookings, setLiveBookings] = useState<AppointmentBooking[]>(() => getAllBookings());
  const crmClientsMap = useCrmClients();

  const [lookupInput, setLookupInput] = useState('');
  const [manualPhone, setManualPhone] = useState<string>('');
  const [isSessionCleared, setIsSessionCleared] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [redeemingTierId, setRedeemingTierId] = useState<string | null>(null);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [pushStatus, setPushStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  }>({
    supported: true,
    permission: 'default',
    subscribed: false,
  });

  useEffect(() => {
    if (activeClientPhone) {
      setIsSessionCleared(false);
    }
  }, [activeClientPhone]);

  useEffect(() => {
    let active = true;
    void getBrowserPushStatus().then((status) => {
      if (active) setPushStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToBookings((items) => setLiveBookings(items));
    return () => unsub();
  }, []);

  // Resolve client identity priority: activeClientPhone prop -> manualPhone -> localStorage tracked phone/ticket
  const resolvedClientIdentity = useMemo(() => {
    const candidatePhone = activeClientPhone || manualPhone;
    const cleanedProp = normalizeMoroccanPhoneDigits(candidatePhone || '');
    if (cleanedProp.length >= 6) {
      return { phoneDigits: cleanedProp, rawPhone: candidatePhone || cleanedProp };
    }

    if (isSessionCleared) return null;

    const savedPhones = getRememberedPhones();
    if (savedPhones.length > 0) {
      const latestPhone = savedPhones[savedPhones.length - 1];
      const norm = normalizeMoroccanPhoneDigits(latestPhone);
      if (norm.length >= 6) {
        return { phoneDigits: norm, rawPhone: latestPhone };
      }
    }

    const savedTickets = getRememberedTickets();
    if (savedTickets.length > 0 && liveBookings.length > 0) {
      const latestTicket = savedTickets[savedTickets.length - 1];
      const matches = findBookingsUniversal(latestTicket, liveBookings);
      if (matches[0]) {
        const norm = normalizeMoroccanPhoneDigits(matches[0].clientPhone);
        if (norm.length >= 6) {
          return { phoneDigits: norm, rawPhone: matches[0].clientPhone };
        }
      }
    }

    return null;
  }, [activeClientPhone, manualPhone, isSessionCleared, liveBookings]);

  // Filter live Firestore bookings belonging to the resolved client
  const clientBookings = useMemo(() => {
    if (!resolvedClientIdentity) return [];
    return liveBookings
      .filter(
        (b) =>
          normalizeMoroccanPhoneDigits(b.clientPhone) === resolvedClientIdentity.phoneDigits
      )
      .sort((a, b) => safeCompareDesc(a.createdAt, b.createdAt));
  }, [liveBookings, resolvedClientIdentity]);

  const crmProfile = useMemo(() => {
    if (!resolvedClientIdentity) return undefined;
    const directId = getCrmDocId(resolvedClientIdentity.rawPhone);
    if (crmClientsMap[directId]) return crmClientsMap[directId];
    return Object.values(crmClientsMap).find(
      (c) =>
        normalizeMoroccanPhoneDigits(c.normalizedPhone || c.phoneDisplay) ===
        resolvedClientIdentity.phoneDigits
    );
  }, [crmClientsMap, resolvedClientIdentity]);

  const isIdentified = Boolean(
    resolvedClientIdentity && (clientBookings.length > 0 || crmProfile)
  );

  const verifiedVisits = isIdentified
    ? getVerifiedVisitsCount(clientBookings, crmProfile)
    : 0;
  const loyaltyProgress = computeLoyaltyProgress(verifiedVisits, lang);
  const pointsSummary = computeClientPointsSummary(verifiedVisits, crmProfile, clientBookings);

  // Upcoming bookings that have NOT yet completed attendance
  const upcomingActiveBookings = useMemo(() => {
    return clientBookings.filter((b) =>
      ['pending', 'confirmed', 'rescheduled'].includes(b.status)
    );
  }, [clientBookings]);

  const expectedUpcomingPoints = useMemo(
    () =>
      upcomingActiveBookings.reduce(
        (sum, b) => sum + computeBookingLoyaltyPoints(b).points,
        0
      ),
    [upcomingActiveBookings]
  );

  const completedBookingsCount = useMemo(() => {
    return clientBookings.filter((b) => b.status === 'completed').length;
  }, [clientBookings]);

  const milestoneLadderProgressPct = Math.min(
    100,
    Math.round((Math.min(verifiedVisits, 20) / 20) * 100)
  );

  const clientDisplayName =
    crmProfile?.clientName ||
    clientBookings[0]?.clientName ||
    resolvedClientIdentity?.rawPhone ||
    '';

  const langKey: 'ar' | 'fr' | 'en' | 'es' =
    lang === 'ar' || lang === 'en' || lang === 'es' ? lang : 'fr';

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = lookupInput.trim();
    if (!raw) {
      setLookupError(
        pickLang(lang, {
          ar: 'أدخل رقم هاتفك أو رقم التذكرة (#SB-1234) للتحقق من نقاطك.',
          fr: 'Saisissez votre téléphone ou numéro de ticket (#SB-1234).',
          amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ ⵏⵖ ⵓⵟⵟⵓⵏ ⵏ ⵓⵜⵉⴽⵉ (#SB-1234).',
          en: 'Enter your phone number or ticket number (#SB-1234).',
          es: 'Ingresa tu número de teléfono o ticket (#SB-1234).',
        })
      );
      return;
    }

    setIsSearching(true);
    setLookupError(null);
    try {
      let sourceBookings = liveBookings;
      if (sourceBookings.length === 0) {
        try {
          sourceBookings = await fetchAllBookingsOnce();
        } catch {
          // keep cached state
        }
      }

      const matches = findBookingsUniversal(raw, sourceBookings);
      const norm = normalizeMoroccanPhoneDigits(raw);
      const matchedCrm =
        crmClientsMap[getCrmDocId(raw)] ||
        Object.values(crmClientsMap).find(
          (c) =>
            norm.length >= 6 &&
            normalizeMoroccanPhoneDigits(c.normalizedPhone || c.phoneDisplay) === norm
        );

      const resolvedRawPhone =
        matches[0]?.clientPhone ||
        matchedCrm?.phoneDisplay ||
        matchedCrm?.normalizedPhone ||
        '';

      if (!resolvedRawPhone) {
        setLookupError(
          pickLang(lang, {
            ar: 'لم يتم العثور على حجوزات أو رصيد ولاء لهذا الرقم. تأكد من الرقم أو احجز موعدك الأول.',
            fr: 'Aucun historique trouvé pour ce numéro ou ticket. Réservez votre 1re visite pour cumuler des points.',
            amz: 'ⵓⵔ ⵏⵓⴼⵉ ⴰⵙⵉⵀⵍ ⵉ ⵓⵟⵟⵓⵏ ⴰⴷ. ⵙⵙⵏⵜⵉ ⴰⵙⵉⵀⵍ ⵏⵏⴽ ⴰⵎⵣⵡⴰⵔⵓ.',
            en: 'No bookings or loyalty history found for this number. Book your first visit to earn points.',
            es: 'No se encontró historial para este número. Reserva tu primera visita para acumular puntos.',
          })
        );
        return;
      }

      rememberTrackedPhone(resolvedRawPhone);
      setIsSessionCleared(false);
      setManualPhone(resolvedRawPhone);
      if (onClientIdentified) {
        onClientIdentified(resolvedRawPhone);
      }
      setLookupInput('');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearActiveClient = () => {
    setManualPhone('');
    setIsSessionCleared(true);
    setLookupError(null);
    if (onClearClient) onClearClient();
  };

  const handleRedeemTier = async (tier: {
    id: string;
    pointsCost: number;
    discountMAD: number;
    rewardKind?: LoyaltyPointRewardKind;
    rewardTitle?: string;
  }) => {
    if (!resolvedClientIdentity || !isIdentified || redeemingTierId) return;
    setRedeemingTierId(tier.id);
    try {
      await redeemLoyaltyPointsForDiscount({
        phone: resolvedClientIdentity.rawPhone,
        clientName: clientDisplayName || 'Client',
        pointsCost: tier.pointsCost,
        discountMAD: tier.discountMAD,
        rewardKind: tier.rewardKind,
        label:
          tier.discountMAD > 0
            ? `🎟️ ${tier.rewardTitle || `-${tier.discountMAD} MAD`} · ${tier.pointsCost} pts`
            : `🎁 ${tier.rewardTitle || 'Reward'} · ${tier.pointsCost} pts`,
        verifiedVisits,
        crmMap: crmClientsMap,
      });
      sendDualAlert(
        tier.discountMAD > 0
          ? pickLang(lang, {
              ar: `تم استبدال ${tier.pointsCost} نقطة بخصم -${tier.discountMAD} MAD!`,
              fr: `${tier.pointsCost} pts échangés contre -${tier.discountMAD} MAD !`,
              amz: `ⵉⵜⵜⵓⵙⵏⴼⵍ ${tier.pointsCost} ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵙ -${tier.discountMAD} MAD!`,
              en: `Redeemed ${tier.pointsCost} pts for -${tier.discountMAD} MAD!`,
              es: `¡${tier.pointsCost} pts canjeados por -${tier.discountMAD} MAD!`,
            })
          : pickLang(lang, {
              ar: `تم استبدال ${tier.pointsCost} نقطة بمكافأة ${tier.rewardTitle || 'عناية مجانية'}!`,
              fr: `${tier.pointsCost} pts échangés contre ${tier.rewardTitle || 'un soin offert'} !`,
              amz: `ⵉⵜⵜⵓⵙⵏⴼⵍ ${tier.pointsCost} pts: ${tier.rewardTitle || 'ⴼⴰⴱⵓⵔ'}!`,
              en: `Redeemed ${tier.pointsCost} pts for ${tier.rewardTitle || 'free service'}!`,
              es: `¡${tier.pointsCost} pts canjeados por ${tier.rewardTitle || 'premio'}!`,
            }),
        {
          body:
            tier.discountMAD > 0
              ? pickLang(lang, {
                  ar: 'سيُطبق الخصم تلقائياً عند حجزك القادم.',
                  fr: 'La remise sera appliquée automatiquement lors de votre prochaine réservation.',
                  amz: 'ⴰⵙⵉⴷⵔ ⴰⴷ ⵉⵜⵜⵓⵙⵏⴼⵍ ⵙ ⵜⵓⵎⴰⵏⵜ ⴳ ⵓⵙⵉⵀⵍ ⵉⴷⴷⴰⵏ.',
                  en: 'The discount will be automatically applied to your next booking.',
                  es: 'El descuento se aplicará automáticamente en tu próxima reserva.',
                })
              : pickLang(lang, {
                  ar: 'تم تفعيل مكافأتك المجانية لحجزك القادم بالصالون.',
                  fr: 'Votre soin offert est activé pour votre prochaine visite au salon.',
                  amz: 'ⵜⴰⵙⵎⵖⵓⵔⵜ ⵏⵏⴽ ⵜⵡⵊⴷ ⵉ ⵜⵉⵔⵣⵉ ⵉⴷⴷⴰⵏ.',
                  en: 'Your complimentary care reward is active for your next salon visit.',
                  es: 'Tu premio gratuito está listo para tu próxima visita.',
                }),
          type: 'success',
        }
      );
    } catch (err: any) {
      sendDualAlert(
        pickLang(lang, {
          ar: 'تعذر استبدال النقاط',
          fr: 'Échec de l’échange',
          amz: 'ⵓⵔ ⵉⵜⵜⵓⵙⵏⴼⵍ',
          en: 'Redemption failed',
          es: 'Error al canjear',
        }),
        {
          body:
            err?.message ||
            pickLang(lang, {
              ar: 'يرجى التحقق من رصيد نقاطك.',
              fr: 'Vérifiez votre solde de points.',
              amz: 'ⵙⵙⵓⵜⵍ ⵉ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏⵏⴽ.',
              en: 'Please check your points balance.',
              es: 'Verifica tu saldo de puntos.',
            }),
          type: 'warning',
        }
      );
    } finally {
      setRedeemingTierId(null);
    }
  };

  const handleSubscribeNotifications = async () => {
    if (isSubscribingPush) return;
    setIsSubscribingPush(true);
    try {
      const result = await registerClientPushSubscription({
        clientPhone: resolvedClientIdentity?.rawPhone || '0600000000',
        clientName:
          clientDisplayName ||
          pickLang(lang, {
            ar: 'مشترك بومليك',
            fr: 'Abonné Boumlik',
            amz: 'ⴰⵎⵣⵎⵎⴻⵎ ⵏ ⴱⵓⵎⵍⵉⴽ',
            en: 'Boumlik Subscriber',
            es: 'Suscriptor Boumlik',
          }),
        lang,
      });
      const updated = await getBrowserPushStatus();
      setPushStatus(updated);

      if (result.granted && (result.subscribed || updated.subscribed)) {
        showToast(
          pickLang(lang, {
            ar: 'تم الاشتراك في إشعارات الصالون ✓',
            fr: 'Abonné aux notifications ✓',
            amz: 'ⵉⵍⵍⴰ ⵓⵣⵎⵎⴻⵎ ⵏ ⵉⵏⵖⵎⵉⵙⵏ ✓',
            en: 'Subscribed to Notifications ✓',
            es: 'Suscrito a notificaciones ✓',
          }),
          pickLang(lang, {
            ar: 'ستتوصل فوراً بتحديثات مواعيدك وأخبار وعروض صالون بومليك.',
            fr: 'Vous recevrez les alertes de rendez-vous et nouveautés du Salon Boumlik.',
            amz: 'ⴰⴷ ⵜⴰⵎⵥⴷ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵉⵙⵉⵀⴰⵍⵏ ⴷ ⵓⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ.',
            en: 'You will receive real-time appointment alerts and Salon Boumlik news.',
            es: 'Recibirás alertas de citas y novedades de Salon Boumlik al instante.',
          }),
          'success'
        );
      } else if (!result.granted) {
        showToast(
          pickLang(lang, {
            ar: 'الإشعارات غير مسموحة',
            fr: 'Notifications refusées',
            amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵓⵔ ⵜⵜⵓⵙⵓⵔⴼⵏ',
            en: 'Notifications blocked',
            es: 'Notificaciones bloqueadas',
          }),
          pickLang(lang, {
            ar: 'يرجى السماح بالإشعارات من إعدادات المتصفح لتفعيل التنبيهات.',
            fr: 'Veuillez autoriser les notifications dans les paramètres de votre navigateur.',
            amz: 'ⵙⵓⵔⴼ ⵉ ⵉⵏⵖⵎⵉⵙⵏ ⴳ ⵉⵙⵖⴰⵍⵏ ⵏ ⵓⵎⵙⵙⵓⵜⵍ.',
            en: 'Please allow notifications in your browser settings to enable alerts.',
            es: 'Permite las notificaciones en la configuración de tu navegador.',
          }),
          'warning'
        );
      } else {
        showToast(
          pickLang(lang, {
            ar: 'تعذر إتمام الاشتراك حالياً',
            fr: 'Abonnement incomplet',
            amz: 'ⴰⵣⵎⵎⴻⵎ ⵓⵔ ⵉⵎⴷⵉ',
            en: 'Subscription incomplete',
            es: 'Suscripción incompleta',
          }),
          pickLang(lang, {
            ar: 'تم منح الإذن لكن خدمة الإشعارات بالمتصفح غير متوفرة حالياً في وضع التصفح الخاص.',
            fr: 'Permission accordée, mais PushManager n’est pas disponible dans ce contexte.',
            amz: 'ⵜⵉⵙⵓⵔⴼⵜ ⵜⵜⵓⴼⴽⴰ, ⵎⴰⵛⴰ PushManager ⵓⵔ ⵉⵍⵍⵉ ⵖⵉⵍⴰⴷ.',
            en: 'Permission granted, though PushManager is unavailable in this browsing context.',
            es: 'Permiso concedido, pero PushManager no está disponible en este contexto.',
          }),
          'info'
        );
      }
    } catch {
      showToast(
        pickLang(lang, {
          ar: 'خطأ في الاشتراك',
          fr: 'Erreur d’abonnement',
          amz: 'ⴰⵣⴳⴰⵍ ⴳ ⵓⵣⵎⵎⴻⵎ',
          en: 'Subscription error',
          es: 'Error de suscripción',
        }),
        pickLang(lang, {
          ar: 'حاول مرة أخرى في متصفح يدعم الإشعارات.',
          fr: 'Veuillez réessayer dans un navigateur compatible.',
          amz: 'ⴰⵔⵎ ⵜⵉⴽⴽⵍⵜ ⵢⴰⴹⵏ ⴳ ⵓⵎⵙⵙⵓⵜⵍ ⵉⵜⵜⴰⵡⵙⵏ.',
          en: 'Please try again in a supported browser.',
          es: 'Inténtalo de nuevo en un navegador compatible.',
        }),
        'warning'
      );
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const milestoneCards = [
    {
      visits: 5,
      title: getMilestoneRewardLabel(5, lang),
      subtitle: pickLang(lang, {
        ar: 'ابتداءً من الزيارة 5 المؤكدة',
        fr: 'Dès la 5e visite confirmée',
        amz: 'ⵙⴳ 5 ⵜⵉⵔⵣⵉⵡⵉⵏ',
        en: 'Unlocked at 5 verified visits',
        es: 'A partir de 5 visitas',
      }),
      icon: Gift,
    },
    {
      visits: 10,
      title: getMilestoneRewardLabel(10, lang),
      subtitle: pickLang(lang, {
        ar: 'عناية منعشة عند الزيارة 10',
        fr: 'Soin offert à la 10e visite',
        amz: 'ⴰⵙⵓⵊⵊⵉ ⴳ 10 ⵜⵉⵔⵣⵉⵡⵉⵏ',
        en: 'Unlocked at 10 verified visits',
        es: 'A partir de 10 visitas',
      }),
      icon: Sparkles,
    },
    {
      visits: 15,
      title: getMilestoneRewardLabel(15, lang),
      subtitle: pickLang(lang, {
        ar: 'خصم متوازن بعد 15 زيارة مؤكدة',
        fr: 'Remise après 15 visites confirmées',
        amz: 'ⴰⵙⵙⵏⵇⵙ ⴷⴼⴼⵉⵔ 15',
        en: 'Unlocked at 15 verified visits',
        es: 'A partir de 15 visitas',
      }),
      icon: Coins,
    },
    {
      visits: 20,
      title: getMilestoneRewardLabel(20, lang),
      subtitle: pickLang(lang, {
        ar: 'مكافأة VIP عند 20+ زيارة',
        fr: 'Avantage VIP dès 20+ visites',
        amz: 'VIP ⵙⴳ 20+ ⵜⵉⵔⵣⵉⵡⵉⵏ',
        en: 'VIP reward at 20+ visits',
        es: 'Premio VIP a las 20+ visitas',
      }),
      icon: Crown,
    },
  ];

  return (
    <section
      id="loyalty"
      className="py-16 md:py-24 bg-slate-50 dark:bg-[#0B0C10] border-t border-slate-200 dark:border-zinc-800/80 relative transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Crown className="w-4 h-4" />
            <span>
              {pickLang(lang, {
                ar: 'برنامج الولاء والنقاط • Salon Boumlik',
                fr: 'Programme de Fidélité Boumlik',
                amz: 'ⵜⴰⵖⵓⵏⵉ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ • Salon Boumlik',
                en: 'Boumlik Loyalty Program',
                es: 'Programa de Fidelidad Boumlik',
              })}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white font-display tracking-tight text-balance">
            {lang === 'ar' ? (
              <>
                اجمع نقاطك واحصل على <span className="text-gold-gradient">مكافآت وخصومات حصرية</span>
              </>
            ) : lang === 'amz' ? (
              <>
                ⵙⵎⵓⵏ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ <span className="text-gold-gradient">ⵉ ⵜⵙⵎⵖⵓⵔⵉⵏ ⵏ ⴼⴰⴱⵓⵔ</span>
              </>
            ) : lang === 'en' ? (
              <>
                Earn Service Points Toward{' '}
                <span className="text-gold-gradient">Care Rewards &amp; Discounts</span>
              </>
            ) : lang === 'es' ? (
              <>
                Acumula Puntos Por Servicio Para{' '}
                <span className="text-gold-gradient">Premios y Descuentos</span>
              </>
            ) : (
              <>
                Cumulez Vos Points par Service pour{' '}
                <span className="text-gold-gradient">Soins Offerts &amp; Remises</span>
              </>
            )}
          </h2>

          <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-300 font-body max-w-2xl mx-auto">
            {pickLang(lang, {
              ar: 'كل زيارة يتم تأكيد حضورها في الصالون تمنحك +3 إلى +22 نقطة ولاء حسب الخدمات المختارة، وتفتح لك بعد 5 زيارات مؤكدة مكافآت متدرجة: غسل شعر مجاني، ماسك للوجه، وتخفيضات حتى -10 MAD.',
              fr: 'Chaque visite confirmée au salon rapporte +3 à +22 points selon vos prestations et débloque dès la 5e visite : shampoing offert, masque visage gratuit et remises jusqu’à -10 MAD.',
              amz: 'ⴽⵓ ⵜⵉⵔⵣⵉ ⵜⴰⵎⴰⴷⴷⵓⴷⵜ ⵜⵜⴰⴽⴰ +3 ⴰⵔ +22 pts ⵙ ⵜⵡⵓⵔⵉ, ⵜⵕⵥⵎ ⵜⵉⵙⵎⵖⵓⵔⵉⵏ ⵙⴳ 5 ⵜⵉⵔⵣⵉⵡⵉⵏ.',
              en: 'Every verified salon visit earns +3 to +22 points calibrated to your chosen services, unlocking progressive rewards starting after 5 confirmed visits: free hair wash, facial mask, and -5 to -10 MAD VIP discounts.',
              es: 'Cada visita verificada suma +3 a +22 puntos según el servicio y desbloquea premios desde la 5.ª visita: lavado gratis, mascarilla y descuentos de hasta -10 MAD.',
            })}
          </p>
        </div>

        {/* Client Identification / Quick Phone Lookup Bar */}
        <div className="max-w-3xl mx-auto mb-8 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 shadow-sm">
          {isIdentified && resolvedClientIdentity ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-2">
                    <span>{clientDisplayName}</span>
                    {crmProfile?.isVip && (
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                        · VIP
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 font-mono tabular-nums">
                    <span dir="ltr">{resolvedClientIdentity.rawPhone}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {verifiedVisits}{' '}
                      {pickLang(lang, {
                        ar: 'زيارة مؤكدة',
                        fr: 'visites vérifiées',
                        amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ',
                        en: 'verified visits',
                        es: 'visitas verificadas',
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {pointsSummary.pointsBalance}{' '}
                      {pickLang(lang, {
                        ar: 'نقطة',
                        fr: 'pts',
                        amz: 'ⵜⵉⵏⵇⵇⵉⴹⵉⵏ',
                        en: 'pts',
                        es: 'pts',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onOpenTrackBooking && (
                  <button
                    type="button"
                    onClick={() => onOpenTrackBooking(resolvedClientIdentity.rawPhone)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                  >
                    <Ticket className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تذاكري',
                        fr: 'Mes Tickets',
                        amz: 'ⵉⵜⵉⴽⵉⵜⵏ ⵉⵏⵓ',
                        en: 'My Tickets',
                        es: 'Mis Tickets',
                      })}
                    </span>
                  </button>
                )}
                {(manualPhone || activeClientPhone || isIdentified) && (
                  <button
                    type="button"
                    onClick={handleClearActiveClient}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تغيير الرقم',
                        fr: 'Changer',
                        amz: 'ⵙⵏⴼⵍ',
                        en: 'Switch',
                        es: 'Cambiar',
                      })}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleLookupSubmit} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search
                    className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${
                      isRtl ? 'right-3.5' : 'left-3.5'
                    }`}
                  />
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => {
                      setLookupInput(e.target.value);
                      if (lookupError) setLookupError(null);
                    }}
                    placeholder={pickLang(lang, {
                      ar: 'أدخل رقم هاتفك (06...) أو رقم التذكرة (#SB-1234) لعرض تقدمك المباشر...',
                      fr: 'Téléphone (06...) ou N° ticket (#SB-1234) pour voir votre solde réel...',
                      amz: 'ⵙⵙⴽⵛⵎ ⵓⵟⵟⵓⵏ ⵏ ⵜⵉⵍⵉⴼⵓⵏ (06...) ⵏⵖ #SB-1234...',
                      en: 'Phone (06...) or Ticket (#SB-1234) to view live progress...',
                      es: 'Teléfono (06...) o Ticket (#SB-1234) para ver tu progreso...',
                    })}
                    className={`w-full min-h-[44px] py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 transition-colors"
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {isSearching
                      ? '...'
                      : pickLang(lang, {
                          ar: 'عرض نقاطي',
                          fr: 'Voir mon solde',
                          amz: 'ⵥⵕ ⵜⵉⵏⵇⵇⵉⴹⵉⵏ',
                          en: 'Check Points',
                          es: 'Ver mis puntos',
                        })}
                  </span>
                </button>
              </div>
              {lookupError && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {lookupError}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Main 2-Column Interactive Loyalty Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column (7 cols): Live Circular Progress Ring + Free Haircut Tracker + Booking State Telemetry */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Circular Progress Card linked to live Firebase state */}
            <LoyaltyProgressCard
              clientName={isIdentified ? clientDisplayName : undefined}
              crmProfile={crmProfile}
              loyaltyProgress={loyaltyProgress}
              pointsSummary={pointsSummary}
              lang={lang}
            />

            {/* Progressive Milestone Ladder (5, 10, 15, 20 Confirmed Visits) + Live Upcoming Booking Sync */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {pickLang(lang, {
                        ar: 'مراحل مكافآت الزيارات المؤكدة (بدءاً من 5 زيارات)',
                        fr: 'Paliers de Récompenses (dès 5 visites confirmées)',
                        amz: 'ⵜⵉⵙⵎⵖⵓⵔⵉⵏ ⵏ ⵜⵉⵔⵣⵉⵡⵉⵏ (ⵙⴳ 5 ⵜⵉⵔⵣⵉⵡⵉⵏ)',
                        en: 'Progressive Visit Milestones (Starting at 5 Visits)',
                        es: 'Premios Progresivos (desde 5 visitas verificadas)',
                      })}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {loyaltyProgress.justUnlockedRewardTitle
                        ? pickLang(lang, {
                            ar: `مبروك! مكافأة مفتوحة الآن: ${loyaltyProgress.justUnlockedRewardTitle}`,
                            fr: `Félicitations ! Récompense débloquée : ${loyaltyProgress.justUnlockedRewardTitle}`,
                            amz: `ⵜⴰⵙⵎⵖⵓⵔⵜ ⵉⵕⵥⵎⵏ : ${loyaltyProgress.justUnlockedRewardTitle}`,
                            en: `Unlocked now: ${loyaltyProgress.justUnlockedRewardTitle}`,
                            es: `Desbloqueado ahora: ${loyaltyProgress.justUnlockedRewardTitle}`,
                          })
                        : pickLang(lang, {
                            ar: `متبقي ${loyaltyProgress.visitsRemaining} ${loyaltyProgress.visitsRemaining === 1 ? 'زيارة مؤكدة' : 'زيارات مؤكدة'} للوصول إلى ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                            fr: `Plus que ${loyaltyProgress.visitsRemaining} visite${loyaltyProgress.visitsRemaining > 1 ? 's' : ''} avant le palier ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                            amz: `ⵉⵖⴰⵎⴰ ${loyaltyProgress.visitsRemaining} ⵉ ${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                            en: `${loyaltyProgress.visitsRemaining} verified visit${loyaltyProgress.visitsRemaining > 1 ? 's' : ''} left until #${loyaltyProgress.nextMilestone} (${loyaltyProgress.nextRewardTitle})`,
                            es: `Faltan ${loyaltyProgress.visitsRemaining} visita${loyaltyProgress.visitsRemaining > 1 ? 's' : ''} para el nivel ${loyaltyProgress.nextMilestone}`,
                          })}
                    </p>
                  </div>
                </div>

                <span className="font-mono font-black text-base text-amber-600 dark:text-amber-400 tabular-nums">
                  {verifiedVisits}/20
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${milestoneLadderProgressPct}%` }}
                />
              </div>

              {/* 4 Progressive Milestone Checkpoints (5, 10, 15, 20 Visits) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                {milestoneCards.map((m) => {
                  const Icon = m.icon;
                  const unlocked = verifiedVisits >= m.visits;
                  return (
                    <div
                      key={m.visits}
                      className={`p-3 rounded-xl border text-xs transition-colors ${
                        unlocked
                          ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-50 dark:bg-zinc-950/70 border-slate-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-black text-slate-700 dark:text-zinc-300 tabular-nums">
                          {m.visits}{' '}
                          {pickLang(lang, {
                            ar: 'زيارات',
                            fr: 'visites',
                            amz: 'ⵜⵉⵔⵣⵉⵡⵉⵏ',
                            en: 'visits',
                            es: 'visitas',
                          })}
                        </span>
                        {unlocked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Icon className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white leading-snug">
                        {m.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                        {m.subtitle}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Integrated Live Bookings Status Notice */}
              {isIdentified && (
                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span>
                      {upcomingActiveBookings.length > 0
                        ? pickLang(lang, {
                            ar: `لديك ${upcomingActiveBookings.length} موعد قادم (${upcomingActiveBookings[0].date} · ${upcomingActiveBookings[0].timeSlot === 'FLEXIBLE' ? 'طابور ذكي' : upcomingActiveBookings[0].timeSlot}) سيضيف +${expectedUpcomingPoints} نقطة عند تأكيد الحضور.`,
                            fr: `${upcomingActiveBookings.length} RDV à venir (${upcomingActiveBookings[0].date}) créditera +${expectedUpcomingPoints} pts après votre visite.`,
                            amz: `ⵖⵓⵔⴽ ${upcomingActiveBookings.length} ⵏ ⵓⵙⵉⵀⵍ (${upcomingActiveBookings[0].date}) ⴰⴷ ⵢⴰⵡⵉ +${expectedUpcomingPoints} ⵜⵏⵇⵇⵉⴹⵉⵏ.`,
                            en: `${upcomingActiveBookings.length} upcoming appointment(s) (${upcomingActiveBookings[0].date}) will add +${expectedUpcomingPoints} pts upon attendance.`,
                            es: `${upcomingActiveBookings.length} cita(s) próxima(s) (${upcomingActiveBookings[0].date}) sumarán +${expectedUpcomingPoints} pts al asistir.`,
                          })
                        : pickLang(lang, {
                            ar: `الزيارات المكتملة في السجل: ${completedBookingsCount} · تُحتسب النقاط حسب خدمات كل زيارة فور تأكيد الحضور بالصالون.`,
                            fr: `${completedBookingsCount} visite(s) complétée(s) · Points crédités selon vos services dès confirmation au salon.`,
                            amz: `${completedBookingsCount} ⵏ ⵜⵉⵔⵣⴰ ⵉⵎⴷⴰⵏ · ⵜⵉⵏⵇⵇⵉⴹⵉⵏ ⵜⵜⵓⵃⵙⴰⴱⵏⵜ ⴳ ⵓⵙⴰⵍⵓⵏ.`,
                            en: `${completedBookingsCount} completed visit(s) · Service points credited upon salon check-in.`,
                            es: `${completedBookingsCount} visita(s) completada(s) · Puntos por servicio al confirmar asistencia.`,
                          })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Instant Discount Tiers + CTA */}
          <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {pickLang(lang, {
                      ar: 'مستويات الخصم الفوري بالنقاط',
                      fr: 'Paliers de Remise par Points',
                      amz: 'ⵜⵉⵙⵎⵖⵓⵔⵉⵏ ⵏ ⵜⵏⵇⵇⵉⴹⵉⵏ',
                      en: 'Instant Points Discount Tiers',
                      es: 'Niveles de Descuento por Puntos',
                    })}
                  </h3>
                </div>
                <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300 tabular-nums">
                  {pointsSummary.pointsBalance} pts
                </span>
              </div>

              <div className="space-y-3">
                {LOYALTY_POINT_TIERS.map((tier) => {
                  const pct = Math.min(
                    100,
                    Math.round((pointsSummary.pointsBalance / tier.pointsCost) * 100)
                  );
                  const remaining = Math.max(0, tier.pointsCost - pointsSummary.pointsBalance);
                  const canRedeem = isIdentified && pointsSummary.pointsBalance >= tier.pointsCost;

                  return (
                    <div
                      key={tier.id}
                      className={`p-3.5 rounded-xl border transition-colors space-y-2 ${
                        canRedeem
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-50 dark:bg-zinc-950/70 border-slate-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            {tier.label[langKey]}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {tier.description[langKey]}
                          </div>
                        </div>

                        {canRedeem ? (
                          <button
                            type="button"
                            disabled={redeemingTierId !== null}
                            onClick={() =>
                              handleRedeemTier({
                                id: tier.id,
                                pointsCost: tier.pointsCost,
                                discountMAD: tier.discountMAD,
                                rewardKind: tier.rewardKind,
                                rewardTitle: tier.label[langKey],
                              })
                            }
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            {redeemingTierId === tier.id
                              ? '...'
                              : pickLang(lang, {
                                  ar: `استبدال (${tier.pointsCost})`,
                                  fr: `Échanger (${tier.pointsCost})`,
                                  amz: `ⵙⵏⴼⵍ (${tier.pointsCost})`,
                                  en: `Redeem (${tier.pointsCost})`,
                                  es: `Canjear (${tier.pointsCost})`,
                                })}
                          </button>
                        ) : (
                          <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300 whitespace-nowrap tabular-nums">
                            {tier.pointsCost} pts
                          </span>
                        )}
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            canRedeem ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                        <span>
                          {remaining === 0
                            ? pickLang(lang, {
                                ar: 'جاهز للاستبدال ✓',
                                fr: 'Disponible maintenant ✓',
                                amz: 'ⵉⵡⵊⴷ ⵖⵉⵍⴰⴷ ✓',
                                en: 'Ready to redeem ✓',
                                es: 'Disponible ahora ✓',
                              })
                            : pickLang(lang, {
                                ar: `متبقي ${remaining} نقطة`,
                                fr: `Encore ${remaining} pts`,
                                amz: `ⵉⵖⴰⵎⴰ ${remaining} pts`,
                                en: `${remaining} pts left`,
                                es: `Faltan ${remaining} pts`,
                              })}
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenBooking}
              className="w-full min-h-[46px] py-3 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-[0.99] cursor-pointer transition-all whitespace-nowrap"
            >
              <Scissors className="w-4 h-4" />
              <span>
                {pickLang(lang, {
                  ar: 'احجز موعدك الآن واجمع نقاط الولاء',
                  fr: 'Réserver maintenant & cumuler des points',
                  amz: 'ⵃⵊⵣ ⴰⵙⵉⵀⵍ ⵏⵏⴽ ⵙ ⵜⵏⵇⵇⵉⴹⵉⵏ',
                  en: 'Book Now & Earn Loyalty Points',
                  es: 'Reserva ahora y gana puntos',
                })}
              </span>
            </button>
          </div>
        </div>

        {/* Subscribe to Push Notifications (VAPID .env) Banner */}
        <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                pushStatus.subscribed
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-400'
              }`}
            >
              {pushStatus.subscribed ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <BellRing className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {pickLang(lang, {
                  ar: 'إشعارات المواعيد وأخبار صالون بومليك',
                  fr: 'Alertes Rendez-vous & Nouveautés du Salon',
                  amz: 'ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵉⵙⵉⵀⴰⵍⵏ ⴷ ⵓⵙⴰⵍⵓⵏ',
                  en: 'Appointment Updates & Barbershop News',
                  es: 'Alertas de Citas y Novedades del Salón',
                })}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {pushStatus.subscribed
                  ? pickLang(lang, {
                      ar: 'جهازك مشترك حالياً في الإشعارات الفورية لتأكيد المواعيد، تغييرات التوقيت، وعروض النقاط.',
                      fr: 'Votre navigateur est abonné aux notifications pour vos rendez-vous et les actualités du salon.',
                      amz: 'ⵜⵉⵍⵉⴼⵓⵏ ⵏⵏⴽ ⵉⵣⵎⵎⴻⵎ ⵉ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵉⵙⵉⵀⴰⵍⵏ ⴷ ⵓⵙⴰⵍⵓⵏ.',
                      en: 'Your browser is subscribed to push notifications for bookings and Salon Boumlik news.',
                      es: 'Tu navegador está suscrito a notificaciones de citas y novedades del salón.',
                    })
                  : pickLang(lang, {
                      ar: 'فعّل إشعارات المتصفح للتوصل الفوري بتحديثات مواعيدك، أرصدة النقاط، وأحدث أخبار وعروض الصالون.',
                      fr: 'Activez les notifications push pour suivre vos rendez-vous, points et offres exclusives.',
                      amz: 'ⵙⵙⵏⵜⵉ ⵉⵏⵖⵎⵉⵙⵏ ⵏ ⵓⵎⵙⵙⵓⵜⵍ ⵉ ⵉⵙⵉⵀⴰⵍⵏ ⴷ ⵜⵏⵇⵇⵉⴹⵉⵏ ⵏⵏⴽ.',
                      en: 'Enable browser push notifications for real-time appointment updates and barbershop offers.',
                      es: 'Activa las notificaciones push para seguir tus citas, puntos y ofertas.',
                    })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubscribeNotifications}
            disabled={isSubscribingPush || !pushStatus.supported}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-all disabled:opacity-60 ${
              pushStatus.subscribed
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
            }`}
          >
            {pushStatus.subscribed ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <BellRing className="w-4 h-4" />
            )}
            <span>
              {isSubscribingPush
                ? '...'
                : pushStatus.subscribed
                ? pickLang(lang, {
                    ar: 'تم الاشتراك ✓ (إعادة المزامنة)',
                    fr: 'Abonné ✓',
                    amz: 'ⵉⵜⵜⵓⵣⵎⵎⴻⵎ ✓',
                    en: 'Subscribed ✓',
                    es: 'Suscrito ✓',
                  })
                : pickLang(lang, {
                    ar: 'اشترك في الإشعارات',
                    fr: 'S’abonner aux notifications',
                    amz: 'ⵣⵎⵎⴻⵎ ⵉ ⵉⵏⵖⵎⵉⵙⵏ',
                    en: 'Subscribe to Notifications',
                    es: 'Suscribirse a notificaciones',
                  })}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
