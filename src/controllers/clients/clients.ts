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




router.post('/deleteClients', (req, res) => {
  const { ids } = req.body;

  console.log('IDs de clientes a eliminar:', ids);

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'No se proporcionaron IDs válidos para eliminar.' });
  }

  // Inicia la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error('Error al iniciar la transacción:', err);
      return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
    }

    // Primero, elimina las reseñas asociadas a los usuarios
    const deleteReviewsQuery = `DELETE FROM review WHERE id_user IN (?)`;

    connection.query(deleteReviewsQuery, [ids], (error) => {
      if (error) {
        // Si hay un error, se revierte la transacción
        return connection.rollback(() => {
          console.error('Error al eliminar reseñas:', error);
          res.status(500).json({ message: 'Error al eliminar las reseñas.', error });
        });
      }

      // Ahora elimina los usuarios
      const deleteUsersQuery = `DELETE FROM user WHERE id_user IN (?)`;

      connection.query(deleteUsersQuery, [ids], (error: any, results: any) => {
        if (error) {
          // Si hay un error, se revierte la transacción
          return connection.rollback(() => {
            console.error('Error al eliminar clientes:', error);
            res.status(500).json({ message: 'Error al eliminar los clientes.', error });
          });
        }

        // Confirmamos la transacción si todo va bien
        connection.commit((commitErr: any) => {
          if (commitErr) {
            // Si hay un error al confirmar, se revierte la transacción
            return connection.rollback(() => {
              console.error('Error al confirmar la transacción:', commitErr);
              res.status(500).json({ message: 'Error al confirmar la transacción.', error: commitErr });
            });
          }

          // Si todo sale bien, enviamos la respuesta de éxito
          res.status(200).json({ message: 'Clientes eliminados con éxito.', affectedRows: results.affectedRows });
        });
      });
    });
  });
});





export default router;
