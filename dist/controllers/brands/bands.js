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
router.get("/getAllBrands", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const pageSize = parseInt(req.query.pageSize || "10", 10);
        const offset = (page - 1) * pageSize;
        const search = req.query.search ? `%${req.query.search}%` : "%%";
        /*
        console.log("Page:", page);
        console.log("Page Size:", pageSize);
        console.log("Offset:", offset);
        console.log("Search Query:", search);
      */
        const query = `
          SELECT *
          FROM brands
          WHERE brands LIKE ?
          LIMIT ?, ?;
      `;
        const countQuery = `
          SELECT COUNT(DISTINCT bands) AS totalItems 
          FROM bands 
          WHERE bands LIKE ?;
      `;
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res.status(500).json({ error: "An error occurred while starting transaction" });
            }
            db_1.default.query(query, [search, offset, pageSize], (error, results) => {
                if (error) {
                    console.error("Error fetching data:", error);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "An error occurred while fetching data" });
                    });
                }
                //console.log("Query Results:", results);
                db_1.default.query(countQuery, [search], (countError, countResults) => {
                    if (countError) {
                        console.error("Error fetching count:", countError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: "An error occurred while fetching data count" });
                        });
                    }
                    const totalItems = countResults[0].totalItems;
                    //console.log("Total Items:", totalItems);
                    const processedResults = results.map((row) => ({
                        band: row.bands,
                    }));
                    //console.log("Processed Results:", processedResults);
                    db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error committing transaction:", commitError);
                            return db_1.default.rollback(() => {
                                res.status(500).json({ error: "An error occurred while committing transaction" });
                            });
                        }
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
router.post("/addBrand", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, active = 1 } = req.body;
        if (!name) {
            return res
                .status(400)
                .json({ error: "name is required" });
        }
        const query = `
    INSERT INTO brands (name, active)
    VALUES (?, ?);
  `;
        // Inicia la transacción
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res
                    .status(500)
                    .json({ error: "An error occurred while starting transaction" });
            }
            // Ejecuta la consulta de inserción
            db_1.default.query(query, [name, active], (error, results) => {
                if (error) {
                    console.error("Error inserting data:", error);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ error: "An error occurred while inserting data" });
                    });
                }
                const insertId = results.insertId;
                // Si todo salió bien, confirma la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error("Error committing transaction:", commitError);
                        return db_1.default.rollback(() => {
                            res
                                .status(500)
                                .json({
                                error: "An error occurred while committing transaction",
                            });
                        });
                    }
                    // Responde con un mensaje de éxito
                    res
                        .status(201)
                        .json({
                        message: "Brand added successfully",
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
exports.default = router;
