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
const router = express_1.default.Router();
router.get('/count', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Inicia la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ error: 'Error al iniciar la transacción' });
        }
        // Consulta para contar el total de filas en `alert_admin`
        const query = 'SELECT COUNT(*) AS total FROM alert_admin';
        db_1.default.query(query, (err, results) => {
            if (err) {
                // Si hay un error, deshacer la transacción
                return db_1.default.rollback(() => {
                    console.error('Error al contar las filas:', err);
                    res.status(500).json({ error: 'Error al contar las filas' });
                });
            }
            // Confirmar la transacción si todo está bien
            db_1.default.commit((err) => {
                if (err) {
                    // Si hay un error al confirmar, deshacer la transacción
                    return db_1.default.rollback(() => {
                        console.error('Error al confirmar la transacción:', err);
                        res.status(500).json({ error: 'Error al confirmar la transacción' });
                    });
                }
                // Devuelve el total de filas
                const total = results[0].total;
                res.status(200).json({ total });
            });
        });
    });
}));
router.get('/all', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ error: 'Error al iniciar la transacción' });
        }
        // Consulta para seleccionar todos los datos de `alert_admin`
        const query = 'SELECT * FROM alert_admin';
        // Ejecutar la consulta
        db_1.default.query(query, (err, results) => {
            if (err) {
                // Si hay un error en la consulta, hacer rollback de la transacción
                return db_1.default.rollback(() => {
                    console.error('Error al obtener los datos:', err);
                    res.status(500).json({ error: 'Error al obtener los datos de alert_admin' });
                });
            }
            // Confirmar la transacción si la consulta fue exitosa
            db_1.default.commit((err) => {
                if (err) {
                    // Si hay un error al confirmar, hacer rollback
                    return db_1.default.rollback(() => {
                        console.error('Error al confirmar la transacción:', err);
                        res.status(500).json({ error: 'Error al confirmar la transacción' });
                    });
                }
                // Enviar los resultados al cliente en formato JSON
                res.status(200).json(results);
            });
        });
    });
}));
router.delete('/delete/:id_alert_admin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_alert_admin } = req.params;
    //console.log(id_alert_admin);
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ error: 'Error al iniciar la transacción' });
        }
        const deleteQuery = 'DELETE FROM alert_admin WHERE id_alert_admin = ?';
        db_1.default.query(deleteQuery, [id_alert_admin], (err, results) => {
            if (err) {
                return db_1.default.rollback(() => {
                    console.error('Error al eliminar la notificación:', err);
                    res.status(500).json({ error: 'Error al eliminar la notificación' });
                });
            }
            if (results.affectedRows === 0) {
                // Si no se encontró la notificación con el ID proporcionado
                return db_1.default.rollback(() => {
                    res.status(404).json({ error: 'Notificación no encontrada' });
                });
            }
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        console.error('Error al confirmar la transacción:', err);
                        res.status(500).json({ error: 'Error al confirmar la transacción' });
                    });
                }
                // Responder con un mensaje de éxito
                res.status(200).json({ message: 'Notificación eliminada con éxito' });
            });
        });
    });
}));
exports.default = router;
