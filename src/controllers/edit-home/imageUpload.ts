import express from 'express';
import multer from 'multer';
import path from 'path';
import connection from '../../db/db';
import fs from 'fs';

const router = express.Router();

// Configuración de almacenamiento de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../../dist/uploads/salon-pictures')); //ruta para subir las imagenes
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const newName = `MisPeluquerias.com-${uniqueSuffix}${ext}`;
    cb(null, newName);
  }
});

const upload = multer({ storage: storage });

// Ruta para manejar la carga de imágenes

router.post('/uploadImg', upload.single('image'), (req, res) => {
  if (req.file) {
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/salon-pictures/${req.file.filename}`;
    const { file_name, file_description, file_group, file_principal, file_active, salon_id } = req.body;

    if (!salon_id) {
      return res.status(400).json({ error: 'salon_id is required' });
    }

    const query = `
      INSERT INTO file (file_name, file_description, file_extension, file_group, file_fecha, file_original, file_principal, file_active, file_url, salon_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      file_name,
      file_description,
      req.file.mimetype.split('/')[1], // Obtener la extensión del archivo
      file_group,
      new Date(), // Usar la fecha actual
      req.file.originalname,
      file_principal || 0,
      file_active || 0,
      fileUrl,
      salon_id // Identificador del salón
    ];

    connection.query(query, values, (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error al guardar la información en la base de datos', error: err });
      }
      res.json({ success: true, message: 'Imagen subida y datos guardados correctamente', fileUrl: fileUrl });
    });
  } else {
    res.status(400).json({ success: false, message: 'No se pudo subir la imagen' });
  }
});

// Ruta para obtener imágenes
router.get('/getImages', (req, res) => {
  const salon_id = req.query.salon_id;

  if (!salon_id) {
      return res.status(400).json({ error: 'salon_id is required' });
  }

  connection.beginTransaction((err) => {
      if (err) {
          return res.status(500).json({ success: false, message: 'Error starting transaction', error: err });
      }

      const query = 'SELECT * FROM file WHERE salon_id = ?';

      connection.query(query, [salon_id], (err, results) => {
          if (err) {
              return connection.rollback(() => {
                  res.status(500).json({ success: false, message: 'Error fetching images', error: err });
              });
          }

          connection.commit((err) => {
              if (err) {
                  return connection.rollback(() => {
                      res.status(500).json({ success: false, message: 'Error committing transaction', error: err });
                  });
              }

              res.json({ success: true, data: results });
          });
      });
  });
});


router.put('/updatePrincipalImage', (req, res) => {
  const { file_id, file_principal } = req.body;

  if (file_id == null || file_principal == null) {
    return res.status(400).json({ error: 'file_id and file_principal are required' });
  }

  connection.beginTransaction(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error starting transaction', error: err });
    }

    const updateQuery = 'UPDATE file SET file_principal = ? WHERE file_id = ?';
    connection.query(updateQuery, [file_principal, file_id], (err, results) => {
      if (err) {
        return connection.rollback(() => {
          res.status(500).json({ success: false, message: 'Error updating image status', error: err });
        });
      }

      // Asumimos éxito si no hay errores en la consulta.
      connection.commit(err => {
        if (err) {
          return connection.rollback(() => {
            res.status(500).json({ success: false, message: 'Error committing transaction', error: err });
          });
        }

        res.json({ success: true, message: 'Image status updated successfully' });
      });
    });
  });
});

router.delete('/deleteImage/:id', (req, res) => {
  const imageId = req.params.id;
  //console.log(`Received request to delete image with ID: ${imageId}`);

  // Consultar la base de datos para obtener la URL del archivo
  const query = 'SELECT file_url FROM file WHERE file_id = ?';
  connection.query(query, [imageId], (err, results: any[]) => {
    if (err) {
      //console.error('Error fetching image data:', err);
      return res.status(500).json({ success: false, message: 'Error fetching image data', error: err });
    }

    //console.log('Database query results:', results);

    if (results.length === 0) {
      //console.log('No image found with the provided ID.');
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const fileUrl = results[0].file_url;
    //console.log('File URL from database:', fileUrl);

    // Extraer solo el nombre del archivo desde la URL
    const fileName = path.basename(fileUrl);
    //console.log('Extracted file name:', fileName);

    // Construir la ruta del archivo en el sistema de archivos, apuntando a dist/uploads
    const filePath = path.join(__dirname, '../../uploads/salon-pictures', fileName);
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
        const deleteQuery = 'DELETE FROM file WHERE file_id = ?';
        connection.query(deleteQuery, [imageId], (err, result) => {
          if (err) {
            console.error('Error deleting image from database:', err);
            return res.status(500).json({ success: false, message: 'Error deleting image from database', error: err });
          }
          //console.log('Image deleted from database successfully with ID:', imageId);
          res.json({ success: true, message: 'Image deleted successfully' });
        });
      });
    });
  });
});



// Servir archivos estáticos desde el directorio "uploads"
router.use('/uploads', express.static(path.join(__dirname, '../../../uploads')));

export default router;
