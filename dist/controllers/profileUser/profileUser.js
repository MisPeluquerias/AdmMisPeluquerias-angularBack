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
const decodeToken_1 = __importDefault(require("../../functions/decodeToken")); // Asegúrate de que esta función está correctamente exportada
const bcrypt_1 = __importDefault(require("bcrypt"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path_1.default.join(__dirname, '../../../dist/uploads/profile-pictures')); // Directorio para guardar fotos de perfil
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
router.get('/getDataUser', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_user } = req.query;
    // Validar que id_user esté presente
    if (!id_user) {
        return res.status(400).json({ error: 'id_user parameter is required' });
    }
    let decodedIdUser;
    try {
        // Decodificar el token para obtener id_user
        decodedIdUser = (0, decodeToken_1.default)(id_user); // Asegúrate de que decodeToken acepte un string
    }
    catch (err) {
        console.error('Error decoding token:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
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
        db_1.default.query(query, [decodedIdUser], (error, results) => {
            if (error) {
                // En caso de error, revertir la transacción
                db_1.default.rollback(() => {
                    console.error('Error executing query:', error);
                    res.status(500).json({ error: 'An error occurred while fetching data' });
                });
                return;
            }
            // Confirmar la transacción
            db_1.default.commit((commitError) => {
                if (commitError) {
                    // En caso de error durante el commit, revertir la transacción
                    db_1.default.rollback(() => {
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
}));
router.get("/getCitiesByProvince", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    db_1.default.query(query, [id_province], (queryError, results) => {
        if (queryError) {
            console.error("Error fetching cities and province:", queryError);
            return res.status(500).json({
                error: "An error occurred while fetching the city and province data",
            });
        }
        res.json({ data: results });
    });
}));
router.get("/getProvincesForProfile", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
router.get("/getCitiesByProvinceForProfile", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    db_1.default.query(query, [id_province], (queryError, results) => {
        if (queryError) {
            console.error("Error fetching cities and province:", queryError);
            return res.status(500).json({
                error: "An error occurred while fetching the city and province data",
            });
        }
        res.json({ data: results });
    });
}));
router.put('/updateUser', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            decodedIdUser = (0, decodeToken_1.default)(id_user); // Decodificar el token para obtener id_user
            //console.log('Decoded ID User:', decodedIdUser); // Verifica si el ID se decodifica correctamente
        }
        else {
            decodedIdUser = id_user; // Si id_user no es un JWT, úsalo tal cual
            // console.log('Using id_user directly:', decodedIdUser);
        }
    }
    catch (err) {
        console.error('Error decoding token:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
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
        db_1.default.query(query, queryParams, (error, results) => {
            if (error) {
                // En caso de error, revertir la transacción
                db_1.default.rollback(() => {
                    console.error('Error executing update query:', error);
                    res.status(500).json({ error: 'An error occurred while updating the user data' });
                });
                return;
            }
            // Confirmar la transacción
            db_1.default.commit((commitError) => {
                if (commitError) {
                    // En caso de error durante el commit, revertir la transacción
                    db_1.default.rollback(() => {
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
}));
router.put('/updateUserPassword', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_user, password } = req.body;
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => __awaiter(void 0, void 0, void 0, function* () {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'Error starting transaction' });
        }
        try {
            // Encriptar la nueva contraseña
            const hashedPassword = yield bcrypt_1.default.hash(password, 10);
            // Actualizar la contraseña en la base de datos
            const query = `UPDATE user SET password = ? WHERE id_user = ?`;
            db_1.default.query(query, [hashedPassword, id_user], (error, results) => {
                if (error) {
                    console.error('Error updating password:', error);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: 'Error updating password' });
                    });
                }
                // Verificar si algún registro fue actualizado
                if (results.affectedRows === 0) {
                    return db_1.default.rollback(() => {
                        res.status(404).json({ error: 'User not found' });
                    });
                }
                // Confirmar la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error('Error committing transaction:', commitError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: 'Error committing transaction' });
                        });
                    }
                    res.json({ message: 'Password updated successfully' });
                });
            });
        }
        catch (hashError) {
            console.error('Error hashing password:', hashError);
            return db_1.default.rollback(() => {
                res.status(500).json({ error: 'Error processing request' });
            });
        }
    }));
}));
router.patch('/desactivateAccount/:id_user', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_user } = req.params;
    // Validar que id_user esté presente
    if (!id_user) {
        return res.status(400).json({ error: 'id_user is required' });
    }
    let decodedIdUser;
    try {
        // Decodificar el token para obtener id_user
        decodedIdUser = (0, decodeToken_1.default)(id_user); // Asegúrate de que decodeToken devuelve el ID del usuario
    }
    catch (err) {
        console.error('Error decoding token:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'Error starting transaction' });
        }
        // Construir la consulta de actualización
        const query = `UPDATE user SET active = 0 WHERE id_user = ?`;
        // Ejecutar la consulta
        db_1.default.query(query, [decodedIdUser], (error, results) => {
            if (error) {
                // En caso de error, revertir la transacción
                db_1.default.rollback(() => {
                    console.error('Error executing update query:', error);
                    res.status(500).json({ error: 'An error occurred while updating the user status' });
                });
                return;
            }
            // Confirmar la transacción
            db_1.default.commit((commitError) => {
                if (commitError) {
                    // En caso de error durante el commit, revertir la transacción
                    db_1.default.rollback(() => {
                        console.error('Error committing transaction:', commitError);
                        res.status(500).json({ error: 'An error occurred while committing the transaction' });
                    });
                    return;
                }
                // Verificar si algún registro fue actualizado
                if (results.affectedRows === 0) {
                    return res.status(404).json({ error: 'User not found or already deactivated' });
                }
                // Enviar la respuesta exitosa
                res.json({ message: 'User account deactivated successfully' });
            });
        });
    });
}));
exports.default = router;
