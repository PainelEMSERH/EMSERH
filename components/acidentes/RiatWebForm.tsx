'use client';

import React from 'react';
import { isoDateInputToBR } from '@/lib/acidentes/riatValues';

export type RiatDraft = Record<string, string>;

type Props = {
  draft: RiatDraft;
  onDraftChange: (next: RiatDraft) => void;
  numeroSinan: string;
  onNumeroSinanChange: (v: string) => void;
  disabled?: boolean;
};

const fields: Array<{
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'date';
  rows?: number;
}> = [
  { key: 'dataInicialInvestigacao', label: 'Data inicial da investigação (opcional)', type: 'date' },
  { key: 'dataFinalInvestigacao', label: 'Data final da investigação (opcional)', type: 'date' },
  { key: 'responsavelInvestigacao', label: 'Responsável pela investigação' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'tempoFuncao', label: 'Tempo na função na EMSERH' },
  { key: 'tempoExperiencia', label: 'Tempo de experiência na profissão' },
  { key: 'horasTrabalhadasAteOcorrencia', label: 'Horas trabalhadas até a ocorrência' },
  { key: 'diasTratamento', label: 'Dias de tratamento (afastamento)' },
  { key: 'parteCorpoLesionada', label: 'Parte do corpo lesionada / lateralidade' },
  { key: 'sesmtInformadoMotivo', label: 'SESMT não informado de imediato — motivo (se aplicável)' },
  { key: 'impacto', label: 'Impacto (parecer SESMT)' },
  { key: 'circunstancias', label: 'Circunstâncias (complemento)', type: 'textarea', rows: 3 },
  { key: 'acoesCorretivas', label: 'Ações corretivas/preventivas (complemento)', type: 'textarea', rows: 3 },
];

export default function RiatWebForm({
  draft,
  onDraftChange,
  numeroSinan,
  onNumeroSinanChange,
  disabled,
}: Props) {
  function setField(key: string, value: string) {
    onDraftChange({ ...draft, [key]: value });
  }

  function brDraftToIsoInput(key: string): string {
    const br = draft[key];
    if (!br || !/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return '';
    const [d, m, y] = br.split('/');
    return `${y}-${m}-${d}`;
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
      <h4 className="text-[11px] font-semibold uppercase text-emerald-800 dark:text-emerald-200">
        Dados extras para a RIAT (opcional)
      </h4>
      <p className="text-[10px] text-muted leading-relaxed">
        O Excel é preenchido com os dados do acidente. Ajuste aqui o que for necessário antes de baixar; campos vazios mantêm o valor sugerido automaticamente.
      </p>

      <div>
        <label className="block text-[10px] font-medium text-muted mb-1">Nº Ficha SINAN</label>
        <input
          type="text"
          value={numeroSinan}
          onChange={(e) => onNumeroSinanChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          placeholder="Ex.: número da ficha"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => {
          if (f.type === 'date') {
            const isoKey = f.key;
            return (
              <div key={f.key} className="sm:col-span-1">
                <label className="block text-[10px] font-medium text-muted mb-1">{f.label}</label>
                <input
                  type="date"
                  value={brDraftToIsoInput(f.key)}
                  onChange={(e) => {
                    const br = isoDateInputToBR(e.target.value);
                    setField(f.key, br);
                  }}
                  disabled={disabled}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                />
              </div>
            );
          }
          if (f.type === 'textarea') {
            return (
              <div key={f.key} className="sm:col-span-2">
                <label className="block text-[10px] font-medium text-muted mb-1">{f.label}</label>
                <textarea
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  disabled={disabled}
                  rows={f.rows ?? 2}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                />
              </div>
            );
          }
          return (
            <div key={f.key} className="sm:col-span-1">
              <label className="block text-[10px] font-medium text-muted mb-1">{f.label}</label>
              <input
                type="text"
                value={draft[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                disabled={disabled}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
