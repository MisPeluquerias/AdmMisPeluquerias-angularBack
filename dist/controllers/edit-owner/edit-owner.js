"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../../db/db")); // Ajusta esta ruta según tu estructura de directorios
const body_parser_1 = __importDefault(require("body-parser"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path_1.default.join(__dirname, '../../../dist/uploads/profile-pictures'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        const ext = path_1.default.extname(file.originalname);
        const newName = `profile-${req.params.id_user}-${uniqueSuffix}${ext}`;
        cb(null, newName);
    }
});
const upload = (0, multer_1.default)({ storage: storage });
// Ruta para manejar la carga de la foto de perfil
router.put('/uploadProfilePicture/:id_user', upload.single('profilePicture'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_user } = req.params;
    if (!id_user) {
        return res.status(400).json({ error: 'id_user is required' });
    }
    try {
        // Consulta para obtener la ruta de la imagen existente
        const selectQuery = `SELECT avatar_path FROM user WHERE id_user = ?`;
        db_1.default.query(selectQuery, [id_user], (selectErr, results) => {
            if (selectErr) {
                return res.status(500).json({ success: false, message: 'Error al obtener la información existente', error: selectErr });
            }
            // Eliminar la imagen existente si existe
            if (results.length > 0 && results[0].avatar_path) {
                const existingImagePath = path_1.default.join(__dirname, '../../../dist', results[0].avatar_path.replace(req.protocol + '://' + req.get('host'), ''));
                if (fs_1.default.existsSync(existingImagePath)) {
                    fs_1.default.unlinkSync(existingImagePath); // Elimina el archivo existente
                }
            }
            // Guardar la nueva imagen
            if (req.file) {
                const fileUrl = `${req.protocol}://${req.get('host')}/uploads/profile-pictures/${req.file.filename}`;
                const updateQuery = `UPDATE user SET avatar_path = ? WHERE id_user = ?`;
                db_1.default.query(updateQuery, [fileUrl, id_user], (updateErr) => {
                    if (updateErr) {
                        return res.status(500).json({ success: false, message: 'Error al guardar la nueva imagen en la base de datos', error: updateErr });
                    }
                    res.json({ success: true, message: 'Foto de perfil subida y guardada correctamente', fileUrl: fileUrl });
                });
            }
            else {
                res.status(400).json({ success: false, message: 'No se pudo subir la foto de perfil' });
            }
        });
    }
    catch (err) {
        console.error('Error durante la carga de la imagen:', err);
        res.status(500).json({ success: false, message: 'Error durante la carga de la imagen', error: err });
    }
}));
router.get("/getProvinces", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT id_province, name FROM province`;
    db_1.default.query(query, (queryError, results) => {
        if (queryError) {
            console.error("Error fetching provinces:", queryError);
            return res
                .status(500)
                .json({ error: "An error occurred while fetching the provinces" });
        }
        res.json({ data: results });
    });
}));
router.get("/getCitiesByProvinceForEditOwner", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id_province = req.query.id_province;
    if (!id_province) {
        return res.status(400).json({ error: "id_province is required" });
    }
    db_1.default.beginTransaction((transactionError) => {
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
        db_1.default.query(query, [id_province], (queryError, results) => {
            if (queryError) {
                return db_1.default.rollback(() => {
                    console.error("Error fetching cities and province:", queryError);
                    res.status(500).json({
                        error: "An error occurred while fetching the city and province data",
                    });
                });
            }
            db_1.default.commit((commitError) => {
                if (commitError) {
                    return db_1.default.rollback(() => {
                        console.error("Error committing transaction:", commitError);
                        res.status(500).json({ error: "Failed to commit transaction" });
                    });
                }
                res.json({ data: results });
            });
        });
    });
}));
router.put('/updateOwner/:id_user', (req, res) => {
    const { id_user } = req.params;
    const { name, lastname, email, phone, address, id_province, id_city, dni, password } = req.body;
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
            password=?
        WHERE id_user=?;
    `;
    db_1.default.query(query, [name, lastname, email, phone, address, id_province, id_city, dni, password, id_user], (error) => {
        if (error) {
            console.error('Error actualizando cliente:', error.message);
            return res.status(500).json({ message: 'Error actualizando cliente' });
        }
        res.json({ message: 'Cliente actualizado correctamente' });
    });
});
router.get("/getOwnerById", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id_user = req.query.id_user;
    if (!id_user) {
        return res.status(400).json({ error: "id_salon is required" });
    }
    const query = `
      SELECT * FROM user WHERE id_user = ? AND permiso = 'salon'
    `;
    try {
        db_1.default.beginTransaction((transactionError) => __awaiter(void 0, void 0, void 0, function* () {
            if (transactionError) {
                console.error("Error starting transaction:", transactionError);
                return res.status(500).json({
                    error: "An error occurred while starting the transaction",
                });
            }
            db_1.default.query(query, [id_user], (queryError, results) => {
                if (queryError) {
                    console.error("Error fetching salon:", queryError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            error: "An error occurred while fetching the salon data",
                        });
                    });
                }
                if (results.length === 0) {
                    return db_1.default.rollback(() => {
                        res.status(404).json({ message: "Salon not found" });
                    });
                }
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error("Error committing transaction:", commitError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                error: "An error occurred while committing the transaction",
                            });
                        });
                    }
                    res.json({ data: results[0] });
                });
            });
        }));
    }
    catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
}));
router.get("/getSalonOwnerById", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        db_1.default.beginTransaction((transactionError) => {
            if (transactionError) {
                console.error("Error starting transaction:", transactionError);
                return res.status(500).json({
                    error: "An error occurred while starting the transaction",
                });
            }
            db_1.default.query(query, [id_user], (queryError, results) => {
                if (queryError) {
                    console.error("Error fetching salon_user:", queryError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            error: "An error occurred while fetching the salon data",
                        });
                    });
                }
                if (results.length === 0) {
                    return db_1.default.rollback(() => {
                        res.status(404).json({ message: "No salons found for this user" });
                    });
                }
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error("Error committing transaction:", commitError);
                        return db_1.default.rollback(() => {
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
    }
    catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
}));
exports.default = router;
