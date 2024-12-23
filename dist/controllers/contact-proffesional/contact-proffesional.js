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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const nodemailer = require('nodemailer');
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const logoPath = path_1.default.join(__dirname, '../../../dist/assets/img/logo-mis-peluquerias-bk.jpg');
const logoBase64 = fs_1.default.readFileSync(logoPath, 'base64');
const logoUrl = `data:image/jpeg;base64,${logoBase64}`;
const transporter = nodemailer.createTransport({
    host: 'mail.mispeluquerias.com', // Cambia esto por el host SMTP de tu proveedor
    port: 465, // Puerto SMTP seguro, usa 587 si el 465 no funciona
    secure: true, // true para el puerto 465, false para otros puertos como 587
    auth: {
        user: 'comunicaciones@mispeluquerias.com', // Tu dirección de correo
        pass: 'MisP2024@', // La contraseña de tu correo (verifica que sea correcta)
    },
});
router.post('/send-reply-contactProffesional', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_contact, to, subject, message, replyMessage } = req.body;
    // Configuración del correo a enviar
    const mailOptions = {
        from: '"mispeluquerias.com" <comunicaciones@mispeluquerias.com>', // Remitente
        to, // Correo del destinatario
        subject, // Asunto del correo
        text: message, // Mensaje en texto plano
        html: `
      
      <p>${message}</p>
      <p>Por favor, no respondas directamente a este correo.</p>
      <p>Para responder, visita nuestra plataforma en 
        <a href="https://www.mispeluquerias.com/profesionales" target="_blank" style="color: #007bff; text-decoration: underline;">
          www.mispeluquerias.com/profesionales
        </a>.
      </p>
      <p>Atentamente el equipo de soporte de mispeluquerias.com</p>
      <div style="text-align: center;">
        <img src="${logoUrl}" alt="Logo de Mis Peluquerías" style="width: 400px; border-radius: 4px;box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); margin-bottom: 20px;" />
      </div>
    `,
    };
    try {
        // Enviar el correo
        const info = yield transporter.sendMail(mailOptions);
        //console.log('Correo enviado:', info.messageId);
        // Inserción de la réplica en la base de datos
        const query = 'UPDATE contact_proffesional SET answer = ? WHERE id_contact = ?';
        db_1.default.query(query, [replyMessage, id_contact], (dbError, result) => {
            if (dbError) {
                console.error('Error al insertar la réplica en la base de datos:', dbError);
                return res.status(500).json({ success: false, message: 'Error al insertar la réplica en la base de datos' });
            }
            // Enviar una respuesta JSON al frontend
            res.status(200).json({ success: true, message: 'Correo enviado con éxito y réplica almacenada' });
        });
    }
    catch (error) {
        // Manejar errores al enviar el correo
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ success: false, message: 'Error al enviar el correo' });
    }
}));
router.post('/send-new-email-contactProffesional', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { to, subject, message } = req.body;
    // Configuración del correo a enviar
    const mailOptions = {
        from: '"mispeluquerias.com" <comunicaciones@mispeluquerias.com>', // Remitente
        to, // Correo del destinatario
        subject, // Asunto del correo
        text: message, // Mensaje en texto plano
        html: `
      <p>${message}</p>
      <p>Por favor, no respondas directamente a este correo.</p>
      <p>Para responder, visita nuestra plataforma en 
         <a href="https://www.mispeluquerias.com/profesionales" target="_blank" style="color: #007bff; text-decoration: underline;">
          www.mispeluquerias.com/profesionales
        </a>.
      </p>
      <p>Atentamente el equipo de soporte de mispeluquerias.com</p>
      <div style="text-align: center;">
        <img src="${logoUrl}" alt="Logo de Mis Peluquerías" style="width: 400px; border-radius: 4px;box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); margin-bottom: 20px;" />
      </div>
    `,
    };
    try {
        // Enviar el correo
        const info = yield transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: 'Correo enviado con éxito y réplica almacenada' });
    }
    catch (error) {
        // Manejar errores al enviar el correo
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ success: false, message: 'Error al enviar el correo' });
    }
}));
router.get('/getAllMessageContactProffesional', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const filterState = req.query.filterState || null;
    // Inicializa la conexión
    db_1.default.beginTransaction((err) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (err) {
            console.error('Error starting transaction:', err);
            res.status(500).json({ error: 'An error occurred while starting the transaction' });
            return;
        }
        try {
            // Consulta principal con parámetros
            let query = `
        SELECT 
            SQL_CALC_FOUND_ROWS cp.*, 
            c.name AS city_name, 
            p.name AS province_name
        FROM 
            contact_proffesional cp
        LEFT JOIN 
            city c ON cp.id_city = c.id_city
        LEFT JOIN 
            province p ON cp.id_province = p.id_province
        WHERE 
            (cp.name LIKE ? OR cp.email LIKE ? OR cp.phone LIKE ? OR cp.text LIKE ?)
      `;
            const queryParams = [search, search, search, search];
            // Aplica los filtros si están presentes
            if (filterState) {
                query += ' AND cp.state = ?';
                queryParams.push(filterState);
            }
            // Añade los límites de paginación
            query += ' ORDER BY cp.email LIMIT ?, ?';
            queryParams.push(offset, pageSize);
            // Ejecuta la consulta principal
            const [results] = yield db_1.default.promise().query(query, queryParams);
            // Ejecuta la consulta para contar los elementos totales
            const [countResults] = yield db_1.default.promise().query('SELECT FOUND_ROWS() AS totalItems');
            const totalItems = ((_a = countResults[0]) === null || _a === void 0 ? void 0 : _a.totalItems) || 0;
            // Confirma la transacción
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    console.error('Error committing transaction:', commitErr);
                    res.status(500).json({ error: 'An error occurred while committing the transaction' });
                    return;
                }
                // Responde con los datos
                res.json({ data: results, totalItems });
            });
        }
        catch (error) {
            // Deshacer la transacción en caso de error
            db_1.default.rollback(() => {
                console.error('Error during transaction:', error);
                res.status(500).json({ error: 'An error occurred during the transaction' });
            });
        }
    }));
}));
router.put('/updateStateContactProffesional', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id_contact, state } = req.body;
        //console.log(req.body);
        // Validación de los datos
        if (!id_contact) {
            return res.status(400).json({ error: 'Missing id_contact' });
        }
        const updateQuery = `
      UPDATE contact_proffesional
      SET state = ?
      WHERE id_contact = ?
    `;
        // Ejecutar la consulta de actualización como una promesa
        yield new Promise((resolve, reject) => {
            db_1.default.query(updateQuery, [state, id_contact], // Solo actualizar el estado
            (error, results) => {
                if (error) {
                    console.error('Error updating contact:', error);
                    return reject(error);
                }
                resolve(results);
            });
        });
        // Respuesta exitosa
        res.json({ message: 'Contact state updated successfully' });
    }
    catch (error) {
        // Manejo de errores generales
        console.error('Error updating contact:', error);
        res.status(500).json({ error: 'An error occurred while updating contact' });
    }
}));
router.post('/deleteContactsProfessional', (req, res) => {
    const { ids } = req.body;
    console.log('IDs de contactos a eliminar:', ids);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron IDs válidos para eliminar.' });
    }
    // Inicia la transacción
    db_1.default.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
        }
        const query = `DELETE FROM contact_proffesional WHERE id_contact IN (?)`;
        // Ejecuta la consulta dentro de la transacción
        db_1.default.query(query, [ids], (error, results) => {
            if (error) {
                // Si hay un error, se revierte la transacción
                return db_1.default.rollback(() => {
                    console.error('Error al eliminar contactos:', error);
                    res.status(500).json({ message: 'Error al eliminar los contactos.', error });
                });
            }
            // Confirmamos la transacción si todo va bien
            db_1.default.commit((commitErr) => {
                if (commitErr) {
                    // Si hay un error al confirmar, se revierte la transacción
                    return db_1.default.rollback(() => {
                        console.error('Error al confirmar la transacción:', commitErr);
                        res.status(500).json({ message: 'Error al confirmar la transacción.', error: commitErr });
                    });
                }
                // Si todo sale bien, enviamos la respuesta de éxito
                res.status(200).json({ message: 'Contactos eliminados con éxito.', affectedRows: results.affectedRows });
            });
        });
    });
});
exports.default = router;
