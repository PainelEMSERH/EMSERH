
import { sql, ensureAuxTables } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function getBase() {
  const colaboradores = await sql`select id, nome, funcao, unidade, regional, situacao from stg_alterdata order by nome limit 500`;
  const unids = await sql`select distinct regional, unidade from stg_unid_reg order by regional, unidade`;
  return { colaboradores, unids };
}

async function moverUnidade(data: FormData) {
  "use server";
  await ensureAuxTables();
  const colaborador_id = String(data.get("colaborador_id")||"");
  const de_unidade = String(data.get("de_unidade")||"");
  const para_unidade = String(data.get("para_unidade")||"");
  const responsavel = String(data.get("responsavel")||"");
  if (!colaborador_id || !para_unidade) return;
  await sql`insert into colaborador_movimentos (colaborador_id, acao, de_unidade, para_unidade, responsavel)
            values (${colaborador_id}, 'mover_unidade', ${de_unidade}, ${para_unidade}, ${responsavel})`;
  revalidatePath("/colaboradores");
}

async function setSituacao(data: FormData) {
  "use server";
  await ensureAuxTables();
  const colaborador_id = String(data.get("colaborador_id")||"");
  const situacao = String(data.get("situacao")||"");
  const responsavel = String(data.get("responsavel")||"");
  if (!colaborador_id || !situacao) return;
  await sql`insert into colaborador_movimentos (colaborador_id, acao, situacao, responsavel)
            values (${colaborador_id}, 'situacao', ${situacao}, ${responsavel})`;
  revalidatePath("/colaboradores");
}

export default async function Page() {
  const { colaboradores, unids } = await getBase();

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <p className="text-sm text-muted-foreground">Gerencie unidade e situação sem alterar as tabelas de origem (movimentos ficam logados).</p>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead>
            <tr className="[&>th]:px-3 [&>th]:py-2 border-b bg-muted/50">
              <th>Nome</th>
              <th>Função</th>
              <th>Unidade</th>
              <th>Regional</th>
              <th>Mover Unidade</th>
              <th>Situação</th>
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
                  <form action={moverUnidade} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="colaborador_id" value={c.id}/>
                    <input type="hidden" name="de_unidade" value={c.unidade}/>
                    <select name="para_unidade" className="border rounded-xl px-2 py-1">
                      {unids.map((u:any,i:number)=>(
                        <option key={i} value={u.unidade}>{u.regional} / {u.unidade}</option>
                      ))}
                    </select>
                    <input name="responsavel" placeholder="Responsável" className="border rounded-xl px-2 py-1"/>
                    <button className="rounded-2xl border px-3 py-1">Mover</button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <form action={setSituacao} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="colaborador_id" value={c.id}/>
                    <select name="situacao" defaultValue={c.situacao||""} className="border rounded-xl px-2 py-1">
                      <option value="">Selecione</option>
                      <option value="ativo">Ativo</option>
                      <option value="afastado">Afastado</option>
                      <option value="desligado">Desligado</option>
                    </select>
                    <input name="responsavel" placeholder="Responsável" className="border rounded-xl px-2 py-1"/>
                    <button className="rounded-2xl border px-3 py-1">Salvar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
