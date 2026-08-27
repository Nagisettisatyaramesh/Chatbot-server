import { prisma } from "../db/prisma";
import { Customer } from "@prisma/client";

const PERIOD_DAYS = 30;

// Resets the rolling usage window if it has elapsed, then reports whether
// the customer still has budget. Called on every /api/chat request before
// any AI call is made, so a customer can never be billed-through silently.
export async function checkAndTrackUsage(customer: Customer): Promise<{ allowed: boolean; customer: Customer }> {
  const periodAgeMs = Date.now() - customer.usagePeriodStart.getTime();
  const periodExpired = periodAgeMs > PERIOD_DAYS * 24 * 60 * 60 * 1000;

  let current = customer;
  if (periodExpired) {
    current = await prisma.customer.update({
      where: { id: customer.id },
      data: { messagesUsed: 0, usagePeriodStart: new Date() },
    });
  }

  if (current.messagesUsed >= current.messageLimit) {
    return { allowed: false, customer: current };
  }

  const updated = await prisma.customer.update({
    where: { id: current.id },
    data: { messagesUsed: { increment: 1 } },
  });

  return { allowed: true, customer: updated };
}

export function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function recordUnansweredQuestion(customerId: string, question: string): Promise<void> {
  const normalized = normalizeQuestion(question);
  if (!normalized) return;

  const existing = await prisma.unansweredQuestion.findFirst({
    where: { customerId, resolved: false, question: { equals: normalized } },
  });

  if (existing) {
    await prisma.unansweredQuestion.update({
      where: { id: existing.id },
      data: { occurrences: { increment: 1 }, lastAskedAt: new Date() },
    });
  } else {
    await prisma.unansweredQuestion.create({
      data: { customerId, question: normalized },
    });
  }
}
