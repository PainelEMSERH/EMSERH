'use client';

import { useEffect, useState } from 'react';

type Resp = {
  ok: boolean;
  staging?: { stg_alterdata:number; stg_unid_reg:number; stg_epi_map:number };
  finais?: { regional:number; unidade:number; funcao:number; item:number; colaborador:number; colaborador_vinculo:number };
  error?: string;
};

export default function AdminDbCheck() {
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/db-check', { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <div className="p-6">Erro: {err}</div>;
  if (!data) return <div className="p-6">Checando banco…</div>;
  if (!data.ok) return <div className="p-6">Falhou: {data.error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">DB • Health Check</h1>
      <section>
        <h2 className="text-lg font-medium">Staging</h2>
        <ul className="list-disc pl-6">
          <li>stg_alterdata: <b>{data.staging!.stg_alterdata}</b></li>
          <li>stg_unid_reg: <b>{data.staging!.stg_unid_reg}</b></li>
          <li>stg_epi_map: <b>{data.staging!.stg_epi_map}</b></li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Tabelas finais</h2>
        <ul className="list-disc pl-6">
          <li>regional: <b>{data.finais!.regional}</b></li>
          <li>unidade: <b>{data.finais!.unidade}</b></li>
          <li>funcao: <b>{data.finais!.funcao}</b></li>
          <li>item: <b>{data.finais!.item}</b></li>
          <li>colaborador: <b>{data.finais!.colaborador}</b></li>
          <li>colaborador_vinculo: <b>{data.finais!.colaborador_vinculo}</b></li>
        </ul>
      </section>
      <p className="text-sm text-neutral-500">Rota usada: <code>/api/db-check</code></p>
    </div>
  );
}
