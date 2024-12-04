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
const decodeToken_1 = __importDefault(require("../../functions/decodeToken"));
const fs = require("fs");
const path = require("path");
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get("/getCategoriesJob", (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res.status(500).send("Error iniciando la transacción");
        }
        const query = "SELECT * FROM jobs_cat";
        db_1.default.query(query, (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error("Error ejecutando la consulta:", error);
                    res.status(500).send("Error en la consulta");
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error("Error confirmando la transacción:", err);
                        res.status(500).send("Error confirmando la transacción");
                    });
                }
                res.json(results);
            });
        });
    });
});
// Endpoint para agregar una oferta de trabajo con transacción
router.post("/addJobOffer", (req, res) => {
    const { id_user, id_salon, category, subcategory, description, requirements, salary, img_job_path, } = req.body;
    // Valida que todos los campos necesarios estén presentes
    if (!category ||
        !subcategory ||
        !description ||
        !requirements ||
        !salary ||
        !img_job_path) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    const id_user_decode = (0, decodeToken_1.default)(id_user);
    /*console.log(
      id_user_decode,
      id_salon,
      category,
      subcategory,
      description,
      requirements,
      salary,
      img_job_path
    );
    */
    // Inicia la transacción
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error("Error al iniciar la transacción:", transactionError);
            return res.status(500).json({ error: "Error al iniciar la transacción" });
        }
        // Consulta para insertar la oferta de trabajo en la tabla
        const query = `
        INSERT INTO jobs_offers (id_user, id_salon, category, subcategory, description, requirements, salary, img_job_path, date_job_offer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
        // Ejecuta la consulta dentro de la transacción
        db_1.default.query(query, [
            id_user_decode,
            id_salon,
            category,
            subcategory,
            description,
            requirements,
            salary,
            img_job_path,
        ], (error, results) => {
            if (error) {
                // Realiza un rollback si ocurre un error
                return db_1.default.rollback(() => {
                    console.error("Error al insertar la oferta de trabajo:", error);
                    res
                        .status(500)
                        .json({ error: "Error al insertar la oferta de trabajo" });
                });
            }
            // Cast explícito para que TypeScript entienda que `results` tiene `insertId`
            const result = results;
            // Realiza el commit si la inserción fue exitosa
            db_1.default.commit((commitError) => {
                if (commitError) {
                    // Realiza un rollback si ocurre un error durante el commit
                    return db_1.default.rollback(() => {
                        console.error("Error al confirmar la transacción:", commitError);
                        res
                            .status(500)
                            .json({ error: "Error al confirmar la transacción" });
                    });
                }
                // Responde con éxito si todo se completó correctamente
                res.status(201).json({
                    message: "Oferta de trabajo agregada con éxito",
                    offerId: result.insertId,
                });
            });
        });
    });
});
router.get("/getImgJob", (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res.status(500).send("Error iniciando la transacción");
        }
        const query = "SELECT * FROM jobs_img";
        db_1.default.query(query, (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error("Error ejecutando la consulta:", error);
                    res.status(500).send("Error en la consulta");
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error("Error confirmando la transacción:", err);
                        res.status(500).send("Error confirmando la transacción");
                    });
                }
                res.json(results);
            });
        });
    });
});
router.get("/getSubCategoriesByCategory/:id_job_cat", (req, res) => {
    const { id_job_cat } = req.params;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res.status(500).send("Error iniciando la transacción");
        }
        const query = "SELECT * FROM jobs_subcat WHERE id_job_cat = ?";
        db_1.default.query(query, [id_job_cat], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error("Error ejecutando la consulta:", error);
                    res.status(500).send("Error en la consulta");
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error("Error confirmando la transacción:", err);
                        res.status(500).send("Error confirmando la transacción");
                    });
                }
                res.json(results);
            });
        });
    });
});
router.get("/getAlljobsOffers", (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res.status(500).send("Error iniciando la transacción");
        }
        // Parámetros de paginación
        const page = parseInt(req.query.page || "1", 10);
        const pageSize = parseInt(req.query.pageSize || "4", 10);
        const offset = (page - 1) * pageSize;
        // Consulta para obtener los registros con paginación
        const query = `
    SELECT 
      jobs_offers.*, 
      salon.name AS salon_name
    FROM 
      jobs_offers
    LEFT JOIN 
      salon 
    ON 
      jobs_offers.id_salon = salon.id_salon
    LIMIT ? OFFSET ?;
  `;
        // Consulta para contar el total de registros
        const countQuery = `
      SELECT COUNT(*) AS total 
      FROM jobs_offers;
    `;
        // Ejecutar la consulta principal
        db_1.default.query(query, [pageSize, offset], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error("Error ejecutando la consulta principal:", error);
                    res.status(500).send("Error en la consulta principal");
                });
            }
            // Ejecutar la consulta de conteo
            db_1.default.query(countQuery, (countError, countResults) => {
                if (countError) {
                    return db_1.default.rollback(() => {
                        console.error("Error ejecutando la consulta de conteo:", countError);
                        res.status(500).send("Error en la consulta de conteo");
                    });
                }
                db_1.default.commit((commitErr) => {
                    var _a;
                    if (commitErr) {
                        return db_1.default.rollback(() => {
                            console.error("Error confirmando la transacción:", commitErr);
                            res.status(500).send("Error confirmando la transacción");
                        });
                    }
                    // Respuesta al cliente
                    const totalItems = ((_a = countResults[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
                    res.json({
                        jobs: results,
                        total: totalItems,
                        currentPage: page,
                        pageSize: pageSize,
                    });
                });
            });
        });
    });
});
router.get("/getAlljobsOffersByUser/:id_user", (req, res) => {
    const { id_user } = req.params;
    // Decodificar el id_user
    const id_user_decode = (0, decodeToken_1.default)(id_user);
    if (!id_user_decode) {
        return res
            .status(400)
            .json({ message: "Token inválido o no se pudo decodificar" });
    }
    const page = parseInt(req.query.page || "1", 10);
    const pageSize = parseInt(req.query.pageSize || "4", 10);
    const offset = (page - 1) * pageSize;
    // Query para obtener los registros paginados
    const query = `
    SELECT 
      jobs_offers.*, 
      salon.name AS salon_name
    FROM 
      jobs_offers
    LEFT JOIN 
      salon 
    ON 
      jobs_offers.id_salon = salon.id_salon
    WHERE 
      jobs_offers.id_user = ?
    LIMIT ? OFFSET ?;
  `;
    // Query para obtener el total de registros
    const countQuery = `
    SELECT COUNT(*) AS total 
    FROM jobs_offers 
    WHERE id_user = ?;
  `;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res.status(500).json({ error: "Error iniciando la transacción" });
        }
        // Ejecutar la consulta principal
        db_1.default.query(query, [id_user_decode, pageSize, offset], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error("Error ejecutando la consulta principal:", error);
                    res
                        .status(500)
                        .json({ error: "Error ejecutando la consulta principal" });
                });
            }
            // Ejecutar la consulta de conteo
            db_1.default.query(countQuery, [id_user_decode], (countError, countResults) => {
                if (countError) {
                    return db_1.default.rollback(() => {
                        console.error("Error ejecutando la consulta de conteo:", countError);
                        res
                            .status(500)
                            .json({ error: "Error ejecutando la consulta de conteo" });
                    });
                }
                // Confirmar la transacción
                db_1.default.commit((commitErr) => {
                    var _a;
                    if (commitErr) {
                        return db_1.default.rollback(() => {
                            console.error("Error confirmando la transacción:", commitErr);
                            res
                                .status(500)
                                .json({ error: "Error confirmando la transacción" });
                        });
                    }
                    // Respuesta al cliente
                    const totalItems = ((_a = countResults[0]) === null || _a === void 0 ? void 0 : _a.total) || 0; // Validar existencia del conteo
                    res.json({
                        jobs: results,
                        total: totalItems,
                        currentPage: page,
                        pageSize: pageSize,
                    });
                });
            });
        });
    });
});
router.get("/getSalonsByUser/:id_user", (req, res) => {
    const { id_user } = req.params;
    // Decodificar el id_user
    const id_user_decode = (0, decodeToken_1.default)(id_user);
    if (!id_user_decode) {
        return res
            .status(400)
            .json({ message: "Token inválido o no se pudo decodificar" });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error iniciando la transacción:", err);
            return res
                .status(500)
                .json({ message: "Error iniciando la transacción" });
        }
        // Consulta con INNER JOIN para obtener los nombres de los salones
        const query = `
        SELECT s.id_salon, s.name AS salon_name
        FROM salon s
        INNER JOIN user_salon us ON s.id_salon = us.id_salon
        WHERE us.id_user = ?
      `;
        db_1.default.query(query, [id_user_decode], (error, results) => {
            if (error) {
                console.error("Error ejecutando la consulta:", error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ message: "Error ejecutando la consulta" });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error("Error confirmando la transacción:", commitErr);
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ message: "Error confirmando la transacción" });
                    });
                }
                res.json(results);
                //console.log(results);
            });
        });
    });
});
router.get("/getJobInscriptions/:id_job_offer", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const jobId = req.params.id_job_offer;
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '4', 10); // Tamaño de página
    const offset = (page - 1) * pageSize;
    // Consulta principal con paginación
    const query = `
    SELECT 
      u.name AS user_name,
      u.lastname AS user_last_name,
      u.email AS user_email,
      js.id_user_job_subscriptions,
      js.date_subscriptions,
      js.path_curriculum,
      js.work_presentation
    FROM user_job_subscriptions js
    INNER JOIN user u ON js.id_user = u.id_user
    WHERE js.id_job_offer = ?
    LIMIT ? OFFSET ?;
  `;
    // Consulta para contar el total de registros
    const countQuery = `
    SELECT COUNT(*) AS total
    FROM user_job_subscriptions js
    WHERE js.id_job_offer = ?;
  `;
    db_1.default.beginTransaction((err) => {
        if (err) {
            return res
                .status(500)
                .json({ error: "Error al iniciar la transacción", details: err });
        }
        // Ejecutar la consulta principal con paginación
        db_1.default.query(query, [jobId, pageSize, offset], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    res
                        .status(500)
                        .json({ error: "Error al ejecutar la consulta", details: error });
                });
            }
            // Ejecutar la consulta de conteo
            db_1.default.query(countQuery, [jobId], (countError, countResults) => {
                if (countError) {
                    return db_1.default.rollback(() => {
                        res
                            .status(500)
                            .json({ error: "Error al contar los registros", details: countError });
                    });
                }
                const totalRecords = countResults[0].total; // Total de registros
                const totalPages = Math.ceil(totalRecords / pageSize); // Total de páginas
                db_1.default.commit((commitErr) => {
                    if (commitErr) {
                        return db_1.default.rollback(() => {
                            res
                                .status(500)
                                .json({
                                error: "Error al confirmar la transacción",
                                details: commitErr,
                            });
                        });
                    }
                    // Responder con datos paginados y metainformación
                    res.status(200).json({
                        message: "Datos obtenidos con éxito",
                        data: results,
                        meta: {
                            currentPage: page,
                            pageSize: pageSize,
                            totalRecords: totalRecords,
                            totalPages: totalPages,
                        },
                    });
                });
            });
        });
    });
}));
exports.default = router;
