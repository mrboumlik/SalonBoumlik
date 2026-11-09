import React from 'react';
import { 
  MapPin, 
  Phone, 
  Mail, 
  ArrowUp, 
  Instagram, 
  Facebook, 
  MessageCircle, 
  ShieldCheck,
  Lock,
  Ticket
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenTrackBooking?: () => void;
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ 
  onOpenBooking,
  onOpenTrackBooking,
  onOpenAdmin 
}) => {
  const { lang, t } = useLanguage();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-black border-t border-zinc-900 text-zinc-400 text-xs">
      
      {/* Barber Pole Top Line */}
      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-white to-blue-600 opacity-90" />

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 p-0.5 flex items-center justify-center shadow-md">
                <img 
                  src={SALON_INFO.media.logoClean} 
                  alt="Salon Boumlik Logo" 
                  className="w-full h-full object-contain filter drop-shadow"
                />
              </div>
              <div>
                <span className="font-display text-base font-black text-white">
                  SALON <span className="text-red-500">BOU</span><span className="text-blue-500">MLIK</span>
                </span>
                <div className="text-[11px] italic text-zinc-300">"{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"</div>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {lang === 'ar'
                ? 'صالون حلاقة وعناية متكاملة مخصص للرجال في تارودانت. قصات عصرية، تحديد اللحية بالموس، وعلاجات البروتين في بيئة احترافية.'
                : 'Salon de coiffure et barbier d’exception réservé aux hommes à Taroudant. Coiffure contemporaine, rituels barbe et soins du visage.'}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={SALON_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-pink-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="Instagram @SalonBoumlik"
              >
                <Instagram className="w-4 h-4" />
              </a>

              <a
                href={SALON_INFO.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="Facebook Salon Boumlik"
              >
                <Facebook className="w-4 h-4" />
              </a>

              <a
                href={`https://wa.me/${SALON_INFO.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="WhatsApp 0635392503"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              {lang === 'ar' ? 'روابط سريعة' : 'Navigation Rapide'}
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li>
                <a href="#services" className="hover:text-white transition-colors">
                  {lang === 'ar' ? 'قائمة الخدمات والأسعار' : 'Prestations & Tarifs'}
                </a>
              </li>
              <li>
                <a href="#booking" className="hover:text-white transition-colors">
                  {lang === 'ar' ? 'حجز موعد عبر الموقع' : 'Réservation en Ligne'}
                </a>
              </li>
              <li>
                <a href="#reviews" className="hover:text-white transition-colors">
                  {lang === 'ar' ? 'تقييمات Google Maps 5.0' : 'Avis Google 5.0'}
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition-colors">
                  {lang === 'ar' ? 'الموقع الدقيق والاتصال' : 'Contact & Itinéraire'}
                </a>
              </li>
            </ul>
          </div>

          {/* Client Tools */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              {lang === 'ar' ? 'خدمات الزبناء' : 'Services & Suivi'}
            </h4>
            <div className="space-y-2">
              {onOpenTrackBooking && (
                <button
                  onClick={onOpenTrackBooking}
                  className="w-full text-left p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Ticket className="w-4 h-4 text-blue-400" />
                  <span>{lang === 'ar' ? 'تتبع حالة التذكرة مباشرة' : 'Suivre ma Réservation'}</span>
                </button>
              )}

              <a
                href="https://g.page/r/CZWdoYsTiwy_EAE/review"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold text-center transition-colors"
              >
                ★ {lang === 'ar' ? 'تقييم 5 نجوم على Google' : 'Laisser un Avis Google'}
              </a>
            </div>
          </div>

          {/* Direct Address & Contact */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              {lang === 'ar' ? 'العنوان بتارودانت' : 'Adresse & Contact'}
            </h4>
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <a 
                  href={SALON_INFO.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  {SALON_INFO.shortAddress[lang] || SALON_INFO.shortAddress.fr}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <a href={`tel:${SALON_INFO.phone}`} className="font-mono text-zinc-200 hover:text-white">
                  {SALON_INFO.displayPhone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="font-mono text-zinc-300">{SALON_INFO.email}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <div>
            © {new Date().getFullYear()} Salon Boumlik Taroudant. Tous droits réservés.
          </div>

          <div className="flex items-center gap-4">
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-red-400 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Accès Équipe (Hassan)</span>
              </button>
            )}

            <button
              onClick={scrollToTop}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
              aria-label="Haut de page"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
