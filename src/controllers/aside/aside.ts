import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import decodeToken from '../../functions/decodeToken';

const router = express.Router();
router.use(bodyParser.json());

router.get("/getUserName", (req, res) => {
    
    const { id_user } = req.query;
    let decodedIdUser;
    try {
        // Decodificar el token para obtener id_user
        decodedIdUser = decodeToken(id_user as string); 
        //console.log('Decoded ID User:', decodedIdUser); // Depuración: muestra el ID de usuario decodificado
    } catch (err) {
        console.error('Error decoding token:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }

    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err); // Depuración: error al iniciar la transacción
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }

        const query = `SELECT name FROM user WHERE id_user = ?`;
       // console.log('Executing query:', query); // Depuración: muestra la consulta que se va a ejecutar
  
        connection.query(query, [decodedIdUser], (err, results) => {
            if (err) {
                console.error('Error fetching user name:', err); // Depuración: error al ejecutar la consulta
                return connection.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error fetching user name",
                        error: err,
                    });
                });
            }

           // console.log('Query Results:', results); // Depuración: muestra los resultados obtenidos de la consulta
  
            connection.commit((err) => {
                if (err) {
                    console.error('Error committing transaction:', err); // Depuración: error al hacer commit
                    return connection.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error committing transaction",
                            error: err,
                        });
                    });
                }
                //console.log('Transaction committed successfully'); // Depuración: transacción exitosa
                res.json({ success: true, data: results });
            });
        });
    });
});



export default router;