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
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.resolve(__dirname, "../../../dist/uploads/brands-pictures"));
    },
    filename: (req, file, cb) => {
        // Generar un nombre de archivo único con un prefijo y marca de tiempo
        const uniqueSuffix = Date.now() + path_1.default.extname(file.originalname);
        cb(null, `brand-${uniqueSuffix}`);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/jpeg" ||
            file.mimetype === "image/png" ||
            file.mimetype === "image/gif") {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
        }
    },
});
router.get("/getAllBrands", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const pageSize = parseInt(req.query.pageSize || "10", 10);
        const offset = (page - 1) * pageSize;
        const search = req.query.search ? `%${req.query.search}%` : "%%";
        const query = `
    SELECT b.id_brand, b.name, b.imagePath, b.active, COUNT(sb.id_salon) AS totalSalones, 
           GROUP_CONCAT(bc.category SEPARATOR ', ') AS categories
    FROM brands b
    LEFT JOIN brands_salon sb ON b.id_brand = sb.id_brand
    LEFT JOIN brands_categories bc ON b.id_brand = bc.id_brand
    WHERE b.name LIKE ?
    GROUP BY b.id_brand
    LIMIT ?, ?;
  `;
        const countQuery = `
      SELECT COUNT(*) AS totalItems 
      FROM brands 
      WHERE name LIKE ?;
    `;
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res
                    .status(500)
                    .json({ error: "An error occurred while starting transaction" });
            }
            db_1.default.query(query, [search, offset, pageSize], (error, results) => {
                if (error) {
                    console.error("Error fetching data:", error);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ error: "An error occurred while fetching data" });
                    });
                }
                db_1.default.query(countQuery, [search], (countError, countResults) => {
                    if (countError) {
                        console.error("Error fetching count:", countError);
                        return db_1.default.rollback(() => {
                            res
                                .status(500)
                                .json({
                                error: "An error occurred while fetching data count",
                            });
                        });
                    }
                    const totalItems = countResults[0].totalItems;
                    // Procesar resultados y añadir las categorías
                    const processedResults = results.map((row) => ({
                        id_brand: row.id_brand,
                        name: row.name,
                        imagePath: row.imagePath,
                        active: row.active,
                        totalSalones: row.totalSalones,
                        categories: row.categories || '', // Devolver las categorías separadas por comas
                    }));
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
router.get("/searchCategoryInLive", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category } = req.query;
        if (!category) {
            return res
                .status(400)
                .json({ error: "El parámetro 'category' es requerido." });
        }
        // Iniciar la transacción
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve(undefined);
            });
        });
        const query = "SELECT DISTINCT categories FROM categories WHERE categories LIKE ?";
        db_1.default.query(query, [`%${category}%`], (error, results) => {
            if (error) {
                console.error("Error al buscar la categoria:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Error al buscar categoria." });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    console.error("Error al hacer commit:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Error al buscar categoria." });
                    });
                }
                res.json(results);
            });
        });
    }
    catch (err) {
        console.error("Error al buscar categoria:", err);
        res.status(500).json({ error: "Error al buscar la categoria." });
    }
}));
router.post("/addBrand", upload.single("brandImage"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, categories } = req.body; // Recibir las categorías desde el cliente
        const brandImage = req.file;
        if (!name) {
            return res
                .status(400)
                .json({ error: "El nombre de la marca es requerido" });
        }
        if (!brandImage) {
            return res.status(400).json({ error: "La imagen es requerida" });
        }
        // Asegurarse de que las categorías están parseadas correctamente si vienen como JSON string
        let parsedCategories;
        if (typeof categories === "string") {
            try {
                parsedCategories = JSON.parse(categories);
            }
            catch (err) {
                return res
                    .status(400)
                    .json({ error: "El formato de las categorías es incorrecto" });
            }
        }
        else {
            parsedCategories = categories;
        }
        // Construir la URL completa basada en el servidor
        const serverUrl = `${req.protocol}://${req.get("host")}`;
        const imageUrl = `${serverUrl}/uploads/brands-pictures/${brandImage.filename}`;
        const insertBrandQuery = `
      INSERT INTO brands (name, imagePath, active)
      VALUES (?, ?, ?);
    `;
        db_1.default.beginTransaction((err) => {
            if (err) {
                console.error("Error al iniciar la transacción:", err);
                return res
                    .status(500)
                    .json({ error: "Ocurrió un error al iniciar la transacción" });
            }
            // Insertar la marca
            db_1.default.query(insertBrandQuery, [name, imageUrl, 1], // El valor de "active" es 1 por defecto
            (error, results) => {
                if (error) {
                    console.error("Error al insertar los datos:", error);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ error: "Ocurrió un error al insertar los datos" });
                    });
                }
                const brandId = results.insertId; // Obtener el ID de la marca insertada
                // Si no hay categorías, continuar con el commit
                if (!parsedCategories || parsedCategories.length === 0) {
                    return db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error al confirmar la transacción:", commitError);
                            return db_1.default.rollback(() => {
                                res
                                    .status(500)
                                    .json({
                                    error: "Ocurrió un error al confirmar la transacción",
                                });
                            });
                        }
                        res.status(201).json({ message: "Marca añadida exitosamente" });
                    });
                }
                // Insertar las categorías asociadas
                const insertCategoriesQuery = `
            INSERT INTO brands_categories (id_brand, category)
            VALUES ?
          `;
                // Preparar los valores a insertar
                const categoryValues = parsedCategories.map((category) => [
                    brandId,
                    category,
                ]);
                db_1.default.query(insertCategoriesQuery, [categoryValues], (catError, catResults) => {
                    if (catError) {
                        console.error("Error al insertar las categorías:", catError);
                        return db_1.default.rollback(() => {
                            res
                                .status(500)
                                .json({
                                error: "Ocurrió un error al insertar las categorías",
                            });
                        });
                    }
                    // Confirmar la transacción si todo fue exitoso
                    db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error al confirmar la transacción:", commitError);
                            return db_1.default.rollback(() => {
                                res
                                    .status(500)
                                    .json({
                                    error: "Ocurrió un error al confirmar la transacción",
                                });
                            });
                        }
                        res
                            .status(201)
                            .json({
                            message: "Marca y categorías añadidas exitosamente",
                        });
                    });
                });
            });
        });
    }
    catch (err) {
        console.error("Error inesperado:", err);
        res.status(500).json({ error: "Ocurrió un error inesperado" });
    }
}));
router.post("/deleteBrand", (req, res) => {
    const { id_brand } = req.body;
    // Validar que se proporcionen los IDs y que sea un array válido
    if (!id_brand || !Array.isArray(id_brand) || id_brand.length === 0) {
        return res.status(400).json({ message: "No hay marcas para eliminar" });
    }
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res
                .status(500)
                .json({ message: "Error al iniciar la transacción" });
        }
        // Consulta para obtener las rutas de las imágenes de las marcas que se van a eliminar
        const selectQuery = `SELECT imagePath FROM brands WHERE id_brand IN (?)`;
        db_1.default.query(selectQuery, [id_brand], (selectError, selectResults) => {
            if (selectError) {
                console.error("Error al obtener las rutas de las imágenes:", selectError);
                return db_1.default.rollback(() => {
                    res
                        .status(500)
                        .json({ message: "Error al obtener las rutas de las imágenes" });
                });
            }
            if (selectResults.length === 0) {
                console.error("No se encontraron marcas con los IDs proporcionados.");
                return db_1.default.rollback(() => {
                    res
                        .status(404)
                        .json({ message: "No se encontraron marcas para eliminar" });
                });
            }
            // Procesar cada marca encontrada
            selectResults.forEach((row) => {
                const fileUrl = row.imagePath;
                const fileName = path_1.default.basename(fileUrl);
                // Construir la ruta del archivo en el sistema de archivos
                const filePath = path_1.default.join(__dirname, "../../uploads/brands-pictures", fileName);
                // Verificar si el archivo existe
                fs_1.default.access(filePath, fs_1.default.constants.F_OK, (accessErr) => {
                    if (accessErr) {
                        console.error(`Archivo no encontrado en el servidor: ${filePath}`);
                        // No detenemos el proceso si el archivo no existe
                        return;
                    }
                    // Eliminar el archivo del sistema de archivos
                    fs_1.default.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error(`Error al eliminar el archivo: ${filePath}`, unlinkErr);
                            // No hacemos rollback ya que la eliminación del archivo no afecta la integridad de la base de datos
                        }
                        else {
                            //console.log(`Archivo eliminado exitosamente: ${filePath}`);
                        }
                    });
                });
            });
            // Primero, eliminar las categorías asociadas en `brands_categories`
            const deleteCategoriesQuery = `DELETE FROM brands_categories WHERE id_brand IN (?)`;
            db_1.default.query(deleteCategoriesQuery, [id_brand], (deleteCatError) => {
                if (deleteCatError) {
                    console.error("Error al eliminar las categorías asociadas:", deleteCatError);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({
                            message: "Error al eliminar las categorías asociadas",
                        });
                    });
                }
                // Eliminar las marcas de la base de datos
                const deleteQuery = `DELETE FROM brands WHERE id_brand IN (?)`;
                db_1.default.query(deleteQuery, [id_brand], (deleteError, deleteResults) => {
                    if (deleteError) {
                        console.error("Error al eliminar las marcas:", deleteError);
                        return db_1.default.rollback(() => {
                            res
                                .status(500)
                                .json({ message: "Error al eliminar las marcas" });
                        });
                    }
                    if (deleteResults.affectedRows === 0) {
                        console.error("No se encontraron marcas para eliminar.");
                        return db_1.default.rollback(() => {
                            res
                                .status(404)
                                .json({
                                message: "No se encontraron marcas para eliminar",
                            });
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
                        //console.log('Marcas e imágenes eliminadas con éxito');
                        res
                            .status(200)
                            .json({
                            message: "Marcas e imágenes eliminadas con éxito",
                        });
                    });
                });
            });
        });
    });
});
router.put("/updateBrand/:id", upload.single("brandImage"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, categories } = req.body; // Recibir las categorías desde el cliente
    const brandImage = req.file;
    if (!name) {
        return res.status(400).json({ error: "El nombre de la marca es requerido" });
    }
    // Asegurarse de que las categorías están parseadas correctamente si vienen como JSON string
    let parsedCategories;
    if (typeof categories === "string") {
        try {
            parsedCategories = JSON.parse(categories);
        }
        catch (err) {
            return res.status(400).json({ error: "El formato de las categorías es incorrecto" });
        }
    }
    else {
        parsedCategories = categories;
    }
    // Construir la URL completa basada en el servidor
    const serverUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrl = brandImage ? `${serverUrl}/uploads/brands-pictures/${brandImage.filename}` : null;
    const updateBrandQuery = `
    UPDATE brands 
    SET name = ?, ${brandImage ? "imagePath = ?," : ""} active = ?
    WHERE id_brand = ?;
  `;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error al iniciar la transacción:", err);
            return res.status(500).json({ error: "Ocurrió un error al iniciar la transacción" });
        }
        // Actualizar la marca (sin tocar las categorías aún)
        db_1.default.query(updateBrandQuery, brandImage ? [name, imageUrl, 1, id] : [name, 1, id], (error, results) => {
            if (error) {
                console.error("Error al actualizar los datos:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ error: "Ocurrió un error al actualizar los datos" });
                });
            }
            // Eliminar las categorías antiguas
            const deleteCategoriesQuery = `DELETE FROM brands_categories WHERE id_brand = ?`;
            db_1.default.query(deleteCategoriesQuery, [id], (deleteError) => {
                if (deleteError) {
                    console.error("Error al eliminar las categorías antiguas:", deleteError);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ error: "Ocurrió un error al eliminar las categorías antiguas" });
                    });
                }
                // Si no hay nuevas categorías, hacer commit y finalizar
                if (!parsedCategories || parsedCategories.length === 0) {
                    return db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error al confirmar la transacción:", commitError);
                            return db_1.default.rollback(() => {
                                res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
                            });
                        }
                        res.status(200).json({ message: "Marca actualizada con éxito" });
                    });
                }
                // Insertar las nuevas categorías
                const insertCategoriesQuery = `
            INSERT INTO brands_categories (id_brand, category)
            VALUES ?
          `;
                // Preparar los valores a insertar (solo el nombre de las categorías, no el objeto completo)
                const categoryValues = parsedCategories.map((category) => [
                    id,
                    category.name ? category.name : category // Extraer el 'name' si existe, o el valor si es un string
                ]);
                db_1.default.query(insertCategoriesQuery, [categoryValues], (catError) => {
                    if (catError) {
                        console.error("Error al insertar las nuevas categorías:", catError);
                        return db_1.default.rollback(() => {
                            res.status(500).json({ error: "Ocurrió un error al insertar las nuevas categorías" });
                        });
                    }
                    // Confirmar la transacción si todo fue exitoso
                    db_1.default.commit((commitError) => {
                        if (commitError) {
                            console.error("Error al confirmar la transacción:", commitError);
                            return db_1.default.rollback(() => {
                                res.status(500).json({ error: "Ocurrió un error al confirmar la transacción" });
                            });
                        }
                        res.status(200).json({ message: "Marca y categorías actualizadas con éxito" });
                    });
                });
            });
        });
    });
}));
exports.default = router;
