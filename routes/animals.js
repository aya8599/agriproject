const express = require('express');
const router = express.Router();
const pool = require('../db');

// ✅ 1. استرجاع كل البيانات
router.get('/all-data', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        *, 
        ST_AsGeoJSON(geom)::json AS geom,
        y_coord AS latitude,
        x_coord AS longitude
      FROM dumanimal
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في استرجاع البيانات' });
  }
});
// ✅ GET /api/dumanimal/filter (يدعم فلاتر متعددة للقيم النصية)
router.get('/filter', async (req, res) => {
  try {
    const { sec_name, ssec_name } = req.query;

    let query = `
      SELECT 
        *, 
        ST_AsGeoJSON(geom)::json AS geom,
        y_coord AS latitude,
        x_coord AS longitude
      FROM dumanimal
      WHERE 1=1
    `;

    let params = [];
    let i = 1;

    // ✅ دعم فلاتر متعددة لـ sec_name (مراكز)
    if (sec_name) {
      const values = sec_name.split(',').map(val => val.trim()).filter(Boolean);
      if (values.length > 0) {
        const conditions = values.map(val => `COALESCE(sec_name, '') ILIKE $${i++}`);
        query += ` AND (${conditions.join(' OR ')})`;
        params.push(...values.map(val => `%${val}%`));
      }
    }

    // ✅ دعم فلاتر متعددة لـ ssec_name (شياخات)
    if (ssec_name) {
      const values = ssec_name.split(',').map(val => val.trim()).filter(Boolean);
      if (values.length > 0) {
        const conditions = values.map(val => `COALESCE(ssec_name, '') ILIKE $${i++}`);
        query += ` AND (${conditions.join(' OR ')})`;
        params.push(...values.map(val => `%${val}%`));
      }
    }

    const result = await pool.query(query, params);
    res.json(result.rows);

  } catch (err) {
    console.error('❌ Error in /dumanimal/filter:', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء التصفية' });
  }
});
// ✅ GET /api/dumanimal/sec-names
router.get('/sec-names', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT sec_name 
      FROM dumanimal 
      WHERE sec_name IS NOT NULL
    `);
    const names = result.rows.map(row => row.sec_name?.trim()).filter(Boolean);
    res.json(names);
  } catch (err) {
    console.error('❌ Error fetching section names:', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب أسماء الأقسام' });
  }
});



// ✅ 2. إجمالي الثروة الحيوانية مقابل عدد المربين
router.get('/total-vs-breeders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name, 
        total, 
        breeders_count AS breeders,
        y_coord AS latitude,
        x_coord AS longitude,
        ST_AsGeoJSON(geom)::json AS geom
      FROM dumanimal
      WHERE total IS NOT NULL AND breeders_count IS NOT NULL
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
        breeders_count AS breeders,
        y_coord AS latitude,
        x_coord AS longitude,
        CASE 
          WHEN breeders_count IS NULL OR breeders_count = 0 THEN 0
          ELSE ROUND((total::decimal / breeders_count)::numeric, 2)
        END AS heads_per_breeder,
        ST_AsGeoJSON(geom)::json AS geom
      FROM dumanimal
      WHERE total IS NOT NULL AND breeders_count IS NOT NULL
    `);
    res.json(result.rows);
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
        y_coord AS latitude,
        x_coord AS longitude,
        (local_cow_females + imported_cow_females + buffalo_females) AS cows_buffalo,
        (sheep + goats) AS sheep_goats,
        (camels + pack_animals) AS work_animals,
        ST_AsGeoJSON(geom)::json AS geom
      FROM dumanimal
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في التصنيف' });
  }
});

// ✅ 5. عجول التسمين مقابل عجول الألبان
router.get('/fattening-vs-dairy', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name,
        ssec_name,
        y_coord AS latitude,
        x_coord AS longitude,
        (local_cow_fattening + imported_cow_fattening + buffalo_fattening) AS fattening,
        (local_cow_females + imported_cow_females + buffalo_females) AS dairy,
        ST_AsGeoJSON(geom)::json AS geom
      FROM dumanimal
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في التوزيع' });
  }
});


router.get('/dot-density-categorized', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sec_name,
        'cow_dairy' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(
            geom, LEAST(500, GREATEST(1, (local_cow_females + imported_cow_females) / 20))
          )
        )).geom)::json AS geom
      FROM dumanimal
      WHERE (local_cow_females + imported_cow_females) > 0

      UNION ALL

      SELECT 
        sec_name,
        'cow_fattening' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(
            geom, LEAST(500, GREATEST(1, (local_cow_fattening + imported_cow_fattening) / 20))
          )
        )).geom)::json AS geom
      FROM dumanimal
      WHERE (local_cow_fattening + imported_cow_fattening) > 0

      UNION ALL

      SELECT 
        sec_name,
        'buffalo_females' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(geom, LEAST(500, GREATEST(1, buffalo_females / 20)))
        )).geom)::json AS geom
      FROM dumanimal
      WHERE buffalo_females > 0

      UNION ALL

      SELECT 
        sec_name,
        'buffalo_fattening' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(geom, LEAST(500, GREATEST(1, buffalo_fattening / 20)))
        )).geom)::json AS geom
      FROM dumanimal
      WHERE buffalo_fattening > 0

      UNION ALL

      SELECT 
        sec_name,
        'sheep' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(geom, LEAST(500, GREATEST(1, sheep / 20)))
        )).geom)::json AS geom
      FROM dumanimal
      WHERE sheep > 0

      UNION ALL

      SELECT 
        sec_name,
        'goats' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(geom, LEAST(500, GREATEST(1, goats / 20)))
        )).geom)::json AS geom
      FROM dumanimal
      WHERE goats > 0

      UNION ALL

      SELECT 
        sec_name,
        'pack_animals' AS category,
        ST_AsGeoJSON((ST_Dump(
          ST_GeneratePoints(geom, LEAST(500, GREATEST(1, pack_animals / 20)))
        )).geom)::json AS geom
      FROM dumanimal
      WHERE pack_animals > 0
    `);

    const features = result.rows.map((row, index) => ({
      type: 'Feature',
      geometry: row.geom,
      properties: {
        id: index,
        sec_name: row.sec_name,
        category: row.category
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (err) {
    console.error('❌ Error in /dot-density-categorized:', err.message);
    res.status(500).json({ error: 'فشل في توليد النقاط المصنفة' });
  }
});


module.exports = router;
