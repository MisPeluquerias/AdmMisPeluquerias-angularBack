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
router.get('/getAllSalon', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const filterState = req.query.filterState ? req.query.filterState.toString() : '%%';
    const filterActive = req.query.filterActive === 'true' ? '1' : '0';
    let query = `
    SELECT SQL_CALC_FOUND_ROWS * 
    FROM salon 
    WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ? OR state LIKE ?)
  `;
    if (req.query.filterActive) {
        query += ' AND active = ?';
    }
    if (req.query.filterState && req.query.filterState !== '%%') {
        query += ' AND state = ?';
    }
    // Aquí los valores deben ser sin comillas
    query += ' LIMIT ?, ?';
    const countQuery = 'SELECT FOUND_ROWS() AS totalItems';
    const queryParams = [search, search, search, search];
    if (req.query.filterActive) {
        queryParams.push(filterActive);
    }
    if (req.query.filterState && req.query.filterState !== '%%') {
        queryParams.push(filterState);
    }
    // Aquí no se necesita convertir a string, deben ser números
    queryParams.push(offset, pageSize);
    db_1.default.query(query, queryParams, (error, results) => {
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
exports.default = router;
