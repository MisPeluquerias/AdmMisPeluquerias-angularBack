import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import { RowDataPacket } from 'mysql2';
import path from 'path';
import fs from 'fs';

const nodemailer = require('nodemailer');
const router = express.Router();
router.use(bodyParser.json());

const logoPath = path.join(__dirname, '../../../dist/assets/img/logo-mis-peluquerias-bk.jpg');
const logoBase64 = fs.readFileSync(logoPath, 'base64');
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
      <p>Atentamente el equipo de soporte de mispeluquerias.com</p>
      <div style="text-align: center;">
        <img src="${logoUrl}" alt="Logo de Mis Peluquerías" style="width: 400px; border-radius: 4px;box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); margin-bottom: 20px;" />
      </div>
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
      <p>Atentamente el equipo de soporte de mispeluquerias.com</p>
      <div style="text-align: center;">
        <img src="${logoUrl}" alt="Logo de Mis Peluquerías" style="width: 400px; border-radius: 4px;box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); margin-bottom: 20px;" />
      </div>
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
  const filterState = req.query.filterState || null;

  // Inicializa la conexión
  connection.beginTransaction(async (err) => {
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
      const queryParams: any[] = [search, search, search, search];

      // Aplica los filtros si están presentes
      if (filterState) {
        query += ' AND cp.state = ?';
        queryParams.push(filterState);
      }

      // Añade los límites de paginación
      query += ' ORDER BY cp.email LIMIT ?, ?';
      queryParams.push(offset, pageSize);

      // Ejecuta la consulta principal
      const [results] = await connection.promise().query(query, queryParams);

      // Ejecuta la consulta para contar los elementos totales
      const [countResults] = await connection.promise().query('SELECT FOUND_ROWS() AS totalItems');

      const totalItems = (countResults as RowDataPacket[])[0]?.totalItems || 0;

      // Confirma la transacción
      connection.commit((commitErr) => {
        if (commitErr) {
          console.error('Error committing transaction:', commitErr);
          res.status(500).json({ error: 'An error occurred while committing the transaction' });
          return;
        }

        // Responde con los datos
        res.json({ data: results, totalItems });
      });
    } catch (error) {
      // Deshacer la transacción en caso de error
      connection.rollback(() => {
        console.error('Error during transaction:', error);
        res.status(500).json({ error: 'An error occurred during the transaction' });
      });
    }
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


router.post('/deleteContactsProfessional', (req, res) => {
  const { ids } = req.body;

  console.log('IDs de contactos a eliminar:', ids);

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'No se proporcionaron IDs válidos para eliminar.' });
  }

  // Inicia la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error('Error al iniciar la transacción:', err);
      return res.status(500).json({ message: 'Error al iniciar la transacción.', error: err });
    }

    const query = `DELETE FROM contact_proffesional WHERE id_contact IN (?)`;

    // Ejecuta la consulta dentro de la transacción
    connection.query(query, [ids], (error: any, results: any) => {
      if (error) {
        // Si hay un error, se revierte la transacción
        return connection.rollback(() => {
          console.error('Error al eliminar contactos:', error);
          res.status(500).json({ message: 'Error al eliminar los contactos.', error });
        });
      }
    
      // Confirmamos la transacción si todo va bien
      connection.commit((commitErr: any) => {
        if (commitErr) {
          // Si hay un error al confirmar, se revierte la transacción
          return connection.rollback(() => {
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


export default router;
