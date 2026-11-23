import React, { useState } from 'react';
import {
  Users,
  Crown,
  Star,
  Scissors,
  Sparkles,
  Award,
  Phone,
  Instagram,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { SALON_INFO } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { getBarberIdentityTokens } from '../utils/barberIdentity';

interface TeamSectionProps {
  onSelectBarberToBook: (barberId: string) => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ onSelectBarberToBook }) => {
  const { lang, t } = useLanguage();
  const [expandedBioId, setExpandedBioId] = useState<string | null>('hassan');
  const barberRoster = useBarberRoster();
  const barberProfiles = useBarberProfiles();
  const mergedTeam = getMergedBarbers(barberProfiles, barberRoster);

  return (
    <section
      id="team"
      className="py-10 sm:py-14 bg-[#FAF9F6] dark:bg-[#0B0C10] relative transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Users className="w-3.5 h-3.5" />
            <span>{t.ourTeamTitle}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-display tracking-tight">
            {pickLang(lang, {
              ar: 'فريق صالون بومليك',
              amz: 'ⵜⴰⵔⴰⴱⴱⵓⵜ ⵏ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
              en: 'SALON BOUMLIK TEAM',
              es: 'EQUIPO SALON BOUMLIK',
              fr: "L'ÉQUIPE SALON BOUMLIK",
            })}
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 font-body">
            {t.ourTeamSubtitle}
          </p>
        </div>

        {/* Official Salon Instagram Highlight Bar */}
        <div className="max-w-2xl mx-auto mb-8 p-3.5 rounded-2xl bg-white dark:bg-[#13151B] border border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-start shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex items-center justify-center text-amber-700 dark:text-amber-400 flex-shrink-0">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                {pickLang(lang, {
                  ar: 'إنستغرام صالون بومليك الرسمي',
                  amz: 'ⵉⵏⵙⵜⴰⴳⵔⴰⵎ ⴰⵎⴰⴷⴷⵓⴷ ⵏ ⵙⴰⵍⵓⵏ',
                  en: 'Official Salon Boumlik Instagram',
                  es: 'Instagram Oficial Salon Boumlik',
                  fr: 'Instagram Officiel Salon Boumlik',
                })}
              </span>
              <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                @SalonBoumlik • Rue Bir Anzarane, Taroudant
              </span>
            </div>
          </div>

          <a
            href={SALON_INFO.social?.instagram || 'https://www.instagram.com/salonboumlik'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer flex-shrink-0"
          >
            <span>@salonboumlik</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {mergedTeam.map((barber) => {
            const localizedBarberName = barber.name[lang] || barber.name.fr;
            const firstName = localizedBarberName.split(' ')[0];
            const isBioExpanded = expandedBioId === barber.id;
            const isOwner = Boolean(barber.isOwner);
            const barberTone = getBarberIdentityTokens(barber.id, barber.name.ar, barber.colorName);

            return (
              <div
                key={barber.id}
                className={`rounded-2xl overflow-hidden bg-white dark:bg-[#13151B] border transition-all duration-200 flex flex-col justify-between p-5 relative group ${barberTone.borderLeftClass} ${
                  isOwner
                    ? 'border-amber-500/80 dark:border-amber-500/50 shadow-sm'
                    : 'border-stone-200 dark:border-zinc-800 hover:border-amber-500/40 shadow-2xs'
                }`}
              >
                {isOwner && (
                  <div className="mb-3 flex justify-center">
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg">
                      <Crown className="w-3 h-3" />
                      <span>
                        {pickLang(lang, {
                          ar: 'المؤسس والمالك',
                          amz: 'ⴰⵎⵙⴱⴷⴰⴷ',
                          en: 'Founder & Owner',
                          es: 'Fundador',
                          fr: 'Fondateur',
                        })}
                      </span>
                    </span>
                  </div>
                )}

                <div className="pt-1">
                  {/* Avatar */}
                  <div
                    className={`relative w-24 h-24 mx-auto rounded-2xl overflow-hidden border-2 shadow-sm mb-3.5 group-hover:scale-105 transition-transform ${
                      isOwner
                        ? 'border-amber-500/70'
                        : 'border-stone-200 dark:border-zinc-700'
                    }`}
                  >
                    <img
                      src={barber.avatar}
                      alt={localizedBarberName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Name & (Founder-Only Role/Experience) */}
                  <div className="text-center space-y-1 mb-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white inline-flex items-center justify-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${barberTone.dotClass}`} />
                      <span>{localizedBarberName}</span>
                    </h3>
                    {isOwner && barber.role && (
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {barber.role[lang] || barber.role.fr}
                      </div>
                    )}
                    {isOwner && barber.experience && (
                      <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                        {barber.experience[lang] || barber.experience.fr}
                      </div>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-center gap-1 text-amber-500 dark:text-amber-400 text-xs mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-400" />
                    ))}
                    <span className="font-bold text-slate-900 dark:text-white ms-1">
                      {barber.rating}.0
                    </span>
                  </div>

                  {/* Founder-Only Dedicated Description (Specialty & Bio) */}
                  {isOwner && barber.specialty && (
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/70 border border-stone-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 mb-3">
                      <div className="text-[10px] uppercase font-black tracking-wider mb-1 flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Sparkles className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {pickLang(lang, {
                            ar: 'الخبرة والتخصص',
                            amz: 'ⵜⴰⵎⵙⴽⵉⵔⵜ',
                            en: 'Expertise',
                            es: 'Especialidad',
                            fr: 'Expertise',
                          })}
                        </span>
                      </div>
                      <p className="leading-relaxed text-[11px] text-stone-700 dark:text-zinc-300">
                        {barber.specialty[lang] || barber.specialty.fr}
                      </p>
                    </div>
                  )}

                  {isOwner && barber.bio && (
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/70 border border-stone-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 mb-3 space-y-1.5">
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-black tracking-wider flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>{t.barberBioLabel}</span>
                      </span>

                      <p
                        className={`text-stone-700 dark:text-zinc-300 text-[11px] leading-relaxed ${
                          isBioExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        {barber.bio[lang] || barber.bio.fr}
                      </p>

                      <button
                        type="button"
                        onClick={() => setExpandedBioId(isBioExpanded ? null : barber.id)}
                        className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        {isBioExpanded
                          ? pickLang(lang, {
                              ar: 'عرض أقل ▲',
                              amz: 'ⵙⵉⴷⵔ ▲',
                              en: 'Less ▲',
                              es: 'Menos ▲',
                              fr: 'Moins ▲',
                            })
                          : pickLang(lang, {
                              ar: 'قراءة المزيد ▼',
                              amz: 'ⵖⵔ ⵓⴳⴳⴰⵔ ▼',
                              en: 'Read more ▼',
                              es: 'Leer más ▼',
                              fr: 'Lire la suite ▼',
                            })}
                      </button>
                    </div>
                  )}

                  {/* Contact Info & Personal Instagram Card */}
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900/70 border border-stone-200 dark:border-zinc-800 text-xs mb-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-600 dark:text-zinc-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>{t.barberDirectPhoneLabel}</span>
                      </span>
                      <a
                        href={`tel:${barber.phone?.replace(/\s+/g, '') || '0635392503'}`}
                        className="font-mono font-bold text-slate-900 dark:text-amber-400 hover:underline"
                        dir="ltr"
                      >
                        {barber.phone}
                      </a>
                    </div>

                    {barber.instagram && (
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-stone-200 dark:border-zinc-800">
                        <span className="text-stone-600 dark:text-zinc-400 flex items-center gap-1">
                          <Instagram className="w-3 h-3 text-stone-500 dark:text-zinc-400" />
                          <span>Instagram</span>
                        </span>
                        <a
                          href={barber.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-slate-700 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
                          dir="ltr"
                        >
                          <span>{barber.instagramHandle}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-stone-200 dark:border-zinc-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => onSelectBarberToBook(barber.id)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isOwner
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>
                      {pickLang(lang, {
                        ar: `احجز مع ${firstName}`,
                        amz: `ⵃⵊⵣ ⴷ ${firstName}`,
                        en: `Book with ${firstName}`,
                        es: `Reservar con ${firstName}`,
                        fr: `Réserver avec ${firstName}`,
                      })}
                    </span>
                  </button>

                  <a
                    href={`https://wa.me/${barber.whatsappNumber || '212635392503'}?text=${encodeURIComponent(
                      pickLang(lang, {
                        ar: `السلام عليكم ${barber.name.ar}، أريد الاستفسار عن موعد في صالون بومليك.`,
                        amz: `Azul ${firstName}, ⵔⵉⵖ ⴰⵙⵔⵓⵙ ⴳ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ.`,
                        en: `Hello ${firstName}, I would like to book an appointment at Salon Boumlik.`,
                        es: `Hola ${firstName}, me gustaría reservar una cita en Salon Boumlik.`,
                        fr: `Salam ${firstName}, je souhaite réserver un créneau avec vous au Salon Boumlik.`,
                      })
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-stone-200 dark:border-zinc-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
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
