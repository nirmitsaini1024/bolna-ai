import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  const supportAgent = await prisma.agent.upsert({
    where: { id: 'support-agent-1' },
    update: {},
    create: {
      id: 'support-agent-1',
      name: 'Support Agent',
      systemPrompt: 'You are a friendly ecommerce support assistant. Help customers with their orders, products, and general inquiries. Be concise and helpful.',
      voice: 'aura-asteria-en',
      temperature: 0.3,
      sttProvider: 'DEEPGRAM',
    },
  });

  console.log('✅ Created agent:', supportAgent.name);

  await prisma.knowledgeDocument.upsert({
    where: { id: 'kb-return-policy-1' },
    update: {},
    create: {
      id: 'kb-return-policy-1',
      agentId: supportAgent.id,
      content: 'Our return policy allows returns within 30 days.',
      embedding: [],
    },
  });

  console.log('✅ Seeded example knowledge document: return policy');

  const twilioNumber = process.env.TWILIO_NUMBER;
  
  if (!twilioNumber) {
    console.warn('⚠️  TWILIO_NUMBER not found in environment, skipping phone number assignment');
    console.log('💡 Add TWILIO_NUMBER to .env and run seed again to assign phone number');
    return;
  }

  const normalizedNumber = twilioNumber.replace(/\D/g, '');

  const phoneNumber = await prisma.phoneNumber.upsert({
    where: { phoneNumber: normalizedNumber },
    update: {
      agentId: supportAgent.id,
    },
    create: {
      phoneNumber: normalizedNumber,
      agentId: supportAgent.id,
    },
  });

  console.log('✅ Assigned phone number:', phoneNumber.phoneNumber);
  console.log('🎉 Seeding complete!');
  console.log();
  console.log('Agent Configuration:');
  console.log('  - ID:', supportAgent.id);
  console.log('  - Name:', supportAgent.name);
  console.log('  - Voice:', supportAgent.voice);
  console.log('  - Temperature:', supportAgent.temperature);
  console.log('  - Phone Number:', phoneNumber.phoneNumber);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
