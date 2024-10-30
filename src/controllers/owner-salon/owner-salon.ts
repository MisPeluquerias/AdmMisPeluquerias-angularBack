import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllOwners', async (req, res) => {
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
  
    const query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM user 
    WHERE (name LIKE ? OR email LIKE ? OR created_at LIKE ? OR phone LIKE ?)
    AND permiso = 'salon'
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


  router.get("/searchSalonInLive", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: "El parámetro 'name' es requerido." });
    }

    // Iniciar la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error al iniciar la transacción:", err);
        return res.status(500).json({ error: "Error al iniciar la transacción." });
      }

      const query = "SELECT id_salon, name FROM salon WHERE name LIKE ?";

      connection.query(query, [`%${name}%`], (error, results) => {
        if (error) {
          console.error("Error al buscar salon:", error);
          return connection.rollback(() => {
            res.status(500).json({ error: "Error al buscar salon." });
          });
        }

        connection.commit((err) => {
          if (err) {
            console.error("Error al hacer commit:", err);
            return connection.rollback(() => {
              res.status(500).json({ error: "Error al buscar salon." });
            });
          }
          res.json(results);
        });
      });
    });
  } catch (err) {
    console.error("Error al buscar salon:", err);
    res.status(500).json({ error: "Error al buscar el salon." });
  }
});



router.post('/addNewOwner', (req, res) => {
  const { email, salons } = req.body;

  //console.log('Inicio de /addNewOwner endpoint');
  //console.log('Datos recibidos:', { email, salons });

  // Validación inicial
  if (!email || !salons || salons.length === 0) {
      console.error('Validación fallida: email o salons no proporcionados.');
      return res.status(400).json({ message: 'El correo electrónico y al menos un salón son requeridos.' });
  }

  // Consulta para obtener el id_user basado en el email
  const queryUser = 'SELECT id_user FROM user WHERE email = ?';
  
  connection.query(queryUser, [email], (err, results) => {
      if (err) {
          console.error('Error al obtener el ID del usuario:', err);
          return res.status(500).json({ message: 'Error al obtener el ID del usuario.', error: err });
      }

      const userRows = results as Array<{ id_user: number }>;
      if (userRows.length === 0) {
          console.warn('Usuario no encontrado para el email:', email);
          return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      const id_user = userRows[0].id_user;
     // console.log('ID de usuario obtenido:', id_user);

      // Preparar los valores para insertar en user_salon
      const querySalon = 'INSERT INTO user_salon (id_user, id_salon) VALUES ?';
      const values = salons.map((salon: number) => [id_user, salon]);

      //console.log('Valores para insertar en user_salon:', values);

      // Iniciar una transacción
      connection.beginTransaction((err) => {
          if (err) {
              console.error('Error al iniciar la transacción:', err);
              return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
          }

          // Insertar las relaciones en la tabla user_salon
          connection.query(querySalon, [values], (err, result) => {
              if (err) {
                  console.error('Error al asignar salones al usuario:', err);
                  return connection.rollback(() => {
                      res.status(500).json({ message: 'Error al asignar salones al usuario.', error: err });
                  });
              }

              //console.log('Resultado de la inserción en user_salon:', result);

              // Actualizar el campo 'permiso' en la tabla 'user'
              const queryPermission = 'UPDATE user SET permiso = ? WHERE id_user = ?';
              const newPermissionValue = 'salon'; // Puedes personalizar este valor según tu lógica

              connection.query(queryPermission, [newPermissionValue, id_user], (err, permResult) => {
                  if (err) {
                      console.error('Error al actualizar el permiso del usuario:', err);
                      return connection.rollback(() => {
                          res.status(500).json({ message: 'Error al actualizar el permiso del usuario.', error: err });
                      });
                  }

                  //console.log('Permiso actualizado:', permResult);

                  // Confirmar la transacción si todo va bien
                  connection.commit((err) => {
                      if (err) {
                          console.error('Error al confirmar la transacción:', err);
                          return connection.rollback(() => {
                              res.status(500).json({ message: 'Error al confirmar la transacción.', error: err });
                          });
                      }
                      //console.log('Transacción confirmada con éxito.');
                      res.status(200).json({ message: 'Propietario, salones y permisos añadidos con éxito.' });
                  });
              });
          });
      });
  });
});

router.post('/deleteOwners', (req, res) => {
  const { ids } = req.body;

  console.log('IDs de propietarios a eliminar:', ids);

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'No se proporcionaron IDs válidos para eliminar.' });
  }

  // Inicia la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error('Error al iniciar la transacción:', err);
      return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
    }

    // Primero, elimina las relaciones en user_salon
    const deleteRelationsQuery = `DELETE FROM user_salon WHERE id_user IN (?)`;

    connection.query(deleteRelationsQuery, [ids], (error) => {
      if (error) {
        // Si hay un error, se revierte la transacción
        return connection.rollback(() => {
          console.error('Error al eliminar relaciones de propietarios:', error);
          res.status(500).json({ message: 'Error al eliminar las relaciones de propietarios.', error });
        });
      }

      // Ahora elimina los usuarios
      const deleteUsersQuery = `DELETE FROM user WHERE id_user IN (?)`;

      connection.query(deleteUsersQuery, [ids], (error: any, results: any) => {
        if (error) {
          // Si hay un error, se revierte la transacción
          return connection.rollback(() => {
            console.error('Error al eliminar propietarios:', error);
            res.status(500).json({ message: 'Error al eliminar los propietarios.', error });
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
          res.status(200).json({ message: 'Propietarios eliminados con éxito.', affectedRows: results.affectedRows });
        });
      });
    });    
  });
});




export default router