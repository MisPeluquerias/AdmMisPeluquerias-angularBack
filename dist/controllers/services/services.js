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
      GROUP_CONCAT(sn.name ORDER BY sn.name SEPARATOR ', ') AS subservices,
      GROUP_CONCAT(sn.id_service_type ORDER BY sn.id_service_type SEPARATOR ', ') AS service_type_ids
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
router.post('/addService', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, subservices } = req.body;
    if (!name || !Array.isArray(subservices) || subservices.length === 0) {
        return res.status(400).json({ error: 'Nombre del servicio y subservicios son necesarios' });
    }
    // Usamos una transacción para asegurar que se añadan tanto el servicio como los subservicios
    const queryService = 'INSERT INTO service (name, id_salon) VALUES (?, 0)';
    const querySubservice = 'INSERT INTO service_type (id_service, name) VALUES (?, ?)';
    try {
        db_1.default.beginTransaction((transactionError) => __awaiter(void 0, void 0, void 0, function* () {
            if (transactionError) {
                console.error('Error starting transaction:', transactionError);
                return res.status(500).json({ error: 'Transaction failed' });
            }
            // Insertar el servicio
            db_1.default.query(queryService, [name], (error, result) => {
                if (error) {
                    db_1.default.rollback(() => {
                        console.error('Error inserting service:', error);
                        res.status(500).json({ error: 'Error inserting service' });
                    });
                    return;
                }
                const serviceId = result.insertId; // Asegúrate de obtener el serviceId correctamente
                // Insertar los subservicios asociados
                const subservicePromises = subservices.map(subservice => {
                    return new Promise((resolve, reject) => {
                        db_1.default.query(querySubservice, [serviceId, subservice], (subError, subResult) => {
                            if (subError) {
                                return reject(subError);
                            }
                            resolve(subResult);
                        });
                    });
                });
                // Ejecutar todas las promesas de inserción de subservicios
                Promise.all(subservicePromises)
                    .then(() => {
                    db_1.default.commit(commitError => {
                        if (commitError) {
                            db_1.default.rollback(() => {
                                console.error('Error committing transaction:', commitError);
                                res.status(500).json({ error: 'Error committing transaction' });
                            });
                        }
                        else {
                            res.status(201).json({ message: 'Servicio y subservicios creados con éxito' });
                        }
                    });
                })
                    .catch(subserviceError => {
                    db_1.default.rollback(() => {
                        console.error('Error inserting subservices:', subserviceError);
                        res.status(500).json({ error: 'Error inserting subservices' });
                    });
                });
            });
        }));
    }
    catch (error) {
        console.error('Error creating service and subservices:', error);
        res.status(500).json({ error: 'Error creating service and subservices' });
    }
}));
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
router.put('/updateSubservices/:service_type_ids', (req, res) => {
    const service_type_ids = req.params.service_type_ids.split(',').map((id) => parseInt(id, 10));
    const { subservices, id_service } = req.body;
    //console.log('Lista de IDs proporcionada por el frontend:', service_type_ids);
    //console.log('Subservicios enviados por el frontend:', subservices);
    //console.log('ID del servicio:', id_service);
    if (!subservices || subservices.length === 0 || !id_service) {
        console.error('Error: No se proporcionaron subservicios o ID del servicio.');
        return res.status(400).json({ error: 'Debe proporcionar al menos un subservicio y el ID del servicio.' });
    }
    // Obtener todos los `id_service_type` existentes para este `id_service`
    const existingQuery = 'SELECT id_service_type FROM service_type WHERE id_service = ?';
    db_1.default.query(existingQuery, [id_service], (err, results) => {
        if (err) {
            console.error('Error obteniendo subservicios existentes:', err);
            return res.status(500).json({ error: 'Error al obtener subservicios existentes.' });
        }
        const existingResults = results;
        const existingServiceTypeIds = existingResults.map((row) => row.id_service_type);
        //console.log('Subservicios existentes en la base de datos:', existingServiceTypeIds);
        // Identificar los `id_service_type` que deben eliminarse
        const idsToDelete = existingServiceTypeIds.filter(id => !service_type_ids.includes(id));
        //console.log('IDs a eliminar identificados:', idsToDelete);
        if (idsToDelete.length > 0) {
            const deletePromises = idsToDelete.map((id_service_type) => {
                //(`Intentando eliminar subservicio con id_service_type: ${id_service_type}`);
                const deleteQuery = `DELETE FROM service_type WHERE id_service_type = ?`;
                return new Promise((resolve, reject) => {
                    db_1.default.query(deleteQuery, [id_service_type], (error, results) => {
                        if (error) {
                            console.error('Error eliminando subservicio:', error);
                            reject(error);
                        }
                        else if (results.affectedRows > 0) {
                            //console.log(`Subservicio con id_service_type: ${id_service_type} eliminado correctamente.`);
                            resolve(null);
                        }
                        else {
                            console.log(`No se encontró subservicio con id_service_type: ${id_service_type} para eliminar.`);
                            resolve(null);
                        }
                    });
                });
            });
            // Ejecutar promesas de eliminación y continuar con la inserción/actualización
            Promise.all(deletePromises)
                .then(() => {
                handleUpdateAndInsert();
            })
                .catch((error) => {
                console.error('Error eliminando los subservicios:', error);
                res.status(500).json({ error: 'Error durante la eliminación de subservicios.' });
            });
        }
        else {
            // Si no hay nada que eliminar, continuar directamente con la inserción/actualización
            //console.log('No se encontraron subservicios para eliminar, pasando a la actualización/inserción.');
            handleUpdateAndInsert();
        }
        function handleUpdateAndInsert() {
            // Validar que el array `subservices[]` y `service_type_ids[]` tengan la misma longitud
            if (subservices.length < service_type_ids.length) {
                // Si hay menos subservicios que ids, se eliminan aquellos cuyo nombre es `null` o `undefined`
                const missingSubservices = service_type_ids.slice(subservices.length);
                const deleteMissingSubservicesPromises = missingSubservices.map((id_service_type) => {
                    //console.log(`Eliminando subservicio con id_service_type ${id_service_type} porque no tiene nombre asociado.`);
                    const deleteQuery = `DELETE FROM service_type WHERE id_service_type = ?`;
                    return new Promise((resolve, reject) => {
                        db_1.default.query(deleteQuery, [id_service_type], (error, results) => {
                            if (error) {
                                console.error('Error eliminando subservicio con id_service_type:', error);
                                reject(error);
                            }
                            else {
                                //console.log(`Subservicio con id_service_type ${id_service_type} eliminado correctamente.`);
                                resolve(null);
                            }
                        });
                    });
                });
                // Ejecutar promesas de eliminación para los subservicios faltantes
                Promise.all(deleteMissingSubservicesPromises)
                    .then(() => {
                    //console.log('Eliminación de subservicios faltantes completada.');
                    proceedWithUpdateAndInsert();
                })
                    .catch((error) => {
                    console.error('Error eliminando los subservicios faltantes:', error);
                    res.status(500).json({ error: 'Error durante la eliminación de subservicios faltantes.' });
                });
            }
            else {
                proceedWithUpdateAndInsert();
            }
        }
        function proceedWithUpdateAndInsert() {
            // Actualizar los subservicios existentes
            const updatePromises = service_type_ids.slice(0, subservices.length).map((id_service_type, index) => {
                const subserviceName = subservices[index];
                if (existingServiceTypeIds.includes(id_service_type)) {
                    if (!subserviceName) {
                        console.log(`No se puede actualizar subservicio con id_service_type: ${id_service_type} porque el nombre está indefinido.`);
                        return Promise.resolve(null);
                    }
                    console.log(`Actualizando subservicio con id_service_type: ${id_service_type}, nombre: ${subserviceName}`);
                    const updateQuery = `
            UPDATE service_type 
            SET name = ? 
            WHERE id_service_type = ?
          `;
                    return new Promise((resolve, reject) => {
                        db_1.default.query(updateQuery, [subserviceName, id_service_type], (error) => {
                            if (error) {
                                console.error('Error actualizando subservicio:', error);
                                reject(error);
                            }
                            else {
                                resolve(null);
                            }
                        });
                    });
                }
                else {
                    return Promise.resolve(null); // No hacer nada si no se encuentra
                }
            });
            // Insertar nuevos subservicios
            const newSubservices = subservices.slice(existingServiceTypeIds.length); // Solo los nuevos subservicios
            const insertPromises = newSubservices.map((subserviceName) => {
                //console.log(`Insertando nuevo subservicio: nombre: ${subserviceName}`);
                const insertQuery = `
          INSERT INTO service_type (id_service, name) VALUES (?, ?)
        `;
                return new Promise((resolve, reject) => {
                    db_1.default.query(insertQuery, [id_service, subserviceName], (error, results) => {
                        if (error) {
                            console.error('Error insertando nuevo subservicio:', error);
                            reject(error);
                        }
                        else {
                            resolve(null);
                        }
                    });
                });
            });
            // Ejecutar todas las promesas: actualización e inserción
            Promise.all([...updatePromises, ...insertPromises])
                .then(() => {
                //console.log('Actualización, inserción y eliminación de subservicios completada.');
                res.status(200).json({ success: true, message: 'Subservicios actualizados, insertados y eliminados con éxito.' });
            })
                .catch((error) => {
                console.error('Error durante la actualización/inserción:', error);
                res.status(500).json({ error: 'Error al procesar los subservicios.' });
            });
        }
    });
});
exports.default = router;
