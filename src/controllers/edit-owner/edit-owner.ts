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

  router.get("/getProvinces", async (req: Request, res: Response) => {
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

  router.get("/getCitiesByProvinceForEditOwner", async (req: Request, res: Response) => {
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

router.put('/updateOwner/:id_user', async (req: Request, res: Response) => {
  const { id_user } = req.params;
  const { name, lastname, email, phone, address, id_province, id_city, dni, password } = req.body;

  // Iniciar transacción
  connection.beginTransaction(async (transactionError) => {
      if (transactionError) {
          console.error("Error al iniciar la transacción:", transactionError);
          return res.status(500).json({ message: 'Error al iniciar la transacción' });
      }

      try {
          // Si se proporciona una nueva contraseña, la ciframos
          let hashedPassword = null;
          if (password) {
              const saltRounds = 10;
              hashedPassword = await bcrypt.hash(password, saltRounds);
          }

          // Actualización de la consulta SQL
          const query = `
              UPDATE user
              SET 
                  name=?, 
                  lastname=?, 
                  email=?, 
                  phone=?, 
                  address=?,  
                  id_province=?, 
                  id_city=?, 
                  dni=?,
                  ${hashedPassword ? 'password=?,' : ''} 
                  updated_at = NOW()
              WHERE id_user=?;
          `;

          const params = [name, lastname, email, phone, address, id_province, id_city, dni];
          if (hashedPassword) {
              params.push(hashedPassword);
          }
          params.push(id_user);

          // Ejecutar la consulta
          connection.query(query, params, (queryError) => {
              if (queryError) {
                  console.error("Error al actualizar el cliente:", queryError);
                  return connection.rollback(() => {
                      res.status(500).json({ message: 'Error al actualizar el cliente' });
                  });
              }

              // Si todo va bien, hacemos commit a la transacción
              connection.commit((commitError) => {
                  if (commitError) {
                      console.error("Error al hacer commit:", commitError);
                      return connection.rollback(() => {
                          res.status(500).json({ message: 'Error al hacer commit de la transacción' });
                      });
                  }

                  res.json({ message: 'Cliente actualizado correctamente' });
              });
          });

      } catch (error) {
          console.error("Error durante la transacción:", (error as Error).message);
          return connection.rollback(() => {
              res.status(500).json({ message: 'Error al procesar la transacción' });
          });
      }
  });
});
  
  router.get("/getOwnerById", async (req: Request, res: Response) => {
    const id_user = req.query.id_user;
  
    if (!id_user) {
      return res.status(400).json({ error: "id_salon is required" });
    }
  
    const query = `
      SELECT * FROM user WHERE id_user = ? AND permiso = 'salon'
    `;
  
    try {
      connection.beginTransaction(async (transactionError) => {
        if (transactionError) {
          console.error("Error starting transaction:", transactionError);
          return res.status(500).json({
            error: "An error occurred while starting the transaction",
          });
        }
  
        connection.query(query, [id_user], (queryError, results: RowDataPacket[]) => {
          if (queryError) {
            console.error("Error fetching salon:", queryError);
            return connection.rollback(() => {
              res.status(500).json({
                error: "An error occurred while fetching the salon data",
              });
            });
          }
  
          if (results.length === 0) {
            return connection.rollback(() => {
              res.status(404).json({ message: "Salon not found" });
            });
          }
  
          connection.commit((commitError) => {
            if (commitError) {
              console.error("Error committing transaction:", commitError);
              return connection.rollback(() => {
                res.status(500).json({
                  error: "An error occurred while committing the transaction",
                });
              });
            }
  
            res.json({ data: results[0] });
          });
        });
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  });



  router.get("/getSalonOwnerById", async (req: Request, res: Response) => {
    const id_user = req.query.id_user;
  
    if (!id_user) {
      return res.status(400).json({ error: "id_user is required" });
    }
  
    const query = `
      SELECT us.*, s.name
      FROM user_salon us
      INNER JOIN salon s ON us.id_salon = s.id_salon
      WHERE us.id_user = ?;
    `;
  
    try {
      connection.beginTransaction((transactionError) => {
        if (transactionError) {
          console.error("Error starting transaction:", transactionError);
          return res.status(500).json({
            error: "An error occurred while starting the transaction",
          });
        }
  
        connection.query(query, [id_user], (queryError, results: RowDataPacket[]) => {
          if (queryError) {
            console.error("Error fetching salon_user:", queryError);
            return connection.rollback(() => {
              res.status(500).json({
                error: "An error occurred while fetching the salon data",
              });
            });
          }
  
          if (results.length === 0) {
            return connection.rollback(() => {
              res.status(404).json({ message: "No salons found for this user" });
            });
          }
  
          connection.commit((commitError) => {
            if (commitError) {
              console.error("Error committing transaction:", commitError);
              return connection.rollback(() => {
                res.status(500).json({
                  error: "An error occurred while committing the transaction",
                });
              });
            }
  
            // Aquí devolvemos todos los resultados en lugar de solo el primero
            res.json({ data: results });
          });
        });
      });
    } catch (err) {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred" });
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

  router.put('/updateUserSalon/:id_user_salon', (req: Request, res: Response) => {
    const { id_user_salon } = req.params;
    const { id_salon } = req.body;

    if (!id_user_salon || !id_salon) {
        return res.status(400).json({ error: "id_user_salon and id_salon are required" });
    }

    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: "Error starting transaction" });
        }

        const query = `
            UPDATE user_salon 
            SET id_salon = ? 
            WHERE id_user_salon = ?;
        `;

        connection.query(query, [id_salon, id_user_salon], (error, results: OkPacket) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error updating user_salon:', error.message);
                    res.status(500).json({ error: "Error updating user_salon" });
                });
            }

            if (results.affectedRows === 0) {
                return connection.rollback(() => {
                    res.status(404).json({ message: "user_salon not found or no changes made" });
                });
            }

            connection.commit((commitErr) => {
                if (commitErr) {
                    return connection.rollback(() => {
                        console.error('Error committing transaction:', commitErr);
                        res.status(500).json({ error: "Error committing transaction" });
                    });
                }

                res.json({ message: "user_salon updated successfully" });
            });
        });
    });
});

// Delete user_salon
router.delete('/deleteUserSalon/:id_user_salon', (req: Request, res: Response) => {
    const { id_user_salon } = req.params;

    if (!id_user_salon) {
        return res.status(400).json({ error: "id_user_salon is required" });
    }

    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: "Error starting transaction" });
        }

        const query = `
            DELETE FROM user_salon 
            WHERE id_user_salon = ?;
        `;

        connection.query(query, [id_user_salon], (error, results: OkPacket) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error deleting user_salon:', error.message);
                    res.status(500).json({ error: "Error deleting user_salon" });
                });
            }

            if (results.affectedRows === 0) {
                return connection.rollback(() => {
                    res.status(404).json({ message: "user_salon not found" });
                });
            }

            connection.commit((commitErr) => {
                if (commitErr) {
                    return connection.rollback(() => {
                        console.error('Error committing transaction:', commitErr);
                        res.status(500).json({ error: "Error committing transaction" });
                    });
                }

                res.json({ message: "user_salon deleted successfully" });
            });
        });
    });
});

// Add user_salon
router.post('/addUserSalon', (req: Request, res: Response) => {
    const { id_user, id_salon } = req.body;

    if (!id_user || !id_salon) {
        return res.status(400).json({ error: "id_user and id_salon are required" });
    }

    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: "Error starting transaction" });
        }

        const query = `
            INSERT INTO user_salon (id_user, id_salon)
            VALUES (?, ?);
        `;

        connection.query(query, [id_user, id_salon], (error, results: OkPacket) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error inserting into user_salon:', error.message);
                    res.status(500).json({ error: "Error inserting into user_salon" });
                });
            }

            connection.commit((commitErr) => {
                if (commitErr) {
                    return connection.rollback(() => {
                        console.error('Error committing transaction:', commitErr);
                        res.status(500).json({ error: "Error committing transaction" });
                    });
                }

                res.json({ message: "user_salon added successfully", id_user_salon: results.insertId });
            });
        });
    });
});


export default router;





