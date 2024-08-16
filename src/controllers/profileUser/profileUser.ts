import express from 'express';
import connection from '../../db/db'; // Ajusta esta ruta según tu estructura de directorios
import bodyParser from 'body-parser';
import decodeToken from '../../functions/decodeToken'; // Asegúrate de que esta función está correctamente exportada
import { RowDataPacket } from "mysql2";
import { Request, Response } from "express";
import bcrypt from 'bcrypt';
import { OkPacket } from 'mysql2'; // Importa OkPacket
import multer from 'multer';
import path  from 'path';
import fs from 'fs';

const router = express.Router();
router.use(bodyParser.json());


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../../dist/uploads/profile-pictures')); // Directorio para guardar fotos de perfil
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    const newName = `profile-${req.params.id_user}-${uniqueSuffix}${ext}`;
    cb(null, newName);
  }
});

const upload = multer({ storage: storage });

// Ruta para manejar la carga de la foto de perfil
router.put('/uploadProfilePicture/:id_user', upload.single('profilePicture'), async (req, res) => {
  const { id_user } = req.params;

  if (!id_user) {
    return res.status(400).json({ error: 'id_user is required' });
  }

  try {
    // Consulta para obtener la ruta de la imagen existente
    const selectQuery = `SELECT avatar_path FROM user WHERE id_user = ?`;
    connection.query(selectQuery, [id_user], (selectErr, results: RowDataPacket[]) => {
      if (selectErr) {
        return res.status(500).json({ success: false, message: 'Error al obtener la información existente', error: selectErr });
      }

      // Eliminar la imagen existente si existe
      if (results.length > 0 && results[0].avatar_path) {
        const existingImagePath = path.join(__dirname, '../../../dist', results[0].avatar_path.replace(req.protocol + '://' + req.get('host'), ''));
        if (fs.existsSync(existingImagePath)) {
          fs.unlinkSync(existingImagePath); // Elimina el archivo existente
        }
      }

      // Guardar la nueva imagen
      if (req.file) {
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/profile-pictures/${req.file.filename}`;
        const updateQuery = `UPDATE user SET avatar_path = ? WHERE id_user = ?`;

        connection.query(updateQuery, [fileUrl, id_user], (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ success: false, message: 'Error al guardar la nueva imagen en la base de datos', error: updateErr });
          }

          res.json({ success: true, message: 'Foto de perfil subida y guardada correctamente', fileUrl: fileUrl });
        });
      } else {
        res.status(400).json({ success: false, message: 'No se pudo subir la foto de perfil' });
      }
    });
  } catch (err) {
    console.error('Error durante la carga de la imagen:', err);
    res.status(500).json({ success: false, message: 'Error durante la carga de la imagen', error: err });
  }
});



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

  //console.log(id_province);

  
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

router.put('/updateUser', async (req: Request, res: Response) => {
  const { id_user, name, lastname, email, phone, address, id_city, id_province, permiso } = req.body;

  // Validar que id_user esté presente
  if (!id_user) {
    return res.status(400).json({ error: 'id_user parameter is required' });
  }

  //console.log('id_user received:', id_user); // Verifica qué valor estás recibiendo

  let decodedIdUser;
  try {
    // Si id_user es un token JWT, intenta decodificarlo. Si no, úsalo directamente.
    if (typeof id_user === 'string' && id_user.split('.').length === 3) {
      decodedIdUser = decodeToken(id_user); // Decodificar el token para obtener id_user
      //console.log('Decoded ID User:', decodedIdUser); // Verifica si el ID se decodifica correctamente
    } else {
      decodedIdUser = id_user; // Si id_user no es un JWT, úsalo tal cual
     // console.log('Using id_user directly:', decodedIdUser);
    }
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

    // Construir la consulta de actualización
    const query = `
      UPDATE user 
      SET 
        name = ?, 
        lastname = ?, 
        email = ?, 
        phone = ?, 
        address = ?, 
        id_city = ?, 
        id_province = ?, 
        permiso = ? 
      WHERE id_user = ?;
    `;

    const queryParams = [
      name, 
      lastname, 
      email, 
      phone, 
      address, 
      id_city, 
      id_province, 
      permiso, 
      decodedIdUser
    ];

    // Ejecutar la consulta
    connection.query(query, queryParams, (error, results) => {
      if (error) {
        // En caso de error, revertir la transacción
        connection.rollback(() => {
          console.error('Error executing update query:', error);
          res.status(500).json({ error: 'An error occurred while updating the user data' });
        });
        return;
      }

      // Confirmar la transacción
      connection.commit((commitError) => {
        if (commitError) {
          // En caso de error durante el commit, revertir la transacción
          connection.rollback(() => {
            console.error('Error committing transaction:', commitError);
            res.status(500).json({ error: 'An error occurred while committing the transaction' });
          });
          return;
        }

        // Enviar la respuesta exitosa
        res.json({ message: 'User data updated successfully' });
      });
    });
  });
});


router.put('/updateUserPassword', async (req, res) => {
  const { id_user, password } = req.body;



  // Iniciar la transacción
  connection.beginTransaction(async (err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'Error starting transaction' });
    }

    try {
      // Encriptar la nueva contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Actualizar la contraseña en la base de datos
      const query = `UPDATE user SET password = ? WHERE id_user = ?`;
      connection.query(query, [hashedPassword, id_user], (error, results: OkPacket) => {
        if (error) {
          console.error('Error updating password:', error);
          return connection.rollback(() => {
            res.status(500).json({ error: 'Error updating password' });
          });
        }

        // Verificar si algún registro fue actualizado
        if (results.affectedRows === 0) {
          return connection.rollback(() => {
            res.status(404).json({ error: 'User not found' });
          });
        }

        // Confirmar la transacción
        connection.commit((commitError) => {
          if (commitError) {
            console.error('Error committing transaction:', commitError);
            return connection.rollback(() => {
              res.status(500).json({ error: 'Error committing transaction' });
            });
          }

          res.json({ message: 'Password updated successfully' });
        });
      });
    } catch (hashError) {
      console.error('Error hashing password:', hashError);
      return connection.rollback(() => {
        res.status(500).json({ error: 'Error processing request' });
      });
    }
  });
});


export default router;
