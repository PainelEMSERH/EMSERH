
import { sql, ensureAuxTables } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function getFiltros() {
  // stg_unid_reg: unidade → regional
  // stg_epi_map: funcao → EPI/quantidade
  const unids = await sql`select distinct regional, unidade from stg_unid_reg order by regional, unidade`;
  return { unids };
}

async function getColaboradores(regional?: string, unidade?: string) {
  // stg_alterdata: colaboradores (nome, id, funcao, unidade, regional)
  let rows;
  if (regional && unidade) {
    rows = await sql`select * from stg_alterdata where regional = ${regional} and unidade = ${unidade} order by nome limit 1000`;
  } else if (regional) {
    rows = await sql`select * from stg_alterdata where regional = ${regional} order by nome limit 1000`;
  } else {
    rows = await sql`select * from stg_alterdata order by nome limit 300`;
  }
  return rows;
}

async function itensEPI() {
  const rows = await sql`select * from stg_epi_map order by funcao`;
  return rows;
}

async function marcarEntrega(data: FormData) {
  "use server";
  await ensureAuxTables();

  const colaborador_id = String(data.get("colaborador_id")||"");
  const unidade = String(data.get("unidade")||"");
  const regional = String(data.get("regional")||"");
  const item = String(data.get("item")||"");
  const quantidade = Number(data.get("quantidade")||"1");
  const responsavel = String(data.get("responsavel")||"");
  if (!colaborador_id || !unidade || !regional || !item) return;

  await sql`insert into entregas_log (colaborador_id, unidade, regional, item, quantidade, responsavel)
            values (${colaborador_id}, ${unidade}, ${regional}, ${item}, ${quantidade}, ${responsavel})`;
  revalidatePath("/entregas");
}

export default async function Page({ searchParams }: { searchParams: { regional?: string, unidade?: string } }) {
  const { unids } = await getFiltros();
  const colaboradores = await getColaboradores(searchParams.regional, searchParams.unidade);
  const epis = await itensEPI();

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Entregas</h1>
        <p className="text-sm text-muted-foreground">Filtre por Regional/Unidade e marque entregas por colaborador.</p>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Regional</label>
          <select name="regional" defaultValue={searchParams.regional||""} className="border rounded-xl px-3 py-2">
            <option value="">Todas</option>
            {[...new Set(unids.map((u:any)=>u.regional))].map((r:string)=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Unidade</label>
          <select name="unidade" defaultValue={searchParams.unidade||""} className="border rounded-xl px-3 py-2">
            <option value="">Todas</option>
            {unids
              .filter((u:any)=>!searchParams.regional || u.regional===searchParams.regional)
              .map((u:any, i:number)=><option key={i} value={u.unidade}>{u.unidade}</option>)}
          </select>
        </div>
        <button className="rounded-2xl border px-4 py-2">Aplicar</button>
      </form>

      {/* Tabela */}
      <div className="rounded-2xl border overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="[&>th]:px-3 [&>th]:py-2 border-b bg-muted/50">
              <th>Colaborador</th>
              <th>Função</th>
              <th>Unidade</th>
              <th>Regional</th>
              <th>Item / Qtd</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c:any)=>(
              <tr key={c.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2">{c.nome}</td>
                <td className="px-3 py-2">{c.funcao}</td>
                <td className="px-3 py-2">{c.unidade}</td>
                <td className="px-3 py-2">{c.regional}</td>
                <td className="px-3 py-2">
                  <form action={marcarEntrega} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="colaborador_id" value={c.id}/>
                    <input type="hidden" name="unidade" value={c.unidade}/>
                    <input type="hidden" name="regional" value={c.regional}/>
                    <select name="item" className="border rounded-xl px-2 py-1">
                      {epis
                        .filter((e:any)=> e.funcao===c.funcao)
                        .map((e:any, i:number)=> <option key={i} value={e.item}>{e.item}</option>)
                      }
                      {epis.filter((e:any)=> e.funcao===c.funcao).length===0 && <option>Item</option>}
                    </select>
                    <input name="quantidade" type="number" min={1} defaultValue={1} className="w-20 border rounded-xl px-2 py-1"/>
                    <input name="responsavel" placeholder="Responsável" className="border rounded-xl px-2 py-1"/>
                    <button className="rounded-2xl border px-3 py-1">Marcar</button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <a className="underline" href={`/entregas?regional=${encodeURIComponent(c.regional)}&unidade=${encodeURIComponent(c.unidade)}`}>Filtrar iguais</a>
                </td>
              </tr>
            ))}
            {colaboradores.length===0 && (
              <tr><td className="px-3 py-6 text-muted-foreground" colSpan={6}>Nenhum colaborador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
