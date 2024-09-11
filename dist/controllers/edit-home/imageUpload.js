"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("../../db/db"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
// Configuración de almacenamiento de multer
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path_1.default.join(__dirname, '../../../dist/uploads')); // Ajusta la ruta para asegurar que el destino es correcto
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        const ext = path_1.default.extname(file.originalname);
        const baseName = path_1.default.basename(file.originalname, ext);
        const newName = `MisPeluquerias.com-${uniqueSuffix}${ext}`;
        cb(null, newName);
    }
});
const upload = (0, multer_1.default)({ storage: storage });
// Ruta para manejar la carga de imágenes
router.post('/uploadImg', upload.single('image'), (req, res) => {
    if (req.file) {
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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
        db_1.default.query(query, values, (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error al guardar la información en la base de datos', error: err });
            }
            res.json({ success: true, message: 'Imagen subida y datos guardados correctamente', fileUrl: fileUrl });
        });
    }
    else {
        res.status(400).json({ success: false, message: 'No se pudo subir la imagen' });
    }
});
// Ruta para obtener imágenes
router.get('/getImages', (req, res) => {
    const salon_id = req.query.salon_id;
    if (!salon_id) {
        return res.status(400).json({ error: 'salon_id is required' });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error starting transaction', error: err });
        }
        const query = 'SELECT * FROM file WHERE salon_id = ?';
        db_1.default.query(query, [salon_id], (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    res.status(500).json({ success: false, message: 'Error fetching images', error: err });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
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
    db_1.default.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error starting transaction', error: err });
        }
        const updateQuery = 'UPDATE file SET file_principal = ? WHERE file_id = ?';
        db_1.default.query(updateQuery, [file_principal, file_id], (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    res.status(500).json({ success: false, message: 'Error updating image status', error: err });
                });
            }
            // Asumimos éxito si no hay errores en la consulta.
            db_1.default.commit(err => {
                if (err) {
                    return db_1.default.rollback(() => {
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
    db_1.default.query(query, [imageId], (err, results) => {
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
        const fileName = path_1.default.basename(fileUrl);
        //console.log('Extracted file name:', fileName);
        // Construir la ruta del archivo en el sistema de archivos, apuntando a dist/uploads
        const filePath = path_1.default.join(__dirname, '../../uploads', fileName);
        //console.log('File path to delete:', filePath);
        // Verificar si el archivo realmente existe
        fs_1.default.access(filePath, fs_1.default.constants.F_OK, (err) => {
            if (err) {
                //console.error('File does not exist:', err);
                return res.status(404).json({ success: false, message: 'File not found on the server' });
            }
            // Eliminar el archivo del sistema de archivos
            fs_1.default.unlink(filePath, (err) => {
                if (err) {
                    //console.error('Error deleting file:', err);
                    return res.status(500).json({ success: false, message: 'Error deleting file', error: err });
                }
                //console.log('File deleted successfully:', filePath);
                // Eliminar la entrada de la base de datos
                const deleteQuery = 'DELETE FROM file WHERE file_id = ?';
                db_1.default.query(deleteQuery, [imageId], (err, result) => {
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
router.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../../../uploads')));
exports.default = router;
