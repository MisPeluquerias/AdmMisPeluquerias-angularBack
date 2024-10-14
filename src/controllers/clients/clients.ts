import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllClients', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';

  const query = `
  SELECT SQL_CALC_FOUND_ROWS * 
  FROM user 
  WHERE (name LIKE ? OR email LIKE ? OR created_at LIKE ? OR phone LIKE ?)
  AND permiso = 'client'
  LIMIT ?, ?`;

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

router.post('/delete', (req, res) => {
  const { id_user } = req.body;

  if (!id_user || !Array.isArray(id_user) || id_user.length === 0) {
    return res.status(400).json({ message: 'No hay clientes para eliminar' });
  }

  // Eliminar las referencias en la tabla user_salon
  const deleteUserSalonSql = `DELETE FROM user_salon WHERE id_user IN (${id_user.map(() => '?').join(',')})`;
  connection.query(deleteUserSalonSql, id_user, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error eliminando relaciones de clientes en user_salon' });
    }

    // Luego de eliminar las relaciones, eliminar el usuario
    const deleteUserSql = `DELETE FROM user WHERE id_user IN (${id_user.map(() => '?').join(',')})`;
    connection.query(deleteUserSql, id_user, (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error eliminando clientes' });
      }
      res.status(200).json({ message: 'Clientes eliminados correctamente' });
    });
  });
});



export default router;
