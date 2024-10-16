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
const bcrypt_1 = __importDefault(require("bcrypt"));
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
    const query = `SELECT id_province, name FROM province ORDER BY name`;
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
                p.id_province = ?
            ORDER BY c.name;
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
router.put('/updateOwner/:id_user', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_user } = req.params;
    const { name, lastname, email, phone, address, id_province, id_city, dni, password } = req.body;
    // Iniciar transacción
    db_1.default.beginTransaction((transactionError) => __awaiter(void 0, void 0, void 0, function* () {
        if (transactionError) {
            console.error("Error al iniciar la transacción:", transactionError);
            return res.status(500).json({ message: 'Error al iniciar la transacción' });
        }
        try {
            // Si se proporciona una nueva contraseña, la ciframos
            let hashedPassword = null;
            if (password) {
                const saltRounds = 10;
                hashedPassword = yield bcrypt_1.default.hash(password, saltRounds);
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
            db_1.default.query(query, params, (queryError) => {
                if (queryError) {
                    console.error("Error al actualizar el cliente:", queryError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ message: 'Error al actualizar el cliente' });
                    });
                }
                // Si todo va bien, hacemos commit a la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error("Error al hacer commit:", commitError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ message: 'Error al hacer commit de la transacción' });
                        });
                    }
                    res.json({ message: 'Cliente actualizado correctamente' });
                });
            });
        }
        catch (error) {
            console.error("Error durante la transacción:", error.message);
            return db_1.default.rollback(() => {
                res.status(500).json({ message: 'Error al procesar la transacción' });
            });
        }
    }));
}));
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
router.get("/searchSalonInLive", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ error: "El parámetro 'name' es requerido." });
        }
        // Iniciar la transacción
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error al iniciar la transacción:", err);
                return res.status(500).json({ error: "Error al iniciar la transacción." });
            }
            const query = "SELECT id_salon, name FROM salon WHERE name LIKE ?";
            db_1.default.query(query, [`%${name}%`], (error, results) => {
                if (error) {
                    console.error("Error al buscar salon:", error);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al buscar salon." });
                    });
                }
                db_1.default.commit((err) => {
                    if (err) {
                        console.error("Error al hacer commit:", err);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: "Error al buscar salon." });
                        });
                    }
                    res.json(results);
                });
            });
        });
    }
    catch (err) {
        console.error("Error al buscar salon:", err);
        res.status(500).json({ error: "Error al buscar el salon." });
    }
}));
router.put('/updateUserSalon/:id_user_salon', (req, res) => {
    const { id_user_salon } = req.params;
    const { id_salon } = req.body;
    if (!id_user_salon || !id_salon) {
        return res.status(400).json({ error: "id_user_salon and id_salon are required" });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: "Error starting transaction" });
        }
        const query = `
            UPDATE user_salon 
            SET id_salon = ? 
            WHERE id_user_salon = ?;
        `;
        db_1.default.query(query, [id_salon, id_user_salon], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error updating user_salon:', error.message);
                    res.status(500).json({ error: "Error updating user_salon" });
                });
            }
            if (results.affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ message: "user_salon not found or no changes made" });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    return db_1.default.rollback(() => {
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
router.delete('/deleteUserSalon/:id_user_salon', (req, res) => {
    const { id_user_salon } = req.params;
    if (!id_user_salon) {
        return res.status(400).json({ error: "id_user_salon is required" });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: "Error starting transaction" });
        }
        const query = `
            DELETE FROM user_salon 
            WHERE id_user_salon = ?;
        `;
        db_1.default.query(query, [id_user_salon], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error deleting user_salon:', error.message);
                    res.status(500).json({ error: "Error deleting user_salon" });
                });
            }
            if (results.affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ message: "user_salon not found" });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    return db_1.default.rollback(() => {
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
router.post('/addUserSalon', (req, res) => {
    const { id_user, id_salon } = req.body;
    if (!id_user || !id_salon) {
        return res.status(400).json({ error: "id_user and id_salon are required" });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: "Error starting transaction" });
        }
        const query = `
            INSERT INTO user_salon (id_user, id_salon)
            VALUES (?, ?);
        `;
        db_1.default.query(query, [id_user, id_salon], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error inserting into user_salon:', error.message);
                    res.status(500).json({ error: "Error inserting into user_salon" });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    return db_1.default.rollback(() => {
                        console.error('Error committing transaction:', commitErr);
                        res.status(500).json({ error: "Error committing transaction" });
                    });
                }
                res.json({ message: "user_salon added successfully", id_user_salon: results.insertId });
            });
        });
    });
});
exports.default = router;
