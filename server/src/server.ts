import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initScheduler } from './scheduler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', limiter); 

// API routes
app.use('/api', apiRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV !== 'development') {
  // Assuming the server is compiled to /server/dist/server.js, 
  // we need to go up two levels to reach the root, then into /dist
  const distPath = path.join(__dirname, '../../dist');
  console.log('Static files path set to:', distPath);

  // Explicitly serve service-worker.js with correct Content-Type and error handling
  app.get('/service-worker.js', (req, res) => {
    const swPath = path.join(distPath, 'service-worker.js');
    console.log('Serving SW from:', swPath);
    
    res.sendFile(swPath, {
      headers: { 
          'Content-Type': 'application/javascript',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
      }
    }, (err) => {
      if (err) {
        console.error("Error serving service-worker.js:", err);
        // Explicitly send 404 so it doesn't fall through to index.html
        if (!res.headersSent) {
            res.status(404).send('Service Worker not found');
        }
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
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'production') {
      initScheduler();
  } else {
      console.log('Scheduler NOT initialized in development mode.');
      // initScheduler(); 
  }
});