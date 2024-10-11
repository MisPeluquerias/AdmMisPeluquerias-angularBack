import express, { Request, Response } from "express";
import connection from '../../db/db'; // Ajusta esta ruta según tu estructura de directorios
import bodyParser from 'body-parser';
import decodeToken from '../../functions/decodeToken'; // Asegúrate de que esta función está correctamente exportada
import { RowDataPacket } from "mysql2";
import bcrypt from 'bcrypt';
import { OkPacket } from 'mysql2'; // Importa OkPacket
import multer from 'multer';
import path  from 'path';
import fs from 'fs';


const router = express.Router();
router.use(bodyParser.json());


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '../../../dist/uploads/profile-pictures'));
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


router.get("/getProvincesForNewClient", async (req: Request, res: Response) => {
  
    connection.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error("Error starting transaction:", transactionError);
            return res.status(500).json({ error: "Failed to start transaction" });
        }

        const query = `SELECT id_province, name FROM province`;
  
        connection.query(query, (queryError, results: RowDataPacket[]) => {
            if (queryError) {
                return connection.rollback(() => {
                    console.error("Error fetching provinces:", queryError);
                    res.status(500).json({ error: "An error occurred while fetching the provinces" });
                });
            }
  
            connection.commit((commitError) => {
                if (commitError) {
                    return connection.rollback(() => {
                        console.error("Error committing transaction:", commitError);
                        res.status(500).json({ error: "Failed to commit transaction" });
                    });
                }

                res.json({ data: results });
            });
        });
    });
});



router.get("/getCitiesByProvinceForNewClient", async (req: Request, res: Response) => {
    const id_province = req.query.id_province;

    if (!id_province) {
        return res.status(400).json({ error: "id_province is required" });
    }

    connection.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error("Error starting transaction:", transactionError);
            return res.status(500).json({ error: "Failed to start transaction" });
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

        connection.query(query, [id_province], (queryError, results: RowDataPacket[]) => {
            if (queryError) {
                return connection.rollback(() => {
                    console.error("Error fetching cities and province:", queryError);
                    res.status(500).json({
                        error: "An error occurred while fetching the city and province data",
                    });
                });
            }

            connection.commit((commitError) => {
                if (commitError) {
                    return connection.rollback(() => {
                        console.error("Error committing transaction:", commitError);
                        res.status(500).json({ error: "Failed to commit transaction" });
                    });
                }

                res.json({ data: results });
            });
        });
    });
});



router.post("/addNewUser", async (req: Request, res: Response) => {
  const {
    name,
    lastname,
    email,
    phone,
    address,
    id_province,
    id_city,
    dni,
    permiso,
    password
  } = req.body;

  console.log('datos recibidos', req.body);

  // Validaciones básicas
  if (!name || !lastname || !email || !phone || !address || !id_province || !id_city || !dni || !password || !permiso) {
    console.log('Error: Uno o más campos están vacíos');
    return res.status(400).json({ error: "All fields are required" });
  }

  // Iniciar transacción
  connection.beginTransaction(async (transactionError) => {
    if (transactionError) {
      console.error("Error starting transaction:", transactionError);
      return res.status(500).json({ error: "Failed to start transaction" });
    }
    //comprobacion de git
    try {
      // Encriptar la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Contraseña encriptada:', hashedPassword);

      // Insertar el nuevo usuario
      const insertUserQuery = `
        INSERT INTO user (name, lastname, permiso, email, phone, address, id_province, id_city, dni, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      console.log('Ejecutando consulta SQL:', insertUserQuery);
      console.log('Valores:', [name, lastname, permiso, email, phone, address, id_province, id_city, dni, hashedPassword]);

      connection.query(
        insertUserQuery,
        [name, lastname, permiso, email, phone, address, id_province, id_city, dni, hashedPassword],
        (insertError, insertResults: OkPacket) => {
          if (insertError) {
            // Manejo del error de entrada duplicada
            if (insertError.code === 'ER_DUP_ENTRY') {
              console.log("Error inserting new user:", insertError.message);
              return connection.rollback(() => {
                res.status(409).json({ error: "User with this email already exists" });
              });
            }
            console.log("Error inserting new user:", insertError.message);
            return connection.rollback(() => {
              res.status(500).json({ error: "Failed to insert new user" });
            });
          }

          const newUserId = insertResults.insertId;
          console.log('Nuevo usuario creado con ID:', newUserId);

          // Confirmar la transacción
          connection.commit((commitError) => {
            if (commitError) {
              return connection.rollback(() => {
                console.error("Error committing transaction:", commitError);
                res.status(500).json({ error: "Failed to commit transaction" });
              });
            }

            res.status(201).json({
              success: true,
              message: "New user created successfully",
              userId: newUserId
            });
          });
        }
      );
    } catch (error) {
      console.error("Error during user creation:", error);
      return connection.rollback(() => {
        res.status(500).json({ error: "Failed to create new user" });
      });
    }
  });
});



export default router;