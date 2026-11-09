import React, { useState, useEffect } from 'react';
import { 
  Star, 
  MessageSquarePlus, 
  CheckCircle2, 
  Sparkles, 
  X,
  Send,
  QrCode,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INITIAL_REVIEWS, SERVICES, SALON_INFO } from '../data/barbershopData';
import { CustomerReview } from '../types';
import { useLanguage } from '../context/LanguageContext';

export const ReviewsSection: React.FC = () => {
  const { lang, t } = useLanguage();
  const [reviews, setReviews] = useState<CustomerReview[]>(() => {
    try {
      const stored = localStorage.getItem('salon_boumlik_reviews_v3');
      if (stored) return JSON.parse(stored);
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
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('salon_boumlik_reviews_v3', JSON.stringify(reviews));
    } catch (e) {
      console.error(e);
    }
  }, [reviews]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const newReview: CustomerReview = {
        id: `rev-${Date.now()}`,
        author: author.trim(),
        city: city.trim() || 'Taroudant',
        serviceName: serviceName || (SERVICES[0].name[lang] || SERVICES[0].name.fr),
        rating,
        date: {
          fr: "À l'instant",
          ar: 'الآن',
          en: 'Just now',
          amz: 'ⵖⵉⵍⴰⴷ',
          es: 'Ahora mismo',
        }[lang] || 'Just now',
        comment: comment.trim(),
        tags: [lang === 'ar' ? 'زبون موثق' : 'Client vérifié'],
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
    }, 400);
  };

  const filteredReviews = reviews.filter((r) => {
    if (filterRating === 'all') return true;
    return r.rating === filterRating;
  });

  const GOOGLE_REVIEW_URL = 'https://g.page/r/CZWdoYsTiwy_EAE/review';

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
    <section id="reviews" className="py-16 sm:py-24 bg-black text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-bold text-red-400 mb-3">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{ui.badge}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
            {ui.title}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-zinc-400">
            {ui.subtitle}
          </p>
        </div>

        {/* Realistic Google Reviews Widget Showcase Card */}
        <div className="max-w-4xl mx-auto mb-12 p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            
            {/* Google Rating Big Metric */}
            <div className="flex items-center gap-4 text-left">
              {/* Google G logo circle */}
              <div className="w-16 h-16 rounded-2xl bg-white p-2.5 flex items-center justify-center flex-shrink-0 shadow-md">
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
                  <span className="text-3xl sm:text-4xl font-black text-white font-mono">5.0</span>
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  {lang === 'ar'
                    ? 'التقييم الرسمي في Google Maps • صالون بومليك تارودانت'
                    : 'Note d’excellence sur Google Maps • Salon Boumlik Taroudant'}
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
                className="py-2.5 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold text-xs flex items-center gap-2 transition-colors"
              >
                <QrCode className="w-4 h-4 text-red-500" />
                <span>{ui.btnQr}</span>
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="py-2.5 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-blue-400" />
                <span>{ui.btnLocal}</span>
              </button>
            </div>

          </div>

          {/* Rating filter pills */}
          <div className="flex items-center justify-between gap-3 pt-4 text-xs">
            <span className="text-zinc-400 font-medium hidden sm:inline">
              {lang === 'ar' ? 'تصفية حسب التقييم:' : 'Filtrer par note :'}
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFilterRating('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterRating === 'all'
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {lang === 'ar' ? 'الكل' : 'Tous'} ({reviews.length})
              </button>
              {[5, 4].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRating(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                    filterRating === r
                      ? 'bg-zinc-800 text-white border border-zinc-700'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{r}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {filteredReviews.slice(0, 6).map((rev) => {
            const authorName = rev.author;
            const cityName = typeof rev.city === 'object' ? (rev.city as any)[lang] || rev.city.fr : rev.city;
            const commentText = typeof rev.comment === 'object' ? (rev.comment as any)[lang] || rev.comment.fr : rev.comment;
            const serviceStr = typeof rev.serviceName === 'object' ? (rev.serviceName as any)[lang] || rev.serviceName.fr : rev.serviceName;

            return (
              <div
                key={rev.id}
                className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Reviewer Top Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                        {authorName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{authorName}</h4>
                        <span className="text-[10px] text-zinc-400">{cityName}</span>
                      </div>
                    </div>

                    <div className="flex text-amber-400">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <p className="text-xs text-zinc-300 leading-relaxed italic">
                    "{commentText}"
                  </p>
                </div>

                {/* Service Tag & Verification */}
                <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="text-zinc-300 font-medium truncate max-w-[150px]">
                    {serviceStr}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'تقييم موثق' : 'Avis vérifié'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* QR CODE MODAL - High Quality Google Review Code */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5 text-center shadow-2xl">
            
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white p-2 mx-auto shadow-md">
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-black text-white">
                {lang === 'ar' ? 'امسح رمز التقييم على Google' : 'Scannez le QR Code Google'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'ar'
                  ? 'وجه كاميرا هاتفك مباشرة نحو الرمز لإعطاء رأيك في ثوانٍ'
                  : 'Ouvrez votre appareil photo pour noter Salon Boumlik en un instant'}
              </p>
            </div>

            {/* Official QR Code Image with Google logo in center */}
            <div className="p-3 bg-white rounded-2xl mx-auto w-56 h-56 shadow-xl flex items-center justify-center">
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
                <span>{lang === 'ar' ? 'أو افتح الرابط المباشر' : 'Ou Ouvrir le Lien Direct'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </div>
      )}

      {/* LEAVE A REVIEW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-white">
                {lang === 'ar' ? 'شاركنا رأيك في صالون بومليك' : 'Donnez Votre Avis'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {lang === 'ar' ? 'رأيك يهمنا لمواصلة تقديم أفضل خدمة رجالية بتارودانت' : 'Votre retour nous aide à perfectionner notre expérience.'}
              </p>
            </div>

            {successMessage ? (
              <div className="p-6 text-center text-emerald-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <p className="font-bold text-sm">
                  {lang === 'ar' ? 'شكراً جزيلاً على تقييمك!' : 'Merci pour votre confiance !'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    {lang === 'ar' ? 'الاسم الكامل:' : 'Votre nom :'}
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    required
                    placeholder="Ex: Omar Ait"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    {lang === 'ar' ? 'المدينة / الحي:' : 'Ville / Quartier :'}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Taroudant"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    {lang === 'ar' ? 'تقييمك بالنجوم:' : 'Votre note :'}
                  </label>
                  <div className="flex gap-1 text-amber-400 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 text-2xl hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    {lang === 'ar' ? 'تعليقك وتجربتك:' : 'Votre commentaire :'}
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    placeholder={lang === 'ar' ? 'اكتب رأيك بصراحة...' : 'Partagez votre ressenti...'}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
                  >
                    {isSubmitting ? '...' : lang === 'ar' ? 'نشر التقييم' : 'Publier'}
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
