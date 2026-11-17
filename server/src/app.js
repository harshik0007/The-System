import express from 'express';

const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'the-system-api',
    timestamp: new Date().toISOString(),
  });
});

export default app;
