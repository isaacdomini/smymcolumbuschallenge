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
  max: 1000, // Increased from 100 to 1000 for easier testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
// Only apply rate limiting to API routes, not static files if we wanted to be specific, 
// but applying it globally with a higher limit is fine for now.
app.use('/api', limiter); 

// API routes
app.use('/api', apiRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV !== 'development') {
  const distPath = path.join(__dirname, '../../dist');
  console.log('Serving static files from:', distPath);

  // Explicitly serve service-worker.js with correct Content-Type
  app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(distPath, 'service-worker.js'), {
      headers: { 'Content-Type': 'application/javascript' }
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
  
  // Initialize the daily reminder scheduler
  if (process.env.NODE_ENV === 'production') {
      initScheduler();
  } else {
      console.log('Scheduler NOT initialized in development mode to avoid spamming.');
      // initScheduler(); // Uncomment to test in dev if needed
  }
});