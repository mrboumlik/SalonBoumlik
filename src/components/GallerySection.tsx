import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Sparkles, 
  Plus, 
  Heart, 
  X, 
  CheckCircle2, 
  Eye, 
  Scissors, 
  ShieldCheck,
  Instagram,
  ExternalLink
} from 'lucide-react';
import { INITIAL_GALLERY, TEAM_MEMBERS, SALON_INFO } from '../data/barbershopData';
import { GalleryItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

export const GallerySection: React.FC = () => {
  const { lang, t, isRtl } = useLanguage();

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() => {
    try {
      const stored = localStorage.getItem('salon_boumlik_gallery_v1');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_GALLERY;
  });

  const [activeCategory, setActiveCategory] = useState<'all' | 'fades' | 'beards' | 'skincare' | 'vip'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New photo form states
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'fades' | 'beards' | 'skincare' | 'vip'>('fades');
  const [newBarber, setNewBarber] = useState('Salon Boumlik');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('salon_boumlik_gallery_v1', JSON.stringify(galleryItems));
    } catch (e) {
      console.error(e);
    }
  }, [galleryItems]);

  const handleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: (item.likes || 0) + 1 } : item))
    );
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) return;

    const newItem: GalleryItem = {
      id: `gal-${Date.now()}`,
      title: {
        fr: newTitle.trim() || 'Réalisation Salon Boumlik',
        ar: newTitle.trim() || 'إبداع صالون بومليك',
        en: newTitle.trim() || 'Salon Boumlik Craft',
        amz: newTitle.trim() || 'ⵜⴰⵡⵓⵔⵉ ⵏ ⵙⴰⵍⵓⵏ ⴱⵓⵎⵍⵉⴽ',
      },
      category: newCategory,
      barberName: newBarber,
      imageUrl: newImageUrl.trim(),
      date: new Date().getFullYear().toString(),
      likes: 1,
    };

    setGalleryItems([newItem, ...galleryItems]);
    setSuccessToast(true);
    setTimeout(() => {
      setSuccessToast(false);
      setIsAddModalOpen(false);
      setNewTitle('');
      setNewImageUrl('');
    }, 1200);
  };

  const filteredItems = galleryItems.filter((item) => {
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  const categories = [
    { id: 'all', label: t.galleryCategoryAll },
    { id: 'fades', label: t.galleryCategoryFades },
    { id: 'beards', label: t.galleryCategoryBeards },
    { id: 'skincare', label: t.galleryCategorySkincare },
    { id: 'vip', label: t.galleryCategoryVip },
  ];

  return (
    <section id="gallery" className="py-16 md:py-24 bg-[#06070A] relative border-t border-zinc-800/80">
      
      {/* Subtle background glow */}
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.navGallery}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight">
              {lang === 'ar' ? (
                <span>معرض <span className="text-gold-gradient">أعمالنا وإبداعاتنا</span></span>
              ) : lang === 'amz' ? (
                <span>ⵜⴰⵙⴽⴰⵍⴰ ⵏ <span className="text-gold-gradient">ⵜⵉⵡⵓⵔⵉⵡⵉⵏ ⵏⵏⵖ</span></span>
              ) : lang === 'en' ? (
                <span>OUR WORK & <span className="text-gold-gradient">MASTER CRAFT</span></span>
              ) : (
                <span>NOS RÉALISATIONS & <span className="text-gold-gradient">PORTFOLIO</span></span>
              )}
            </h2>

            <p className="text-sm sm:text-base text-zinc-300 font-body">
              {t.gallerySubtitle}
            </p>
          </div>

          {/* Action to upload new photo */}
          <div className="flex items-center justify-center md:justify-end gap-3 flex-shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 hover:border-amber-400 text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>{t.addPhotoBtn}</span>
            </button>
          </div>
        </div>

        {/* High-Converting Official Instagram Banner */}
        <div className="mb-8 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-amber-500/30 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-pink-500/10 blur-[60px] rounded-full pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 flex-shrink-0">
                <Instagram className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                  {t.galleryInstagramBannerTitle}
                </p>
                <span className="text-[11px] text-amber-400 font-semibold mt-0.5 inline-block">
                  @SalonBoumlik • Taroudant
                </span>
              </div>
            </div>

            <a
              href="https://www.instagram.com/salonboumlik"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-rose-400 to-pink-500 text-zinc-950 hover:brightness-110 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
            >
              <Instagram className="w-4 h-4 text-zinc-950" />
              <span>{t.galleryInstagramBannerBtn}</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-950" />
            </a>
          </div>
        </div>

        {/* Category Pills (Horizontal scrolling on small screens) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar scroll-smooth">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gallery Grid (Names overlay removed for clean premium aesthetic) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const localizedTitle = item.title[lang] || item.title.fr;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedPhoto(item)}
                className="group relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-all duration-300 shadow-xl cursor-pointer flex flex-col justify-between"
              >
                {/* Photo container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950">
                  <img
                    src={item.imageUrl}
                    alt={localizedTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                  {/* Top Bar on Image: Clean like button only without name overlays */}
                  <div className="absolute top-3 right-3 flex items-center justify-end">
                    <button
                      onClick={(e) => handleLike(item.id, e)}
                      className="px-2.5 py-1 rounded-full bg-zinc-950/80 backdrop-blur-md text-rose-400 hover:text-rose-300 border border-zinc-800 flex items-center gap-1 text-[11px] font-bold transition-transform active:scale-90"
                    >
                      <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                      <span>{item.likes || 0}</span>
                    </button>
                  </div>

                  {/* Bottom Image Overlay: Title & Zoom */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {localizedTitle}
                      </h3>
                      <span className="text-[10px] text-zinc-400 capitalize">
                        {item.category === 'fades' ? 'Dégradé / حسانة' : item.category === 'beards' ? 'Barbe / لحية' : item.category === 'skincare' ? 'Visage / وجه' : 'VIP'}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg flex-shrink-0">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-150"
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900/90 border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative max-h-[70vh] bg-black flex items-center justify-center overflow-hidden">
              <img
                src={selectedPhoto.imageUrl}
                alt={selectedPhoto.title[lang] || selectedPhoto.title.fr}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="p-5 sm:p-6 bg-zinc-900 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                  Salon Boumlik • {selectedPhoto.category === 'fades' ? 'Dégradé' : selectedPhoto.category === 'beards' ? 'Barbe' : selectedPhoto.category === 'skincare' ? 'Soin Visage' : 'VIP'}
                </span>
                <h3 className="text-lg font-black text-white">
                  {selectedPhoto.title[lang] || selectedPhoto.title.fr}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => handleLike(selectedPhoto.id, e)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-zinc-700 flex items-center gap-1.5 text-xs font-bold"
                >
                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                  <span>{selectedPhoto.likes || 0} J'aime</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Photo Modal for Hassan / Staff */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0C0E14] border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white font-display">
                {t.addPhotoBtn}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {lang === 'ar' ? 'إضافة صورة لعمل جديد بمعرض صالون بومليك' : 'Ajoutez une nouvelle photo de coiffure au portfolio'}
              </p>
            </div>

            {successToast ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'تمت إضافة الصورة بنجاح !' : 'Photo ajoutée avec succès !'}
                </h4>
              </div>
            ) : (
              <form onSubmit={handleAddPhoto} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {lang === 'ar' ? 'عنوان العمل أو الستايل' : 'Titre ou description du style'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Taper fade avec rasage barbe"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-100 px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      {lang === 'ar' ? 'التصنيف' : 'Catégorie'}
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="fades">{t.galleryCategoryFades}</option>
                      <option value="beards">{t.galleryCategoryBeards}</option>
                      <option value="skincare">{t.galleryCategorySkincare}</option>
                      <option value="vip">{t.galleryCategoryVip}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      {lang === 'ar' ? 'الحلاق المنفذ' : 'Barbier'}
                    </label>
                    <select
                      value={newBarber}
                      onChange={(e) => setNewBarber(e.target.value)}
                      className="w-full bg-zinc-950 text-xs text-zinc-100 px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                    >
                      {TEAM_MEMBERS.map((b) => (
                        <option key={b.id} value={b.name.fr}>
                          {b.name[lang] || b.name.fr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {lang === 'ar' ? 'رابط الصورة (URL)' : 'URL de la photo'}
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-100 px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-xs shadow-md shadow-amber-400/20 hover:brightness-105 active:scale-98 transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'نشر في المعرض' : 'Publier dans la galerie'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </section>
  );
};
