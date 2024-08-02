import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import { RowDataPacket } from 'mysql2';
import { Request, Response } from 'express';

const router = express.Router();
router.use(bodyParser.json());




router.get('/getSalonById', async (req: Request, res: Response) => {


    const id_salon = req.query.id_salon; 
    
    console.log(id_salon);
    
    if (!id_salon) {
      return res.status(400).json({ error: 'id_salon is required' });
    }
    
  
    const query = `
      SELECT * 
      FROM salon 
      WHERE id_salon = ?`;
  
    // Iniciar la transacción
    connection.beginTransaction((transactionError) => {
      if (transactionError) {
        console.error('Error starting transaction:', transactionError);
        res.status(500).json({ error: 'An error occurred while starting the transaction' });
        return;
      }
  
      // Ejecutar la consulta principal dentro de la transacción
      connection.query(query, [id_salon], (queryError, results: RowDataPacket[]) => {
        if (queryError) {
          console.error('Error fetching salon:', queryError);
          connection.rollback(() => {
            res.status(500).json({ error: 'An error occurred while fetching the salon data' });
          });
          return;
        }
  
        // Verificar si se encontró el salón
        if (results.length === 0) {
          connection.rollback(() => {
            res.status(404).json({ message: 'Salon not found' });
          });
          return;
        }
  
        // Si todo va bien, confirmar la transacción
        connection.commit((commitError) => {
          if (commitError) {
            console.error('Error committing transaction:', commitError);
            connection.rollback(() => {
              res.status(500).json({ error: 'An error occurred while committing the transaction' });
            });
            return;
          }
  
          // Enviar la respuesta con los datos del salón
          res.json({ data: results[0] });
        });
      });
    });
  });

export default router;
