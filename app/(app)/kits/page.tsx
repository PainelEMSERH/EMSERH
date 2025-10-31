export const dynamic = 'force-dynamic';

type KitMapRow = {
  funcao: string;
  item: string;
  quantidade: number;
  unidade: string | null;
  regional?: string | null;
};

async function fetchData(searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  const res = await fetch(`${{process.env.NEXT_PUBLIC_BASE_URL || ''}}/api/kits/map${{qs ? '?' + qs : ''}}`, { cache: 'no-store' });
  // Fallback para ambientes server onde NEXT_PUBLIC_BASE_URL não está definido
  if (!res.ok) {
    // tenta rota relativa
    const res2 = await fetch('/api/kits/map' + (qs ? '?' + qs : ''), { cache: 'no-store' });
    if (!res2.ok) throw new Error('Falha ao buscar dados de kits');
    return res2.json();
  }
  return res.json();
}

export default async function Page({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const params = new URLSearchParams();
  if (typeof searchParams.q === 'string' && searchParams.q) params.set('q', searchParams.q);
  if (typeof searchParams.unidade === 'string' && searchParams.unidade) params.set('unidade', searchParams.unidade);
  if (typeof searchParams.size === 'string' && searchParams.size) params.set('size', searchParams.size);
  if (typeof searchParams.page === 'string' && searchParams.page) params.set('page', searchParams.page);

  const data = await fetchData(params); // { ok, items, total, page, size }
  const items: KitMapRow[] = data?.items || [];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#0c1424] px-6 py-5">
        <h1 className="text-2xl font-semibold text-slate-200">Kits</h1>
        <p className="mt-1 text-sm text-slate-400">
          Mapa função → EPI com quantidade por unidade (fonte: stg_epi_map).
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0c1424] p-4">
        {/* Filtros simples */}
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            name="q"
            defaultValue={typeof searchParams.q === 'string' ? searchParams.q : ''}
            placeholder="Buscar por função ou item"
            className="bg-[#0b1220] border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-600"
          />
          <input
            name="unidade"
            defaultValue={typeof searchParams.unidade === 'string' ? searchParams.unidade : ''}
            placeholder="Filtrar por unidade"
            className="bg-[#0b1220] border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-600"
          />
          <select
            name="size"
            defaultValue={typeof searchParams.size === 'string' ? searchParams.size : '50'}
            className="bg-[#0b1220] border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-600"
          >
            <option value="25">25/pág</option>
            <option value="50">50/pág</option>
            <option value="100">100/pág</option>
          </select>
          <button className="bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-md text-sm px-4 py-2">
            Aplicar
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0c1424] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0b1220] text-slate-300">
              <tr className="text-left">
                <th className="px-4 py-3 border-b border-slate-800">Função</th>
                <th className="px-4 py-3 border-b border-slate-800">Item EPI</th>
                <th className="px-4 py-3 border-b border-slate-800">Qtd</th>
                <th className="px-4 py-3 border-b border-slate-800">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                items.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 border-b border-slate-800">{r.funcao}</td>
                    <td className="px-4 py-3 border-b border-slate-800">{r.item}</td>
                    <td className="px-4 py-3 border-b border-slate-800">{r.quantidade}</td>
                    <td className="px-4 py-3 border-b border-slate-800">{r.unidade || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-right text-xs text-slate-500 border-t border-slate-800">
          Total: {data?.total ?? 0} • Página {data?.page ?? 1}
        </div>
      </div>
    </div>
  );
}
