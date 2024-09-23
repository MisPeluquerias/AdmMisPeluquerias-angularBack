import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllMessageContact', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';

  const query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM contact 
    WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR text LIKE ?
    LIMIT ?, ?;
  `;
  
  const countQuery = 'SELECT FOUND_ROWS() AS totalItems';

  connection.query(query, [search, search, search, search, offset, pageSize], (error, results) => {
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

router.put('/updateStateContact', async (req, res) => {
  try {
    const { id_contact, state } = req.body;

     //console.log(req.body);
    // Validación de los datos
    if (!id_contact) {
      return res.status(400).json({ error: 'Missing id_contact' });
    }

    const updateQuery = `
      UPDATE contact
      SET state = ?
      WHERE id_contact = ?
    `;

    // Ejecutar la consulta de actualización como una promesa
    await new Promise((resolve, reject) => {
      connection.query(
        updateQuery,
        [state, id_contact], // Solo actualizar el estado
        (error, results) => {
          if (error) {
            console.error('Error updating contact:', error);
            return reject(error);
          }
          resolve(results);
        }
      );
    });

    // Respuesta exitosa
    res.json({ message: 'Contact state updated successfully' });
  } catch (error) {
    // Manejo de errores generales
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'An error occurred while updating contact' });
  }
});

export default router;
