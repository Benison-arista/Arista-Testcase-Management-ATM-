require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { runMigrations } = require('./db');
const auth = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Public routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));

// Protected routes — JWT required
app.use('/api/folders', auth, require('./routes/folders'));
app.use('/api/testcases', auth, require('./routes/testcases'));
app.use('/api/runs', auth, require('./routes/runs'));

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

runMigrations()
  .then(() => app.listen(PORT, () => console.log(`ATM backend listening on port ${PORT}`)))
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); });
