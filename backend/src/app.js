const express = require('express');
const cors = require('cors');
const { mockAuth, requireAdmin } = require('./utils/mockAuth');

const studentRoutes = require('./routes/studentRoutes');
const interventionRoutes = require('./routes/interventionRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(mockAuth);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/students', studentRoutes);
app.use('/intervention', interventionRoutes);
app.use('/mentor', mentorRoutes);
app.use('/admin', requireAdmin, adminRoutes);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
