import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { ensurePlanoAcaoIndicadoresTable } from '@/lib/plano-acao-indicadores-ensure';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;

function esc(s: string) {
  return s.replace(/'/g, "''");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
  }

  const id = (params.id || '').trim();
  if (!id || id.length > 80) {
    return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  }

  try {
    await ensurePlanoAcaoIndicadoresTable(prisma);

    const exists: any[] = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM plano_acao_indicadores WHERE id = '${esc(id)}' LIMIT 1`,
    );
    if (!exists?.length) {
      return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Envie o campo file' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Arquivo acima de 8 MB' }, { status: 400 });
    }

    const original = (file.name || 'anexo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const fname = `${id}_${Date.now()}_${original}`;
    const relDir = path.join('uploads', 'plano-acao');
    const absDir = path.join(process.cwd(), 'public', relDir);
    await mkdir(absDir, { recursive: true });
    const absPath = path.join(absDir, fname);
    await writeFile(absPath, buf);

    const relPath = `${relDir.replace(/\\/g, '/')}/${fname}`;
    const nomeEsc = esc(file.name || fname);
    const publicUrl = `/${relPath}`;
    const urlEsc = esc(publicUrl);

    await prisma.$executeRawUnsafe(`
      UPDATE plano_acao_indicadores
      SET evidencia_storage_path = '${esc(relPath)}',
          evidencia_arquivo_nome = '${nomeEsc}',
          evidencia = '${urlEsc}',
          updated_at = NOW()
      WHERE id = '${esc(id)}'
    `);

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      evidencia_arquivo_nome: file.name || fname,
      evidencia_storage_path: relPath,
    });
  } catch (e: any) {
    console.error('[plano-acao-indicadores anexo]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e || 'Erro ao salvar anexo') },
      { status: 500 },
    );
  }
}
