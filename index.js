const express = require('express');
const app = express();
const animalRoutes = require('./routes/animals');
const animalsSecRoutes = require('./routes/animals_sec');
const cors = require('cors');
const PORT = process.env.PORT || 4000;

app.use(express.json());
 // Enable CORS for all origins
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
app.use('/api/dumanimal', animalRoutes);
app.use('/api/animals_sec', animalsSecRoutes);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});