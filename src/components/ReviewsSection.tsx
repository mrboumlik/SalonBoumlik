import React, { useState, useRef } from 'react';
import { 
  Star, 
  MessageSquarePlus, 
  CheckCircle2, 
  ChevronLeft,
  ChevronRight,
  X,
  QrCode,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INITIAL_REVIEWS, SERVICES, SALON_INFO } from '../data/barbershopData';
import { CustomerReview } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useSalonProfileSettings } from '../utils/salonSettingsStore';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { submitBarberReview, useFirestoreReviews } from '../utils/reviewsStore';
import { pickLang } from '../utils/i18n';
import { safeStorageGet } from '../utils/safeBrowser';

export const ReviewsSection: React.FC = () => {
  const { lang, isRtl } = useLanguage();
  const salonSettings = useSalonProfileSettings();
  const barberRoster = useBarberRoster();
  const barberProfiles = useBarberProfiles();
  const mergedBarbers = React.useMemo(
    () => getMergedBarbers(barberProfiles, barberRoster),
    [barberProfiles, barberRoster]
  );
  const { reviews: firestoreReviews } = useFirestoreReviews();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const [localCustomReviews, setLocalCustomReviews] = useState<CustomerReview[]>(() => {
    try {
      const stored = safeStorageGet('salon_boumlik_reviews_v3', 'local');
      if (stored) {
        const parsed = JSON.parse(stored) as CustomerReview[];
        return Array.isArray(parsed)
          ? parsed.filter((r) => !INITIAL_REVIEWS.some((initR) => initR.id === r.id))
          : [];
      }
    } catch {
      // fallback
    }
    return [];
  });

  const reviews: CustomerReview[] = React.useMemo(() => {
    if (firestoreReviews.length > 0) {
      const ids = new Set(firestoreReviews.map((r) => r.id));
      const uniqueLocal = localCustomReviews.filter((r) => !ids.has(r.id));
      return [...firestoreReviews, ...uniqueLocal];
    }
    return [...localCustomReviews, ...INITIAL_REVIEWS];
  }, [firestoreReviews, localCustomReviews]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');

  // Form states
  const [selectedBarberId, setSelectedBarberId] = useState<string>(mergedBarbers[0]?.id || 'hassan');
  const [author, setAuthor] = useState('');
  const [city, setCity] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const saved = await submitBarberReview({
        barberId: selectedBarberId,
        author: author.trim(),
        city: city.trim() || 'Taroudant',
        serviceName: serviceName || (SERVICES[0].name[lang] || SERVICES[0].name.fr),
        rating,
        comment: comment.trim(),
        dateLabel:
          {
            fr: "À l'instant",
            ar: 'الآن',
            en: 'Just now',
            amz: 'ⵖⵉⵍⴰⴷ',
            es: 'Ahora mismo',
          }[lang] || 'Just now',
      });

      setLocalCustomReviews((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      setSuccessMessage(true);

      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#ffffff', '#2563eb', '#f59e0b'],
        });
      } catch {
        // ignore
      }

      setTimeout(() => {
        setSuccessMessage(false);
        setIsModalOpen(false);
        setAuthor('');
        setComment('');
        setCity('');
      }, 1500);
    } catch (err) {
      console.error('Failed to submit review to Firestore:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (filterRating === 'all') return true;
    return r.rating === filterRating;
  });

  const displayedCarouselReviews = filteredReviews.slice(0, 9);

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || displayedCarouselReviews.length === 0) return;
    const stepWidth = el.scrollWidth / displayedCarouselReviews.length;
    if (stepWidth <= 0) return;
    const rawIdx = Math.round(Math.abs(el.scrollLeft) / stepWidth);
    setActiveSlideIndex(Math.max(0, Math.min(displayedCarouselReviews.length - 1, rawIdx)));
  };

  const scrollCarouselBy = (direction: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = Math.max(260, el.clientWidth * 0.85);
    const delta = (isRtl ? -direction : direction) * cardWidth;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToReviewSlide = (idx: number) => {
    const el = carouselRef.current;
    if (!el || displayedCarouselReviews.length === 0) return;
    const stepWidth = el.scrollWidth / displayedCarouselReviews.length;
    const targetLeft = (isRtl ? -1 : 1) * stepWidth * idx;
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setActiveSlideIndex(idx);
  };

  const GOOGLE_REVIEW_URL = salonSettings.googleReviewUrl;

  const ui = {
    badge: {
      fr: 'Avis Clients Vérifiés • Google Reviews',
      ar: 'تقييمات زبناء صالون بومليك على Google',
      en: 'Verified Reviews • Google 5.0 Rating',
      amz: 'ⵜⵉⵡⵍⴰⴼⵉⵏ ⵏ ⵉⵎⵣⴷⴰⵖ',
      es: 'Opiniones verificadas en Google',
    }[lang] || 'Avis Vérifiés',
    title: {
      fr: 'La Référence Masculine à Taroudant',
      ar: 'رأي زبنائنا وتجربتهم في الصالون',
      en: 'Rated 5.0 on Google Maps',
      amz: 'ⵜⴰⵏⵏⴰⵢⵉⵏ ⵏ ⵉⵎⵣⴷⴰⵖ',
      es: 'Valorado 5.0 en Google Maps',
    }[lang] || 'Avis Clients',
    subtitle: {
      fr: 'Rejoignez plus de 200 clients satisfaits. Donnez votre avis ou scannez le QR code en salon.',
      ar: 'انضم لمئات الزبناء الراضين في تارودانت. اترك تقييمك على جوجل أو امسح رمز الاستجابة السريعة.',
      en: 'Join our community of satisfied gentlemen in Taroudant. Leave a Google Review or scan the QR Code.',
      amz: 'ⴰⵔⵎ ⵜⵉⵔⵎⵜ ⵏⵏⴽ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵜⴰⵔⵓⴷⴰⵏⵜ.',
      es: 'Únete a nuestros clientes satisfechos en Taroudant. Deja tu reseña en Google o escanea el QR.',
    }[lang] || 'Rejoignez nos clients satisfaits',
    btnGoogle: {
      fr: 'Laisser un Avis 5 Étoiles sur Google',
      ar: 'أضف تقييمك 5 نجوم على Google',
      en: 'Leave a 5-Star Review on Google',
      amz: 'ⴰⵔⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ ⴳ ⴳⵓⴳⵍ',
      es: 'Dejar reseña 5 estrellas en Google',
    }[lang] || 'Laisser un avis sur Google',
    btnQr: {
      fr: 'Scanner le QR Code Google',
      ar: 'مسح رمز الاستجابة السريعة QR',
      en: 'Scan QR Review Code',
      amz: 'ⵙⴽⴰⵏⵉ QR Code',
      es: 'Escanear código QR de Google',
    }[lang] || 'Scanner le QR',
    btnLocal: {
      fr: 'Écrire un Commentaire Direct',
      ar: 'كتابة تعليق مباشر في الموقع',
      en: 'Write On-Site Review',
      amz: 'ⴰⵔⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ ⴳ ⵓⵙⵉⵜ',
      es: 'Escribir reseña en la web',
    }[lang] || 'Écrire un avis',
  };

  return (
    <section id="reviews" className="py-16 sm:py-24 bg-slate-50 dark:bg-black text-slate-900 dark:text-white relative border-t border-slate-200 dark:border-zinc-900 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-red-600 dark:text-red-400 mb-3 shadow-2xs">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
            <span>{ui.badge}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            {ui.title}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-zinc-400">
            {ui.subtitle}
          </p>
        </div>

        {/* Realistic Google Reviews Widget Showcase Card */}
        <div className="max-w-4xl mx-auto mb-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-xl dark:shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-zinc-800">
            
            {/* Google Rating Big Metric */}
            <div className="flex items-center gap-4 text-left rtl:text-right">
              {/* Google G logo circle */}
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 dark:border-transparent p-2.5 flex items-center justify-center flex-shrink-0 shadow-md">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">5.0</span>
                  <div className="flex text-amber-500 dark:text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-500 dark:fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium mt-0.5">
                  {pickLang(lang, {
                    ar: 'التقييم الرسمي في Google Maps • صالون بومليك تارودانت',
                    fr: 'Note d’excellence sur Google Maps • Salon Boumlik Taroudant',
                    amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵜⴰⵎⴰⴷⴷⵓⴷⵜ ⴳ Google Maps • Salon Boumlik',
                    en: 'Official Google Maps Rating • Salon Boumlik Taroudant',
                    es: 'Calificación oficial en Google Maps • Salon Boumlik Taroudant',
                  })}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons for Reviews */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
              >
                <span>{ui.btnGoogle}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setIsQrModalOpen(true)}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-red-600 dark:text-red-500" />
                <span>{ui.btnQr}</span>
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{ui.btnLocal}</span>
              </button>
            </div>

          </div>

          {/* Rating filter pills */}
          <div className="flex items-center justify-between gap-3 pt-4 text-xs">
            <span className="text-slate-600 dark:text-zinc-400 font-medium hidden sm:inline">
              {pickLang(lang, {
                ar: 'تصفية حسب التقييم:',
                fr: 'Filtrer par note :',
                amz: 'ⵙⵜⵢ ⵙ ⵜⴰⵏⵏⴰⵢⵜ :',
                en: 'Filter by rating:',
                es: 'Filtrar por nota:',
              })}
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFilterRating('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterRating === 'all'
                    ? 'bg-slate-900 dark:bg-zinc-800 text-white border border-slate-900 dark:border-zinc-700'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {pickLang(lang, {
                  ar: 'الكل',
                  fr: 'Tous',
                  amz: 'ⴰⴽⴽⵯ',
                  en: 'All',
                  es: 'Todos',
                })}{' '}
                ({reviews.length})
              </button>
              {[5, 4].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRating(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    filterRating === r
                      ? 'bg-slate-900 dark:bg-zinc-800 text-white border border-slate-900 dark:border-zinc-700'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <span>{r}</span>
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Carousel Controls (Prev / Next & Counter) */}
        {displayedCarouselReviews.length > 1 && (
          <div className="flex md:hidden items-center justify-between gap-3 max-w-6xl mx-auto mb-3 px-1">
            <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
              {pickLang(lang, {
                ar: 'اسحب لليسار أو اليمين لاستعراض الآراء',
                fr: 'Glissez pour voir les avis',
                amz: 'ⵙⵙⵓⵜⵍ ⵉ ⵜⵏⵏⴰⵢⵉⵏ',
                en: 'Swipe to browse testimonials',
                es: 'Desliza para ver opiniones',
              })}
            </span>
            <div className="flex items-center gap-1.5" dir="ltr">
              <button
                type="button"
                onClick={() => scrollCarouselBy(-1)}
                aria-label="Previous testimonial"
                className="min-h-[38px] min-w-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white flex items-center justify-center shadow-2xs active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-zinc-300 px-1.5 tabular-nums">
                {activeSlideIndex + 1}/{displayedCarouselReviews.length}
              </span>
              <button
                type="button"
                onClick={() => scrollCarouselBy(1)}
                aria-label="Next testimonial"
                className="min-h-[38px] min-w-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white flex items-center justify-center shadow-2xs active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Horizontal Scrollable Carousel on Mobile / Multi-Column Grid on Desktop */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4 max-w-6xl mx-auto overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-smooth pb-3 md:pb-0 -mx-4 px-4 md:mx-auto md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {displayedCarouselReviews.map((rev, idx) => {
            const authorName = rev.author;
            const cityName = typeof rev.city === 'object' ? (rev.city as any)[lang] || rev.city.fr : rev.city;
            const commentText = typeof rev.comment === 'object' ? (rev.comment as any)[lang] || rev.comment.fr : rev.comment;
            const serviceStr = typeof rev.serviceName === 'object' ? (rev.serviceName as any)[lang] || rev.serviceName.fr : rev.serviceName;

            return (
              <div
                key={rev.id}
                className={`snap-start flex-shrink-0 w-[84vw] sm:w-[330px] md:w-auto p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs transition-all flex flex-col justify-between space-y-3.5 ${
                  idx >= 6 ? 'md:hidden' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Reviewer Top Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center font-bold text-xs text-slate-900 dark:text-white flex-shrink-0">
                        {authorName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">{authorName}</h4>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate block">{cityName}</span>
                      </div>
                    </div>

                    <div className="flex text-amber-500 dark:text-amber-400 flex-shrink-0">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-500 dark:fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed italic line-clamp-4 md:line-clamp-none">
                    "{commentText}"
                  </p>
                </div>

                {/* Service Tag & Verification */}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-900 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span className="text-slate-700 dark:text-zinc-300 font-medium truncate max-w-[165px]">
                    {rev.barberName ? `${rev.barberName.split(' ')[0]} · ` : ''}{serviceStr}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      {pickLang(lang, {
                        ar: 'تقييم موثق',
                        fr: 'Avis vérifié',
                        amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵉⵜⵜⵓⵙⵙⴷⴰⵏ',
                        en: 'Verified Review',
                        es: 'Reseña verificada',
                      })}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Carousel Pagination Dots */}
        {displayedCarouselReviews.length > 1 && (
          <div className="flex md:hidden items-center justify-center gap-1.5 mt-3" aria-label="Carousel pagination">
            {displayedCarouselReviews.map((rev, idx) => (
              <button
                key={rev.id}
                type="button"
                onClick={() => scrollToReviewSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-200 cursor-pointer ${
                  activeSlideIndex === idx
                    ? 'w-5 bg-amber-500'
                    : 'w-2 bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        )}

      </div>

      {/* QR CODE MODAL - High Quality Google Review Code */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-4 sb-modal-backdrop">
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5 text-center shadow-2xl">
            
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 dark:border-transparent p-2 mx-auto shadow-md">
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {pickLang(lang, {
                  ar: 'امسح رمز التقييم على Google',
                  fr: 'Scannez le QR Code Google',
                  amz: 'ⵙⴽⴰⵏⵉ QR Code Google',
                  en: 'Scan the Google Review QR Code',
                  es: 'Escanea el QR de Google',
                })}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                {pickLang(lang, {
                  ar: 'وجه كاميرا هاتفك مباشرة نحو الرمز لإعطاء رأيك في ثوانٍ',
                  fr: 'Ouvrez votre appareil photo pour noter Salon Boumlik en un instant',
                  amz: 'ⵕⵥⵎ ⵜⴰⴽⴰⵎⵉⵔⴰ ⵏⵏⴽ ⴰⴼⴰⴷ ⴰⴷ ⵜⴼⴽⴷ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ',
                  en: 'Point your phone camera at the code to rate Salon Boumlik in seconds',
                  es: 'Apunta tu cámara para valorar a Salon Boumlik al instante',
                })}
              </p>
            </div>

            {/* Official QR Code Image with Google logo in center */}
            <div className="p-3 bg-white border border-slate-200 dark:border-transparent rounded-2xl mx-auto w-56 h-56 shadow-xl flex items-center justify-center">
              <img
                src={SALON_INFO.media.qrGoogleReview}
                alt="Google Review QR Code"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="pt-2">
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <span>
                  {pickLang(lang, {
                    ar: 'أو افتح الرابط المباشر',
                    fr: 'Ou Ouvrir le Lien Direct',
                    amz: 'ⵏⵖ ⵕⵥⵎ ⴰⵙⵖⵏ ⵓⵙⵔⵉⴷ',
                    en: 'Or Open Direct Link',
                    es: 'O abrir enlace directo',
                  })}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </div>
      )}

      {/* LEAVE A REVIEW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-4 sb-modal-backdrop">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {pickLang(lang, {
                  ar: 'شاركنا رأيك في صالون بومليك',
                  fr: 'Donnez Votre Avis',
                  amz: 'ⴼⴽ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵖⴼ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
                  en: 'Share Your Review',
                  es: 'Deja tu reseña',
                })}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                {pickLang(lang, {
                  ar: 'رأيك يهمنا لمواصلة تقديم أفضل خدمة رجالية بتارودانت',
                  fr: 'Votre retour nous aide à perfectionner notre expérience.',
                  amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵜⴰⵡⵙ ⴰⵖ ⵉ ⵓⵙⴱⵓⵖⵍⵓ ⵏ ⵜⵏⴰⴼⵓⵜ.',
                  en: 'Your feedback helps us keep delivering the best service in Taroudant.',
                  es: 'Tu opinión nos ayuda a mejorar nuestro servicio.',
                })}
              </p>
            </div>

            {successMessage ? (
              <div className="p-6 text-center text-emerald-600 dark:text-emerald-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <p className="font-bold text-sm">
                  {pickLang(lang, {
                    ar: 'شكراً جزيلاً على تقييمك!',
                    fr: 'Merci pour votre confiance !',
                    amz: 'ⵜⴰⵏⵎⵎⵉⵔⵜ ⵉ ⵜⵏⵏⴰⵢⵜ ⵏⵏⴽ!',
                    en: 'Thank you for your review!',
                    es: '¡Muchas gracias por tu reseña!',
                  })}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">
                    {pickLang(lang, {
                      ar: 'الحلاق المعني بالتقييم:',
                      fr: 'Barbier concerné :',
                      amz: 'ⴰⵎⴽⵔⴰⴹ:',
                      en: 'Barber:',
                      es: 'Barbero:',
                    })}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {mergedBarbers.map((b) => {
                      const active = selectedBarberId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBarberId(b.id)}
                          className={`px-2.5 py-2 rounded-xl border text-left rtl:text-right font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <img
                            src={b.avatar}
                            alt={b.name[lang] || b.name.fr}
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                          />
                          <span className="truncate text-[11px]">{b.name[lang] || b.name.fr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    {pickLang(lang, {
                      ar: 'الاسم الكامل:',
                      fr: 'Votre nom :',
                      amz: 'ⵉⵙⵎ ⵏⵏⴽ :',
                      en: 'Full Name:',
                      es: 'Tu nombre:',
                    })}
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    required
                    placeholder="Omar Ait"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    {pickLang(lang, {
                      ar: 'المدينة / الحي:',
                      fr: 'Ville / Quartier :',
                      amz: 'ⵜⴰⵎⴷⵉⵏⵜ / ⴰⵙⵓⵏ :',
                      en: 'City / Area:',
                      es: 'Ciudad / Zona:',
                    })}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Taroudant"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    {pickLang(lang, {
                      ar: 'تقييمك بالنجوم:',
                      fr: 'Votre note :',
                      amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵙ ⵉⵜⵔⴰⵏ :',
                      en: 'Star Rating:',
                      es: 'Tu puntuación:',
                    })}
                  </label>
                  <div className="flex gap-1 text-amber-500 dark:text-amber-400 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 text-2xl hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= rating ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : 'text-slate-300 dark:text-zinc-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    {pickLang(lang, {
                      ar: 'تعليقك وتجربتك:',
                      fr: 'Votre commentaire :',
                      amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ :',
                      en: 'Your comment:',
                      es: 'Tu comentario:',
                    })}
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    placeholder={pickLang(lang, {
                      ar: 'اكتب رأيك بصراحة...',
                      fr: 'Partagez votre ressenti...',
                      amz: 'ⴰⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ...',
                      en: 'Share your experience...',
                      es: 'Comparte tu experiencia...',
                    })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    {pickLang(lang, {
                      ar: 'إلغاء',
                      fr: 'Annuler',
                      amz: 'ⵙⵔ',
                      en: 'Cancel',
                      es: 'Cancelar',
                    })}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors cursor-pointer"
                  >
                    {isSubmitting
                      ? '...'
                      : pickLang(lang, {
                          ar: 'نشر التقييم',
                          fr: 'Publier',
                          amz: 'ⵙⵙⵉⴼⴹ',
                          en: 'Submit',
                          es: 'Publicar',
                        })}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </section>
  );
};
