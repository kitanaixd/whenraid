import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// En développement, Next.js recharge les modules à chaque modification :
// on garde un seul client pour ne pas ouvrir une connexion par rechargement.
const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creerClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalPourPrisma.prisma ?? creerClient();

if (process.env.NODE_ENV !== "production") globalPourPrisma.prisma = db;
