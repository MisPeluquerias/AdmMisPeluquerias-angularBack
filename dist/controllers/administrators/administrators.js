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
router.get('/getAllAdministrators', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM user 
    WHERE permiso = "admin" AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR created_at LIKE ?)
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
router.put('/addNewAdmin', (req, res) => {
    const { email } = req.body;
    //console.log('Email recibido en el servidor:', email);
    if (!email) {
        return res.status(400).json({ message: 'El correo electrónico es requerido.' });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
        }
        // Consulta para actualizar el permiso
        const query = 'UPDATE user SET permiso = ? WHERE email = ?';
        db_1.default.query(query, ['admin', email], (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    res.status(500).json({ message: 'Error al actualizar el rol del usuario.', error: err });
                });
            }
            const affectedRows = results.affectedRows;
            if (affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ message: 'Usuario no encontrado.' });
                });
            }
            // Confirmar la transacción
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        res.status(500).json({ message: 'Error al confirmar la transacción.', error: err });
                    });
                }
                res.status(200).json({ message: 'El usuario ha sido promovido a administrador.' });
            });
        });
    });
});
exports.default = router;
