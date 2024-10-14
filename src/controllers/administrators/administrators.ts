import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());



router.get('/getAllAdministrators', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';

  const query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM user 
    WHERE permiso = "admin" AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR created_at LIKE ?)
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


router.get("/searchEmailInLive", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "El parámetro 'name' es requerido." });
    }
    // Iniciar la transacción
    await new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });


    const query = "SELECT email FROM user WHERE email LIKE ? AND permiso != 'admin'";
    

    connection.query(query, [`%${email}%`, `%${email}%`], (error, results) => {
      if (error) {
        console.error("Error al buscar la ciudad:", error);
        return connection.rollback(() => {
          res.status(500).json({ error: "Error al buscar cliente." });
        });
      }

      connection.commit((err) => {
        if (err) {
          console.error("Error al hacer commit:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al buscar cliente." });
          });
        }

        res.json(results);
      });
    });
  } catch (err) {
    console.error("Error al buscar cliente:", err);
    res.status(500).json({ error: "Error al buscar la ciudad." });
  }
});


router.put('/addNewAdmin', (req, res) => {
  const { email } = req.body;
  //console.log('Email recibido en el servidor:', email);

  if (!email) {
      return res.status(400).json({ message: 'El correo electrónico es requerido.' });
  }

  connection.beginTransaction((err) => {
      if (err) {
          return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
      }

      // Consulta para actualizar el permiso
      const query = 'UPDATE user SET permiso = ? WHERE email = ?';
      connection.query(query, ['admin', email], (err, results) => {
          if (err) {
              return connection.rollback(() => {
                  res.status(500).json({ message: 'Error al actualizar el rol del usuario.', error: err });
              });
          }

          const affectedRows = (results as any).affectedRows;

          if (affectedRows === 0) {
              return connection.rollback(() => {
                  res.status(404).json({ message: 'Usuario no encontrado.' });
              });
          }

          // Confirmar la transacción
          connection.commit((err) => {
              if (err) {
                  return connection.rollback(() => {
                      res.status(500).json({ message: 'Error al confirmar la transacción.', error: err });
                  });
              }

              res.status(200).json({ message: 'El usuario ha sido promovido a administrador.' });
          });
      });
  });
});




export default router;
