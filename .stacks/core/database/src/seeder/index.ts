import { PrismaClient } from '@prisma/client';

interface SeedData {
  [key: string]: any;
}

async function seed(modelName: string, data: SeedData[]): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const model = prisma[modelName];
    const seedPromises = data.map((item) => model.create({ data: item }));
    await Promise.all(seedPromises);
    console.log(`Seeding successful for model "${modelName}"`);
  } catch (error) {
    console.error(`Error seeding model "${modelName}": ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

export { seed }
