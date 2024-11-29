"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../../db/db"));
const body_parser_1 = __importDefault(require("body-parser"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.resolve(__dirname, "../../../dist/uploads/jobs-pictures"));
    },
    filename: (req, file, cb) => {
        // Generar un nombre de archivo único con un prefijo y marca de tiempo
        const uniqueSuffix = Date.now() + path_1.default.extname(file.originalname);
        cb(null, `imgJobs-${uniqueSuffix}`);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/jpeg" ||
            file.mimetype === "image/png" ||
            file.mimetype === "image/gif" ||
            file.mimetype === "image/webp") {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only JPEG, PNG,GIF and webp are allowed."));
        }
    },
});
router.get("/getAllImgJobs", (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error al iniciar la transacción:", err);
            return res.status(500).json({ error: "Ocurrió un error al iniciar la transacción" });
        }
        // Consulta para contar el total de imágenes
        const countQuery = `SELECT COUNT(*) as totalItems FROM jobs_img`;
        db_1.default.query(countQuery, (countError, countResults) => {
            if (countError) {
                console.error("Error al contar las imágenes:", countError);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Ocurrió un error al contar las imágenes" });
                });
            }
            const totalItems = countResults[0].totalItems;
            // Consulta para obtener las imágenes con paginación
            const selectImagesQuery = `
          SELECT id_jobs_img, path FROM jobs_img
          LIMIT ? OFFSET ?;
        `;
            db_1.default.query(selectImagesQuery, [pageSize, offset], (error, results) => {
                if (error) {
                    console.error("Error al obtener las imágenes:", error);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Ocurrió un error al obtener las imágenes" });
                    });
                }
                // Verifica que results es un array de RowDataPacket
                const rows = results;
                const serverUrl = `${req.protocol}://${req.get("host")}`;
                const images = rows.map((row) => ({
                    id_jobs_img: row.id_jobs_img,
                    imageUrl: `${row.path}`, // Ruta completa de cada imagen
                }));
                db_1.default.commit((commitErr) => {
                    if (commitErr) {
                        console.error("Error al confirmar la transacción:", commitErr);
                        return db_1.default.rollback(() => {
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
    const insertJobImgQuery = `
    INSERT INTO jobs_img (path)
    VALUES (?);
  `;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error al iniciar la transacción:", err);
            return res.status(500).json({ error: "Ocurrió un error al iniciar la transacción" });
        }
        db_1.default.query(insertJobImgQuery, [imageUrl], (error, results) => {
            if (error) {
                console.error("Error al insertar los datos:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Ocurrió un error al insertar los datos" });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error("Error al confirmar la transacción:", commitErr);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
                    });
                }
                res.status(201).json({
                    message: "Imagen agregada exitosamente",
                    imageUrl, // Devuelve la URL de la imagen aquí
                    id: results.insertId,
                });
            });
        });
    });
});
router.delete('/deleteImgJob/:id_jobs_img', (req, res) => {
    const imageId = req.params.id_jobs_img;
    //console.log(`Received request to delete image with ID: ${imageId}`);
    // Consultar la base de datos para obtener la URL del archivo
    const query = 'SELECT path FROM jobs_img WHERE id_jobs_img = ?';
    db_1.default.query(query, [imageId], (err, results) => {
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
        const fileName = path_1.default.basename(relativePath);
        //console.log('Extracted file name:', fileName);
        // Construir la ruta correcta del archivo en el sistema de archivos
        const filePath = path_1.default.resolve(__dirname, `../../${relativePath}`);
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
                const deleteQuery = 'DELETE FROM jobs_img WHERE id_jobs_img = ?';
                db_1.default.query(deleteQuery, [imageId], (err) => {
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
exports.default = router;
