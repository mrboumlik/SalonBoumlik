import React, { useMemo, useState } from 'react';
import {
  Star,
  Trash2,
  Search,
  UserX,
  Users,
  MessageSquare,
  AlertTriangle,
  MapPin,
  Scissors,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { CustomerReview } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { pickLang } from '../utils/i18n';
import { deleteBarberReview } from '../utils/reviewsStore';
import { useBarberRoster } from '../utils/barberRosterStore';
import { getMergedBarbers, useBarberProfiles } from '../utils/barberProfileStore';
import { showToast } from '../utils/notifications';
import { ModalPortal } from './ModalPortal';

interface MasterReviewsModerationPanelProps {
  reviews: CustomerReview[];
}

export const MasterReviewsModerationPanel: React.FC<
  MasterReviewsModerationPanelProps
> = ({ reviews }) => {
  const { lang, isRtl } = useLanguage();
  const barberRoster = useBarberRoster();
  const barberProfiles = useBarberProfiles();
  const mergedBarbers = useMemo(
    () => getMergedBarbers(barberProfiles, barberRoster),
    [barberProfiles, barberRoster]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'five' | 'low' | 'anonymous'
  >('all');
  const [deleteTarget, setDeleteTarget] = useState<CustomerReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stats = useMemo(() => {
    const total = reviews.length;
    const avg =
      total > 0
        ? (
            reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / total
          ).toFixed(1)
        : '5.0';
    const anonymousCount = reviews.filter(
      (r) => Boolean(r.isAnonymous) || r.author.trim() === 'بدون اسم'
    ).length;
    const lowCount = reviews.filter((r) => (Number(r.rating) || 5) <= 3).length;
    return { total, avg, anonymousCount, lowCount };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reviews.filter((rev) => {
      const isAnon =
        Boolean(rev.isAnonymous) || rev.author.trim() === 'بدون اسم';
      if (filterMode === 'five' && rev.rating < 5) return false;
      if (filterMode === 'low' && rev.rating > 3) return false;
      if (filterMode === 'anonymous' && !isAnon) return false;

      if (!q) return true;
      const commentStr =
        typeof rev.comment === 'string'
          ? rev.comment
          : [rev.comment?.ar, rev.comment?.fr, rev.comment?.en, rev.comment?.amz]
              .filter(Boolean)
              .join(' ');
      const cityStr =
        typeof rev.city === 'string'
          ? rev.city
          : [rev.city?.ar, rev.city?.fr].filter(Boolean).join(' ');
      const barbersStr = [
        rev.barberName || '',
        ...(rev.barberNames || []),
      ].join(' ');
      return (
        rev.author.toLowerCase().includes(q) ||
        commentStr.toLowerCase().includes(q) ||
        cityStr.toLowerCase().includes(q) ||
        barbersStr.toLowerCase().includes(q)
      );
    });
  }, [reviews, searchQuery, filterMode]);

  const getBarberBadges = (rev: CustomerReview): string[] => {
    if (rev.allBarbers || rev.barberId === 'all') {
      return [
        pickLang(lang, {
          ar: 'جميع الحلاقين (الكل)',
          fr: 'Tous les barbiers',
          amz: 'ⴰⴽⴽⵯ ⵉⵎⴽⵔⴰⴹⵏ',
          en: 'All Barbers',
          es: 'Todos los barberos',
        }),
      ];
    }
    if (Array.isArray(rev.barberIds) && rev.barberIds.length > 0) {
      return rev.barberIds.map((id, idx) => {
        const found = mergedBarbers.find((b) => b.id === id);
        if (found) return found.name[lang] || found.name.fr;
        return rev.barberNames?.[idx] || id;
      });
    }
    if (rev.barberId) {
      const found = mergedBarbers.find((b) => b.id === rev.barberId);
      if (found) return [found.name[lang] || found.name.fr];
    }
    return rev.barberName ? [rev.barberName] : [];
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteBarberReview(deleteTarget.id);
      showToast(
        pickLang(lang, {
          ar: '🗑️ تم حذف التعليق من الموقع بنجاح',
          fr: '🗑️ Avis supprimé du site avec succès',
          amz: '🗑️ ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵏⵉ ⵙ ⵓⵎⵓⵔⵙ',
          en: '🗑️ Review deleted across the site',
          es: '🗑️ Comentario eliminado del sitio',
        }),
        pickLang(lang, {
          ar: 'تمت إزالة التعليق فوراً ولن يظهر للزبناء.',
          fr: 'Le commentaire a été retiré immédiatement.',
          amz: 'ⵉⵜⵜⵓⴽⴽⵙ ⵓⵙⵏⵉ ⵖⵉⵍⴰⴷ.',
          en: 'The comment has been removed immediately.',
          es: 'El comentario ha sido eliminado de inmediato.',
        }),
        'info'
      );
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete review:', err);
      showToast(
        pickLang(lang, {
          ar: 'تعذر حذف التعليق حالياً',
          fr: 'Impossible de supprimer cet avis',
          amz: 'ⵓⵔ ⵉⵣⵎⵉⵔ ⴰⴷ ⵉⴽⴽⵙ ⴰⵙⵏⵉ',
          en: 'Could not delete this review',
          es: 'No se pudo eliminar el comentario',
        }),
        '',
        'warning'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Metrics */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {pickLang(lang, {
                  ar: 'إدارة ومراقبة تعليقات وتقييمات الزبناء',
                  fr: 'Modération des Avis & Commentaires Clients',
                  amz: 'ⴰⵙⵡⵓⴷⴷⵓ ⵏ ⵜⵏⵏⴰⵢⵉⵏ ⵏ ⵉⵎⵣⴷⴰⵖⵏ',
                  en: 'Client Reviews & Comments Moderation',
                  es: 'Moderación de Reseñas y Comentarios',
                })}
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
              {pickLang(lang, {
                ar: 'تصفح جميع التعليقات واحذف أي تعليق مخل بالآداب أو غير مناسب ليختفي فوراً من الموقع.',
                fr: 'Consultez tous les avis et supprimez immédiatement tout commentaire inapproprié.',
                amz: 'ⵥⵕ ⴰⴽⴽⵯ ⵜⵉⵏⵏⴰⵢⵉⵏ ⵜⴽⴽⵙⴷ ⵜⵉⵏⵏⴰ ⵓⵔ ⵉⴼⵓⵍⴽⵉⵏ.',
                en: 'Inspect all client comments and immediately remove any inappropriate review.',
                es: 'Revisa los comentarios y elimina al instante cualquier reseña inapropiada.',
              })}
            </p>
          </div>
        </div>

        {/* Compact KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              {pickLang(lang, {
                ar: 'مجموع التعليقات',
                fr: 'Total avis',
                amz: 'ⴰⵎⴹⴰⵏ ⵏ ⵜⵏⵏⴰⵢⵉⵏ',
                en: 'Total Reviews',
                es: 'Total reseñas',
              })}
            </div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {stats.total}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30">
            <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {pickLang(lang, {
                ar: 'معدل النجوم',
                fr: 'Note moyenne',
                amz: 'ⴰⵜⵉⴳ ⴰⵏⴰⵎⵎⴰⵙ',
                en: 'Average Rating',
                es: 'Media',
              })}
            </div>
            <div className="text-xl font-black font-mono text-amber-700 dark:text-amber-300 mt-0.5 flex items-center gap-1">
              <span>{stats.avg}</span>
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              {pickLang(lang, {
                ar: 'بدون اسم',
                fr: 'Anonymes',
                amz: 'ⵡⴰⵔ ⵉⵙⵎ',
                en: 'Anonymous',
                es: 'Anónimos',
              })}
            </div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {stats.anonymousCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30">
            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              {pickLang(lang, {
                ar: 'تقييم ≤ 3 نجوم',
                fr: 'Notes ≤ 3★',
                amz: '≤ 3★',
                en: 'Low (≤ 3★)',
                es: 'Bajas (≤ 3★)',
              })}
            </div>
            <div className="text-xl font-black font-mono text-rose-700 dark:text-rose-300 mt-0.5">
              {stats.lowCount}
            </div>
          </div>
        </div>

        {/* Search + Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={pickLang(lang, {
                ar: 'ابحث في التعليقات، اسم الزبون، أو الحلاق...',
                fr: 'Rechercher un commentaire, client ou barbier...',
                amz: 'ⵔⵣⵓ ⴳ ⵜⵏⵏⴰⵢⵉⵏ...',
                en: 'Search comments, customer, or barber...',
                es: 'Buscar comentarios, cliente o barbero...',
              })}
              className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'all',
                  label: pickLang(lang, {
                    ar: 'الكل',
                    fr: 'Tous',
                    amz: 'ⴰⴽⴽⵯ',
                    en: 'All',
                    es: 'Todos',
                  }),
                },
                {
                  id: 'five',
                  label: '5★',
                },
                {
                  id: 'low',
                  label: '≤ 3★',
                },
                {
                  id: 'anonymous',
                  label: pickLang(lang, {
                    ar: 'بدون اسم',
                    fr: 'Sans nom',
                    amz: 'ⵡⴰⵔ ⵉⵙⵎ',
                    en: 'Anonymous',
                    es: 'Anónimos',
                  }),
                },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilterMode(btn.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  filterMode === btn.id
                    ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-slate-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">
            {pickLang(lang, {
              ar: 'لا توجد تعليقات مطابقة للبحث حالياً.',
              fr: 'Aucun commentaire correspondant.',
              amz: 'ⵓⵔ ⵍⵍⵉⵏ ⵉⵙⵏⵉⵜⵏ.',
              en: 'No matching reviews found.',
              es: 'No hay comentarios que coincidan.',
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredReviews.map((rev) => {
            const isAnon =
              Boolean(rev.isAnonymous) || rev.author.trim() === 'بدون اسم';
            const authorDisplay = isAnon
              ? pickLang(lang, {
                  ar: 'زبون (بدون اسم)',
                  fr: 'Client (Sans nom)',
                  amz: 'ⴰⵎⵣⴷⴰⵖ (ⵡⴰⵔ ⵉⵙⵎ)',
                  en: 'Client (Anonymous)',
                  es: 'Cliente (Anónimo)',
                })
              : rev.author;
            const commentText =
              typeof rev.comment === 'string'
                ? rev.comment
                : (rev.comment as Record<string, string>)?.[lang] ||
                  rev.comment?.fr ||
                  '';
            const cityText =
              typeof rev.city === 'string'
                ? rev.city
                : (rev.city as Record<string, string>)?.[lang] || rev.city?.fr || '';
            const serviceText =
              typeof rev.serviceName === 'string'
                ? rev.serviceName
                : (rev.serviceName as Record<string, string>)?.[lang] ||
                  rev.serviceName?.fr ||
                  '';
            const barberBadges = getBarberBadges(rev);
            const dateDisplay = rev.createdAt
              ? rev.createdAt.slice(0, 16).replace('T', ' ')
              : typeof rev.date === 'string'
              ? rev.date
              : '';

            return (
              <div
                key={rev.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#141720] border border-stone-200 dark:border-zinc-800 shadow-2xs space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center font-black text-xs text-slate-900 dark:text-white shrink-0">
                      {isAnon ? (
                        <UserX className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                      ) : (
                        authorDisplay.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                          {authorDisplay}
                        </span>
                        {isAnon && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                            {pickLang(lang, {
                              ar: 'بدون اسم',
                              fr: 'Anonyme',
                              amz: 'ⵡⴰⵔ ⵉⵙⵎ',
                              en: 'Anonymous',
                              es: 'Anónimo',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        {cityText && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{cityText}</span>
                          </span>
                        )}
                        {serviceText && (
                          <span className="inline-flex items-center gap-1">
                            <Scissors className="w-3 h-3" />
                            <span>{serviceText}</span>
                          </span>
                        )}
                        {dateDisplay && (
                          <span dir="ltr" className="inline-flex items-center gap-1 font-mono text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>{dateDisplay}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= rev.rating
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-slate-300 dark:text-zinc-700'
                          }`}
                        />
                      ))}
                      <span className="ms-1 text-[11px] font-mono font-black text-amber-800 dark:text-amber-300">
                        {rev.rating}/5
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rev)}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-300 dark:hover:text-white border border-red-200 dark:border-red-500/40 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {pickLang(lang, {
                          ar: 'حذف التعليق',
                          fr: 'Supprimer',
                          amz: 'ⴽⴽⵙ',
                          en: 'Delete',
                          es: 'Eliminar',
                        })}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Comment Body */}
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs sm:text-sm text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                  "{commentText}"
                </p>

                {/* Affected Barbers Badges */}
                {barberBadges.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {pickLang(lang, {
                          ar: 'الحلاق المعني:',
                          fr: 'Barbier(s) :',
                          amz: 'ⴰⵎⴽⵔⴰⴹ :',
                          en: 'Barber(s):',
                          es: 'Barbero(s):',
                        })}
                      </span>
                    </span>
                    {barberBadges.map((label, i) => (
                      <span
                        key={`${rev.id}-b-${i}`}
                        className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold text-amber-800 dark:text-amber-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Solid Confirmation Modal for Deleting a Review */}
      {deleteTarget && (
        <ModalPortal>
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="fixed inset-0 z-[115] flex items-center justify-center p-4 sb-modal-backdrop"
          >
            <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {pickLang(lang, {
                      ar: 'تأكيد حذف التعليق نهائياً',
                      fr: 'Confirmer la suppression de l’avis',
                      amz: 'ⵙⵙⵏⵜⵎ ⵜⵓⴽⴽⵙⴰ ⵏ ⵓⵙⵏⵉ',
                      en: 'Confirm Review Deletion',
                      es: 'Confirmar eliminación',
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                    {pickLang(lang, {
                      ar: 'هل أنت متأكد من حذف هذا التعليق؟ سيختفي فوراً من واجهة الموقع وإحصائيات الصالون.',
                      fr: 'Voulez-vous vraiment supprimer ce commentaire ? Il disparaîtra immédiatement du site.',
                      amz: 'ⵉⵙ ⵜⵔⵉⴷ ⴰⴷ ⵜⴽⴽⵙⴷ ⴰⵙⵏⵉ ⴰⴷ ⵙⴳ ⵓⵙⵉⵜ ?',
                      en: 'Are you sure you want to delete this review? It will disappear across the site immediately.',
                      es: '¿Seguro que deseas eliminar este comentario? Desaparecerá del sitio al instante.',
                    })}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">
                  {deleteTarget.isAnonymous || deleteTarget.author === 'بدون اسم'
                    ? 'بدون اسم'
                    : deleteTarget.author}{' '}
                  ({deleteTarget.rating}/5★)
                </div>
                <div className="text-slate-600 dark:text-zinc-300 italic line-clamp-3">
                  "
                  {typeof deleteTarget.comment === 'string'
                    ? deleteTarget.comment
                    : deleteTarget.comment?.fr || ''}
                  "
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
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
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void handleConfirmDelete()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {isDeleting
                      ? '...'
                      : pickLang(lang, {
                          ar: 'نعم، حذف التعليق نهائياً',
                          fr: 'Oui, supprimer',
                          amz: 'ⵢⴰⵀ, ⴽⴽⵙ',
                          en: 'Yes, Delete Review',
                          es: 'Sí, eliminar',
                        })}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
