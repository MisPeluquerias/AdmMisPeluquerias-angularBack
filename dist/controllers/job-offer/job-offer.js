"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../../db/db"));
const body_parser_1 = __importDefault(require("body-parser"));
const decodeToken_1 = __importDefault(require("../../functions/decodeToken"));
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
    const { id_user, id_salon, category, subcategory, description, requirements, salary, img_job_path } = req.body;
    // Valida que todos los campos necesarios estén presentes
    if (!category || !subcategory || !description || !requirements || !salary || !img_job_path) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    const id_user_decode = (0, decodeToken_1.default)(id_user);
    console.log(id_user_decode, id_salon, category, subcategory, description, requirements, salary, img_job_path);
    // Inicia la transacción
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error('Error al iniciar la transacción:', transactionError);
            return res.status(500).json({ error: 'Error al iniciar la transacción' });
        }
        // Consulta para insertar la oferta de trabajo en la tabla
        const query = `
        INSERT INTO jobs_offers (id_user, id_salon, category, subcategory, description, requirements, salary, img_job_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
        // Ejecuta la consulta dentro de la transacción
        db_1.default.query(query, [id_user_decode, id_salon, category, subcategory, description, requirements, salary, img_job_path], (error, results) => {
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
router.get('/getAlljobsOffers', (req, res) => {
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }
        const query = 'SELECT * FROM jobs_offers';
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
router.get('/getAlljobsOffersByUser/:id_user', (req, res) => {
    const { id_user } = req.params;
    // Decodificar el id_user
    const id_user_decode = (0, decodeToken_1.default)(id_user);
    //console.log('id_user decodificado:', id_user_decode);
    if (!id_user_decode) {
        return res.status(400).json({ message: 'Token inválido o no se pudo decodificar' });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).json({ message: 'Error iniciando la transacción' });
        }
        const query = 'SELECT * FROM jobs_offers WHERE id_user = ?';
        db_1.default.query(query, [id_user_decode], (error, results) => {
            if (error) {
                console.error('Error ejecutando la consulta:', error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ message: 'Error ejecutando la consulta' });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error('Error confirmando la transacción:', commitErr);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ message: 'Error confirmando la transacción' });
                    });
                }
                res.json(results);
            });
        });
    });
});
router.get('/getSalonsByUser/:id_user', (req, res) => {
    const { id_user } = req.params;
    // Decodificar el id_user
    const id_user_decode = (0, decodeToken_1.default)(id_user);
    if (!id_user_decode) {
        return res.status(400).json({ message: 'Token inválido o no se pudo decodificar' });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).json({ message: 'Error iniciando la transacción' });
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
                console.error('Error ejecutando la consulta:', error);
                return db_1.default.rollback(() => {
                    res.status(500).json({ message: 'Error ejecutando la consulta' });
                });
            }
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error('Error confirmando la transacción:', commitErr);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ message: 'Error confirmando la transacción' });
                    });
                }
                res.json(results);
                //console.log(results);
            });
        });
    });
});
router.delete('/deleteJobOffer/:id_job_offer', (req, res) => {
    const { id_job_offer } = req.params;
    // Validar el ID
    if (!id_job_offer || isNaN(Number(id_job_offer))) {
        return res.status(400).json({ message: 'ID de la oferta no válido.' });
    }
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ message: 'Error interno del servidor.' });
        }
        const deleteOfferQuery = 'DELETE FROM jobs_offers WHERE id_job_offer = ?';
        // Cambiamos el tipo del resultado a ResultSetHeader
        db_1.default.query(deleteOfferQuery, [id_job_offer], (queryErr, result) => {
            if (queryErr) {
                console.error('Error al eliminar la oferta de empleo:', queryErr);
                return db_1.default.rollback(() => {
                    res.status(500).json({ message: 'Error interno del servidor.' });
                });
            }
            // Verificar si se eliminó alguna fila
            if (result.affectedRows === 0) {
                return db_1.default.rollback(() => {
                    res.status(404).json({ message: 'Oferta de empleo no encontrada.' });
                });
            }
            // Confirmar la transacción
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error('Error al confirmar la transacción:', commitErr);
                    return db_1.default.rollback(() => {
                        res.status(500).json({ message: 'Error interno del servidor.' });
                    });
                }
                return res.status(200).json({ message: 'Oferta de empleo eliminada con éxito.' });
            });
        });
    });
});
exports.default = router;
