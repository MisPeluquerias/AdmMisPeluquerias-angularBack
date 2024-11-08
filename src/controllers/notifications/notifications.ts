import express  from "express";
import connection from "../../db/db";
const router = express.Router();
import { ResultSetHeader } from "mysql2";


router.get('/count',async (req, res) => {
    // Inicia la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        return res.status(500).json({ error: 'Error al iniciar la transacción' });
      }
  
      // Consulta para contar el total de filas en `alert_admin`
      const query = 'SELECT COUNT(*) AS total FROM alert_admin';
  
      connection.query(query, (err, results:any) => {
        if (err) {
          // Si hay un error, deshacer la transacción
          return connection.rollback(() => {
            console.error('Error al contar las filas:', err);
            res.status(500).json({ error: 'Error al contar las filas' });
          });
        }
  
        // Confirmar la transacción si todo está bien
        connection.commit((err) => {
          if (err) {
            // Si hay un error al confirmar, deshacer la transacción
            return connection.rollback(() => {
              console.error('Error al confirmar la transacción:', err);
              res.status(500).json({ error: 'Error al confirmar la transacción' });
            });
          }
  
          // Devuelve el total de filas
          const total = results[0].total;
          res.status(200).json({ total });
        });
      });
    });
  });


  router.get('/all',async (req, res) => {
    // Iniciar la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        return res.status(500).json({ error: 'Error al iniciar la transacción' });
      }
  
      // Consulta para seleccionar todos los datos de `alert_admin`
      const query = 'SELECT * FROM alert_admin';
  
      // Ejecutar la consulta
      connection.query(query, (err, results) => {
        if (err) {
          // Si hay un error en la consulta, hacer rollback de la transacción
          return connection.rollback(() => {
            console.error('Error al obtener los datos:', err);
            res.status(500).json({ error: 'Error al obtener los datos de alert_admin' });
          });
        }
  
        // Confirmar la transacción si la consulta fue exitosa
        connection.commit((err) => {
          if (err) {
            // Si hay un error al confirmar, hacer rollback
            return connection.rollback(() => {
              console.error('Error al confirmar la transacción:', err);
              res.status(500).json({ error: 'Error al confirmar la transacción' });
            });
          }
  
          // Enviar los resultados al cliente en formato JSON
          res.status(200).json(results);
        });
      });
    });
  });

  router.delete('/delete/:id_alert_admin',async (req, res) => {
    const { id_alert_admin } = req.params;
    //console.log(id_alert_admin);
  
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        return res.status(500).json({ error: 'Error al iniciar la transacción' });
      }
  
      const deleteQuery = 'DELETE FROM alert_admin WHERE id_alert_admin = ?';
  
      connection.query(deleteQuery, [id_alert_admin], (err, results: ResultSetHeader) => {
        if (err) {
          return connection.rollback(() => {
            console.error('Error al eliminar la notificación:', err);
            res.status(500).json({ error: 'Error al eliminar la notificación' });
          });
        }
  
        if (results.affectedRows === 0) {
          // Si no se encontró la notificación con el ID proporcionado
          return connection.rollback(() => {
            res.status(404).json({ error: 'Notificación no encontrada' });
          });
        }
  
        connection.commit((err) => {
          if (err) {
            return connection.rollback(() => {
              console.error('Error al confirmar la transacción:', err);
              res.status(500).json({ error: 'Error al confirmar la transacción' });
            });
          }
  
          // Responder con un mensaje de éxito
          res.status(200).json({ message: 'Notificación eliminada con éxito' });
        });
      });
    });
  });
  


export default router;