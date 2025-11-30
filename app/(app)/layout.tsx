import React from "react";
import AppShell from "@/components/layout/AppShell";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

async function ensureUsuario() {
  const { userId } = auth();
  if (!userId) {
    return;
  }
  const user = await currentUser();
  if (!user) return;

  const email =
    user.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const nome = user.fullName || user.username || email || "Usuário";

  if (!email) return;

  try {
    const existing = await prisma.usuario.findUnique({
      where: { email },
    });

    if (existing) {
      // Atualiza dados básicos, mas preserva role/regional/unidade/ativo
      await prisma.usuario.update({
        where: { email },
        data: {
          clerkUserId: user.id,
          nome,
        },
      });
    } else {
      // Cria como operador sem escopo definido; o admin poderá ajustar depois
      await prisma.usuario.create({
        data: {
          id: user.id,
          clerkUserId: user.id,
          nome,
          email,
          role: "operador",
          ativo: true,
        },
      });
    }
  } catch (e) {
    console.error("[layout.ensureUsuario] erro ao sincronizar usuario", e);
  }
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureUsuario();
  return <AppShell>{children}</AppShell>;
}
