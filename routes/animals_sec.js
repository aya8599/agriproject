const express = require('express');
const router = express.Router();
const pool = require('../db');

// ✅ 1. استرجاع كل البيانات
router.get('/all-data', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *, ST_AsGeoJSON(geom)::json AS geom
      FROM sec_animal
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في استرجاع البيانات' });
  }
});

// ✅ 2. إجمالي الثروة الحيوانية مقابل عدد المربين
router.get('/total-vs-breeders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name, total, breeders, latitude, longitude,
        ST_AsGeoJSON(geom)::json AS geom
      FROM sec_animal
      WHERE total IS NOT NULL AND breeders IS NOT NULL
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('🔴 Database error in /total-vs-breeders:', err);
    res.status(500).json({ error: 'خطأ في استرجاع البيانات' });
  }
});

// ✅ 3. عدد الرؤوس لكل مربّي
router.get('/heads-per-breeder', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name,
        total,
        breeders,
        latitude,
        longitude,
        CASE 
          WHEN breeders IS NULL OR breeders = 0 THEN 0
          ELSE ROUND((total / breeders)::numeric, 2)
        END AS heads_per_breeder,
        ST_AsGeoJSON(geom)::json AS geojson
      FROM sec_animal
      WHERE total IS NOT NULL AND breeders IS NOT NULL
    `);

    const rows = result.rows.map(row => ({
      sec_name: row.sec_name,
      total: row.total,
      breeders: row.breeders,
      latitude: row.latitude,
      longitude: row.longitude,
      heads_per_breeder: row.heads_per_breeder,
      geom: row.geojson
    }));

    res.json(rows);
  } catch (err) {
    console.error('❌ Error in /heads-per-breeder:', err.message);
    res.status(500).json({ error: 'خطأ في الحساب' });
  }
});

// ✅ 4. التصنيف النوعي للثروة الحيوانية
router.get('/animal-types-distribution', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name,
        latitude,
        longitude,
        (local_cow_females + imported_cow_females + buffalo_females) AS cows_buffalo,
        (sheep + goats) AS sheep_goats,
        (camels + pack_animals) AS work_animals,
        ST_AsGeoJSON(geom)::json AS geom
      FROM sec_animal
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التصنيف' });
  }
});

// ✅ 5. عجول التسمين مقابل عجول الألبان
router.get('/fattening-vs-dairy', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name,
        latitude,
        longitude,
        (local_cow_fattening + imported_cow_fattening + buffalo_fattening) AS fattening,
        (local_cow_females + imported_cow_females + buffalo_females) AS dairy,
        ST_AsGeoJSON(geom)::json AS geom
      FROM sec_animal
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التوزيع' });
  }
});



module.exports = router;
