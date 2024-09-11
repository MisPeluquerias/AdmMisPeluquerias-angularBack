import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllSalon', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';
  const filterState = req.query.filterState ? req.query.filterState.toString() : '%%';
  const filterActive = req.query.filterActive === 'true' ? '1' : '0';

  let query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM salon 
    WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ? OR state LIKE ?)
  `;

  if (req.query.filterActive) {
    query += ' AND active = ?';
  }

  if (req.query.filterState && req.query.filterState !== '%%') {
    query += ' AND state = ?';
  }

  // Aquí los valores deben ser sin comillas
  query += ' LIMIT ?, ?';

  const countQuery = 'SELECT FOUND_ROWS() AS totalItems';

  const queryParams: any[] = [search, search, search, search];
  
  if (req.query.filterActive) {
    queryParams.push(filterActive);
  }

  if (req.query.filterState && req.query.filterState !== '%%') {
    queryParams.push(filterState);
  }

  // Aquí no se necesita convertir a string, deben ser números
  queryParams.push(offset, pageSize);

  connection.query(query, queryParams, (error, results) => {
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
      res.json({ data: results, totalItems });
    });
  });
});


export default router;
