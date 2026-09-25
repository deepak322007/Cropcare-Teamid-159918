require('dotenv').config();
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

app.get('/', (req, res) => res.json({ name: 'CropCare API', status: 'running', health: '/health' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use((error, req, res, next) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Internal server error' });
});

module.exports = app;
