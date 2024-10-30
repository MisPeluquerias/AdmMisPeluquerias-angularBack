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
const db_1 = __importDefault(require("../../db/db"));
const body_parser_1 = __importDefault(require("body-parser"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get('/getAllOwners', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM user 
    WHERE (name LIKE ? OR email LIKE ? OR created_at LIKE ? OR phone LIKE ?)
    AND permiso = 'salon'
    LIMIT ?, ?`;
    const countQuery = 'SELECT FOUND_ROWS() AS totalItems';
    db_1.default.query(query, [search, search, search, search, offset, pageSize], (error, results) => {
        if (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'An error occurred while fetching data' });
            return;
        }
        db_1.default.query(countQuery, (countError, countResults) => {
            if (countError) {
                console.error('Error fetching count:', countError);
                res.status(500).json({ error: 'An error occurred while fetching data count' });
                return;
            }
            const totalItems = countResults[0].totalItems;
            res.json({ data: results, totalItems });
        });
    });
}));
router.get("/searchEmailInLive", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: "El parámetro 'name' es requerido." });
        }
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        const query = "SELECT email FROM user WHERE email LIKE ? AND permiso != 'admin'";
        db_1.default.query(query, [`%${email}%`, `%${email}%`], (error, results) => {
            if (error) {
                console.error("Error al buscar la ciudad:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al buscar cliente." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al buscar cliente." });
                    });
                }
                res.json(results);
            });
        });
    }
    catch (err) {
        console.error("Error al buscar cliente:", err);
        res.status(500).json({ error: "Error al buscar la ciudad." });
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
router.post('/addNewOwner', (req, res) => {
    const { email, salons } = req.body;
    //console.log('Inicio de /addNewOwner endpoint');
    //console.log('Datos recibidos:', { email, salons });
    // Validación inicial
    if (!email || !salons || salons.length === 0) {
        console.error('Validación fallida: email o salons no proporcionados.');
        return res.status(400).json({ message: 'El correo electrónico y al menos un salón son requeridos.' });
    }
    // Consulta para obtener el id_user basado en el email
    const queryUser = 'SELECT id_user FROM user WHERE email = ?';
    db_1.default.query(queryUser, [email], (err, results) => {
        if (err) {
            console.error('Error al obtener el ID del usuario:', err);
            return res.status(500).json({ message: 'Error al obtener el ID del usuario.', error: err });
        }
        const userRows = results;
        if (userRows.length === 0) {
            console.warn('Usuario no encontrado para el email:', email);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const id_user = userRows[0].id_user;
        // console.log('ID de usuario obtenido:', id_user);
        // Preparar los valores para insertar en user_salon
        const querySalon = 'INSERT INTO user_salon (id_user, id_salon) VALUES ?';
        const values = salons.map((salon) => [id_user, salon]);
        //console.log('Valores para insertar en user_salon:', values);
        // Iniciar una transacción
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error('Error al iniciar la transacción:', err);
                return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
            }
            // Insertar las relaciones en la tabla user_salon
            db_1.default.query(querySalon, [values], (err, result) => {
                if (err) {
                    console.error('Error al asignar salones al usuario:', err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ message: 'Error al asignar salones al usuario.', error: err });
                    });
                }
                //console.log('Resultado de la inserción en user_salon:', result);
                // Actualizar el campo 'permiso' en la tabla 'user'
                const queryPermission = 'UPDATE user SET permiso = ? WHERE id_user = ?';
                const newPermissionValue = 'salon'; // Puedes personalizar este valor según tu lógica
                db_1.default.query(queryPermission, [newPermissionValue, id_user], (err, permResult) => {
                    if (err) {
                        console.error('Error al actualizar el permiso del usuario:', err);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ message: 'Error al actualizar el permiso del usuario.', error: err });
                        });
                    }
                    //console.log('Permiso actualizado:', permResult);
                    // Confirmar la transacción si todo va bien
                    db_1.default.commit((err) => {
                        if (err) {
                            console.error('Error al confirmar la transacción:', err);
                            return db_1.default.rollback(() => {
                                res.status(500).json({ message: 'Error al confirmar la transacción.', error: err });
                            });
                        }
                        //console.log('Transacción confirmada con éxito.');
                        res.status(200).json({ message: 'Propietario, salones y permisos añadidos con éxito.' });
                    });
                });
            });
        });
    });
});
router.post('/deleteOwners', (req, res) => {
    const { ids } = req.body;
    console.log('IDs de propietarios a eliminar:', ids);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron IDs válidos para eliminar.' });
    }
    // Inicia la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
        }
        // Primero, elimina las relaciones en user_salon
        const deleteRelationsQuery = `DELETE FROM user_salon WHERE id_user IN (?)`;
        db_1.default.query(deleteRelationsQuery, [ids], (error) => {
            if (error) {
                // Si hay un error, se revierte la transacción
                return db_1.default.rollback(() => {
                    console.error('Error al eliminar relaciones de propietarios:', error);
                    res.status(500).json({ message: 'Error al eliminar las relaciones de propietarios.', error });
                });
            }
            // Ahora elimina los usuarios
            const deleteUsersQuery = `DELETE FROM user WHERE id_user IN (?)`;
            db_1.default.query(deleteUsersQuery, [ids], (error, results) => {
                if (error) {
                    // Si hay un error, se revierte la transacción
                    return db_1.default.rollback(() => {
                        console.error('Error al eliminar propietarios:', error);
                        res.status(500).json({ message: 'Error al eliminar los propietarios.', error });
                    });
                }
                // Confirmamos la transacción si todo va bien
                db_1.default.commit((commitErr) => {
                    if (commitErr) {
                        // Si hay un error al confirmar, se revierte la transacción
                        return db_1.default.rollback(() => {
                            console.error('Error al confirmar la transacción:', commitErr);
                            res.status(500).json({ message: 'Error al confirmar la transacción.', error: commitErr });
                        });
                    }
                    // Si todo sale bien, enviamos la respuesta de éxito
                    res.status(200).json({ message: 'Propietarios eliminados con éxito.', affectedRows: results.affectedRows });
                });
            });
        });
    });
});
exports.default = router;
