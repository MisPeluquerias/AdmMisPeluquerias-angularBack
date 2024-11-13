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
const nodemailer = require("nodemailer");
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logoPath = path_1.default.join(__dirname, '../../../dist/assets/img/logo-mis-peluquerias-bk.jpg');
const logoBase64 = fs_1.default.readFileSync(logoPath, "base64");
const logoUrl = `data:image/jpeg;base64,${logoBase64}`;
router.get("/getAllReclamations", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = "1", pageSize = "3", filterState, } = req.query;
    const pageNumber = parseInt(page, 10);
    const pageSizeNumber = parseInt(pageSize, 10);
    const offset = (pageNumber - 1) * pageSizeNumber;
    // Base query para obtener las reclamaciones con sus relaciones
    let query = `
    SELECT sr.*, 
           u.name AS user_name, 
           u.email, 
           c.name AS city_name, 
           p.name AS province_name
    FROM salon_reclamacion sr
    INNER JOIN user u ON sr.id_user = u.id_user
    INNER JOIN city c ON sr.id_city = c.id_city
    INNER JOIN province p ON c.id_province = p.id_province
    WHERE 1=1
  `;
    // Manejo de filtros
    const queryParams = [];
    if (filterState && filterState !== "%%") {
        query += " AND sr.state = ?";
        queryParams.push(filterState);
    }
    // Añadir límites de paginación al final de la consulta
    query += " LIMIT ?, ?";
    queryParams.push(offset, pageSizeNumber);
    // Consulta para contar el total de elementos sin paginación
    const countQuery = `
    SELECT COUNT(*) AS totalItems 
    FROM salon_reclamacion sr
    INNER JOIN user u ON sr.id_user = u.id_user
    INNER JOIN city c ON sr.id_city = c.id_city
    INNER JOIN province p ON c.id_province = p.id_province
    WHERE 1=1
  ` + (filterState && filterState !== "%%" ? " AND sr.state = ?" : "");
    // Iniciar la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res
                .status(500)
                .json({ error: "An error occurred while starting transaction" });
        }
        // Ejecutar la consulta principal con filtros y paginación
        db_1.default.query(query, queryParams, (error, results) => {
            if (error) {
                return db_1.default.rollback(() => {
                    console.error("Error fetching data:", error);
                    res
                        .status(500)
                        .json({ error: "An error occurred while fetching data" });
                });
            }
            // Ejecutar la consulta de conteo total
            db_1.default.query(countQuery, filterState && filterState !== "%%" ? [filterState] : [], (countError, countResults) => {
                if (countError) {
                    return db_1.default.rollback(() => {
                        console.error("Error fetching count:", countError);
                        res
                            .status(500)
                            .json({ error: "An error occurred while fetching data count" });
                    });
                }
                // Commit de la transacción
                db_1.default.commit((commitError) => {
                    if (commitError) {
                        return db_1.default.rollback(() => {
                            console.error("Error committing transaction:", commitError);
                            res
                                .status(500)
                                .json({
                                error: "An error occurred while committing transaction",
                            });
                        });
                    }
                    // Manejo de los resultados de la consulta de conteo
                    const totalItems = countResults[0].totalItems;
                    const totalPages = Math.ceil(totalItems / pageSizeNumber);
                    res.json({
                        data: results,
                        pagination: {
                            page: pageNumber,
                            pageSize: pageSizeNumber,
                            totalItems,
                            totalPages,
                        },
                    });
                });
            });
        });
    });
}));
router.put("/updateStateReclamation", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_salon_reclamacion, state, id_user, salon_name, email } = req.body;
    //console.log('Reclamación recibida en el servidor:', req.body);
    if (!id_salon_reclamacion || !state || !id_user || !salon_name) {
        return res
            .status(400)
            .json({
            error: "Faltan datos requeridos: id_salon_reclamacion, state, id_user o salon_name",
        });
    }
    try {
        yield new Promise((resolve, reject) => {
            db_1.default.beginTransaction((err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const updateStateQuery = `
      UPDATE salon_reclamacion
      SET state = ?
      WHERE id_salon_reclamacion = ?
    `;
        const updateResults = yield new Promise((resolve, reject) => {
            db_1.default.query(updateStateQuery, [state, id_salon_reclamacion], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results);
            });
        });
        if (updateResults.affectedRows === 0) {
            throw new Error("No se encontró la reclamación con el ID proporcionado.");
        }
        if (state === "Pendiente" || state === "En revision") {
            // Primero obtenemos el id_salon por nombre del salón
            const getSalonIdQuery = `
        SELECT id_salon FROM salon WHERE name = ?
      `;
            const salonResult = yield new Promise((resolve, reject) => {
                db_1.default.query(getSalonIdQuery, [salon_name], (error, results) => {
                    if (error)
                        return reject(error);
                    resolve(results);
                });
            });
            // Verificamos si se encontró el salón
            if (salonResult.length === 0) {
                throw new Error("No se encontró un salón con el nombre proporcionado.");
            }
            const id_salon = salonResult[0].id_salon;
            // Luego actualizamos el estado del salón a 'Validado'
            const updateSalonStateQuery = `
        UPDATE salon SET state = 'No reclamado' WHERE id_salon = ?
      `;
            const updateSalonResults = yield new Promise((resolve, reject) => {
                db_1.default.query(updateSalonStateQuery, [id_salon], (error, results) => {
                    if (error)
                        return reject(error);
                    resolve(results);
                });
            });
        }
        if (state === "Validado") {
            // Primero obtenemos el id_salon por nombre del salón
            const getSalonIdQuery = `
        SELECT id_salon FROM salon WHERE name = ?
      `;
            const salonResult = yield new Promise((resolve, reject) => {
                db_1.default.query(getSalonIdQuery, [salon_name], (error, results) => {
                    if (error)
                        return reject(error);
                    resolve(results);
                });
            });
            // Verificamos si se encontró el salón
            if (salonResult.length === 0) {
                throw new Error("No se encontró un salón con el nombre proporcionado.");
            }
            const id_salon = salonResult[0].id_salon;
            // Luego actualizamos el estado del salón a 'Validado'
            const updateSalonStateQuery = `
        UPDATE salon SET state = 'Validado' WHERE id_salon = ?
      `;
            const updateSalonResults = yield new Promise((resolve, reject) => {
                db_1.default.query(updateSalonStateQuery, [id_salon], (error, results) => {
                    if (error)
                        return reject(error);
                    resolve(results);
                });
            });
            // Verificamos si la actualización fue exitosa
            if (updateSalonResults.affectedRows === 0) {
                throw new Error("Error al actualizar el estado del salón.");
            }
        }
        // Acción para estado 'Reclamado'
        if (state === "Reclamado") {
            try {
                // Obtener el id_salon basado en el nombre del salón
                const getSalonIdQuery = `
          SELECT id_salon FROM salon WHERE name = ?
        `;
                const salonResult = yield new Promise((resolve, reject) => {
                    db_1.default.query(getSalonIdQuery, [salon_name], (error, results) => {
                        if (error)
                            return reject(error);
                        resolve(results);
                    });
                });
                if (salonResult.length === 0) {
                    throw new Error("No se encontró un salón con el nombre proporcionado.");
                }
                const id_salon = salonResult[0].id_salon;
                // Insertar el usuario en user_salon
                const insertUserSalonQuery = `
          INSERT INTO user_salon (id_user, id_salon)
          VALUES (?, ?)
        `;
                const insertResults = yield new Promise((resolve, reject) => {
                    db_1.default.query(insertUserSalonQuery, [id_user, id_salon], (error, results) => {
                        if (error)
                            return reject(error);
                        resolve(results);
                    });
                });
                if (insertResults.affectedRows === 0) {
                    throw new Error("Error al insertar el registro en la tabla user_salon.");
                }
                // Actualizar el estado del salón a 'Reclamado'
                const updateSalonStateQuery = `
          UPDATE salon
          SET state = 'Reclamado'
          WHERE id_salon = ?
        `;
                yield new Promise((resolve, reject) => {
                    db_1.default.query(updateSalonStateQuery, [id_salon], (error, results) => {
                        if (error)
                            return reject(error);
                        resolve(results);
                    });
                });
                // Actualizar el permiso del usuario a 'salon'
                const updatePermissionQuery = `
          UPDATE user
          SET permiso = 'salon'
          WHERE id_user = ?
        `;
                yield new Promise((resolve, reject) => {
                    db_1.default.query(updatePermissionQuery, [id_user], (error, results) => {
                        if (error)
                            return reject(error);
                        // Aseguramos que el resultado sea del tipo esperado
                        const result = results;
                        // Verificamos si hubo filas afectadas
                        if (result.affectedRows === 0) {
                            return reject(new Error("No se encontró el usuario con el ID proporcionado."));
                        }
                        resolve(result);
                    });
                });
                // Enviar correo si el email está definido y no es vacío
                if (email && email.trim() !== "") {
                    const transporter = nodemailer.createTransport({
                        host: "mail.mispeluquerias.com",
                        port: 465,
                        secure: true,
                        auth: {
                            user: "comunicaciones@mispeluquerias.com",
                            pass: "MisP2024@",
                        },
                    });
                    const mailOptions = {
                        from: '"mispeluquerias.com" <comunicaciones@mispeluquerias.com>',
                        to: email,
                        subject: "Reclamación Reclamada",
                        html: `
              <div style="text-align: center;">
                <img src="${logoUrl}" alt="Logo de Mis Peluquerías" style="width: 400px; border-radius: 4px;box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); margin-bottom: 20px;" />
              </div>
              <p>¡Enhorabuena! Tu reclamación ha sido registrada exitosamente para el salón ${salon_name}.</p>
              <p>Para administrar tu establecimiento, visita la plataforma 
                <a href="https://adm.mispeluquerias.com/login" target="_blank" style="color: #007bff; text-decoration: underline;">
                  www.adm.mispeluquerias.com
                </a> introduciendo sus credenciales de usuario.
              </p>
              <p>Por favor, no respondas a este correo.</p>
            `,
                    };
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error instanceof Error) {
                            console.error("Error al enviar el correo:", error.message);
                        }
                        else {
                            console.log("Correo enviado:", info.response);
                        }
                    });
                }
                else {
                    console.error("El correo electrónico del usuario no está definido o es inválido.");
                }
            }
            catch (error) {
                console.error('Error durante la actualización de la reclamación a "Reclamado":', error);
                throw error;
            }
        }
        // Acción para estado 'Pendiente' o 'En revisión': eliminar el registro de user_salon
        if (state === "Pendiente" ||
            state === "En revisión" ||
            state === "Validado") {
            const deleteUserSalonQuery = `
        DELETE FROM user_salon
        WHERE id_user = ? AND id_salon = (
          SELECT id_salon FROM salon WHERE name = ?
        )
      `;
            const deleteResults = yield new Promise((resolve, reject) => {
                db_1.default.query(deleteUserSalonQuery, [id_user, salon_name], (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(results);
                });
            });
            if (deleteResults.affectedRows > 0) {
                // Actualizar el permiso del usuario a 'client' después de eliminar
                const updateToClientQuery = `
          UPDATE user
          SET permiso = 'client'
          WHERE id_user = ?
        `;
                yield new Promise((resolve, reject) => {
                    db_1.default.query(updateToClientQuery, [id_user], (error, results) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve(results);
                    });
                });
            }
            else {
                //console.log('No se encontró ningún registro en user_salon para eliminar.');
            }
        }
        yield new Promise((resolve, reject) => {
            db_1.default.commit((err) => {
                if (err) {
                    return db_1.default.rollback(() => {
                        reject(err);
                    });
                }
                resolve();
            });
        });
        res.json({ message: "Reclamación y permisos actualizados exitosamente." });
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Error al actualizar la reclamación o permisos:", error.message);
        }
        else {
            console.error("Error desconocido al actualizar la reclamación o permisos:", error);
        }
        db_1.default.rollback(() => {
            res
                .status(500)
                .json({
                error: "Ocurrió un error al actualizar la reclamación o los permisos del usuario.",
            });
        });
    }
}));
exports.default = router;
