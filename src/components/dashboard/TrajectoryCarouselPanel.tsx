import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Plus,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
  Sparkles,
  Maximize2,
  Trash2,
  X,
  Upload,
  Clock,
  Sliders,
} from 'lucide-react';
import { TrajectoryMemory } from '../../types/finance';
import { trajectoryRepo } from '../../services/db';

interface TrajectoryCarouselPanelProps {
  userId: string;
}

export const TrajectoryCarouselPanel: React.FC<TrajectoryCarouselPanelProps> = ({ userId }) => {
  const [memories, setMemories] = useState<TrajectoryMemory[]>(() =>
    trajectoryRepo.list(userId)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalMs, setIntervalMs] = useState(5000); // 5s default
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lightboxMemory, setLightboxMemory] = useState<TrajectoryMemory | null>(null);

  // Add Memory Form State
  const [newImageBase64, setNewImageBase64] = useState<string>('');
  const [newCaption, setNewCaption] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newPackagesCount, setNewPackagesCount] = useState<number>(1);
  const [newMilestonePhase, setNewMilestonePhase] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload memories from repo
  const refreshMemories = () => {
    const list = trajectoryRepo.list(userId);
    setMemories(list);
    if (currentIndex >= list.length) {
      setCurrentIndex(Math.max(0, list.length - 1));
    }
  };

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || memories.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % memories.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, memories.length, intervalMs]);

  const handleNext = () => {
    if (memories.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % memories.length);
  };

  const handlePrev = () => {
    if (memories.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + memories.length) % memories.length);
  };

  // Handle local image file upload & convert to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Limit size to ~5MB to preserve localStorage capacity
    if (file.size > 5 * 1024 * 1024) {
      setFileError('A imagem deve ter até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageBase64) {
      setFileError('Por favor selecione uma foto.');
      return;
    }

    const created: TrajectoryMemory = {
      id: 'traj_' + Date.now(),
      userId,
      imageUrl: newImageBase64,
      caption: newCaption.trim() || 'Despacho de encomendas',
      date: newDate || new Date().toISOString().split('T')[0],
      packagesCount: Math.max(1, newPackagesCount || 1),
      milestonePhase: newMilestonePhase.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    trajectoryRepo.save(created);
    refreshMemories();

    // Reset & close
    setNewImageBase64('');
    setNewCaption('');
    setNewPackagesCount(1);
    setNewMilestonePhase('');
    setFileError(null);
    setIsAddModalOpen(false);
    setCurrentIndex(memories.length); // jump to newly added
  };

  const handleDeleteMemory = (id: string) => {
    if (confirm('Deseja realmente remover esta foto da sua trajetória?')) {
      trajectoryRepo.delete(userId, id);
      refreshMemories();
      if (lightboxMemory?.id === id) {
        setLightboxMemory(null);
      }
    }
  };

  const currentMemory = memories[currentIndex] || null;

  // Format date helper (ex: "18 de out. de 2026")
  const formatDatePt = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between h-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Minha Trajetória</span>
                <span className="text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                  Encomendas
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {memories.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  title="Configurar velocidade"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                {showSpeedMenu && (
                  <div className="absolute right-0 top-8 z-30 bg-white border border-slate-200 shadow-lg rounded-xl p-2 text-xs w-36">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Intervalo:
                    </span>
                    {[
                      { label: '3 segundos', ms: 3000 },
                      { label: '5 segundos (padrão)', ms: 5000 },
                      { label: '8 segundos', ms: 8000 },
                      { label: '10 segundos', ms: 10000 },
                    ].map((opt) => (
                      <button
                        key={opt.ms}
                        type="button"
                        onClick={() => {
                          setIntervalMs(opt.ms);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors ${
                          intervalMs === opt.ms
                            ? 'bg-emerald-50 text-[#064E3B] font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#064E3B] font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar foto</span>
            </button>
          </div>
        </div>

        {/* Content: Carousel or Empty State */}
        <div className="pt-3">
          {memories.length === 0 ? (
            /* Empty State Elegante (sem fotos genéricas falsas) */
            <div className="py-7 px-4 text-center bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-[#064E3B] flex items-center justify-center mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                Ainda não há fotos de encomendas
              </h3>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                Registre os pacotes despachados no seu dia a dia e celebre cada marco do seu negócio (como o 1º pacote ou dias com mais de 10 pedidos).
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#064E3B] hover:bg-emerald-800 text-white font-medium text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Adicionar primeira foto</span>
              </button>
            </div>
          ) : currentMemory ? (
            /* Carousel Display Card */
            <div className="space-y-3">
              {/* Photo Box with click-to-enlarge */}
              <div
                onClick={() => setLightboxMemory(currentMemory)}
                className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer shadow-2xs h-48 sm:h-52 flex items-center justify-center"
              >
                <img
                  src={currentMemory.imageUrl}
                  alt={currentMemory.caption}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />

                {/* Milestone Badge Overlay */}
                {currentMemory.milestonePhase && (
                  <div className="absolute top-2.5 left-2.5 bg-amber-500/90 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm backdrop-blur-xs">
                    <Sparkles className="w-3 h-3 text-slate-950" />
                    <span>{currentMemory.milestonePhase}</span>
                  </div>
                )}

                {/* Packages count badge */}
                <div className="absolute top-2.5 right-2.5 bg-slate-900/80 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs">
                  <Package className="w-3 h-3 text-emerald-400" />
                  <span>
                    {currentMemory.packagesCount}{' '}
                    {currentMemory.packagesCount === 1 ? 'pacote' : 'pacotes'}
                  </span>
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 bg-white/90 text-slate-900 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Ver ampliado</span>
                  </span>
                </div>

                {/* Date stamp in bottom-left */}
                <div className="absolute bottom-2 left-2 bg-slate-900/70 text-white/90 text-[10px] px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5 text-slate-300" />
                  <span>{formatDatePt(currentMemory.date)}</span>
                </div>
              </div>

              {/* Caption description */}
              <div className="px-1 min-h-[38px]">
                <p className="text-xs text-slate-800 font-medium leading-snug line-clamp-2">
                  {currentMemory.caption}
                </p>
              </div>

              {/* Discrete Controls: Play/Pause, Prev, Next, Dots, Index */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Pausar troca automática' : 'Retomar troca automática'}
                    className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrev}
                    title="Foto anterior"
                    className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    title="Próxima foto"
                    className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Dots indicator */}
                <div className="flex items-center gap-1 overflow-hidden max-w-[120px]">
                  {memories.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        currentIndex === idx
                          ? 'w-4 bg-[#064E3B]'
                          : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>

                {/* Index counter */}
                <span className="text-[11px] font-mono text-slate-400 font-medium">
                  {currentIndex + 1} / {memories.length}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer info note */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Fotos armazenadas no seu dispositivo</span>
        {memories.length > 0 && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-emerald-700 hover:underline font-semibold"
          >
            + Registrar momento
          </button>
        )}
      </div>

      {/* Lightbox Modal (Click to open photo in enlarged view) */}
      {lightboxMemory && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxMemory(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Foto da Encomenda
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxMemory(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enlarged Image */}
            <div className="bg-slate-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={lightboxMemory.imageUrl}
                alt={lightboxMemory.caption}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            {/* Details & Actions */}
            <div className="p-5 space-y-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {lightboxMemory.milestonePhase && (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full mb-1">
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      {lightboxMemory.milestonePhase}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {lightboxMemory.caption}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory(lightboxMemory.id)}
                  title="Remover foto"
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDatePt(lightboxMemory.date)}
                </span>
                <span className="flex items-center gap-1 font-mono font-medium text-emerald-800">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  {lightboxMemory.packagesCount}{' '}
                  {lightboxMemory.packagesCount === 1 ? 'pacote enviado' : 'pacotes enviados'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#064E3B] flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Registrar Momento da Trajetória
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Envie a foto real das suas encomendas despachadas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMemory} className="p-5 space-y-4">
              {/* File upload input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Foto das encomendas *
                </label>
                {newImageBase64 ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-40 flex items-center justify-center">
                    <img
                      src={newImageBase64}
                      alt="Prévia"
                      className="max-h-40 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setNewImageBase64('')}
                      className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-lg hover:bg-rose-600 transition-colors"
                      title="Trocar imagem"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/30"
                  >
                    <Upload className="w-7 h-7 text-emerald-700 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-800">
                      Clique para escolher a foto
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      JPG, PNG ou WEBP do seu celular ou computador (máx 5MB)
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileError && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{fileError}</p>
                )}
              </div>

              {/* Data and Packages count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data do Envio *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Qtd. de Pacotes *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPackagesCount}
                    onChange={(e) => setNewPackagesCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Milestone Phase */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destaque / Marco Especial (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Meu primeiro pacote, Mais de 10 encomendas por dia..."
                  value={newMilestonePhase}
                  onChange={(e) => setNewMilestonePhase(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
                />

                {/* Quick chip suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Meu primeiro pacote',
                    'Mais de 10 encomendas por dia',
                    'Primeiro envio Full',
                    'Recorde do mês',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNewMilestonePhase(chip)}
                      className="text-[10px] bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 px-2 py-0.5 rounded-md border border-slate-200 transition-colors"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legenda / História do momento
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Despachando os pedidos de segunda-feira na agência Shopee e Mercado Envios..."
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newImageBase64}
                  className="px-4 py-2 bg-[#064E3B] hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Salvar na Trajetória
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
