import axios from 'axios';
import readline from 'readline';
import dotenv from 'dotenv';
import { config } from './src/config/config';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const history = [
  { role: 'system', content: config.agent.systemPrompt }
];

async function chat() {
  console.log('\x1b[36m%s\x1b[0m', '--- ওপেনরাউটার এআই এজেন্ট সিএলআই ---');
  console.log('বাহির হতে "exit" লিখুন।\n');

  const ask = () => {
    rl.question('\x1b[32mআপনি: \x1b[0m', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      history.push({ role: 'user', content: input });

      try {
        process.stdout.write('\x1b[35mএজেন্ট: \x1b[0m');
        
        // Using streaming for CLI too
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: config.openRouter.model,
          messages: history,
          stream: true,
        }, {
          headers: {
            'Authorization': `Bearer ${config.openRouter.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream'
        });

        let fullResponse = '';
        for await (const chunk of response.data) {
          const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
          for (const line of lines) {
            const message = line.replace(/^data: /, '');
            if (message === '[DONE]') break;
            try {
              const parsed = JSON.parse(message);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                process.stdout.write(content);
                fullResponse += content;
              }
            } catch (e) {}
          }
        }
        
        process.stdout.write('\n\n');
        history.push({ role: 'assistant', content: fullResponse });
      } catch (error: any) {
        console.error('\nError:', error.response?.data?.error?.message || error.message);
      }

      ask();
    });
  };

  ask();
}

chat();
