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
router.get('/getAllClients', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const query = `
  SELECT SQL_CALC_FOUND_ROWS * 
  FROM user 
  WHERE (name LIKE ? OR email LIKE ? OR created_at LIKE ? OR phone LIKE ?)
  AND permiso = 'client'
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
router.post('/delete', (req, res) => {
    const { id_user } = req.body;
    if (!id_user || !Array.isArray(id_user) || id_user.length === 0) {
        return res.status(400).json({ message: 'No hay clientes para eliminar' });
    }
    // Eliminar las referencias en la tabla user_salon
    const deleteUserSalonSql = `DELETE FROM user_salon WHERE id_user IN (${id_user.map(() => '?').join(',')})`;
    db_1.default.query(deleteUserSalonSql, id_user, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error eliminando relaciones de clientes en user_salon' });
        }
        // Luego de eliminar las relaciones, eliminar el usuario
        const deleteUserSql = `DELETE FROM user WHERE id_user IN (${id_user.map(() => '?').join(',')})`;
        db_1.default.query(deleteUserSql, id_user, (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Error eliminando clientes' });
            }
            res.status(200).json({ message: 'Clientes eliminados correctamente' });
        });
    });
});
exports.default = router;
