"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createFaq(formData: FormData) {
  const clinicId = formData.get("clinicId") as string;
  const question = formData.get("question") as string;
  const answer = formData.get("answer") as string;
  const category = (formData.get("category") as string) || null;

  if (!clinicId || !question.trim() || !answer.trim()) {
    throw new Error("Datos incompletos");
  }

  await prisma.knowledgeBase.create({
    data: {
      clinicId,
      question: question.trim(),
      answer: answer.trim(),
      category: category?.trim() || null,
    },
  });

  revalidatePath("/knowledge-base");
}

export async function updateFaq(formData: FormData) {
  const id = formData.get("id") as string;
  const question = formData.get("question") as string;
  const answer = formData.get("answer") as string;
  const category = (formData.get("category") as string) || null;

  await prisma.knowledgeBase.update({
    where: { id },
    data: {
      question: question.trim(),
      answer: answer.trim(),
      category: category?.trim() || null,
    },
  });

  revalidatePath("/knowledge-base");
}

export async function deleteFaq(id: string) {
  await prisma.knowledgeBase.delete({ where: { id } });
  revalidatePath("/knowledge-base");
}

export async function toggleFaq(id: string, active: boolean) {
  await prisma.knowledgeBase.update({
    where: { id },
    data: { active },
  });
  revalidatePath("/knowledge-base");
}
