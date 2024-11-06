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
router.use(express_1.default.json());
router.get('/getAllCategoriesJobs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    // Consulta con condición para buscar tanto en el nombre de la categoría como en el nombre de la subcategoría
    const query = `
    SELECT SQL_CALC_FOUND_ROWS jobs_cat.id_job_cat, jobs_cat.name AS categoryName, 
      jobs_subcat.id_job_subcat, jobs_subcat.name AS subcategoryName
    FROM jobs_cat
    LEFT JOIN jobs_subcat ON jobs_cat.id_job_cat = jobs_subcat.id_job_cat
    WHERE jobs_cat.name LIKE ? OR jobs_subcat.name LIKE ?
    ORDER BY jobs_cat.id_job_cat
    LIMIT ?, ?;
  `;
    const queryParams = [search, search, offset, pageSize];
    // Ejecuta la consulta principal
    db_1.default.query(query, queryParams, (error, results) => {
        if (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'An error occurred while fetching data' });
            return;
        }
        // Consulta para contar el total de elementos con el mismo criterio de búsqueda
        db_1.default.query('SELECT FOUND_ROWS() AS totalItems', (countError, countResults) => {
            var _a;
            if (countError) {
                console.error('Error fetching count:', countError);
                res.status(500).json({ error: 'An error occurred while fetching data count' });
                return;
            }
            const totalItems = (_a = countResults[0]) === null || _a === void 0 ? void 0 : _a.totalItems;
            // Agrupar resultados por categoría
            const categories = results.reduce((acc, row) => {
                const { id_job_cat, categoryName, id_job_subcat, subcategoryName } = row;
                let category = acc.find((cat) => cat.id_job_cat === id_job_cat);
                if (!category) {
                    category = {
                        id_job_cat,
                        name: categoryName,
                        subcategories: [],
                    };
                    acc.push(category);
                }
                if (id_job_subcat) {
                    category.subcategories.push({
                        id_job_subcat,
                        name: subcategoryName,
                    });
                }
                return acc;
            }, []);
            // Respuesta con las categorías y el total de elementos
            res.json({ data: categories, totalItems });
        });
    });
}));
router.post("/addCategoryWithSubcategoriesJobs", (req, res) => {
    const { category, subCategories } = req.body;
    console.log("Datos recibidos en el servidor:");
    console.log("category:", category);
    console.log("subCategories:", subCategories);
    if (!category || !Array.isArray(subCategories) || subCategories.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Faltan datos: se requiere 'category' y 'subCategories' como arreglo.",
        });
    }
    // Inicia la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Inserta la categoría en `jobs_cat`
        const categoryQuery = "INSERT INTO jobs_cat (name, active) VALUES (?, 1)";
        db_1.default.query(categoryQuery, [category], (err, categoryResult) => {
            if (err) {
                console.error("Error inserting category:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error inserting category",
                        error: err,
                    });
                });
            }
            const categoryId = categoryResult.insertId; // ID de la categoría insertada
            // Prepara las subcategorías para la inserción en `jobs_subcat`
            const subcategoryQuery = "INSERT INTO jobs_subcat (id_job_cat, name) VALUES ?";
            const subcategoryValues = subCategories.map((subcategory) => [
                categoryId,
                subcategory,
            ]);
            // Inserta las subcategorías en `jobs_subcat`
            db_1.default.query(subcategoryQuery, [subcategoryValues], (err) => {
                if (err) {
                    console.error("Error inserting subcategories:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error inserting subcategories",
                            error: err,
                        });
                    });
                }
                // Confirma la transacción si todo salió bien
                db_1.default.commit((err) => {
                    if (err) {
                        console.error("Error committing transaction:", err);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: "Error committing transaction",
                                error: err,
                            });
                        });
                    }
                    // Respuesta final exitosa con la opción de devolver datos adicionales (como categoryId)
                    res.json({
                        success: true,
                        message: "Category and subcategories added successfully",
                        // Opcional: devolver si es útil para el frontend
                    });
                });
            });
        });
    });
});
router.post("/delete", (req, res) => {
    const { categoryIds } = req.body;
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Faltan los IDs de las categorías en el cuerpo de la solicitud",
        });
    }
    // Inicia la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Elimina las subcategorías para todas las categorías dadas
        const deleteSubcategoriesQuery = "DELETE FROM jobs_subcat WHERE id_job_cat IN (?)";
        db_1.default.query(deleteSubcategoriesQuery, [categoryIds], (err) => {
            if (err) {
                console.error("Error deleting subcategories:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error deleting subcategories",
                        error: err,
                    });
                });
            }
            // Luego elimina las categorías
            const deleteCategoriesQuery = "DELETE FROM jobs_cat WHERE id_job_cat IN (?)";
            db_1.default.query(deleteCategoriesQuery, [categoryIds], (err) => {
                if (err) {
                    console.error("Error deleting categories:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error deleting categories",
                            error: err,
                        });
                    });
                }
                // Confirma la transacción si todo salió bien
                db_1.default.commit((err) => {
                    if (err) {
                        console.error("Error committing transaction:", err);
                        return db_1.default.rollback(() => {
                            res.status(500).json({
                                success: false,
                                message: "Error committing transaction",
                                error: err,
                            });
                        });
                    }
                    // Respuesta final exitosa
                    res.json({
                        success: true,
                        message: "Categories and their subcategories deleted successfully",
                    });
                });
            });
        });
    });
});
router.put("/updateCategoryJob/:id", (req, res) => {
    const { id } = req.params; // Obtener el ID de la categoría de los parámetros de la URL
    const { name } = req.body; // Obtener el nuevo nombre de la categoría del cuerpo de la solicitud
    // Verificar que los datos necesarios estén presentes
    if (!id || !name) {
        return res.status(400).json({
            success: false,
            message: "Faltan datos: se requiere 'id' y 'name'."
        });
    }
    // Iniciar una transacción para asegurar la consistencia de los datos
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error al iniciar la transacción:", err);
            return res.status(500).json({
                success: false,
                message: "Error al iniciar la transacción",
                error: err
            });
        }
        // Consulta para actualizar la categoría en la tabla `jobs_cat`
        const updateQuery = "UPDATE jobs_cat SET name = ? WHERE id_job_cat = ?";
        db_1.default.query(updateQuery, [name, id], (err, result) => {
            if (err) {
                console.error("Error al actualizar la categoría:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error al actualizar la categoría",
                        error: err
                    });
                });
            }
            // Confirmar la transacción si no hubo errores
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al confirmar la transacción:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error al confirmar la transacción",
                            error: err
                        });
                    });
                }
                // Responder exitosamente si todo salió bien
                res.json({
                    success: true,
                    message: "Categoría actualizada exitosamente"
                });
            });
        });
    });
});
router.put('/updateSubcategories/:category_id', (req, res) => {
    const category_id = parseInt(req.params.category_id, 10);
    let { subcategories } = req.body;
    // Verificación de datos básicos
    if (!subcategories || !category_id) {
        console.error('Error: No se proporcionaron subcategorías o el ID de la categoría.');
        return res.status(400).json({ error: 'Debe proporcionar las subcategorías y el ID de la categoría.' });
    }
    // Si `subcategories` es un string, dividirlo en un array usando coma y espacio
    if (typeof subcategories === 'string') {
        subcategories = subcategories.split(',').map(subcat => subcat.trim()).filter(subcat => subcat.length > 0);
    }
    else if (!Array.isArray(subcategories)) {
        // Si `subcategories` no es un array o string, retornar un error
        return res.status(400).json({ error: 'El formato de subcategorías es incorrecto. Debe ser un string o un array.' });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((transErr) => {
        if (transErr) {
            console.error('Error al iniciar la transacción:', transErr);
            return res.status(500).json({ error: 'Error al iniciar la transacción.' });
        }
        // Obtener los IDs de subcategorías existentes para esta categoría
        const existingQuery = 'SELECT id_job_subcat, name FROM jobs_subcat WHERE id_job_cat = ?';
        db_1.default.query(existingQuery, [category_id], (err, results) => {
            if (err) {
                console.error('Error obteniendo subcategorías existentes:', err);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: 'Error al obtener subcategorías existentes.' });
                });
            }
            const existingResults = results;
            const existingSubcategoryMap = new Map(existingResults.map((row) => [row.name, row.id_job_subcat]));
            // Identificar subcategorías a agregar, actualizar y eliminar
            const subcategoriesToAdd = subcategories.filter((subcat) => !existingSubcategoryMap.has(subcat));
            const subcategoriesToUpdate = subcategories.filter((subcat) => existingSubcategoryMap.has(subcat));
            const idsToDelete = existingResults
                .filter(row => !subcategories.includes(row.name))
                .map(row => row.id_job_subcat);
            // Paso 1: Eliminar subcategorías que ya no están presentes en `subcategories`
            const deletePromises = idsToDelete.map((id_job_subcat) => {
                const deleteQuery = 'DELETE FROM jobs_subcat WHERE id_job_subcat = ?';
                return new Promise((resolve, reject) => {
                    db_1.default.query(deleteQuery, [id_job_subcat], (error) => {
                        if (error) {
                            console.error('Error eliminando subcategoría:', error);
                            reject(error);
                        }
                        else {
                            resolve(null);
                        }
                    });
                });
            });
            // Ejecutar eliminaciones
            Promise.all(deletePromises)
                .then(() => {
                // Paso 2: Insertar nuevas subcategorías
                const insertPromises = subcategoriesToAdd.map((subcat) => {
                    const insertQuery = 'INSERT INTO jobs_subcat (name, id_job_cat) VALUES (?, ?)';
                    return new Promise((resolve, reject) => {
                        db_1.default.query(insertQuery, [subcat, category_id], (error) => {
                            if (error) {
                                console.error('Error insertando subcategoría:', error);
                                reject(error);
                            }
                            else {
                                resolve(null);
                            }
                        });
                    });
                });
                // Ejecutar inserciones y luego confirmar la transacción
                return Promise.all(insertPromises);
            })
                .then(() => {
                // Confirmar la transacción
                db_1.default.commit((commitErr) => {
                    if (commitErr) {
                        console.error('Error al confirmar la transacción:', commitErr);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: 'Error al confirmar la transacción.' });
                        });
                    }
                    res.json({ message: 'Subcategorías actualizadas con éxito.' });
                });
            })
                .catch((error) => {
                console.error('Error en la actualización de subcategorías:', error);
                db_1.default.rollback(() => {
                    res.status(500).json({ error: 'Error durante la actualización de subcategorías.' });
                });
            });
        });
    });
});
router.get("/getCategories", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Usar DISTINCT para seleccionar solo servicios únicos por nombre
        const query = "SELECT DISTINCT categories FROM categories";
        db_1.default.query(query, (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error fetching categories",
                        error: err,
                    });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error committing transaction",
                            error: err,
                        });
                    });
                }
                res.json(results);
            });
        });
    });
}));
exports.default = router;
