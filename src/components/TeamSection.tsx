import React, { useState } from 'react';
import { 
  Users, 
  Crown, 
  Star, 
  Scissors, 
  Sparkles, 
  Award,
  ShieldCheck,
  Phone,
  Instagram,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

interface TeamSectionProps {
  onSelectBarberToBook: (barberId: string) => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ onSelectBarberToBook }) => {
  const { lang, t } = useLanguage();
  const [expandedBioId, setExpandedBioId] = useState<string | null>('hassan');

  return (
    <section id="team" className="py-16 md:py-24 bg-[#08090C] relative border-t border-zinc-800/80">
      
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/4 w-[450px] h-[350px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.ourTeamTitle}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
            {lang === 'ar' ? (
              <span>فريق <span className="text-gold-gradient">صالون بومليك</span></span>
            ) : lang === 'amz' ? (
              <span>ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏ <span className="text-gold-gradient">ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ</span></span>
            ) : lang === 'en' ? (
              <span>SALON BOUMLIK <span className="text-gold-gradient">MASTER TEAM</span></span>
            ) : (
              <span>L'ÉQUIPE <span className="text-gold-gradient">SALON BOUMLIK</span></span>
            )}
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 font-body">
            {t.ourTeamSubtitle}
          </p>
        </div>

        {/* Official Salon Instagram Highlight Header Bar */}
        <div className="max-w-2xl mx-auto mb-10 p-3.5 rounded-2xl bg-zinc-900/90 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-zinc-950 flex-shrink-0 shadow-md">
              <Instagram className="w-5 h-5 text-zinc-950" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {lang === 'ar' ? 'إنستغرام صالون بومليك الرسمي' : lang === 'amz' ? 'ⵉⵏⵙⵜⴰⴳⵔⴰⵎ ⴰⵎⴰⴷⴷⵓⴷ ⵏ ⵙⴰⵍⵓⵏ' : 'Instagram Officiel Salon Boumlik'}
              </span>
              <span className="text-[11px] text-zinc-400">
                @SalonBoumlik • Rue Bir Anzarane, Taroudant
              </span>
            </div>
          </div>

          <a
            href="https://www.instagram.com/salonboumlik"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer flex-shrink-0"
          >
            <span>@salonboumlik</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {TEAM_MEMBERS.map((barber) => {
            const localizedBarberName = barber.name[lang] || barber.name.fr;
            const firstName = localizedBarberName.split(' ')[0];
            const isBioExpanded = expandedBioId === barber.id;

            return (
              <div
                key={barber.id}
                className={`rounded-3xl overflow-hidden bg-zinc-900 border transition-all duration-300 flex flex-col justify-between p-6 relative group ${
                  barber.isOwner
                    ? 'border-amber-400/60 shadow-2xl shadow-amber-500/10 ring-1 ring-amber-400/30'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {barber.isOwner && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md">
                      <Crown className="w-3 h-3 text-zinc-950" />
                      <span>{lang === 'ar' ? 'المالك' : lang === 'amz' ? 'ⴰⵎⵙⴱⴷⴰⴷ' : 'Fondateur'}</span>
                    </span>
                  </div>
                )}

                <div>
                  {/* Avatar with gold border */}
                  <div className="relative w-28 h-28 mx-auto rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-xl mb-4 group-hover:scale-105 transition-transform">
                    <img
                      src={barber.avatar}
                      alt={localizedBarberName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  {/* Name & Role */}
                  <div className="text-center space-y-1 mb-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                      {localizedBarberName}
                    </h3>
                    {barber.isOwner && barber.role && (
                      <div className="text-xs font-semibold text-amber-400">
                        {barber.role[lang] || barber.role.fr}
                      </div>
                    )}
                    {barber.isOwner && barber.experience && (
                      <div className="text-[11px] text-zinc-400">
                        {barber.experience[lang] || barber.experience.fr}
                      </div>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-center gap-1 text-amber-400 text-xs mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                    <span className="font-bold text-white ml-1">{barber.rating}.0</span>
                  </div>

                  {/* Contact Info & Personal Instagram Card */}
                  <div className="p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 text-xs mb-3 space-y-2">
                    {/* Direct Phone */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-amber-400" />
                        <span>{t.barberDirectPhoneLabel || 'Téléphone'}</span>
                      </span>
                      <a
                        href={`tel:${barber.phone?.replace(/\s+/g, '') || '0635392503'}`}
                        className="font-mono font-bold text-amber-400 hover:underline"
                        dir="ltr"
                      >
                        {barber.phone}
                      </a>
                    </div>

                    {/* Personal Instagram */}
                    {barber.instagram && (
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-900">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Instagram className="w-3 h-3 text-pink-400" />
                          <span>{t.barberPersonalIgLabel || 'Instagram'}</span>
                        </span>
                        <a
                          href={barber.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 transition-colors"
                          dir="ltr"
                        >
                          <span>{barber.instagramHandle}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Biography & Credentials Box - ONLY for Hassan */}
                  {barber.isOwner && barber.bio && (
                    <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 mb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          <span>{t.barberBioLabel}</span>
                        </span>
                      </div>

                      <p className={`text-zinc-300 text-[11px] leading-relaxed transition-all ${isBioExpanded ? '' : 'line-clamp-3'}`}>
                        {barber.bio[lang] || barber.bio.fr}
                      </p>

                      <button
                        type="button"
                        onClick={() => setExpandedBioId(isBioExpanded ? null : barber.id)}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        {isBioExpanded 
                          ? (lang === 'ar' ? 'عرض أقل ▲' : 'Moins ▲') 
                          : (lang === 'ar' ? 'قراءة المزيد ▼' : 'Lire la suite ▼')}
                      </button>
                    </div>
                  )}

                  {/* Specialty Box - ONLY for Hassan */}
                  {barber.isOwner && barber.specialty && (
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-400 mb-4">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">
                        {lang === 'ar' ? 'التخصص' : lang === 'amz' ? 'ⵜⴰⵎⵙⴽⵉⵔⵜ' : lang === 'en' ? 'Specialty' : 'Spécialité'}
                      </div>
                      <p className="leading-relaxed text-[11px] text-zinc-300">
                        {barber.specialty[lang] || barber.specialty.fr}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons: Choose this barber & Direct WhatsApp */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                  <button
                    onClick={() => onSelectBarberToBook(barber.id)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      barber.isOwner
                        ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-md shadow-amber-400/20'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'ar' 
                        ? `حجز موعد مع ${firstName}` 
                        : lang === 'amz' 
                        ? `ⴰⵙⵜⴰⵢ ⵏ ${firstName}` 
                        : lang === 'en' 
                        ? `Book with ${firstName}` 
                        : `Réserver avec ${firstName}`}
                    </span>
                  </button>

                  <a
                    href={`https://wa.me/${barber.whatsappNumber || '212635392503'}?text=${encodeURIComponent(
                      lang === 'ar'
                        ? `السلام عليكم ${barber.name.ar}، أريد الاستفسار عن حلاقة أو موعد في صالون بومليك.`
                        : `Salam ${firstName}, je souhaite réserver un créneau avec vous au Salon Boumlik.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp {firstName}</span>
                  </a>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

