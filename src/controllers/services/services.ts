import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import { ResultSetHeader } from 'mysql2';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllServices', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';

  const query = `
    SELECT SQL_CALC_FOUND_ROWS 
      s.id_service, 
      s.name AS service_name, 
      GROUP_CONCAT(sn.name ORDER BY sn.name SEPARATOR ', ') AS subservices
    FROM service s
    INNER JOIN service_type sn ON s.id_service = sn.id_service
    WHERE s.name LIKE ? OR sn.name LIKE ?
    GROUP BY s.id_service
    LIMIT ?, ?;
  `;

  const countQuery = 'SELECT FOUND_ROWS() AS totalItems';

  connection.query(query, [search, search, offset, pageSize], (error, results) => {
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


router.post('/addService', async (req, res) => {
  const { name, subservices } = req.body;

  if (!name || !Array.isArray(subservices) || subservices.length === 0) {
    return res.status(400).json({ error: 'Nombre del servicio y subservicios son necesarios' });
  }

  // Usamos una transacción para asegurar que se añadan tanto el servicio como los subservicios
  const queryService = 'INSERT INTO service (name, id_salon) VALUES (?, 0)';
  const querySubservice = 'INSERT INTO service_type (id_service, name) VALUES (?, ?)';

  try {
    connection.beginTransaction(async (transactionError) => {
      if (transactionError) {
        console.error('Error starting transaction:', transactionError);
        return res.status(500).json({ error: 'Transaction failed' });
      }

      // Insertar el servicio
      connection.query(queryService, [name], (error, result: ResultSetHeader) => {
        if (error) {
          connection.rollback(() => {
            console.error('Error inserting service:', error);
            res.status(500).json({ error: 'Error inserting service' });
          });
          return;
        }

        const serviceId = result.insertId; // Asegúrate de obtener el serviceId correctamente

        // Insertar los subservicios asociados
        const subservicePromises = subservices.map(subservice => {
          return new Promise((resolve, reject) => {
            connection.query(querySubservice, [serviceId, subservice], (subError, subResult) => {
              if (subError) {
                return reject(subError);
              }
              resolve(subResult);
            });
          });
        });

        // Ejecutar todas las promesas de inserción de subservicios
        Promise.all(subservicePromises)
          .then(() => {
            connection.commit(commitError => {
              if (commitError) {
                connection.rollback(() => {
                  console.error('Error committing transaction:', commitError);
                  res.status(500).json({ error: 'Error committing transaction' });
                });
              } else {
                res.status(201).json({ message: 'Servicio y subservicios creados con éxito' });
              }
            });
          })
          .catch(subserviceError => {
            connection.rollback(() => {
              console.error('Error inserting subservices:', subserviceError);
              res.status(500).json({ error: 'Error inserting subservices' });
            });
          });
      });
    });
  } catch (error) {
    console.error('Error creating service and subservices:', error);
    res.status(500).json({ error: 'Error creating service and subservices' });
  }
});


router.delete("/deleteServiceWithSubservices/:id_service", (req, res) => {
  const { id_service } = req.params;

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({
        success: false,
        message: "Error starting transaction",
        error: err,
      });
    }

    // Primero, elimina los subservicios asociados al servicio
    const deleteSubservicesQuery =
      "DELETE FROM service_type WHERE id_service = ?";
    connection.query(deleteSubservicesQuery, [id_service], (err) => {
      if (err) {
        console.error("Error deleting subservices:", err);
        return connection.rollback(() => {
          res.status(500).json({
            success: false,
            message: "Error deleting subservices",
            error: err,
          });
        });
      }

      // Luego, elimina el servicio principal
      const deleteServiceQuery = "DELETE FROM service WHERE id_service = ?";
      connection.query(deleteServiceQuery, [id_service], (err) => {
        if (err) {
          console.error("Error deleting service:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error deleting service",
              error: err,
            });
          });
        }

        // Si todo va bien, confirma la transacción
        connection.commit((err) => {
          if (err) {
            console.error("Error committing transaction:", err);
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error committing transaction",
                error: err,
              });
            });
          }

          res.json({
            success: true,
            message: "Service and subservices deleted successfully",
          });
        });
      });
    });
  });
});


router.put('/updateService/:id_service', (req, res) => {
  const { id_service } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre del servicio es requerido' });
  }

  const query = 'UPDATE service SET name = ? WHERE id_service = ?';

  connection.query(query, [name, id_service], (error, results: any) => {
    if (error) {
      console.error('Error al actualizar el servicio:', error);
      return res.status(500).json({ error: 'Hubo un error al actualizar el servicio' });
    }

    // Verifica si la actualización afectó alguna fila
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    res.status(200).json({ success: true, message: 'Servicio actualizado correctamente' });
  });
})

router.put('/updateSubservices/:id_service', (req, res) => {
  const { id_service } = req.params;
  const { subservices } = req.body;

  if (!subservices || subservices.length === 0) {
    return res.status(400).json({ error: 'Debe proporcionar al menos un subservicio.' });
  }

  // Eliminar todos los subservicios actuales para este servicio
  const deleteQuery = 'DELETE FROM service_type WHERE id_service = ?';
  connection.query(deleteQuery, [id_service], (deleteError) => {
    if (deleteError) {
      console.error('Error eliminando subservicios:', deleteError);
      return res.status(500).json({ error: 'Error eliminando subservicios actuales.' });
    }

    // Insertar los nuevos subservicios
    const insertQuery = 'INSERT INTO service_type (id_service, name) VALUES ?';
    const subservicesData = subservices.map((subservice: string) => [id_service, subservice]);

    connection.query(insertQuery, [subservicesData], (insertError) => {
      if (insertError) {
        console.error('Error insertando nuevos subservicios:', insertError);
        return res.status(500).json({ error: 'Error insertando nuevos subservicios.' });
      }

      res.status(200).json({ success: true, message: 'Subservicios actualizados con éxito.' });
    });
  });
});


export default router;
