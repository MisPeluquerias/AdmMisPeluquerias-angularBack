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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secretKey = 'uN3!pK@9rV$4zF6&hS*8xM2+bC0^wQ1!';
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
function decodeTokenPermiso(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secretKey);
        //console.log('Contenido decodificado del token:', decoded); // Imprime el contenido completo
        return decoded;
    }
    catch (error) {
        console.error('Error al decodificar el token:', error);
        return null;
    }
}
router.get('/getAllSalon', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const filterState = req.query.filterState ? req.query.filterState.toString() : '%%';
    const filterActive = req.query.filterActive === 'true' ? '1' : '0';
    const permisoToken = req.query.permiso;
    const usuarioIdToken = req.query.usuarioId;
    let decodedPermiso = null;
    let decodedUsuarioId = null;
    if (typeof permisoToken === 'string' && typeof usuarioIdToken === 'string') {
        decodedPermiso = decodeTokenPermiso(permisoToken);
        decodedUsuarioId = decodeTokenPermiso(usuarioIdToken);
        if (!decodedPermiso || !decodedPermiso.permiso) {
            return res.status(400).json({ message: 'Token de permiso inválido' });
        }
        if (!decodedUsuarioId || !decodedUsuarioId.usuarioId) {
            return res.status(400).json({ message: 'Token de usuarioId inválido' });
        }
    }
    else {
        return res.status(400).json({ message: 'Permiso o UsuarioId inválidos' });
    }
    let query;
    const queryParams = [];
    if (decodedPermiso.permiso === 'admin') {
        query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM salon 
    WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ? OR state LIKE ?)
    `;
        queryParams.push(search, search, search, search);
    }
    else {
        query = `
    SELECT s.* 
    FROM salon s
    JOIN user_salon us ON s.id_salon = us.id_salon
    WHERE us.id_user = ? AND (s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ? OR s.state LIKE ?)
    `;
        queryParams.push(decodedUsuarioId.usuarioId, search, search, search, search);
    }
    if (filterActive) {
        query += ' AND active = ?';
        queryParams.push(filterActive);
    }
    if (filterState && filterState !== '%%') {
        query += ' AND state = ?';
        queryParams.push(filterState);
    }
    query += ' LIMIT ?, ?';
    queryParams.push(offset, pageSize);
    // Inicio de la transacción
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error('Error starting transaction:', transactionError);
            return res.status(500).json({ error: 'Error starting transaction' });
        }
        // Ejecución de la primera consulta
        db_1.default.query(query, queryParams, (queryError, results) => {
            if (queryError) {
                console.error('Error executing query:', queryError);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: 'Error fetching data' });
                });
            }
            // Ejecución de la segunda consulta dentro de la transacción
            db_1.default.query('SELECT FOUND_ROWS() as totalItems', (countError, countResults) => {
                var _a;
                if (countError) {
                    console.error('Error fetching count:', countError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: 'Error fetching data count' });
                    });
                }
                const totalItems = (_a = countResults[0]) === null || _a === void 0 ? void 0 : _a.totalItems;
                // Confirmar la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error('Error committing transaction:', commitError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: 'Error committing transaction' });
                        });
                    }
                    // Enviar la respuesta final
                    res.json({ data: results, totalItems });
                });
            });
        });
    });
}));
router.post('/deleteBusiness', (req, res) => {
    const { ids } = req.body;
    console.log('IDs de negocios a eliminar:', ids);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron IDs válidos para eliminar.' });
    }
    // Inicia la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
        }
        // Primero, elimina las categorías asociadas a los salones
        const deleteCategoriesQuery = `DELETE FROM categories WHERE id_salon IN (?)`;
        db_1.default.query(deleteCategoriesQuery, [ids], (error) => {
            if (error) {
                // Si hay un error, se revierte la transacción
                return db_1.default.rollback(() => {
                    console.error('Error al eliminar categorías:', error);
                    res.status(500).json({ message: 'Error al eliminar las categorías.', error });
                });
            }
            // Ahora elimina los salones
            const deleteSalonsQuery = `DELETE FROM salon WHERE id_salon IN (?)`;
            db_1.default.query(deleteSalonsQuery, [ids], (error, results) => {
                if (error) {
                    // Si hay un error, se revierte la transacción
                    return db_1.default.rollback(() => {
                        console.error('Error al eliminar negocios:', error);
                        res.status(500).json({ message: 'Error al eliminar los negocios.', error });
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
                    res.status(200).json({ message: 'Negocios eliminados con éxito.', affectedRows: results.affectedRows });
                });
            });
        });
    });
});
exports.default = router;
