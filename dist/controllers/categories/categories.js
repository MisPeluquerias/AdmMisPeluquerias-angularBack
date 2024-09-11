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
router.get("/getAllCategories", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const pageSize = parseInt(req.query.pageSize || "10", 10);
        const offset = (page - 1) * pageSize;
        const search = req.query.search ? `%${req.query.search}%` : "%%";
        const query = `
      SELECT DISTINCT categories
      FROM categories
      WHERE categories LIKE ?
      LIMIT ?, ?;
    `;
        const countQuery = "SELECT FOUND_ROWS() AS totalItems";
        // Inicia la transacción
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res.status(500).json({ error: "An error occurred while starting transaction" });
            }
            // Ejecuta la primera consulta
            db_1.default.query(query, [search, offset, pageSize], (error, results) => {
                if (error) {
                    console.error("Error fetching data:", error);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "An error occurred while fetching data" });
                    });
                }
                // Ejecuta la segunda consulta
                db_1.default.query(countQuery, (countError, countResults) => {
                    if (countError) {
                        console.error("Error fetching count:", countError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: "An error occurred while fetching data count" });
                        });
                    }
                    const totalItems = countResults[0].totalItems;
                    let processedResults = [];
                    if (Array.isArray(results)) {
                        processedResults = results.map((row) => ({
                            category: row.categories,
                        }));
                    }
                    // Si todo salió bien, confirma la transacción
                    db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error committing transaction:", commitError);
                            return db_1.default.rollback(() => {
                                res.status(500).json({ error: "An error occurred while committing transaction" });
                            });
                        }
                        // Responde con los datos
                        res.json({ data: processedResults, totalItems });
                    });
                });
            });
        });
    }
    catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
}));
router.post("/addCategory", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_salon, category, destacado = 0, active = 1 } = req.body;
        if (!id_salon || !category) {
            return res.status(400).json({ error: "id_salon and category are required" });
        }
        const query = `
          INSERT INTO categories (id_salon, categories, destacado, active)
          VALUES (?, ?, ?, ?);
      `;
        // Inicia la transacción
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res.status(500).json({ error: "An error occurred while starting transaction" });
            }
            // Ejecuta la consulta de inserción
            db_1.default.query(query, [id_salon, category, destacado, active], (error, results) => {
                if (error) {
                    console.error("Error inserting data:", error);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "An error occurred while inserting data" });
                    });
                }
                const insertId = results.insertId;
                // Si todo salió bien, confirma la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error("Error committing transaction:", commitError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: "An error occurred while committing transaction" });
                        });
                    }
                    // Responde con un mensaje de éxito
                    res.status(201).json({ message: "Category added successfully", categoryId: insertId });
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
