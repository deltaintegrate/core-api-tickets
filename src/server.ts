import 'reflect-metadata';
import { AppDataSource } from './infrastructure/persistence/postgres/data-source';
import { createApp } from './app';

const PORT = parseInt(process.env.PORT ?? '3002', 10);

AppDataSource.initialize()
  .then((dataSource) => {
    const app = createApp(dataSource);
    app.listen(PORT, () => {
      console.log(`[core-api-tickets] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[core-api-tickets] Failed to initialize database:', err);
    process.exit(1);
  });
