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
router.get('/getAllServices', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const query = `
    SELECT SQL_CALC_FOUND_ROWS 
      s.id_service, 
      s.name AS service_name, 
      GROUP_CONCAT(sn.name ORDER BY sn.name SEPARATOR ', ') AS subservices
    FROM service s
    INNER JOIN service_type sn ON s.id_service = sn.id_service
    WHERE s.name LIKE ? OR sn.name LIKE ?
    GROUP BY s.id_service
    LIMIT ?, ?;
  `;
    const countQuery = 'SELECT FOUND_ROWS() AS totalItems';
    db_1.default.query(query, [search, search, offset, pageSize], (error, results) => {
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
router.post('/addService', (req, res) => {
    const { name, subservices } = req.body;
    // Verificar que name y subservices existan
    if (!name || !Array.isArray(subservices) || subservices.length === 0) {
        return res.status(400).json({ error: 'Nombre del servicio y subservicios son necesarios' });
    }
    // Si subservices es un array, asegúrate de eliminar espacios en blanco de cada subservicio
    const subservicesArray = subservices.map((subservice) => subservice.trim());
    const queryService = 'INSERT INTO service (name, id_salon) VALUES (?, 0)';
    const querySubservice = 'INSERT INTO service_type (id_service, name) VALUES (?, ?)';
    // Iniciar la transacción
    db_1.default.beginTransaction((transactionError) => {
        if (transactionError) {
            console.error('Error al iniciar la transacción:', transactionError);
            return res.status(500).json({ error: 'Error al iniciar la transacción' });
        }
        // Insertar el servicio
        db_1.default.query(queryService, [name], (serviceError, result) => {
            if (serviceError) {
                db_1.default.rollback(() => {
                    console.error('Error al insertar el servicio:', serviceError);
                    return res.status(500).json({ error: 'Error al insertar el servicio' });
                });
                return;
            }
            const serviceId = result.insertId;
            // Insertar subservicios asociados
            const subservicePromises = subservicesArray.map((subservice) => {
                return new Promise((resolve, reject) => {
                    db_1.default.query(querySubservice, [serviceId, subservice], (subError) => {
                        if (subError) {
                            return reject(subError);
                        }
                        resolve();
                    });
                });
            });
            // Ejecutar todas las inserciones de subservicios
            Promise.all(subservicePromises)
                .then(() => {
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        db_1.default.rollback(() => {
                            console.error('Error al confirmar la transacción:', commitError);
                            return res.status(500).json({ error: 'Error al confirmar la transacción' });
                        });
                    }
                    else {
                        return res.status(201).json({ message: 'Servicio y subservicios creados con éxito' });
                    }
                });
            })
                .catch((subserviceError) => {
                db_1.default.rollback(() => {
                    console.error('Error al insertar los subservicios:', subserviceError);
                    return res.status(500).json({ error: 'Error al insertar los subservicios' });
                });
            });
        });
    });
});
router.delete("/deleteServiceWithSubservices/:id_service", (req, res) => {
    const { id_service } = req.params;
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({
                success: false,
                message: "Error starting transaction",
                error: err,
            });
        }
        // Primero, elimina los subservicios asociados al servicio
        const deleteSubservicesQuery = "DELETE FROM service_type WHERE id_service = ?";
        db_1.default.query(deleteSubservicesQuery, [id_service], (err) => {
            if (err) {
                console.error("Error deleting subservices:", err);
                return db_1.default.rollback(() => {
                    res.status(500).json({
                        success: false,
                        message: "Error deleting subservices",
                        error: err,
                    });
                });
            }
            // Luego, elimina el servicio principal
            const deleteServiceQuery = "DELETE FROM service WHERE id_service = ?";
            db_1.default.query(deleteServiceQuery, [id_service], (err) => {
                if (err) {
                    console.error("Error deleting service:", err);
                    return db_1.default.rollback(() => {
                        res.status(500).json({
                            success: false,
                            message: "Error deleting service",
                            error: err,
                        });
                    });
                }
                // Si todo va bien, confirma la transacción
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
                    res.json({
                        success: true,
                        message: "Service and subservices deleted successfully",
                    });
                });
            });
        });
    });
});
router.put('/updateService/:id_service', (req, res) => {
    const { id_service } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'El nombre del servicio es requerido' });
    }
    const query = 'UPDATE service SET name = ? WHERE id_service = ?';
    db_1.default.query(query, [name, id_service], (error, results) => {
        if (error) {
            console.error('Error al actualizar el servicio:', error);
            return res.status(500).json({ error: 'Hubo un error al actualizar el servicio' });
        }
        // Verifica si la actualización afectó alguna fila
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.status(200).json({ success: true, message: 'Servicio actualizado correctamente' });
    });
});
router.put('/updateSubservices/:id_service', (req, res) => {
    const { id_service } = req.params;
    const { subservices } = req.body;
    if (!subservices || subservices.length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar al menos un subservicio.' });
    }
    // Eliminar todos los subservicios actuales para este servicio
    const deleteQuery = 'DELETE FROM service_type WHERE id_service = ?';
    db_1.default.query(deleteQuery, [id_service], (deleteError) => {
        if (deleteError) {
            console.error('Error eliminando subservicios:', deleteError);
            return res.status(500).json({ error: 'Error eliminando subservicios actuales.' });
        }
        // Insertar los nuevos subservicios
        const insertQuery = 'INSERT INTO service_type (id_service, name) VALUES ?';
        const subservicesData = subservices.map((subservice) => [id_service, subservice]);
        db_1.default.query(insertQuery, [subservicesData], (insertError) => {
            if (insertError) {
                console.error('Error insertando nuevos subservicios:', insertError);
                return res.status(500).json({ error: 'Error insertando nuevos subservicios.' });
            }
            res.status(200).json({ success: true, message: 'Subservicios actualizados con éxito.' });
        });
    });
});
exports.default = router;
