import express from 'express';
import connection from '../../db/db';
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import { ResultSetHeader } from 'mysql2';
import { RowDataPacket } from 'mysql2';
import fs from "fs";

const router = express.Router();
router.use(bodyParser.json());


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.resolve(__dirname, "../../../dist/uploads/jobs-pictures"));
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
      if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "image/gif" ||
        file.mimetype === "image/webp"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only JPEG, PNG,GIF and webp are allowed."));
      }
    },
  });



  router.get("/getAllImgJobs", (req, res) => {
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '10', 10);
    const offset = (page - 1) * pageSize;
  
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error al iniciar la transacción:", err);
        return res.status(500).json({ error: "Ocurrió un error al iniciar la transacción" });
      }
  
      // Consulta para contar el total de imágenes
      const countQuery = `SELECT COUNT(*) as totalItems FROM jobs_img`;
      connection.query(countQuery, (countError, countResults:any) => {
        if (countError) {
          console.error("Error al contar las imágenes:", countError);
          return connection.rollback(() => {
            res.status(500).json({ error: "Ocurrió un error al contar las imágenes" });
          });
        }
  
        const totalItems = countResults[0].totalItems;
  
        // Consulta para obtener las imágenes con paginación
        const selectImagesQuery = `
          SELECT id_jobs_img, path FROM jobs_img
          LIMIT ? OFFSET ?;
        `;
  
        connection.query(selectImagesQuery, [pageSize, offset], (error, results) => {
          if (error) {
            console.error("Error al obtener las imágenes:", error);
            return connection.rollback(() => {
              res.status(500).json({ error: "Ocurrió un error al obtener las imágenes" });
            });
          }
  
          // Verifica que results es un array de RowDataPacket
          const rows = results as RowDataPacket[];
  
          const serverUrl = `${req.protocol}://${req.get("host")}`;
          const images = rows.map((row) => ({
            id_jobs_img: row.id_jobs_img,
            imageUrl: `${row.path}`, // Ruta completa de cada imagen
          }));
  
          connection.commit((commitErr) => {
            if (commitErr) {
              console.error("Error al confirmar la transacción:", commitErr);
              return connection.rollback(() => {
                res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
              });
            }
  
            // Enviar la respuesta con las imágenes y el total de elementos
            res.status(200).json({ images, totalItems });
          });
        });
      });
    });
  });
  


  router.post("/addImgJobs", upload.single("imgJobs"), (req, res) => {
  const imgJobs = req.file;

  if (!imgJobs) {
    return res.status(400).json({ error: "La imagen es requerida" });
  }

  const serverUrl = `${req.protocol}://${req.get("host")}`;
  const imageUrl = `${serverUrl}/uploads/jobs-pictures/${imgJobs.filename}`;

  const insertBrandQuery = `
    INSERT INTO jobs_img (path)
    VALUES (?);
  `;

  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error al iniciar la transacción:", err);
      return res.status(500).json({ error: "Ocurrió un error al iniciar la transacción" });
    }

    connection.query<ResultSetHeader>(
      insertBrandQuery,
      [imageUrl],
      (error, results) => {
        if (error) {
          console.error("Error al insertar los datos:", error);
          return connection.rollback(() => {
            res.status(500).json({ error: "Ocurrió un error al insertar los datos" });
          });
        }

        connection.commit((commitErr) => {
          if (commitErr) {
            console.error("Error al confirmar la transacción:", commitErr);
            return connection.rollback(() => {
              res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
            });
          }

          res.status(201).json({
            message: "Imagen agregada exitosamente",
            imageUrl, // Devuelve la URL de la imagen aquí
            id: results.insertId,
          });
        });
      }
    );
  });
});


router.delete('/deleteImgJob/:id_jobs_img', (req, res) => {
  const imageId = req.params.id_jobs_img;
  //console.log(`Received request to delete image with ID: ${imageId}`);




  // Consultar la base de datos para obtener la URL del archivo
  const query = 'SELECT path FROM jobs_img WHERE id_jobs_img = ?';
  connection.query(query, [imageId], (err, results:any) => {
    if (err) {
      //console.error('Error fetching image data:', err);
      return res.status(500).json({ success: false, message: 'Error fetching image data', error: err });
    }

    if (results.length === 0) {
      //console.log('No image found with the provided ID.');
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const fileUrl = results[0].path;
    //console.log('File URL from database:', fileUrl);

    // Extraer solo la ruta relativa
    const relativePath = new URL(fileUrl).pathname; // Esto te da solo "/uploads/jobs-pictures/brand-xxx.jpg"
    const fileName = path.basename(relativePath);
    //console.log('Extracted file name:', fileName);

    // Construir la ruta correcta del archivo en el sistema de archivos
    const filePath = path.resolve(__dirname, `../../${relativePath}`);
    //console.log('File path to delete:', filePath);

    // Verificar si el archivo realmente existe
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        //console.error('File does not exist:', err);
        return res.status(404).json({ success: false, message: 'File not found on the server' });
      }

      // Eliminar el archivo del sistema de archivos
      fs.unlink(filePath, (err) => {
        if (err) {
          //console.error('Error deleting file:', err);
          return res.status(500).json({ success: false, message: 'Error deleting file', error: err });
        }

        //console.log('File deleted successfully:', filePath);

        // Eliminar la entrada de la base de datos
        const deleteQuery = 'DELETE FROM jobs_img WHERE id_jobs_img = ?';
        connection.query(deleteQuery, [imageId], (err) => {
          if (err) {
            //console.error('Error deleting image from database:', err);
            return res.status(500).json({ success: false, message: 'Error deleting image from database', error: err });
          }
          //console.log('Image deleted from database successfully with ID:', imageId);
          res.json({ success: true, message: 'Image deleted successfully' });
        });
      });
    });
  });
});







  






export default router;