import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Image as ImageIcon, 
  Wifi, 
  MapPin, 
  Lock, 
  Phone, 
  Instagram, 
  ExternalLink, 
  Sparkles, 
  Scissors, 
  CheckCircle2, 
  Copy, 
  ChevronDown,
  Check
} from 'lucide-react';
import { TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { BarberStaff } from '../types';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin: () => void;
  onSelectBarberForBooking?: (barberId: string) => void;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  onOpenAdmin,
  onSelectBarberForBooking,
}) => {
  const { lang, t, isRtl } = useLanguage();
  const { theme, setTheme } = useTheme();

  // Accordion state: null = all collapsed by default, or specific active key
  const [expandedSection, setExpandedSection] = useState<'team' | 'gallery' | 'wifi' | 'location' | null>(null);
  const [wifiCopied, setWifiCopied] = useState(false);

  if (!isOpen) return null;

  const toggleSection = (section: 'team' | 'gallery' | 'wifi' | 'location') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const copyWifiPassword = () => {
    navigator.clipboard.writeText(SALON_INFO.media.wifiPassword);
    setWifiCopied(true);
    setTimeout(() => setWifiCopied(false), 2000);
  };

  // Gallery items clean without overlay tags
  const galleryPhotos = [
    {
      src: SALON_INFO.media.logoClean,
      alt: 'Salon Boumlik Interior and Style',
      category: 'Fade & Styling'
    },
    {
      src: '/assets/aistudio/IMG-20240103-WA0029_222599c1.jpg',
      alt: 'Precision Beard Sculpting',
      category: 'Beard Art'
    },
    {
      src: '/assets/aistudio/IMG-20231231-WA0003_222599c1.jpg',
      alt: 'Clean Razor Line-up',
      category: 'Razor Line-up'
    },
    {
      src: '/assets/aistudio/IMG-20231231-WA0004_393afdd0.jpg',
      alt: 'Salon Boumlik Atmosphere',
      category: 'Vibe & Lounge'
    }
  ];

  const labels = {
    team: {
      fr: 'Notre Équipe & Barbiers',
      ar: 'فريق العمل والخبرات',
      en: 'Our Team & Master Barbers',
      amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏⵏⵖ',
      es: 'Nuestro equipo y barberos',
    }[lang] || 'Notre Équipe',
    gallery: {
      fr: 'Galerie d’Édition & Coupes',
      ar: 'معرض الإبداعات',
      en: 'Gallery & Cuts',
      amz: 'ⵜⴰⵙⵏⵜ ⵏ ⵜⵡⵍⴰⴼⵉⵏ',
      es: 'Galería de cortes',
    }[lang] || 'Galerie',
    wifi: {
      fr: 'Wi-Fi & Salon Lounge',
      ar: 'الواي فاي وصالة الانتظار',
      en: 'Wi-Fi & Lounge',
      amz: 'ⵡⴰⵢ ⴼⴰⵢ ⴷ ⵓⵙⴰⵢⵔⴰⵔ',
      es: 'Wi-Fi y salón',
    }[lang] || 'Wi-Fi & Lounge',
    location: {
      fr: 'Adresse & Accès Taroudant',
      ar: 'الموقع الدقيق والوصول',
      en: 'Location & Map',
      amz: 'ⴰⴷⵖⴰⵔ ⴷ ⵓⵖⴰⵔⴰⵙ',
      es: 'Ubicación y mapa',
    }[lang] || 'Adresse',
    adminButton: {
      fr: 'Espace Administration (Staff)',
      ar: 'لوحة تحكم الإدارة (خاصة بالفريق)',
      en: 'Staff Admin Dashboard',
      amz: 'ⴰⵎⵙⵙⵓⴳⵓⵔ ⵏ ⵓⵙⴰⵍⵓⵏ',
      es: 'Panel de administración',
    }[lang] || 'Espace Administration',
    instaCta: {
      fr: 'Suivez nos créations quotidiennes sur Instagram',
      ar: 'تابعنا على إنستغرام لمشاهدة أحدث الإبداعات والقصات اليومية',
      en: 'Follow our daily grooming artistry on Instagram',
      amz: 'ⴹⴼⵕ ⵜⵉⵡⵍⴰⴼⵉⵏ ⵏⵏⵖ ⴳ ⵉⵏⵙⵜⴰⴳⵔⴰⵎ',
      es: 'Sigue nuestros cortes diarios en Instagram',
    }[lang] || 'Suivez-nous sur Instagram',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 ${isRtl ? 'left-0' : 'right-0'} max-w-full w-full sm:max-w-xl bg-zinc-950 border-${isRtl ? 'r' : 'l'} border-zinc-800 shadow-2xl flex flex-col z-10`}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black/70">
          <div className="flex items-center gap-3">
            {/* Barber Pole Striped Accent */}
            <div className="w-2.5 h-7 rounded-full bg-gradient-to-b from-red-600 via-white to-blue-600 shadow-sm" />
            <div>
              <h2 className="text-lg font-black text-white tracking-wide font-display">
                SALON <span className="text-red-500">BOU</span><span className="text-blue-500">MLIK</span>
              </h2>
              <p className="text-[11px] text-zinc-400 font-medium">
                {SALON_INFO.slogan[lang] || SALON_INFO.slogan.fr}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Accordion Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          
          {/* ACCORDION ITEM 1: TEAM */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('team')}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-850/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{labels.team}</h3>
                  <p className="text-[11px] text-zinc-400">
                    {lang === 'ar' ? '4 حلاقين محترفين برئاسة حسن' : '4 barbiers qualifiés'}
                  </p>
                </div>
              </div>
              <ChevronDown 
                className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${
                  expandedSection === 'team' ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {expandedSection === 'team' && (
              <div className="p-4 pt-1 border-t border-zinc-800/60 space-y-3.5 animate-in fade-in duration-200">
                {TEAM_MEMBERS.map((barber: BarberStaff) => {
                  const name = barber.name[lang] || barber.name.fr;
                  const bio = barber.bio ? (barber.bio[lang] || barber.bio.fr) : '';

                  return (
                    <div 
                      key={barber.id}
                      className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700">
                          <img 
                            src={barber.avatar} 
                            alt={name} 
                            className="w-full h-full object-cover"
                          />
                          {barber.isOwner && (
                            <span className="absolute top-0 right-0 bg-red-600 text-[8px] font-black text-white px-1 rounded-bl">
                              OWNER
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm truncate">{name}</h4>
                          <span className="text-[11px] font-semibold text-amber-400 block truncate">
                            {barber.isOwner ? (lang === 'ar' ? 'المؤسس وخبير الحلاقة (منذ 2016)' : 'Fondateur & Maître Barbier (depuis 2016)') : (lang === 'ar' ? 'حلاق محترف' : 'Barbier Pro')}
                          </span>
                        </div>
                      </div>

                      {/* Hassan only bio */}
                      {barber.isOwner && bio && (
                        <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-2.5 rounded-lg border border-zinc-800/80">
                          {bio}
                        </p>
                      )}

                      {/* Direct Barber Actions */}
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        {barber.phone && (
                          <a
                            href={`tel:${barber.phone}`}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-center font-mono flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-red-500" />
                            <span dir="ltr">{barber.phone}</span>
                          </a>
                        )}

                        {barber.whatsappNumber && (
                          <a
                            href={`https://wa.me/${barber.whatsappNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 transition-colors"
                            title="WhatsApp"
                          >
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {barber.instagram && (
                          <a
                            href={barber.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-pink-400 transition-colors"
                            title="Instagram"
                          >
                            <Instagram className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {onSelectBarberForBooking && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBarberForBooking(barber.id);
                              onClose();
                            }}
                            className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black transition-colors"
                          >
                            {lang === 'ar' ? 'حجز' : 'Choisir'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACCORDION ITEM 2: GALLERY */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('gallery')}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-850/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{labels.gallery}</h3>
                  <p className="text-[11px] text-zinc-400">
                    {lang === 'ar' ? 'قصات التدريج واللحية' : 'Photos de réalisations'}
                  </p>
                </div>
              </div>
              <ChevronDown 
                className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${
                  expandedSection === 'gallery' ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {expandedSection === 'gallery' && (
              <div className="p-4 pt-1 border-t border-zinc-800/60 space-y-4 animate-in fade-in duration-200">
                {/* Instagram CTA Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-zinc-900 border border-pink-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-pink-400 font-bold text-xs">
                    <Instagram className="w-4 h-4" />
                    <span>Instagram Officiel @SalonBoumlik</span>
                  </div>
                  <p className="text-zinc-200 text-xs font-semibold">
                    {labels.instaCta}
                  </p>
                  <a
                    href={SALON_INFO.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition-colors shadow-md"
                  >
                    <span>{lang === 'ar' ? 'متابعة الصفحة على إنستغرام' : 'Suivre @SalonBoumlik'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Photos Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {galleryPhotos.map((photo, idx) => (
                    <div 
                      key={idx}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800"
                    >
                      <img 
                        src={photo.src} 
                        alt={photo.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ACCORDION ITEM 3: WI-FI & LOUNGE */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('wifi')}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-850/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{labels.wifi}</h3>
                  <p className="text-[11px] text-zinc-400">
                    {lang === 'ar' ? 'شبكة مجانية وسريعة بالصالون' : 'Connexion haut débit'}
                  </p>
                </div>
              </div>
              <ChevronDown 
                className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${
                  expandedSection === 'wifi' ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {expandedSection === 'wifi' && (
              <div className="p-4 pt-1 border-t border-zinc-800/60 space-y-3 animate-in fade-in duration-200">
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">{lang === 'ar' ? 'اسم الشبكة (SSID):' : 'Réseau :'}</span>
                    <span className="font-mono font-bold text-white">{SALON_INFO.media.wifiSsid}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                    <span className="text-zinc-400">{lang === 'ar' ? 'كلمة المرور:' : 'Mot de passe :'}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{SALON_INFO.media.wifiPassword}</span>
                      <button
                        onClick={copyWifiPassword}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Copier"
                      >
                        {wifiCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-zinc-400 p-2.5 rounded-lg bg-black/40 border border-zinc-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{lang === 'ar' ? 'صالون مكيف ومريح مع شاي مغربي أصيل' : 'Salon climatisé et thé offert durant votre attente.'}</span>
                </div>
              </div>
            )}
          </div>

          {/* ACCORDION ITEM 4: EXACT LOCATION & MAP */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection('location')}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-850/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{labels.location}</h3>
                  <p className="text-[11px] text-zinc-400">
                    {lang === 'ar' ? 'شارع بئر أنزران فوق مخبزة إتري' : 'Rue Bir Anzarane, Taroudant'}
                  </p>
                </div>
              </div>
              <ChevronDown 
                className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${
                  expandedSection === 'location' ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {expandedSection === 'location' && (
              <div className="p-4 pt-1 border-t border-zinc-800/60 space-y-3 animate-in fade-in duration-200">
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>{SALON_INFO.address[lang] || SALON_INFO.address.fr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-400 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{lang === 'ar' ? 'الطابق 2 فوق مخبزة إتري وصانع الأسنان' : '2ème Étage au-dessus Boulangerie ITRI & Dentiste'}</span>
                  </div>
                </div>

                <a
                  href={SALON_INFO.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'فتح الاتجاهات في Google Maps' : 'Ouvrir dans Google Maps'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

        </div>

        {/* Theme Switcher in Drawer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-semibold text-[11px]">
            {lang === 'ar' ? 'نمط وألوان الموقع:' : 'Thème visuel :'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTheme('luxury_gold')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                theme === 'luxury_gold' ? 'bg-amber-500 text-black shadow' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              ✨ {lang === 'ar' ? 'ذهبي' : 'Gold'}
            </button>
            <button
              onClick={() => setTheme('charcoal')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                theme === 'charcoal' ? 'bg-blue-600 text-white shadow' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              💈 {lang === 'ar' ? 'فحمي' : 'Charcoal'}
            </button>
            <button
              onClick={() => setTheme('minimal_light')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                theme === 'minimal_light' ? 'bg-zinc-200 text-zinc-900 shadow' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              ☀️ {lang === 'ar' ? 'أبيض' : 'Light'}
            </button>
          </div>
        </div>

        {/* Drawer Footer with Admin Access */}
        <div className="p-4 border-t border-zinc-800 bg-black/80 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenAdmin();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-red-500" />
            <span>{labels.adminButton}</span>
          </button>

          <span className="text-[10px] text-zinc-400 font-mono">
            v3.3 • Taroudant
          </span>
        </div>
      </div>
    </div>
  );
};
