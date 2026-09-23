import 'dotenv/config';
import { resolve } from 'node:path';
import { createApp } from './app';

const host = process.env.HOST?.trim() || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT должен быть целым числом от 1 до 65535.');
}
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const app = createApp({ frontendDirectory: production ? resolve(process.cwd(), 'dist') : undefined });
const server = app.listen(port, host, () => {
  console.info(`Симулятор: http://${host}:${port} (${production ? 'приложение и API' : 'API'})`);
  const hasKey = Boolean((process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || process.env.BREV_API_KEY)?.trim());
  console.info(`LLM: ${hasKey ? 'ключ настроен на сервере' : 'нет ключа; анализ по правилам'}.`);
});
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE' ? `Порт ${port} уже занят.` : 'Не удалось запустить сервер.');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { server.close(); });
}
