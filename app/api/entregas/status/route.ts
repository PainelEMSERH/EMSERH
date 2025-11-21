import { NextResponse } from 'next/server';

// Rota stub apenas para compilar sem erro.
// Ainda não há lógica de status implementada aqui.
export function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}
