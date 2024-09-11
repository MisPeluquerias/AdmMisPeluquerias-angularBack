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
router.get('/getAllReclamations', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = '1', pageSize = '3' } = req.query; // Cambié el valor predeterminado de pageSize a '3'
    const pageNumber = parseInt(page, 10);
    const pageSizeNumber = parseInt(pageSize, 10);
    const offset = (pageNumber - 1) * pageSizeNumber;
    const query = `
    SELECT sr.*, u.name AS user_name, u.email
    FROM salon_reclamacion sr
    INNER JOIN user u ON sr.id_user = u.id_user
    LIMIT ?, ?;
  `;
    const countQuery = 'SELECT COUNT(*) AS totalItems FROM salon_reclamacion';
    // Iniciar la transacción
    db_1.default.beginTransaction(err => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'An error occurred while starting transaction' });
        }
        // Primera consulta: obtener datos de reclamaciones
        db_1.default.query(query, [offset, pageSizeNumber], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error fetching data:', error);
                    res.status(500).json({ error: 'An error occurred while fetching data' });
                });
            }
            // Segunda consulta: contar el total de registros
            db_1.default.query(countQuery, (countError, countResults) => {
                if (countError) {
                    return db_1.default.rollback(() => {
                        console.error('Error fetching count:', countError);
                        res.status(500).json({ error: 'An error occurred while fetching data count' });
                    });
                }
                // Si todo fue bien, commit y envío de los resultados
                db_1.default.commit(commitError => {
                    if (commitError) {
                        return db_1.default.rollback(() => {
                            console.error('Error committing transaction:', commitError);
                            res.status(500).json({ error: 'An error occurred while committing transaction' });
                        });
                    }
                    // Manejo seguro de resultados
                    const totalItems = countResults[0].totalItems;
                    const totalPages = Math.ceil(totalItems / pageSizeNumber);
                    res.json({
                        data: results,
                        pagination: {
                            page: pageNumber,
                            pageSize: pageSizeNumber,
                            totalItems,
                            totalPages,
                        },
                    });
                });
            });
        });
    });
}));
exports.default = router;
