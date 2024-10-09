import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from "mysql2";
import { RowDataPacket } from 'mysql2';
import multer from 'multer';
import path  from 'path';
import fs from 'fs';


const router = express.Router();
router.use(bodyParser.json());


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '../../../dist/uploads/brands-pictures'));
  },
  filename: (req, file, cb) => {
    // Generar un nombre de archivo único con un prefijo y marca de tiempo
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, `brand-${uniqueSuffix}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
    }
  },
});


router.get("/getAllBrands", async (req, res) => {
  try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
      const offset = (page - 1) * pageSize;
      const search = req.query.search ? `%${req.query.search}%` : "%%";

      const query = `
          SELECT b.id_brand, b.name, b.imagePath, b.active, COUNT(sb.id_salon) AS totalSalones
          FROM brands b
          LEFT JOIN brands_salon sb ON b.id_brand = sb.id_brand
          WHERE b.name LIKE ?
          GROUP BY b.id_brand
          LIMIT ?, ?;
      `;

      const countQuery = `
          SELECT COUNT(*) AS totalItems 
          FROM brands 
          WHERE name LIKE ?;
      `;

      connection.beginTransaction((err) => {
          if (err) {
              console.error("Error starting transaction:", err);
              return res.status(500).json({ error: "An error occurred while starting transaction" });
          }

          connection.query(query, [search, offset, pageSize], (error, results: RowDataPacket[]) => {
              if (error) {
                  console.error("Error fetching data:", error);
                  return connection.rollback(() => {
                      res.status(500).json({ error: "An error occurred while fetching data" });
                  });
              }

              connection.query(countQuery, [search], (countError, countResults: RowDataPacket[]) => {
                  if (countError) {
                      console.error("Error fetching count:", countError);
                      return connection.rollback(() => {
                          res.status(500).json({ error: "An error occurred while fetching data count" });
                      });
                  }

                  const totalItems = countResults[0].totalItems;

                  const processedResults = results.map((row: any) => ({
                      id_brand: row.id_brand,
                      name: row.name,
                      imagePath: row.imagePath,
                      active: row.active,
                      totalSalones: row.totalSalones
                  }));

                  connection.commit((commitError) => {
                      if (commitError) {
                          console.error("Error committing transaction:", commitError);
                          return connection.rollback(() => {
                              res.status(500).json({ error: "An error occurred while committing transaction" });
                          });
                      }

                      res.json({ data: processedResults, totalItems });
                  });
              });
          });
      });
  } catch (err) {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred" });
  }
});



router.post('/addBrand', upload.single('brandImage'), async (req, res) => {
  try {
    //console.log('Archivo recibido:', req.file); // Debe mostrar información sobre el archivo
    //console.log('Datos recibidos:', req.body); // Debe mostrar el nombre de la marca

    const { name } = req.body;
    const brandImage = req.file;

    if (!name) {
      return res.status(400).json({ error: 'El nombre de la marca es requerido' });
    }

    if (!brandImage) {
      return res.status(400).json({ error: 'La imagen es requerida' });
    }

    // Construir la URL completa basada en el servidor
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${serverUrl}/uploads/brands-pictures/${brandImage.filename}`;

    const query = `
      INSERT INTO brands (name, imagePath, active)
      VALUES (?, ?, ?);
    `;

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error al iniciar la transacción:', err);
        return res.status(500).json({ error: 'Ocurrió un error al iniciar la transacción' });
      }

      connection.query<ResultSetHeader>(
        query,
        [name, imageUrl, 1], // El valor de "active" es 1 por defecto
        (error, results) => {
          if (error) {
            console.error('Error al insertar los datos:', error);
            return connection.rollback(() => {
              res.status(500).json({ error: 'Ocurrió un error al insertar los datos' });
            });
          }

          connection.commit((commitError) => {
            if (commitError) {
              console.error('Error al confirmar la transacción:', commitError);
              return connection.rollback(() => {
                res.status(500).json({ error: 'Ocurrió un error al confirmar la transacción' });
              });
            }

            res.status(201).json({ message: 'Marca añadida exitosamente' });
          });
        }
      );
    });
  } catch (err) {
    console.error('Error inesperado:', err);
    res.status(500).json({ error: 'Ocurrió un error inesperado' });
  }
});





