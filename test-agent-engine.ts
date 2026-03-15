import 'dotenv/config';
import { AgentService } from './src/agents/agentService';

async function testAgentEngine() {
  console.log('🧪 Testing Agent Engine...\n');

  const agentService = new AgentService();

  try {
    const twilioNumber = process.env.TWILIO_NUMBER;
    
    if (!twilioNumber) {
      console.error('❌ TWILIO_NUMBER not set in .env');
      process.exit(1);
    }

    console.log(`📞 Looking up agent for phone number: ${twilioNumber}`);
    
    const agent = await agentService.getAgentByPhoneNumber(twilioNumber);
    
    if (!agent) {
      console.error('❌ No agent found for phone number');
      console.log('💡 Run `npm run seed` to create an agent');
      process.exit(1);
    }

    console.log('\n✅ Agent loaded successfully!\n');
    console.log('Agent Details:');
    console.log('  ID:', agent.id);
    console.log('  Name:', agent.name);
    console.log('  Voice:', agent.voice);
    console.log('  Temperature:', agent.temperature);
    console.log('  System Prompt:', agent.systemPrompt.substring(0, 100) + '...');
    console.log('  Created At:', agent.createdAt.toISOString());

    console.log('\n🔄 Testing cache...');
    const cached = await agentService.getAgentByPhoneNumber(twilioNumber);
    
    if (cached?.id === agent.id) {
      console.log('✅ Cache working correctly!');
    }

    const stats = agentService.getCacheStats();
    console.log('\n📊 Cache Stats:');
    console.log('  Size:', stats.size);
    console.log('  TTL:', stats.ttl, 'seconds');

    console.log('\n🎉 Agent Engine test passed!');
    
    await agentService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await agentService.shutdown();
    process.exit(1);
  }
}

testAgentEngine();
