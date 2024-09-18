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
        /*
        console.log("Page:", page);
        console.log("Page Size:", pageSize);
        console.log("Offset:", offset);
        console.log("Search Query:", search);
      */
        const query = `
          SELECT DISTINCT categories
          FROM categories
          WHERE categories LIKE ?
          LIMIT ?, ?;
      `;
        const countQuery = `
          SELECT COUNT(DISTINCT categories) AS totalItems 
          FROM categories 
          WHERE categories LIKE ?;
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
                        category: row.categories,
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
router.put("/updateCategory", (req, res) => {
    const { OldCategory, newCategory } = req.body;
    /*console.log(
      "Categoría antigua:",
      OldCategory,
      "Nueva categoría:",
      newCategory
    );*/
    // Validar que se proporcionen ambas categorías
    if (!OldCategory || !newCategory) {
        return res
            .status(400)
            .json({ message: "OldCategory y newCategory son requeridos" });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res
                .status(500)
                .json({ message: "Error al iniciar la transacción" });
        }
        // Consulta para actualizar la categoría
        const query = `
      UPDATE categories
      SET categories = ?
      WHERE categories = ?
    `;
        // Ejecutar la consulta con tipo explícito para los resultados
        db_1.default.query(query, [newCategory, OldCategory], (err, results) => {
            if (err) {
                console.error("Error al actualizar la categoría:", err);
                return db_1.default.rollback(() => {
                    res
                        .status(500)
                        .json({ message: "Error al actualizar la categoría" });
                });
            }
            // Verificar si se afectaron filas en la base de datos
            if (results.affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ message: "Categoría no encontrada" });
                });
            }
            // Confirmar la transacción
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error("Error al confirmar la transacción:", commitErr);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ message: "Error al confirmar la transacción" });
                    });
                }
                // Respuesta exitosa
                res.status(200).json({ message: "Categoría actualizada con éxito" });
            });
        });
    });
});
router.post("/addCategory", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_salon = 15451, category, destacado = 0, active = 1 } = req.body;
        if (!category) {
            return res
                .status(400)
                .json({ error: "id_salon and category are required" });
        }
        const query = `
  INSERT INTO categories (id_salon,categories, destacado, active)
  VALUES (?, ?, ?, ?);
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
            db_1.default.query(query, [id_salon, category, destacado, active], (error, results) => {
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
                        message: "Category added successfully",
                        categoryId: insertId,
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
router.put("/updateService/:id_service", (req, res) => {
    const { id_service } = req.params;
    const { service_name } = req.body;
    // Validar que se proporcione un nombre de servicio
    if (!service_name || !id_service) {
        return res
            .status(400)
            .json({ message: "El ID del servicio y el nombre son requeridos" });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res
                .status(500)
                .json({ message: "Error al iniciar la transacción" });
        }
        // Consulta para actualizar el nombre del servicio
        const updateServiceQuery = `
      UPDATE service
      SET name = ?
      WHERE id_service = ?
    `;
        db_1.default.query(updateServiceQuery, [service_name, id_service], (err, results) => {
            if (err) {
                console.error("Error al actualizar el servicio:", err);
                return db_1.default.rollback(() => {
                    res
                        .status(500)
                        .json({ message: "Error al actualizar el servicio" });
                });
            }
            // Si no se afectaron filas, el servicio no fue encontrado
            if (results.affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ message: "Servicio no encontrado" });
                });
            }
            // Confirmar la transacción
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error("Error al confirmar la transacción:", commitErr);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ message: "Error al confirmar la transacción" });
                    });
                }
                // Respuesta exitosa
                res.status(200).json({ message: "Servicio actualizado con éxito" });
            });
        });
    });
});
router.post('/delete', (req, res) => {
    const { names } = req.body;
    if (!names || !Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ message: 'No hay categorías para eliminar' });
    }
    const query = `DELETE FROM categories WHERE categories IN (?)`;
    db_1.default.query(query, [names], (err, results) => {
        if (err) {
            console.error('Error al eliminar las categorías:', err);
            return res.status(500).json({ message: 'Error al eliminar las categorías' });
        }
        res.status(200).json({ message: 'Categorías eliminadas con éxito' });
    });
});
exports.default = router;
