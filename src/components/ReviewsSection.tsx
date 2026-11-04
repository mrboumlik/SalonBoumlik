import React, { useState, useEffect } from 'react';
import { 
  Star, 
  MessageSquarePlus, 
  CheckCircle2, 
  Sparkles, 
  X,
  Send,
  QrCode
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INITIAL_REVIEWS, SERVICES, SALON_INFO } from '../data/barbershopData';
import { CustomerReview } from '../types';
import { useLanguage } from '../context/LanguageContext';

export const ReviewsSection: React.FC = () => {
  const { lang, t } = useLanguage();
  const [reviews, setReviews] = useState<CustomerReview[]>(() => {
    try {
      const stored = localStorage.getItem('salon_boumlik_reviews_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return INITIAL_REVIEWS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');

  // Form states
  const [author, setAuthor] = useState('');
  const [city, setCity] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    if (SERVICES.length > 0 && !serviceName) {
      setServiceName(SERVICES[0].name[lang] || SERVICES[0].name.fr);
    }
  }, [lang, serviceName]);

  useEffect(() => {
    try {
      localStorage.setItem('salon_boumlik_reviews_v2', JSON.stringify(reviews));
    } catch (e) {
      console.error(e);
    }
  }, [reviews]);

  const getLocalizedStr = (field: any): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field.fr || '';
  };

  const getLocalizedTags = (tagsField: any): string[] => {
    if (!tagsField) return [];
    if (Array.isArray(tagsField)) return tagsField;
    if (typeof tagsField === 'object') {
      return tagsField[lang] || tagsField.fr || [];
    }
    return [];
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const selectedServiceName = serviceName || (SERVICES[0].name[lang] || SERVICES[0].name.fr);
      const newReview: CustomerReview = {
        id: `rev-${Date.now()}`,
        author: author.trim(),
        city: {
          fr: city.trim() || 'Taroudant',
          ar: city.trim() || 'تارودانت',
          en: city.trim() || 'Taroudant',
          amz: city.trim() || 'ⵜⴰⵔⵓⴷⴰⵏⵜ',
        },
        serviceName: {
          fr: selectedServiceName,
          ar: selectedServiceName,
          en: selectedServiceName,
          amz: selectedServiceName,
        },
        rating,
        date: {
          fr: "À l'instant",
          ar: 'الآن',
          en: 'Just now',
          amz: 'ⵖⵉⵍⴰⴷ',
        },
        comment: {
          fr: comment.trim(),
          ar: comment.trim(),
          en: comment.trim(),
          amz: comment.trim(),
        },
        tags: {
          fr: ['Client vérifié'],
          ar: ['زبون موثق'],
          en: ['Verified Client'],
          amz: ['ⴰⵎⵣⴷⴰⵖ ⵢⵓⵣⵏ'],
        },
        verified: true,
      };

      setReviews([newReview, ...reviews]);
      setIsSubmitting(false);
      setSuccessMessage(true);

      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#D97706', '#FCD34D', '#10B981']
        });
      } catch (err) {
        console.warn(err);
      }

      setTimeout(() => {
        setSuccessMessage(false);
        setIsModalOpen(false);
        setAuthor('');
        setComment('');
        setCity('');
      }, 1600);
    }, 400);
  };

  const filteredReviews = reviews.filter((r) => {
    if (filterRating === 'all') return true;
    return r.rating === filterRating;
  });

  const totalReviewsCount = reviews.length;
  const averageRating = (
    reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviewsCount
  ).toFixed(1);

  // Localized UI strings dictionary
  const ui = {
    basedOn: {
      fr: 'Basé sur Google Reviews & retours vérifiés',
      ar: 'بناءً على تقييمات جوجل والآراء الموثقة',
      en: 'Based on Google Reviews & verified feedback',
      amz: 'ⵖⴼ ⵜⴰⵏⵏⴰⵢⵉⵏ ⵏ ⴳⵓⴳⵍ ⴷ ⵉⵎⵣⴷⴰⵖ',
    }[lang],
    recommended: {
      fr: '100% Recommandé à Taroudant',
      ar: 'موصى به 100% في تارودانت',
      en: '100% Recommended in Taroudant',
      amz: '100% ⵉⵖⵓⴷⴰ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ',
    }[lang],
    qrCardTag: {
      fr: 'Fiche Google Reviews',
      ar: 'بطاقة تقييم جوجل',
      en: 'Google Review Card',
      amz: 'ⵜⴰⴼⵍⵡⵉⵜ ⵏ Google',
    }[lang],
    qrCardTitle: {
      fr: 'Scannez pour noter le salon',
      ar: 'امسح الرمز لتقييم الصالون',
      en: 'Scan to rate us on Google',
      amz: 'ⵙⴽⴰⵏⵉ ⴰⵏⴳⴰⵍ ⵉ ⵓⵙⵡⵉⵔ',
    }[lang],
    qrCardEnlarge: {
      fr: 'Agrandir le QR Code',
      ar: 'تكبير رمز الاستجابة السريعة',
      en: 'Enlarge QR Code',
      amz: 'ⵙⵉⵎⵖⵓⵔ QR',
    }[lang],
    viewPosterBtn: {
      fr: 'Voir le poster officiel Google Reviews',
      ar: 'عرض الملصق الرسمي لتقييمات جوجل',
      en: 'View official Google Reviews poster',
      amz: 'ⵥⵕ ⵜⴰⴼⵍⵡⵉⵜ ⵏ Google',
    }[lang],
    filterLabel: {
      fr: 'Filtrer :',
      ar: 'تصفية :',
      en: 'Filter:',
      amz: 'ⴰⵙⵜⴰⵢ:',
    }[lang],
    allReviews: {
      fr: 'Tous les avis',
      ar: 'جميع التقييمات',
      en: 'All reviews',
      amz: 'ⵎⴰⵕⵕⴰ ⵜⴰⵏⵏⴰⵢⵉⵏ',
    }[lang],
    fiveStars: {
      fr: '5 étoiles',
      ar: '5 نجوم',
      en: '5 stars',
      amz: '5 ⵉⵜⵔⴰⵏ',
    }[lang],
    verifiedClient: {
      fr: 'Client vérifié',
      ar: 'زبون موثق',
      en: 'Verified Client',
      amz: 'ⴰⵎⵣⴷⴰⵖ ⵢⵓⵣⵏ',
    }[lang],
    modalTitle: {
      fr: 'Votre Avis sur Salon Boumlik',
      ar: 'تقييمكم لصالون بومليك',
      en: 'Your Review of Salon Boumlik',
      amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵅⴼ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
    }[lang],
    modalSubtitle: {
      fr: 'Partagez votre retour sur la coupe, la barbe ou l’ambiance au 2ème étage.',
      ar: 'شاركنا تجربتك حول الحلاقة، تشذيب اللحية أو الأجواء بالطابق الثاني.',
      en: 'Share your feedback on your haircut, beard trim, or the atmosphere on the 2nd floor.',
      amz: 'ⴰⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵅⴼ ⵜⴽⵔⴹⴰ, ⵜⴰⵎⴰⵔⵜ ⴷ ⵓⵙⵡⵉⵔ ⵡⵉⵙ ⵙⵉⵏ.',
    }[lang],
    ratingLabel: {
      fr: 'Note globale',
      ar: 'التقييم الإجمالي',
      en: 'Overall Rating',
      amz: 'ⴰⵙⵡⵉⵔ ⴰⵎⴰⵜⴰⵢ',
    }[lang],
    nameLabel: {
      fr: 'Votre Nom *',
      ar: 'الاسم الكامل *',
      en: 'Your Name *',
      amz: 'ⵉⵙⵎ ⵏⵏⴽ *',
    }[lang],
    cityLabel: {
      fr: 'Ville ou Quartier',
      ar: 'المدينة أو الحي',
      en: 'City or District',
      amz: 'ⵜⴰⵎⴷⵉⵏⵜ ⵏⵉⵖ ⴰⴷⵖⴰⵔ',
    }[lang],
    serviceLabel: {
      fr: 'Prestation',
      ar: 'الخدمة المطلوبة',
      en: 'Service Received',
      amz: 'ⵜⴰⵏⴰⴼⵓⵜ',
    }[lang],
    commentLabel: {
      fr: 'Votre Témoignage *',
      ar: 'رأيك وتقييمك *',
      en: 'Your Review *',
      amz: 'ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ *',
    }[lang],
    commentPlaceholder: {
      fr: 'Partagez votre avis sur Hassan, Anouar, Lahcen, Mounir, la coupe ou les soins...',
      ar: 'شاركنا رأيك في الحلاقة، تعامل فريق العمل (حسن، أنوار، لحسن، منير)، والعناية بالبشرة...',
      en: 'Share your feedback on your haircut, beard trim, or care received from Hassan, Anouar, Lahcen, Mounir...',
      amz: 'ⴰⵔⴰ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵅⴼ ⵜⴽⵔⴹⴰ ⴷ ⵜⵡⵓⵔⵉ ⵏ ⵜⵔⴰⴱⴱⵓⵜ (ⵃⴰⵙⴰⵏ, ⴰⵏⵡⴰⵔ, ⵍⵃⵙⵏ, ⵎⵓⵏⵉⵔ)...',
    }[lang],
    submitBtnText: {
      fr: isSubmitting ? 'Publication...' : 'Publier mon avis',
      ar: isSubmitting ? 'جاري النشر...' : 'نشر التقييم',
      en: isSubmitting ? 'Publishing...' : 'Submit Review',
      amz: isSubmitting ? 'ⴰⵙⵔⴰⵙ...' : 'ⵙⵙⵓⴼⵖ ⵜⴰⵏⵏⴰⵢⵜ',
    }[lang],
    successTitle: {
      fr: 'Merci pour votre confiance !',
      ar: 'شكراً جزيلاً على ثقتكم !',
      en: 'Thank you for your feedback!',
      amz: 'ⵜⴰⵏⵎⵎⵉⵔⵜ ⵅⴼ ⵜⴰⴼⵍⵙⵜ ⵏⵏⵓⵏ !',
    }[lang],
    successDesc: {
      fr: 'Votre avis a été publié avec succès sur Salon Boumlik.',
      ar: 'تم نشر تقييمكم بنجاح في صالون بومليك.',
      en: 'Your review has been successfully posted for Salon Boumlik.',
      amz: 'ⵜⵣⵔⵉ ⵜⴰⵏⵏⴰⵢⵜ ⵏⵏⴽ ⵙ ⵓⵎⵓⵔⵙ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ.',
    }[lang],
    posterTitle: {
      fr: 'Poster Officiel Google Reviews',
      ar: 'الملصق الرسمي لتقييمات جوجل',
      en: 'Official Google Reviews Poster',
      amz: 'ⵜⴰⴼⵍⵡⵉⵜ ⵜⴰⵎⴰⴷⴷⵓⴷⵜ ⵏ Google',
    }[lang],
    posterSubtitle: {
      fr: 'Scannez le QR Code pour laisser votre avis directement sur Google.',
      ar: 'امسح رمز الاستجابة السريعة (QR) لوضع تقييمكم مباشرة على صفحتنا في جوجل.',
      en: 'Scan the QR code to leave your review directly on Google Maps.',
      amz: 'ⵙⴽⴰⵏⵉ ⴰⵏⴳⴰⵍ QR ⵉ ⵜⴰⵏⵏⴰⵢⵜ ⴳ Google.',
    }[lang],
    openGoogleBtn: {
      fr: 'Ouvrir directement sur Google',
      ar: 'فتح التقييمات على جوجل مباشرة',
      en: 'Open directly on Google',
      amz: 'ⵕⵥⵎ ⴳ Google',
    }[lang],
  };

  return (
    <section id="reviews" className="py-16 md:py-24 bg-[#08090C] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.reviewsTitle}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
            {lang === 'ar' ? (
              <span>تقييمات جوجل و <span className="text-gold-gradient">آراء الزبائن</span></span>
            ) : lang === 'amz' ? (
              <span>ⵜⴰⵏⵏⴰⵢⵉⵏ ⵏ ⴳⵓⴳⵍ ⴷ <span className="text-gold-gradient">ⵉⵎⵣⴷⴰⵖ</span></span>
            ) : lang === 'en' ? (
              <span>GOOGLE REVIEWS & <span className="text-gold-gradient">TESTIMONIALS</span></span>
            ) : (
              <span>AVIS GOOGLE & <span className="text-gold-gradient">TÉMOIGNAGES</span></span>
            )}
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 font-body">
            {lang === 'ar'
              ? 'اكتشف لماذا يعتبر صالون بومليك الوجهة المفضلة لرجال تارودانت للأناقة والعناية الفائقة.'
              : lang === 'amz'
              ? 'ⵥⵕ ⵎⴰⵖⴼ ⵙⵜⵢⵏ ⵉⵔⴳⴰⵣⵏ ⵏ ⵜⴰⵔⵓⴷⴰⵏⵜ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ ⵉ ⵓⵙⵎⵙⴰⵙ ⵏ ⵓⵣⵣⴰⵔ ⴷ ⵓⴷⵎ.'
              : lang === 'en'
              ? 'Discover why gentlemen across Taroudant trust Salon Boumlik for master barbering and skincare.'
              : 'Découvrez pourquoi les hommes de Taroudant et d’ailleurs choisissent Salon Boumlik comme leur adresse incontournable.'}
          </p>
        </div>

        {/* Dynamic Ratings Summary + Google Review QR Poster Card */}
        <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 mb-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Score & Stars */}
            <div className="lg:col-span-4 text-center lg:text-left space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-6 lg:pb-0 lg:pr-6">
              <div className="text-5xl sm:text-6xl font-black font-display text-gold-gradient">
                {averageRating}
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-amber-400" />
                ))}
              </div>
              <div className="text-xs text-zinc-400">
                {ui.basedOn}
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{ui.recommended}</span>
                </span>
              </div>
            </div>

            {/* Google QR Card Visual from user assets */}
            <div className="lg:col-span-4 flex items-center justify-center gap-4">
              <div 
                onClick={() => setIsQrModalOpen(true)}
                className="group relative rounded-2xl overflow-hidden border border-amber-500/40 bg-zinc-950 p-2.5 cursor-pointer shadow-xl hover:border-amber-400 transition-colors flex items-center gap-3.5 w-full max-w-sm"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white p-1 flex-shrink-0 flex items-center justify-center shadow-md">
                  <img 
                    src={SALON_INFO.media.qrGoogleReview || SALON_INFO.media.googleReviewCard} 
                    alt="Google Review QR code" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <img 
                      src={SALON_INFO.media.googleReviewBadge} 
                      alt="Google" 
                      className="w-4 h-4 object-contain"
                    />
                    <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider">
                      {ui.qrCardTag}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    {ui.qrCardTitle}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    <QrCode className="w-3 h-3 text-amber-400" />
                    <span>{ui.qrCardEnlarge}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions: Direct Google 5-Star CTA + Form button */}
            <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-center gap-3">
              <a
                href={SALON_INFO.social.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                <Star className="w-4 h-4 text-zinc-950 fill-zinc-950" />
                <span>
                  {lang === 'ar' ? 'تقييم 5 نجوم على خرائط جوجل' : lang === 'amz' ? 'ⵙⴽⵔ 5 ⵉⵜⵔⴰⵏ ⴳ Google' : 'Laisser 5 Étoiles sur Google'}
                </span>
              </a>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.leaveReviewBtn}</span>
                </button>

                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{ui.viewPosterBtn}</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 text-xs">
          <span className="text-zinc-400 mr-1">{ui.filterLabel}</span>
          <button
            onClick={() => setFilterRating('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
              filterRating === 'all'
                ? 'bg-amber-400 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
          >
            {ui.allReviews} ({reviews.length})
          </button>
          <button
            onClick={() => setFilterRating(5)}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              filterRating === 5
                ? 'bg-amber-400 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
          >
            <span>{ui.fiveStars}</span>
            <Star className="w-3 h-3 fill-current" />
          </button>
        </div>

        {/* Reviews Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReviews.map((rev) => {
            const locCity = getLocalizedStr(rev.city);
            const locDate = getLocalizedStr(rev.date);
            const locServiceName = getLocalizedStr(rev.serviceName);
            const locComment = getLocalizedStr(rev.comment);
            const locTags = getLocalizedTags(rev.tags);

            return (
              <div
                key={rev.id}
                className="rounded-3xl p-6 bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between shadow-xl"
              >
                <div>
                  {/* Author & Verified */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-zinc-800 border border-amber-500/30 flex items-center justify-center font-black text-amber-300 text-sm">
                        {rev.author.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">{rev.author}</span>
                          {rev.verified && (
                            <span title={ui.verifiedClient} className="inline-flex items-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">{locCity}</div>
                      </div>
                    </div>

                    <span className="text-[11px] text-zinc-500 font-medium">{locDate}</span>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-1 mb-2 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-amber-300 ml-1">{rev.rating}.0</span>
                  </div>

                  {/* Service Tag */}
                  <div className="inline-block text-[11px] font-bold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-lg mb-3 border border-amber-500/20">
                    {locServiceName}
                  </div>

                  {/* Review Text */}
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-body">
                    "{locComment}"
                  </p>
                </div>

                {/* Tags if any */}
                {locTags && locTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-zinc-800/80">
                    {locTags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded-md border border-zinc-800 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Leave a review modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0C0E14] border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white font-display">{ui.modalTitle}</h3>
              <p className="text-xs text-zinc-400 mt-1">
                {ui.modalSubtitle}
              </p>
            </div>

            {successMessage ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-white">{ui.successTitle}</h4>
                <p className="text-xs text-zinc-300">
                  {ui.successDesc}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                
                {/* Star rating selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 text-center">
                    {ui.ratingLabel}
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            (hoverRating || rating) >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-zinc-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-center text-xs font-bold text-amber-400 mt-1">
                    {rating === 5 && (lang === 'ar' ? 'ممتاز (5/5)' : lang === 'amz' ? 'ⵉⴼⵓⵍⴽⵉ ⴱⴰⵀⵔⴰ (5/5)' : 'Exceptionnel (5/5)')}
                    {rating === 4 && (lang === 'ar' ? 'جيد جداً (4/5)' : lang === 'amz' ? 'ⵉⴼⵓⵍⴽⵉ (4/5)' : 'Très bien (4/5)')}
                    {rating <= 3 && (lang === 'ar' ? 'مقبول (3/5)' : lang === 'amz' ? 'ⵉⵎⵙⴰⵙⴰ (3/5)' : 'Correct (3/5)')}
                  </div>
                </div>

                {/* Name & City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      {ui.nameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'ar' ? 'مثال: ياسين' : lang === 'amz' ? 'ⴰⵎⴷⵢⴰ: ⵢⴰⵙⵉⵏ' : 'Ex: Yassine'}
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      {ui.cityLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'تارودانت' : lang === 'amz' ? 'ⵜⴰⵔⵓⴷⴰⵏⵜ' : 'Taroudant'}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Service received */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {ui.serviceLabel}
                  </label>
                  <select
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                  >
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.name[lang] || s.name.fr}>
                        {s.name[lang] || s.name.fr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Comment text */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {ui.commentLabel}
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder={ui.commentPlaceholder}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-100 p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4 text-zinc-950" />
                  <span>{ui.submitBtnText}</span>
                </button>

              </form>
            )}

          </div>
        </div>
      )}

      {/* Official Google Review Poster Lightbox Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-sm sm:max-w-md w-full p-6 text-center space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-bold text-white">{ui.posterTitle}</h4>
            <p className="text-xs text-zinc-400">{ui.posterSubtitle}</p>

            <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
              <img
                src={SALON_INFO.media.googleReviewPoster}
                alt="Please rate your experience on Google Salon Boumlik"
                className="w-full h-auto object-contain"
              />
            </div>

            <div className="pt-2">
              <a
                href={SALON_INFO.social.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-2.5 px-5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs shadow-md"
              >
                {ui.openGoogleBtn}
              </a>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
