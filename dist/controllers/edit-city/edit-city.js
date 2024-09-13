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
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get("/getCityById", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id_city = req.query.id_city;
    if (!id_city) {
        return res.status(400).json({ error: "id_city is required" });
    }
    const query = `
    SELECT city.*, province.name as province_name
    FROM city
    INNER JOIN province ON city.id_province = province.id_province
    WHERE id_city = ? `;
    try {
        db_1.default.beginTransaction((transactionError) => __awaiter(void 0, void 0, void 0, function* () {
            if (transactionError) {
                console.error("Error starting transaction:", transactionError);
                return res.status(500).json({
                    error: "An error occurred while starting the transaction",
                });
            }
            db_1.default.query(query, [id_city], (queryError, results) => {
                if (queryError) {
                    console.error("Error fetching salon:", queryError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            error: "An error occurred while fetching the salon data",
                        });
                    });
                }
                if (results.length === 0) {
                    return db_1.default.rollback(() => {
                        res.status(404).json({ message: "Salon not found" });
                    });
                }
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        console.error("Error committing transaction:", commitError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                error: "An error occurred while committing the transaction",
                            });
                        });
                    }
                    res.json({ data: results[0] });
                });
            });
        }));
    }
    catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
}));
router.get("/getProvinces", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
router.put("/updateCity/:id_city", (req, res) => {
    const { id_city } = req.params;
    const { name, longitud, latitud, zip_code, id_province } = req.body;
    const query = `
        UPDATE city
        SET 
            name=?, 
            longitud=?, 
            latitud=?, 
            zip_code=?, 
            id_province=?
        WHERE id_city=?;
    `;
    db_1.default.query(query, [name, longitud, latitud, zip_code, id_province, id_city], // Reordenar los valores
    (error) => {
        if (error) {
            console.error("Error actualizando ciudad:", error.message);
            return res.status(500).json({ message: "Error actualizando ciudad" });
        }
        res.json({ message: "Ciudad actualizada correctamente" });
    });
});
exports.default = router;
