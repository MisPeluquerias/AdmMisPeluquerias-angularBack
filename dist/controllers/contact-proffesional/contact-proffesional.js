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
const nodemailer = require('nodemailer');
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
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
    `,
    };
    try {
        // Enviar el correo
        const info = yield transporter.sendMail(mailOptions);
        // Enviar una respuesta JSON para evitar errores en el frontend
        res.status(200).json({ success: true, message: 'Correo enviado con éxito' });
    }
    catch (error) {
        // Manejar errores y enviar una respuesta JSON
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ success: false, message: 'Error al enviar el correo' });
    }
}));
router.get('/getAllMessageContactProffesional', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const filterState = req.query.filterState ? req.query.filterState.toString() : '%%';
    // Inicializa la consulta base y los parámetros de la consulta
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
    if (filterState && filterState !== '%%') {
        query += ' AND state = ?';
        queryParams.push(filterState);
    }
    // Añade los límites de paginación
    query += ' LIMIT ?, ?';
    queryParams.push(offset, pageSize);
    // Ejecuta la consulta principal
    db_1.default.query(query, queryParams, (error, results) => {
        if (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'An error occurred while fetching data' });
            return;
        }
        // Ejecuta la consulta para contar los elementos totales
        db_1.default.query('SELECT FOUND_ROWS() AS totalItems', (countError, countResults) => {
            var _a;
            if (countError) {
                console.error('Error fetching count:', countError);
                res.status(500).json({ error: 'An error occurred while fetching data count' });
                return;
            }
            const totalItems = (_a = countResults[0]) === null || _a === void 0 ? void 0 : _a.totalItems;
            res.json({ data: results, totalItems });
        });
    });
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
exports.default = router;
