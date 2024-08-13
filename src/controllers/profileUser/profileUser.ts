import express from 'express';
import connection from '../../db/db'; // Ajusta esta ruta según tu estructura de directorios
import bodyParser from 'body-parser';
import decodeToken from '../../functions/decodeToken'; // Asegúrate de que esta función está correctamente exportada
import { RowDataPacket } from "mysql2";
import { Request, Response } from "express";


const router = express.Router();
router.use(bodyParser.json());

router.get('/getDataUser', async (req, res) => {
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
    SELECT u.*, c.name AS city_name 
    FROM user u
    JOIN city c ON u.id_city = c.id_city
    WHERE u.id_user = ?;
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

router.get("/getCitiesByProvince", async (req: Request, res: Response) => {
  const id_province = req.query.id_province;

  if (!id_province) {
    return res.status(400).json({ error: "id_province is required" });
  }

  const query = `
    SELECT 
      p.name as province_name,
      c.id_city,
      c.name as city_name,
      c.zip_code
    FROM 
      province p
    JOIN 
      city c ON p.id_province = c.id_province
    WHERE 
      p.id_province = ?;
  `;

  connection.query(
    query,
    [id_province],
    (queryError, results: RowDataPacket[]) => {
      if (queryError) {
        console.error("Error fetching cities and province:", queryError);
        return res.status(500).json({
          error: "An error occurred while fetching the city and province data",
        });
      }

      res.json({ data: results });
    }
  );
});

router.get("/getProvincesForProfile", async (req: Request, res: Response) => {
  
  const query = `SELECT id_province, name FROM province`;

  connection.query(query, (queryError, results: RowDataPacket[]) => {
    if (queryError) {
      console.error("Error fetching provinces:", queryError);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching the provinces" });
    }

    res.json({ data: results });
  });
});

router.get("/getCitiesByProvinceForProfile", async (req: Request, res: Response) => {
  const id_province = req.query.id_province;

  if (!id_province) {
    return res.status(400).json({ error: "id_province is required" });
    
  }

  console.log(id_province);

  
  const query = `
    SELECT 
      p.name as province_name,
      c.id_city,
      c.name as city_name,
      c.zip_code
    FROM 
      province p
    JOIN 
      city c ON p.id_province = c.id_province
    WHERE 
      p.id_province = ?;
  `;

  connection.query(
    query,
    [id_province],
    (queryError, results: RowDataPacket[]) => {
      if (queryError) {
        console.error("Error fetching cities and province:", queryError);
        return res.status(500).json({
          error: "An error occurred while fetching the city and province data",
        });
      }

      res.json({ data: results });
    }
  );
});


export default router;
