import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initScheduler } from './scheduler.js';
import { visitLogger } from './middleware/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', false);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(cors());
app.use(express.json());
app.use(visitLogger);

// app.use('/api', limiter);

// Routes
app.use('/api/admin', adminRoutes); // Register admin routes BEFORE generic API if they overlap, though here they don't.
app.use('/api', apiRoutes);

if (process.env.NODE_ENV !== 'development') {
  const distPath = path.join(__dirname, '../../dist');
  app.get('/service-worker.js', (req, res) => {
    const swPath = path.join(distPath, 'service-worker.js');
    res.sendFile(swPath, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).send('Service Worker not found');
      }
    });
  });

  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    initScheduler();
  }
});