router.put("/updateBrand", upload.single('brandImage'), (req, res) => {
  //console.log("Iniciando actualización de marca..."); // Depuración
  //console.log("Archivo recibido:", req.file); // Depuración para ver el archivo recibido
  //console.log("Datos recibidos:", req.body); // Depuración para ver los datos recibidos

  const { id_brand, name } = req.body;
  const brandImage = req.file;

  // Validar que se proporcionen el ID y el nuevo nombre
  if (!id_brand || !name) {
    console.error("Faltan id_brand o name en la solicitud."); // Depuración
    return res.status(400).json({ message: "id_brand y name son requeridos" });
  }

  // Validar que la imagen haya sido subida
  if (!brandImage) {
    console.error("No se ha proporcionado una imagen de marca."); // Depuración
    return res.status(400).json({ message: "La imagen de la marca es requerida" });
  }

  // Iniciar la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err); // Depuración
      return res.status(500).json({ message: "Error al iniciar la transacción" });
    }

    // Primero, obtener la ruta de la imagen antigua
    const selectQuery = `SELECT imagePath FROM brands WHERE id_brand = ?`;
    connection.query<RowDataPacket[]>(selectQuery, [id_brand], (selectError, selectResults) => {
      if (selectError) {
        console.error("Error al obtener la ruta de la imagen antigua:", selectError); // Depuración
        return connection.rollback(() => {
          res.status(500).json({ message: "Error al obtener la ruta de la imagen antigua" });
        });
      }

      if (selectResults.length === 0) {
        console.error("Marca no encontrada con el id proporcionado."); // Depuración
        return connection.rollback(() => {
          res.status(404).json({ message: "Marca no encontrada" });
        });
      }

      const oldImagePath = selectResults[0].imagePath;
      const oldFileName = path.basename(oldImagePath);
      const oldFilePath = path.join(__dirname, '../../../dist/uploads/brands-pictures', oldFileName);

      // Construir la URL de la nueva imagen
      const serverUrl = `${req.protocol}://${req.get('host')}`;
      const newImageUrl = `${serverUrl}/uploads/brands-pictures/${brandImage.filename}`;

      // Consulta para actualizar el nombre y la imagen de la marca
      const updateQuery = `
        UPDATE brands
        SET name = ?, imagePath = ?
        WHERE id_brand = ?;
      `;

      connection.query<ResultSetHeader>(
        updateQuery,
        [name, newImageUrl, id_brand],
        (updateError, results) => {
          if (updateError) {
            console.error("Error al actualizar la marca:", updateError); // Depuración
            return connection.rollback(() => {
              res.status(500).json({ message: "Error al actualizar la marca" });
            });
          }

          if (results.affectedRows === 0) {
            console.error("No se encontraron marcas para actualizar."); // Depuración
            return connection.rollback(() => {
              res.status(404).json({ message: "Marca no encontrada" });
            });
          }

          // Eliminar la imagen antigua del sistema de archivos si existe
          fs.access(oldFilePath, fs.constants.F_OK, (accessErr) => {
            if (!accessErr) {
              fs.unlink(oldFilePath, (unlinkErr) => {
                if (unlinkErr) {
                  console.error("Error al eliminar la imagen antigua:", unlinkErr); // Depuración
                  // Continuar sin hacer rollback ya que no afecta la base de datos
                } else {
                  console.log("Imagen antigua eliminada exitosamente."); // Depuración
                }
              });
            } else {
              console.warn("La imagen antigua no existe en el servidor, nada que eliminar."); // Depuración
            }
          });

          // Confirmar la transacción
          connection.commit((commitErr) => {
            if (commitErr) {
              console.error("Error al confirmar la transacción:", commitErr); // Depuración
              return connection.rollback(() => {
                res.status(500).json({ message: "Error al confirmar la transacción" });
              });
            }

            //console.log("Marca actualizada con éxito."); // Depuración
            res.status(200).json({ message: "Marca actualizada con éxito" });
          });
        }
      );
    });
  });
});



  router.post('/deleteBrand', (req, res) => {
    const { id_brand } = req.body;
  
    // Validar que se proporcionen los IDs y que sea un array válido
    if (!id_brand || !Array.isArray(id_brand) || id_brand.length === 0) {
      return res.status(400).json({ message: 'No hay marcas para eliminar' });
    }
  
    // Iniciar la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error iniciando la transacción:', err);
        return res.status(500).json({ message: 'Error al iniciar la transacción' });
      }
  
      // Consulta para obtener las rutas de las imágenes de las marcas que se van a eliminar
      const selectQuery = `SELECT imagePath FROM brands WHERE id_brand IN (?)`;
      connection.query<RowDataPacket[]>(selectQuery, [id_brand], (selectError, selectResults) => {
        if (selectError) {
          console.error('Error al obtener las rutas de las imágenes:', selectError);
          return connection.rollback(() => {
            res.status(500).json({ message: 'Error al obtener las rutas de las imágenes' });
          });
        }
  
        if (selectResults.length === 0) {
          console.error('No se encontraron marcas con los IDs proporcionados.');
          return connection.rollback(() => {
            res.status(404).json({ message: 'No se encontraron marcas para eliminar' });
          });
        }
  
        // Procesar cada marca encontrada
        selectResults.forEach((row) => {
          const fileUrl = row.imagePath;
          const fileName = path.basename(fileUrl);
  
          // Construir la ruta del archivo en el sistema de archivos
          const filePath = path.join(__dirname, '../../uploads/brands-pictures', fileName);
  
          // Verificar si el archivo existe
          fs.access(filePath, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
              console.error(`Archivo no encontrado en el servidor: ${filePath}`);
              // No detenemos el proceso si el archivo no existe
              return;
            }
  
            // Eliminar el archivo del sistema de archivos
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error(`Error al eliminar el archivo: ${filePath}`, unlinkErr);
                // No hacemos rollback ya que la eliminación del archivo no afecta la integridad de la base de datos
              } else {
                //console.log(`Archivo eliminado exitosamente: ${filePath}`);
              }
            });
          });
        });
  
        // Eliminar las marcas de la base de datos
        const deleteQuery = `DELETE FROM brands WHERE id_brand IN (?)`;
        connection.query<ResultSetHeader>(deleteQuery, [id_brand], (deleteError, deleteResults) => {
          if (deleteError) {
            console.error('Error al eliminar las marcas:', deleteError);
            return connection.rollback(() => {
              res.status(500).json({ message: 'Error al eliminar las marcas' });
            });
          }
  
          if (deleteResults.affectedRows === 0) {
            console.error('No se encontraron marcas para eliminar.');
            return connection.rollback(() => {
              res.status(404).json({ message: 'No se encontraron marcas para eliminar' });
            });
          }
  
          // Confirmar la transacción
          connection.commit((commitErr) => {
            if (commitErr) {
              console.error('Error al confirmar la transacción:', commitErr);
              return connection.rollback(() => {
                res.status(500).json({ message: 'Error al confirmar la transacción' });
              });
            }
  
            //console.log('Marcas e imágenes eliminadas con éxito');
            res.status(200).json({ message: 'Marcas e imágenes eliminadas con éxito' });
          });
        });
      });
    });
  });
  
  
  
  



export default router;