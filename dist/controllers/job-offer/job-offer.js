"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../../db/db"));
const body_parser_1 = __importDefault(require("body-parser"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get('/getCategoriesJob', (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }
        const query = 'SELECT * FROM jobs_cat';
        db_1.default.query(query, (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});
// Endpoint para agregar una oferta de trabajo con transacción
router.post('/addJobOffer', (req, res) => {
    const { category, subcategory, description, requirements, salary, img_job_path } = req.body;
    // Valida que todos los campos necesarios estén presentes
    if (!category || !subcategory || !description || !requirements || !salary || !img_job_path) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    // Inicia la transacción
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error('Error al iniciar la transacción:', transactionError);
            return res.status(500).json({ error: 'Error al iniciar la transacción' });
        }
        // Consulta para insertar la oferta de trabajo en la tabla
        const query = `
        INSERT INTO jobs_offers (category, sucategory, description, requirements, salary, img_job_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
        // Ejecuta la consulta dentro de la transacción
        db_1.default.query(query, [category, subcategory, description, requirements, salary, img_job_path], (error, results) => {
            if (error) {
                // Realiza un rollback si ocurre un error
                return db_1.default.rollback(() => {
                    console.error('Error al insertar la oferta de trabajo:', error);
                    res.status(500).json({ error: 'Error al insertar la oferta de trabajo' });
                });
            }
            // Cast explícito para que TypeScript entienda que `results` tiene `insertId`
            const result = results;
            // Realiza el commit si la inserción fue exitosa
            db_1.default.commit((commitError) => {
                if (commitError) {
                    // Realiza un rollback si ocurre un error durante el commit
                    return db_1.default.rollback(() => {
                        console.error('Error al confirmar la transacción:', commitError);
                        res.status(500).json({ error: 'Error al confirmar la transacción' });
                    });
                }
                // Responde con éxito si todo se completó correctamente
                res.status(201).json({ message: 'Oferta de trabajo agregada con éxito', offerId: result.insertId });
            });
        });
    });
});
router.get('/getImgJob', (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }
        const query = 'SELECT * FROM jobs_img';
        db_1.default.query(query, (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});
router.get('/getSubCategoriesByCategory/:id_job_cat', (req, res) => {
    const { id_job_cat } = req.params;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }
        const query = 'SELECT * FROM jobs_subcat WHERE id_job_cat = ?';
        db_1.default.query(query, [id_job_cat], (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});
exports.default = router;
