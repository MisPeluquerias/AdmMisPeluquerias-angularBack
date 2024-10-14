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
router.use(express_1.default.urlencoded({ extended: true }));
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
router.get("/getProvincesForNewClient", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error("Error starting transaction:", transactionError);
            return res.status(500).json({ error: "Failed to start transaction" });
        }
        const query = `SELECT id_province, name FROM province ORDER BY name`;
        db_1.default.query(query, (queryError, results) => {
            if (queryError) {
                return db_1.default.rollback(() => {
                    console.error("Error fetching provinces:", queryError);
                    res.status(500).json({ error: "An error occurred while fetching the provinces" });
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
router.get("/getCitiesByProvinceForNewClient", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
router.post("/addNewClient", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, lastname, permiso = 'client', email, phone, address, id_province, id_city, dni, password } = req.body; // Accede a los datos del cuerpo de la solicitud
    //console.log('Datos recibidos en el backend:', name,lastname,email,phone,address,id_province,id_city,dni,password);
    // Iniciar transacción
    db_1.default.beginTransaction((transactionError) => __awaiter(void 0, void 0, void 0, function* () {
        if (transactionError) {
            console.error("Error starting transaction:", transactionError);
            return res.status(500).json({ error: "Failed to start transaction" });
        }
        try {
            // Encriptar la contraseña
            const hashedPassword = yield bcrypt_1.default.hash(password, 10);
            //console.log('Contraseña encriptada:', hashedPassword);
            // Insertar el nuevo usuario
            const insertUserQuery = `
        INSERT INTO user (name, lastname, permiso, email, phone, address, id_province, id_city, dni, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            //console.log('Ejecutando consulta SQL:', insertUserQuery);
            //console.log('Valores:', ['Nombre',name,'Apellido', lastname,'Permiso', permiso,'email', email,'telefono',phone,'direccion', address,'id_provincia',id_province,'id_ciudad', id_city,'dni', dni, 'contraseña', hashedPassword]);
            db_1.default.query(insertUserQuery, [name, lastname, permiso, email, phone, address, id_province, id_city, dni, hashedPassword], (insertError, insertResults) => {
                if (insertError) {
                    // Manejo del error de entrada duplicada
                    if (insertError.code === 'ER_DUP_ENTRY') {
                        console.log("Error inserting new user:", insertError.message);
                        return db_1.default.rollback(() => {
                            res.status(409).json({ error: "User with this email already exists" });
                        });
                    }
                    console.log("Error inserting new user:", insertError.message);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Failed to insert new user" });
                    });
                }
                const newUserId = insertResults.insertId;
                console.log('Nuevo usuario creado con ID:', newUserId);
                // Confirmar la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        return db_1.default.rollback(() => {
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
            });
        }
        catch (error) {
            console.error("Error during user creation:", error);
            return db_1.default.rollback(() => {
                res.status(500).json({ error: "Failed to create new user" });
            });
        }
    }));
}));
exports.default = router;
