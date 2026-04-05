const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/burnout_ews';

const pool = new Pool({ connectionString });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
