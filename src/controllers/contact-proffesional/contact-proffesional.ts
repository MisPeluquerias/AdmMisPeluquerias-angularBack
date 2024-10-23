import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import { RowDataPacket } from 'mysql2';

const nodemailer = require('nodemailer');
const router = express.Router();
router.use(bodyParser.json());




const transporter = nodemailer.createTransport({
  host: 'mail.mispeluquerias.com', // Cambia esto por el host SMTP de tu proveedor
  port: 465, // Puerto SMTP seguro, usa 587 si el 465 no funciona
  secure: true, // true para el puerto 465, false para otros puertos como 587
  auth: {
    user: 'comunicaciones@mispeluquerias.com', // Tu dirección de correo
    pass: 'MisP2024@', // La contraseña de tu correo (verifica que sea correcta)
  },
});


router.post('/send-reply-contactProffesional', async (req, res) => {
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
    `,
  };

  try {
    // Enviar el correo
    const info = await transporter.sendMail(mailOptions);
    //console.log('Correo enviado:', info.messageId);

    // Inserción de la réplica en la base de datos
    const query = 'UPDATE contact_proffesional SET answer = ? WHERE id_contact = ?';
    connection.query(query, [replyMessage, id_contact], (dbError, result) => {
      if (dbError) {
        console.error('Error al insertar la réplica en la base de datos:', dbError);
        return res.status(500).json({ success: false, message: 'Error al insertar la réplica en la base de datos' });
      }

      // Enviar una respuesta JSON al frontend
      res.status(200).json({ success: true, message: 'Correo enviado con éxito y réplica almacenada' });
    });
  } catch (error) {
    // Manejar errores al enviar el correo
    console.error('Error al enviar el correo:', error);
    res.status(500).json({ success: false, message: 'Error al enviar el correo' });
  }
});


1
router.post('/send-new-email-contactProffesional', async (req, res) => {
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
    const info = await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'Correo enviado con éxito y réplica almacenada' });
  } catch (error) {
    // Manejar errores al enviar el correo
    console.error('Error al enviar el correo:', error);
    res.status(500).json({ success: false, message: 'Error al enviar el correo' });
  }
});



router.get('/getAllMessageContactProffesional', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
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
        (cp.name LIKE ? OR cp.email LIKE ? OR cp.phone LIKE ? OR cp.text LIKE ?) ORDER BY email
  `;
  const queryParams: any[] = [search, search, search, search];

  // Aplica los filtros si están presentes
 
  if (filterState && filterState !== '%%') {
    query += ' AND state = ?';
    queryParams.push(filterState);
  }

  // Añade los límites de paginación
  query += ' LIMIT ?, ?';
  queryParams.push(offset, pageSize);

  // Ejecuta la consulta principal
  connection.query(query, queryParams, (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'An error occurred while fetching data' });
      return;
    }

    // Ejecuta la consulta para contar los elementos totales
    connection.query('SELECT FOUND_ROWS() AS totalItems', (countError, countResults) => {
      if (countError) {
        console.error('Error fetching count:', countError);
        res.status(500).json({ error: 'An error occurred while fetching data count' });
        return;
      }

      const totalItems = (countResults as RowDataPacket[])[0]?.totalItems;
      res.json({ data: results, totalItems });
    });
  });
});


router.put('/updateStateContactProffesional', async (req, res) => {
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
    await new Promise((resolve, reject) => {
      connection.query(
        updateQuery,
        [state, id_contact], // Solo actualizar el estado
        (error, results) => {
          if (error) {
            console.error('Error updating contact:', error);
            return reject(error);
          }
          resolve(results);
        }
      );
    });

    // Respuesta exitosa
    res.json({ message: 'Contact state updated successfully' });
  } catch (error) {
    // Manejo de errores generales
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'An error occurred while updating contact' });
  }
});

export default router;
