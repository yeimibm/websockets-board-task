import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
const app = new Hono();
app.get('/health', (context) => context.json({ status: 'ok', service: 'web' }));
app.use('/assets/*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Web UI listening on http://localhost:${info.port}`);
});
