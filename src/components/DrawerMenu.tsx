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
  ShieldCheck,
  Award,
  GraduationCap,
  Scissors,
  CheckCircle2,
  Copy,
  ChevronRight
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
  const [activeTab, setActiveTab] = useState<'team' | 'gallery' | 'wifi' | 'location'>('team');
  const [wifiCopied, setWifiCopied] = useState(false);

  if (!isOpen) return null;

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
      fr: 'Notre Équipe',
      ar: 'فريق العمل والخبرات',
      en: 'Our Team',
      amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏⵏⵖ',
      es: 'Nuestro equipo',
    }[lang] || 'Notre Équipe',
    gallery: {
      fr: 'Galerie & Réalisations',
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
      fr: 'Adresse & Accès',
      ar: 'الموقع الدقيق والوصول',
      en: 'Location & Map',
      amz: 'ⴰⴷⵖⴰⵔ ⴷ ⵓⵖⴰⵔⴰⵙ',
      es: 'Ubicación y mapa',
    }[lang] || 'Adresse',
    adminButton: {
      fr: 'Espace Administration (Hassan)',
      ar: 'لوحة تحكم الإدارة (خاصة بحسان)',
      en: 'Admin Dashboard (Hassan)',
      amz: 'ⴰⵎⵙⵙⵓⴳⵓⵔ ⵏ ⵓⵙⴰⵍⵓⵏ',
      es: 'Panel de administración',
    }[lang] || 'Espace Administration',
    instaCta: {
      fr: 'Suivez-nous sur Instagram pour découvrir nos dernières créations et coupes au quotidien',
      ar: 'تابعنا على إنستغرام لمشاهدة أحدث الإبداعات والقصات اليومية',
      en: 'Follow us on Instagram to discover our latest master cuts and daily styling',
      amz: 'ⴹⴼⵕ ⴰⵖ ⴳ ⵉⵏⵙⵜⴰⴳⵔⴰⵎ ⵉ ⵓⵥⵕⴰ ⵏ ⵜⵡⵓⵔⵉⵡⵉⵏ ⵜⵉⵎⴰⵢⵏⵓⵜⵉⵏ',
      es: 'Síguenos en Instagram para descubrir los últimos cortes y estilos diarios',
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
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black/60">
          <div className="flex items-center gap-3">
            {/* Barber Pole Striped Accent */}
            <div className="w-2.5 h-7 rounded-full bg-gradient-to-b from-red-600 via-white to-blue-600 shadow-sm" />
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">
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

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 p-2 gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'team'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Users className="w-4 h-4 text-red-500" />
            <span>{labels.team}</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-blue-500" />
            <span>{labels.gallery}</span>
          </button>

          <button
            onClick={() => setActiveTab('wifi')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'wifi'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span>{labels.wifi}</span>
          </button>

          <button
            onClick={() => setActiveTab('location')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'location'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <MapPin className="w-4 h-4 text-amber-500" />
            <span>{labels.location}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: TEAM */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                <span className="font-bold text-white block mb-0.5">
                  {lang === 'ar' ? 'فريق الحلاقة المحترف بتارودانت' : 'Maîtres Barbiers Qualifiés'}
                </span>
                {lang === 'ar' 
                  ? 'خبرة عالية، دقة في التفاصيل، واهتمام فائق بمظهرك.'
                  : 'Artisans barbiers passionnés dédiés au style masculin.'}
              </div>

              {TEAM_MEMBERS.map((barber: BarberStaff) => {
                const name = barber.name[lang] || barber.name.fr;
                const role = barber.role ? (barber.role[lang] || barber.role.fr) : '';
                const experience = barber.experience ? (barber.experience[lang] || barber.experience.fr) : '';
                const bio = barber.bio ? (barber.bio[lang] || barber.bio.fr) : '';

                return (
                  <div 
                    key={barber.id}
                    className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700">
                        <img 
                          src={barber.avatar} 
                          alt={name} 
                          className="w-full h-full object-cover"
                        />
                        {barber.isOwner && (
                          <span className="absolute top-0 right-0 bg-red-600 text-[9px] font-black text-white px-1 rounded-bl">
                            OWNER
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-bold text-white text-base truncate">{name}</h3>
                          {barber.rating && (
                            <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                              ★ {barber.rating}
                            </span>
                          )}
                        </div>
                        {barber.isOwner && role && (
                          <p className="text-xs font-semibold text-blue-400">{role}</p>
                        )}
                        {barber.isOwner && experience && (
                          <p className="text-[11px] text-zinc-400">{experience}</p>
                        )}
                      </div>
                    </div>

                    {/* ONLY Hassan has a biography; Anouar, Lahcen, and Mounir have NO bio/description displayed */}
                    {barber.isOwner && bio && (
                      <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-2.5 rounded-lg border border-zinc-800/80">
                        {bio}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        {barber.phone && (
                          <a 
                            href={`tel:${barber.phone}`}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs flex items-center gap-1"
                            title="Appeler"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span dir="ltr" className="text-[11px] font-mono">{barber.phone}</span>
                          </a>
                        )}

                        {barber.instagram && (
                          <a 
                            href={barber.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs flex items-center gap-1"
                          >
                            <Instagram className="w-3.5 h-3.5 text-pink-500" />
                            <span className="text-[11px]">{barber.instagramHandle || 'Instagram'}</span>
                          </a>
                        )}
                      </div>

                      {onSelectBarberForBooking && (
                        <button
                          onClick={() => {
                            onSelectBarberForBooking(barber.id);
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                        >
                          {lang === 'ar' ? 'اختر للحجز' : 'Choisir'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: GALLERY */}
          {activeTab === 'gallery' && (
            <div className="space-y-4">
              {/* Instagram Banner CTA */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/60 via-pink-950/40 to-zinc-900 border border-pink-500/30 space-y-3">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs">
                  <Instagram className="w-4 h-4" />
                  <span>@SalonBoumlik</span>
                </div>
                <p className="text-xs text-zinc-200 leading-snug">
                  {labels.instaCta}
                </p>
                <a
                  href={SALON_INFO.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'متابعة الصالون على إنستغرام' : 'Suivre sur Instagram'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Photos Grid - No overlay names */}
              <div className="grid grid-cols-2 gap-3">
                {galleryPhotos.map((photo, index) => (
                  <div 
                    key={index} 
                    className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800"
                  >
                    <img 
                      src={photo.src} 
                      alt={photo.alt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                      <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded">
                        {photo.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: WI-FI & LOUNGE */}
          {activeTab === 'wifi' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center gap-3 text-emerald-400">
                  <Wifi className="w-6 h-6" />
                  <div>
                    <h3 className="font-black text-white text-sm">
                      {lang === 'ar' ? 'شبكة الواي فاي للزبناء' : 'Connexion Wi-Fi Haute Vitesse'}
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      {lang === 'ar' ? 'إنترنت سريع ومجاني داخل الصالون' : 'Accès gratuit pour tous nos clients'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">SSID / Réseau:</span>
                    <span className="text-white font-mono font-bold">{SALON_INFO.media.wifiSsid}</span>
                  </div>

                  <div className="p-3 bg-black/50 rounded-lg border border-zinc-800 flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Mot de passe:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono font-bold">{SALON_INFO.media.wifiPassword}</span>
                      <button
                        onClick={copyWifiPassword}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Copier"
                      >
                        {wifiCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* QR Code Scan */}
                {SALON_INFO.media.qrWifi && (
                  <div className="text-center pt-2 border-t border-zinc-800/80">
                    <p className="text-[11px] text-zinc-400 mb-2">
                      {lang === 'ar' ? 'امسح للاتصال التلقائي' : 'Scannez pour vous connecter'}
                    </p>
                    <img 
                      src={SALON_INFO.media.qrWifi} 
                      alt="Wi-Fi QR Code" 
                      className="w-36 h-36 mx-auto rounded-xl p-2 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Comfort & Amenities */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs text-zinc-300">
                <h4 className="font-bold text-white mb-1">
                  {lang === 'ar' ? 'خدمات الضيافة والراحة' : 'Nos Services de Courtoisie'}
                </h4>
                <ul className="space-y-1.5 text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>{lang === 'ar' ? 'شاي مغربي أصيل بالنعناع وقهوة إسبريسو' : 'Thé à la menthe marocain & café expresso offerts'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>{lang === 'ar' ? 'فوطة ساخنة منعشة بعد كل حلاقة' : 'Rituel serviette chaude & eau de cologne'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>{lang === 'ar' ? 'صالة مكيفة ومريحة وموسيقى هادئة' : 'Salon climatisé et fauteuils ergonomiques'}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: LOCATION */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {lang === 'ar' ? 'العنوان الدقيق بتارودانت' : 'Adresse Exacte'}
                    </h3>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      {SALON_INFO.address[lang] || SALON_INFO.address.fr}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-black/60 rounded-lg border border-zinc-800 text-xs space-y-1.5">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'معالم واضحة للوصول' : 'Points de Repère'}</span>
                  </div>
                  <p className="text-zinc-300 text-[11px]">
                    {lang === 'ar'
                      ? 'الطابق الثاني فوق صانع الأسنان ومخبزة إتري (Boulangerie ITRI) - شارع بئر أنزران.'
                      : '2ème Étage, juste au-dessus du Technicien Dentaire et de la Boulangerie ITRI.'}
                  </p>
                </div>

                <a
                  href={SALON_INFO.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'فتح الاتجاهات في Google Maps' : 'Ouvrir l’itinéraire Google Maps'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Working Hours Summary */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
                <h4 className="font-bold text-white">
                  {lang === 'ar' ? 'أوقات العمل' : 'Horaires d’Ouverture'}
                </h4>
                <div className="space-y-1 text-zinc-400">
                  <div className="flex justify-between">
                    <span>{lang === 'ar' ? 'السبت - الخميس:' : 'Samedi - Jeudi :'}</span>
                    <span className="text-zinc-200 font-mono">10:00 - 22:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'ar' ? 'الجمعة (بعد الصلاة):' : 'Vendredi (après prière) :'}</span>
                    <span className="text-zinc-200 font-mono">15:00 - 23:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'ar' ? 'الأحد:' : 'Dimanche :'}</span>
                    <span className="text-zinc-200 font-mono">10:00 - 21:00</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher in Drawer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-semibold text-[11px]">
            {lang === 'ar' ? 'نمط وألوان الموقع:' : 'Thème visuel :'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTheme('luxury_gold')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                theme === 'luxury_gold' ? 'bg-amber-500 text-black shadow' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              ✨ {lang === 'ar' ? 'ذهبي' : 'Gold'}
            </button>
            <button
              onClick={() => setTheme('charcoal')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                theme === 'charcoal' ? 'bg-blue-600 text-white shadow' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              💈 {lang === 'ar' ? 'فحمي' : 'Charcoal'}
            </button>
            <button
              onClick={() => setTheme('minimal_light')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-semibold transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-red-500" />
            <span>{labels.adminButton}</span>
          </button>

          <span className="text-[10px] text-zinc-400 font-mono">
            v3.2 • Taroudant
          </span>
        </div>
      </div>
    </div>
  );
};
