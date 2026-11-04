import React from 'react';
import { 
  Users, 
  Crown, 
  Star, 
  Scissors, 
  Sparkles, 
  Award,
  ShieldCheck 
} from 'lucide-react';
import { TEAM_MEMBERS } from '../data/barbershopData';
import { useLanguage } from '../context/LanguageContext';

interface TeamSectionProps {
  onSelectBarberToBook: (barberId: string) => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ onSelectBarberToBook }) => {
  const { lang, t } = useLanguage();

  return (
    <section id="team" className="py-16 md:py-24 bg-[#08090C] relative border-t border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
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

        {/* 4 Team Members Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TEAM_MEMBERS.map((barber) => {
            const localizedBarberName = barber.name[lang] || barber.name.fr;
            const firstName = localizedBarberName.split(' ')[0];

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
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md">
                      <Crown className="w-3 h-3 text-zinc-950" />
                      <span>{lang === 'ar' ? 'المالك' : lang === 'amz' ? 'ⴰⵎⵙⴱⴷⴰⴷ' : 'Owner'}</span>
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
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  {/* Name & Role */}
                  <div className="text-center space-y-1 mb-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                      {localizedBarberName}
                    </h3>
                    <div className="text-xs font-semibold text-amber-400">
                      {barber.role[lang] || barber.role.fr}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {barber.experience[lang] || barber.experience.fr}
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-center gap-1 text-amber-400 text-xs mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                    <span className="font-bold text-white ml-1">{barber.rating}.0</span>
                  </div>

                  {/* Specialty Box */}
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 mb-4">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">
                      {lang === 'ar' ? 'التخصص' : lang === 'amz' ? 'ⵜⴰⵎⵙⴽⵉⵔⵜ' : lang === 'en' ? 'Specialty' : 'Spécialité'}
                    </div>
                    <p className="leading-relaxed">
                      {barber.specialty[lang] || barber.specialty.fr}
                    </p>
                  </div>
                </div>

                {/* Action Button: Choose this barber */}
                <div className="pt-2 border-t border-zinc-800/80">
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
                        ? `اختيار ${firstName}` 
                        : lang === 'amz' 
                        ? `ⴰⵙⵜⴰⵢ ⵏ ${firstName}` 
                        : lang === 'en' 
                        ? `Book with ${firstName}` 
                        : `Réserver avec ${firstName}`}
                    </span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
