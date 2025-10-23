import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTests() {
  try {
    const tests = await prisma.aBTest.findMany({
      where: { status: 'active' },
      include: { variants: true }
    });
    
    console.log('Active tests:', JSON.stringify(tests, null, 2));
    
    if (tests.length === 0) {
      console.log('No active tests found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTests();
