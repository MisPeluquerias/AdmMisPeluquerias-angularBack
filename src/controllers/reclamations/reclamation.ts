import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllReclamations', async (req, res) => {
  const { page = '1', pageSize = '3' } = req.query as { page?: string, pageSize?: string }; // Cambié el valor predeterminado de pageSize a '3'
  const pageNumber = parseInt(page, 10);
  const pageSizeNumber = parseInt(pageSize, 10);
  const offset = (pageNumber - 1) * pageSizeNumber;

  const query = `
  SELECT sr.*, 
         u.name AS user_name, 
         u.email, 
         c.name AS city_name, 
         p.name AS province_name
  FROM salon_reclamacion sr
  INNER JOIN user u ON sr.id_user = u.id_user
  INNER JOIN city c ON sr.id_city = c.id_city
  INNER JOIN province p ON c.id_province = p.id_province
  LIMIT ?, ?;
`;

  const countQuery = 'SELECT COUNT(*) AS totalItems FROM salon_reclamacion';

  // Iniciar la transacción
  connection.beginTransaction(err => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'An error occurred while starting transaction' });
    }

    // Primera consulta: obtener datos de reclamaciones
    connection.query(query, [offset, pageSizeNumber], (error, results) => {
      if (error) {
        return connection.rollback(() => {
          console.error('Error fetching data:', error);
          res.status(500).json({ error: 'An error occurred while fetching data' });
        });
      }

      // Segunda consulta: contar el total de registros
      connection.query(countQuery, (countError, countResults) => {
        if (countError) {
          return connection.rollback(() => {
            console.error('Error fetching count:', countError);
            res.status(500).json({ error: 'An error occurred while fetching data count' });
          });
        }

        // Si todo fue bien, commit y envío de los resultados
        connection.commit(commitError => {
          if (commitError) {
            return connection.rollback(() => {
              console.error('Error committing transaction:', commitError);
              res.status(500).json({ error: 'An error occurred while committing transaction' });
            });
          }

          // Manejo seguro de resultados
          const totalItems = (countResults as any)[0].totalItems;
          const totalPages = Math.ceil(totalItems / pageSizeNumber);

          res.json({
            data: results,
            pagination: {
              page: pageNumber,
              pageSize: pageSizeNumber,
              totalItems,
              totalPages,
            },
          });
        });
      });
    });
  });
});





export default router;
