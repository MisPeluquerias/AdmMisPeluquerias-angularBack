import express from 'express';
import connection from '../../db/db';
const router = express.Router();
import bodyParser from 'body-parser';
import decodeToken from '../../functions/decodeToken';


router.use(bodyParser.json());



router.get('/getImgUser', async (req, res) => {
    const { id_user } = req.query;
  
    // Validar que id_user esté presente
    if (!id_user) {
      return res.status(400).json({ error: 'id_user parameter is required' });
    }
  
    let decodedIdUser;
    try {
      // Decodificar el token para obtener id_user
      decodedIdUser = decodeToken(id_user as string); // Asegúrate de que decodeToken acepte un string
    } catch (err) {
      console.error('Error decoding token:', err);
      return res.status(400).json({ error: 'Invalid token' });
    }
  
    // Iniciar la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error starting transaction:', err);
        return res.status(500).json({ error: 'Error starting transaction' });
      }
  
      // Ejecutar la consulta
      const query = `
      SELECT avatar_path 
      FROM user 
      WHERE id_user = ?;
  `;
      connection.query(query, [decodedIdUser], (error, results) => {
        if (error) {
          // En caso de error, revertir la transacción
          connection.rollback(() => {
            console.error('Error executing query:', error);
            res.status(500).json({ error: 'An error occurred while fetching data' });
          });
          return;
        }
  
        // Confirmar la transacción
        connection.commit((commitError) => {
          if (commitError) {
            // En caso de error durante el commit, revertir la transacción
            connection.rollback(() => {
              console.error('Error committing transaction:', commitError);
              res.status(500).json({ error: 'An error occurred while committing transaction' });
            });
            return;
          }
  
          // Enviar los resultados como respuesta
          res.json({ data: results });
        });
      });
    });
  });

  
  export default router;