'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, HardHat, Sparkles } from 'lucide-react';

const MENSAGENS = [
  'Montando a nova versão...',
  'Organizando as telas...',
  'Ajustando os relatórios...',
  'Polindo os botões...',
  'Quase lá, só mais um parafuso...',
  'Conferindo os dados...',
  'Deixando tudo no jeito...',
];

type Props = {
  titulo: string;
  subtitulo?: string;
};

export default function EmAtualizacaoScreen({
  titulo,
  subtitulo = 'Estamos reformulando esta área. Em breve você terá uma experiência nova por aqui.',
}: Props) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [trabalhando, setTrabalhando] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MENSAGENS.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const handleClick = useCallback(() => {
    setClicks((c) => c + 1);
    setTrabalhando(true);
    setMsgIdx(Math.floor(Math.random() * MENSAGENS.length));
    window.setTimeout(() => setTrabalhando(false), 900);
  }, []);

  return (
    <div className="p-5 min-h-[calc(100vh-8rem)] flex flex-col">
      <nav className="text-xs text-muted mb-4">
        <a href="/dashboard" className="hover:text-text inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </a>
        <span className="mx-1">/</span>
        <span className="text-text">{titulo}</span>
      </nav>

      <div className="flex-1 flex items-center justify-center">
        <button
          type="button"
          onClick={handleClick}
          className="group w-full max-w-lg rounded-3xl border border-border bg-panel shadow-lg p-8 text-center cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Área em atualização — clique para animar"
        >
          <div className="relative mx-auto w-56 h-44 mb-6 select-none pointer-events-none">
            <div className="em-gear em-gear-a absolute left-2 top-2 w-10 h-10 text-muted/40" />
            <div className="em-gear em-gear-b absolute right-4 top-0 w-14 h-14 text-muted/30" />
            <div className="em-gear em-gear-c absolute right-8 bottom-6 w-8 h-8 text-muted/35" />

            <svg
              viewBox="0 0 200 160"
              className="w-full h-full drop-shadow-sm"
              aria-hidden
            >
              <ellipse cx="100" cy="148" rx="52" ry="8" fill="currentColor" className="text-black/10 dark:text-white/10" />
              <rect x="68" y="118" width="18" height="22" rx="3" fill="#f97316" />
              <rect x="114" y="118" width="18" height="22" rx="3" fill="#f97316" />
              <rect x="78" y="78" width="44" height="44" rx="8" fill="#2563eb" />
              <rect x="84" y="86" width="32" height="22" rx="4" fill="#fbbf24" opacity="0.9" />
              <circle cx="100" cy="62" r="18" fill="#fcd9b6" />
              <path d="M82 56 Q100 38 118 56 L115 64 Q100 50 85 64 Z" fill="#f59e0b" />
              <rect x="84" y="48" width="32" height="8" rx="2" fill="#d97706" />
              <g className={trabalhando ? 'em-hammer-fast' : 'em-hammer'}>
                <circle cx="138" cy="72" r="7" fill="#fcd9b6" />
                <rect x="132" y="76" width="28" height="7" rx="3" fill="#92400e" transform="rotate(35 138 72)" />
                <rect x="152" y="58" width="14" height="10" rx="2" fill="#6b7280" transform="rotate(35 138 72)" />
              </g>
              <g className="em-spark">
                <path d="M48 52 L52 60 L44 60 Z" fill="#fbbf24" />
                <path d="M56 44 L58 50 L52 50 Z" fill="#fbbf24" opacity="0.7" />
              </g>
            </svg>

            {clicks > 0 && (
              <div className="absolute -top-1 right-6 flex gap-0.5">
                {Array.from({ length: Math.min(clicks, 5) }).map((_, i) => (
                  <Sparkles
                    key={i}
                    className="w-4 h-4 text-amber-400 em-spark-pop"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium mb-4">
            <HardHat className="w-3.5 h-3.5" />
            Em atualização
          </div>

          <h1 className="text-xl font-semibold text-text mb-2">{titulo}</h1>
          <p className="text-sm text-muted mb-5">{subtitulo}</p>

          <p className="text-sm font-medium text-text min-h-[1.25rem] em-fade-msg" key={msgIdx}>
            {MENSAGENS[msgIdx]}
          </p>

          <div className="mt-5 h-2 rounded-full bg-bg border border-border overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-blue-500 ${trabalhando ? 'em-progress-fast' : 'em-progress'}`} />
          </div>

          <p className="mt-4 text-[11px] text-muted opacity-80 group-hover:opacity-100 transition-opacity">
            Clique aqui se quiser ver o bonequinho trabalhar mais rápido
          </p>
        </button>
      </div>
    </div>
  );
}
