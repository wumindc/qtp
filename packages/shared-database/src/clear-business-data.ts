import { createRuntimePrismaClient } from './seed';

type DeleteManyDelegate = {
  deleteMany(): Promise<unknown>;
};

type ClearBusinessPrismaClient = {
  evalReview: DeleteManyDelegate;
  evalResult: DeleteManyDelegate;
  evalReport: DeleteManyDelegate;
  evalRun: DeleteManyDelegate;
  evalPlan: DeleteManyDelegate;
  evalCaseSuite: DeleteManyDelegate;
  evalCase: DeleteManyDelegate;
  evalCaseCategory: DeleteManyDelegate;
  aiModel: DeleteManyDelegate;
  aiProvider: DeleteManyDelegate;
  aiApp: DeleteManyDelegate;
  $disconnect(): Promise<void>;
};

/**
 * @author codex
 * Clears all business records while preserving system users such as the bootstrap administrator.
 */
async function clearBusinessData() {
  const prisma = await createRuntimePrismaClient<ClearBusinessPrismaClient>();
  try {
    await prisma.evalReview.deleteMany();
    await prisma.evalResult.deleteMany();
    await prisma.evalReport.deleteMany();
    await prisma.evalRun.deleteMany();
    await prisma.evalPlan.deleteMany();
    await prisma.evalCaseSuite.deleteMany();
    await prisma.evalCase.deleteMany();
    await prisma.evalCaseCategory.deleteMany();
    await prisma.aiModel.deleteMany();
    await prisma.aiProvider.deleteMany();
    await prisma.aiApp.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

await clearBusinessData();
