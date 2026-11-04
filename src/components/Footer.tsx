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
  Building,
  Coffee,
  QrCode
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  onOpenBooking: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenBooking }) => {
  const { lang, t } = useLanguage();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#050608] border-t border-zinc-800 text-zinc-400 text-xs">
      
      {/* Top Banner: Quick Call to Action */}
      <div className="border-b border-zinc-900 bg-gradient-to-r from-amber-500/10 via-[#050608] to-amber-500/10 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
              Salon Boumlik • Taroudant
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white font-display">
              "{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}" — {t.mensOnly}
            </h3>
            <p className="text-xs text-zinc-400">
              {lang === 'ar'
                ? 'حدد خدماتك المفضلة وسنوافيك بالسعر المناسب والوقت مباشرة عبر الواتساب على 0635392503.'
                : lang === 'amz'
                ? 'ⵙⵜⵢ ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⴽ ⴰⴷ ⴰⴽ-ⴷ ⵢⴰⵡⴹ ⵡⴰⵜⵉⴳ ⴳ ⵡⴰⵜⵙⴰⴱ 0635392503.'
                : lang === 'en'
                ? 'Select your services and get your custom quote on WhatsApp at 0635392503.'
                : 'Composez votre sélection de prestations et recevez votre devis sur WhatsApp au 0635392503.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenBooking}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-400/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'طلب السعر على واتساب' : lang === 'amz' ? 'ⴰⵙⵔⵓⵙ ⴳ ⵡⴰⵜⵙⴰⴱ' : 'Demander mon Devis WhatsApp'}
            </button>
            <a
              href={`tel:${SALON_INFO.phone}`}
              className="px-5 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-800 transition-colors"
            >
              06 35 39 25 03
            </a>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-amber-500/40 p-1 flex items-center justify-center shadow-md">
                <img 
                  src={SALON_INFO.media.logo} 
                  alt="Salon Boumlik Logo" 
                  className="w-full h-full object-contain filter drop-shadow"
                />
              </div>
              <div>
                <span className="font-display text-lg font-black text-white">
                  {lang === 'amz' ? (
                    <span>ⵙⴰⵍⵓⵏ <span className="text-gold-gradient">ⴱⵓⵎⵍⵉⴽ</span></span>
                  ) : lang === 'ar' ? (
                    <span>صالون <span className="text-gold-gradient">بومليك</span></span>
                  ) : (
                    <span>SALON <span className="text-gold-gradient">BOUMLIK</span></span>
                  )}
                </span>
                <div className="text-xs font-serif italic text-amber-400">"{SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}"</div>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
              {lang === 'ar'
                ? 'صالون حلاقة وعناية متكاملة مخصص للرجال في تارودانت. بإشراف خبير الحلاقة حسن بومليك وفريق العمل المحترف. قصات عصرية، تحديد اللحية، علاجات البروتين، والراحة التامة.'
                : lang === 'amz'
                ? 'ⵙⴰⵍⵓⵏ ⵉⵥⵍⵉⵏ ⵙ ⵓⵔⴳⴰⵣ ⴳ ⵜⴰⵔⵓⴷⴰⵏⵜ. ⵜⴰⴽⵔⴹⴰ ⵜⴰⵜⵔⴰⵔⵜ, ⵜⴰⵎⴰⵔⵜ ⴷ ⵓⵙⵉⵔⵉⴷ ⵏ ⵓⴷⵎ.'
                : lang === 'en'
                ? 'A premier men’s grooming barbershop in Taroudant, founded by Hassan Boumlik. Modern scissor cuts, straight razor beard sculpting, and facial treatments.'
                : 'Salon de coiffure et barbier d\'exception exclusivement réservé aux hommes. Fondé par Hassan Boumlik à Taroudant. Coiffure contemporaine, rituels barbe, soins du visage et confort absolu.'}
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <a
                href={SALON_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-pink-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="Instagram @SalonBoumlik"
              >
                <Instagram className="w-4 h-4" />
              </a>

              <a
                href={SALON_INFO.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="Facebook Salon Boumlik"
              >
                <Facebook className="w-4 h-4" />
              </a>

              <a
                href={`https://wa.me/${SALON_INFO.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="WhatsApp 0635392503"
              >
                <MessageCircle className="w-4 h-4" />
              </a>

              <a
                href={`mailto:${SALON_INFO.email}`}
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-800 flex items-center justify-center transition-colors"
                title="Gmail MrBoumlik@gmail.com"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {lang === 'ar' ? 'أقسام الموقع' : lang === 'amz' ? 'ⴰⵖⴰⵡⴰⵙ' : 'Navigation'}
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#services" className="hover:text-amber-400 transition-colors">
                  {t.navServices}
                </a>
              </li>
              <li>
                <a href="#amenities" className="hover:text-amber-400 transition-colors">
                  {t.navAmenities}
                </a>
              </li>
              <li>
                <a href="#team" className="hover:text-amber-400 transition-colors">
                  {t.navTeam}
                </a>
              </li>
              <li>
                <a href="#location" className="hover:text-amber-400 transition-colors">
                  {t.navLocation}
                </a>
              </li>
              <li>
                <a href="#reviews" className="hover:text-amber-400 transition-colors">
                  {t.navReviews}
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-amber-400 transition-colors">
                  {t.navContact}
                </a>
              </li>
            </ul>
          </div>

          {/* Location details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {lang === 'ar' ? 'العنوان والموقع' : lang === 'amz' ? 'ⴰⴷⵖⴰⵔ' : 'Localisation & Repères'}
            </h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <Building className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>{SALON_INFO.address[lang] || SALON_INFO.address.fr}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <a href={`tel:${SALON_INFO.phone}`} className="hover:text-amber-400 font-bold text-white">
                  {SALON_INFO.displayPhone}
                </a>
              </li>
            </ul>
          </div>

          {/* Team & Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {lang === 'ar' ? 'فريق العمل' : lang === 'amz' ? 'ⵜⴰⵔⴰⴱⴱⵓⵜ' : "L'Équipe & Horaires"}
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="text-zinc-300 font-semibold">
                Hassan, Anouar Arif, Lahcen Lhanz, Mounir Qurdeny
              </div>
              <div className="pt-1 text-zinc-400">
                10:00 - 22:00
              </div>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t.mensOnly}</span>
              </span>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 mt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-zinc-500 text-center sm:text-left">
            © {new Date().getFullYear()} {SALON_INFO.name[lang] || SALON_INFO.name.fr} • {t.footerRights}
          </p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors p-2 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer"
          >
            <span>{lang === 'ar' ? 'أعلى الصفحة' : lang === 'amz' ? 'ⴰⴼⵍⵍⴰ' : 'Haut de page'}</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </footer>
  );
};
