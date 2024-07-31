import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllCategories', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;

  const query = `
    SELECT SQL_CALC_FOUND_ROWS id_salon, categories, acitve, destacado
    FROM categories 
    LIMIT ?, ?`;
  const countQuery = 'SELECT FOUND_ROWS() AS totalItems';

  connection.query(query, [offset, pageSize], (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'An error occurred while fetching data' });
      return;
    }

    connection.query(countQuery, (countError, countResults) => {
      if (countError) {
        console.error('Error fetching count:', countError);
        res.status(500).json({ error: 'An error occurred while fetching data count' });
        return;
      }

      const totalItems = (countResults as any)[0].totalItems;

      // Procesar los resultados para eliminar duplicados globalmente
      const categoriesSet = new Set<string>();
      const processedResults = Array.isArray(results) ? results.flatMap((row: any) => {
        return row.categories.split(/\s*;\s*/).map((cat: string) => {
          if (!categoriesSet.has(cat)) {
            categoriesSet.add(cat);
            return {
              id_salon: row.id_salon,
              category: cat,
              destacado: row.destacado,
              active: row.acitve // Corrige el nombre del campo aquí también si es necesario
            };
          }
          return null;
        }).filter((item: any) => item !== null);
      }) : [];

      res.json({ data: processedResults, totalItems });
    });
  });
});

export default router;
