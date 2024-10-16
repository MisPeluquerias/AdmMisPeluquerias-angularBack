import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import util from 'util';
import { OkPacket, ResultSetHeader } from 'mysql2'; // Asegúrate de importar estos tipos
const nodemailer = require('nodemailer');
const router = express.Router();
router.use(bodyParser.json());
import fs from 'fs';
import path from 'path';
import { RowDataPacket } from 'mysql2';

router.get('/getAllReclamations', async (req, res) => {
  const { page = '1', pageSize = '3', filterState } = req.query as { page?: string, pageSize?: string, filterState?: string };
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
  const queryParams: any[] = [];

  if (filterState && filterState !== '%%') {
    query += ' AND sr.state = ?';
    queryParams.push(filterState);
  }

  // Añadir límites de paginación al final de la consulta
  query += ' LIMIT ?, ?';
  queryParams.push(offset, pageSizeNumber);

  // Consulta para contar el total de elementos sin paginación
  const countQuery = `
    SELECT COUNT(*) AS totalItems 
    FROM salon_reclamacion sr
    INNER JOIN user u ON sr.id_user = u.id_user
    INNER JOIN city c ON sr.id_city = c.id_city
    INNER JOIN province p ON c.id_province = p.id_province
    WHERE 1=1
  ` + (filterState && filterState !== '%%' ? ' AND sr.state = ?' : '');

  // Iniciar la transacción
  connection.beginTransaction(err => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'An error occurred while starting transaction' });
    }

    // Ejecutar la consulta principal con filtros y paginación
    connection.query(query, queryParams, (error, results) => {
      if (error) {
        return connection.rollback(() => {
          console.error('Error fetching data:', error);
          res.status(500).json({ error: 'An error occurred while fetching data' });
        });
      }

      // Ejecutar la consulta de conteo total
      connection.query(countQuery, filterState && filterState !== '%%' ? [filterState] : [], (countError, countResults) => {
        if (countError) {
          return connection.rollback(() => {
            console.error('Error fetching count:', countError);
            res.status(500).json({ error: 'An error occurred while fetching data count' });
          });
        }

        // Commit de la transacción
        connection.commit(commitError => {
          if (commitError) {
            return connection.rollback(() => {
              console.error('Error committing transaction:', commitError);
              res.status(500).json({ error: 'An error occurred while committing transaction' });
            });
          }

          // Manejo de los resultados de la consulta de conteo
          const totalItems = (countResults as any)[0].totalItems;
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
});




router.put('/updateStateReclamation', async (req, res) => {
  const { id_salon_reclamacion, state, id_user, salon_name, email } = req.body;
  //console.log('Reclamación recibida en el servidor:', req.body);

  if (!id_salon_reclamacion || !state || !id_user || !salon_name) {
    return res.status(400).json({ error: 'Faltan datos requeridos: id_salon_reclamacion, state, id_user o salon_name' });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const updateStateQuery = `
      UPDATE salon_reclamacion
      SET state = ?
      WHERE id_salon_reclamacion = ?
    `;


    const updateResults = await new Promise<OkPacket>((resolve, reject) => {
      connection.query(updateStateQuery, [state, id_salon_reclamacion], (error: unknown, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results as OkPacket);
      });
    });

    if (updateResults.affectedRows === 0) {
      throw new Error('No se encontró la reclamación con el ID proporcionado.');
    }


    if (state === 'Pendiente' || state === 'En revision') {
      // Primero obtenemos el id_salon por nombre del salón
      const getSalonIdQuery = `
        SELECT id_salon FROM salon WHERE name = ?
      `;
    
      const salonResult = await new Promise<any[]>((resolve, reject) => {
        connection.query(getSalonIdQuery, [salon_name], (error: unknown, results) => {
          if (error) return reject(error);
          resolve(results as any[]);
        });
      });
    
      // Verificamos si se encontró el salón
      if (salonResult.length === 0) {
        throw new Error('No se encontró un salón con el nombre proporcionado.');
      }
    
      const id_salon = salonResult[0].id_salon;
    
      // Luego actualizamos el estado del salón a 'Validado'
      const updateSalonStateQuery = `
        UPDATE salon SET state = 'No reclamado' WHERE id_salon = ?
      `;
    
      const updateSalonResults = await new Promise<OkPacket>((resolve, reject) => {
        connection.query(updateSalonStateQuery, [id_salon], (error: unknown, results) => {
          if (error) return reject(error);
          resolve(results as OkPacket);
        });
      });
    }

    if (state === 'Validado') {
      // Primero obtenemos el id_salon por nombre del salón
      const getSalonIdQuery = `
        SELECT id_salon FROM salon WHERE name = ?
      `;
    
      const salonResult = await new Promise<any[]>((resolve, reject) => {
        connection.query(getSalonIdQuery, [salon_name], (error: unknown, results) => {
          if (error) return reject(error);
          resolve(results as any[]);
        });
      });
    
      // Verificamos si se encontró el salón
      if (salonResult.length === 0) {
        throw new Error('No se encontró un salón con el nombre proporcionado.');
      }
    
      const id_salon = salonResult[0].id_salon;
    
      // Luego actualizamos el estado del salón a 'Validado'
      const updateSalonStateQuery = `
        UPDATE salon SET state = 'Validado' WHERE id_salon = ?
      `;
    
      const updateSalonResults = await new Promise<OkPacket>((resolve, reject) => {
        connection.query(updateSalonStateQuery, [id_salon], (error: unknown, results) => {
          if (error) return reject(error);
          resolve(results as OkPacket);
        });
      });
    
      // Verificamos si la actualización fue exitosa
      if (updateSalonResults.affectedRows === 0) {
        throw new Error('Error al actualizar el estado del salón.');
      }
    }

    // Acción para estado 'Reclamado'
    if (state === 'Reclamado') {
      try {
        // Obtener el id_salon basado en el nombre del salón
        const getSalonIdQuery = `
          SELECT id_salon FROM salon WHERE name = ?
        `;
        const salonResult = await new Promise<any[]>((resolve, reject) => {
          connection.query(getSalonIdQuery, [salon_name], (error, results) => {
            if (error) return reject(error);
            resolve(results as any[]);
          });
        });
    
        if (salonResult.length === 0) {
          throw new Error('No se encontró un salón con el nombre proporcionado.');
        }
    
        const id_salon = salonResult[0].id_salon;
    
        // Insertar el usuario en user_salon
        const insertUserSalonQuery = `
          INSERT INTO user_salon (id_user, id_salon)
          VALUES (?, ?)
        `;
        const insertResults = await new Promise<OkPacket>((resolve, reject) => {
          connection.query(insertUserSalonQuery, [id_user, id_salon], (error, results) => {
            if (error) return reject(error);
            resolve(results as OkPacket);
          });
        });
    
        if (insertResults.affectedRows === 0) {
          throw new Error('Error al insertar el registro en la tabla user_salon.');
        }
    
        // Actualizar el estado del salón a 'Reclamado'
        const updateSalonStateQuery = `
          UPDATE salon
          SET state = 'Reclamado'
          WHERE id_salon = ?
        `;
        await new Promise<OkPacket>((resolve, reject) => {
          connection.query(updateSalonStateQuery, [id_salon], (error, results) => {
            if (error) return reject(error);
            resolve(results as OkPacket);
          });
        });
    
        // Actualizar el permiso del usuario a 'salon'
        const updatePermissionQuery = `
          UPDATE user
          SET permiso = 'salon'
          WHERE id_user = ?
        `;
        await new Promise<OkPacket>((resolve, reject) => {
          connection.query(updatePermissionQuery, [id_user], (error, results) => {
            if (error) return reject(error);
        
            // Aseguramos que el resultado sea del tipo esperado
            const result = results as OkPacket;
            
            // Verificamos si hubo filas afectadas
            if (result.affectedRows === 0) {
              return reject(new Error('No se encontró el usuario con el ID proporcionado.'));
            }
        
            resolve(result);
          });
        });
        
    
        // Enviar correo si el email está definido y no es vacío
        if (email && email.trim() !== '') {
          const transporter = nodemailer.createTransport({
            host: 'mail.mispeluquerias.com',
            port: 465,
            secure: true,
            auth: {
              user: 'comunicaciones@mispeluquerias.com',
              pass: 'MisP2024@',
            },
          });
    
          const mailOptions = {
            from: '"mispeluquerias.com" <comunicaciones@mispeluquerias.com>',
            to: email,
            subject: 'Reclamación Reclamada',
            html: `
              <p>¡Enhorabuena! Tu reclamación ha sido registrada exitosamente para el salón ${salon_name}.</p>
              <p>Para administrar tu establecimiento, visita la plataforma 
                <a href="https://adm.mispeluquerias.com/login" target="_blank" style="color: #007bff; text-decoration: underline;">
                  www.adm.mispeluquerias.com
                </a> introduciendo sus credenciales de usuario.
              </p>
              <p>Por favor, no respondas a este correo.</p>
            `,
          };
    
          transporter.sendMail(mailOptions, (error:any, info:any) => {
            if (error instanceof Error) {
              console.error('Error al enviar el correo:', error.message);
            } else {
              console.log('Correo enviado:', info.response);
            }
          });
        } else {
          console.error('El correo electrónico del usuario no está definido o es inválido.');
        }
    
      } catch (error) {
        console.error('Error durante la actualización de la reclamación a "Reclamado":', error);
        throw error;
      }
    }
    

    // Acción para estado 'Pendiente' o 'En revisión': eliminar el registro de user_salon
    if (state === 'Pendiente' || state === 'En revisión' || state === 'Validado') {
      const deleteUserSalonQuery = `
        DELETE FROM user_salon
        WHERE id_user = ? AND id_salon = (
          SELECT id_salon FROM salon WHERE name = ?
        )
      `;
      const deleteResults = await new Promise<OkPacket>((resolve, reject) => {
        connection.query(deleteUserSalonQuery, [id_user, salon_name], (error: unknown, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results as OkPacket);
        });
      });

      if (deleteResults.affectedRows > 0) {
        // Actualizar el permiso del usuario a 'client' después de eliminar
        const updateToClientQuery = `
          UPDATE user
          SET permiso = 'client'
          WHERE id_user = ?
        `;
        await new Promise<OkPacket>((resolve, reject) => {
          connection.query(updateToClientQuery, [id_user], (error: unknown, results) => {
            if (error) {
              return reject(error);
            }
            resolve(results as OkPacket);
          });
        });
      } else {
        
        //console.log('No se encontró ningún registro en user_salon para eliminar.');
      }
    }

    await new Promise<void>((resolve, reject) => {
      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => {
            reject(err);
          });
        }
        resolve();
      });
    });

    res.json({ message: 'Reclamación y permisos actualizados exitosamente.' });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error al actualizar la reclamación o permisos:', error.message);
    } else {
      console.error('Error desconocido al actualizar la reclamación o permisos:', error);
    }
    connection.rollback(() => {
      res.status(500).json({ error: 'Ocurrió un error al actualizar la reclamación o los permisos del usuario.' });
    });
  }
});






// Especifica la ruta correcta de MisPeluquerias-angularBack
const uploadsReclamationPath = path.join(__dirname, '../../../dist/uploads-reclamation');

router.post('/delete', async (req, res) => {
  const { id_salon_reclamacion } = req.body;

  if (!id_salon_reclamacion || !Array.isArray(id_salon_reclamacion) || id_salon_reclamacion.length === 0) {
    return res.status(400).json({ message: 'No hay reclamaciones para eliminar' });
  }

  try {
    // Obtener las reclamaciones para eliminar los archivos asociados
    const selectReclamationsQuery = `
      SELECT dnifront_path, dniback_path, file_path, invoice_path 
      FROM salon_reclamacion 
      WHERE id_salon_reclamacion IN (${id_salon_reclamacion.map(() => '?').join(',')})
    `;

    const reclamations = await new Promise<RowDataPacket[]>((resolve, reject) => {
      connection.query(selectReclamationsQuery, id_salon_reclamacion, (err, results:any) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Eliminar los archivos si existen
    for (const reclamation of reclamations) {
      const paths = [
        reclamation.dnifront_path,
        reclamation.dniback_path,
        reclamation.file_path,
        reclamation.invoice_path
      ];

      for (const fileUrl of paths) {
        if (fileUrl) {
          try {
            // Extraer el nombre del archivo desde la URL
            const fileName = path.basename(fileUrl); // Extrae solo el nombre del archivo
            const fullPath = path.join(uploadsReclamationPath, fileName); // Construir la ruta completa

            // Intentar eliminar el archivo desde el sistema de archivos
            fs.unlink(fullPath, (err) => {
              if (err && err.code === 'ENOENT') {
                console.warn(`El archivo no existe: ${fullPath}`);
              } else if (err) {
                console.error(`Error al eliminar el archivo: ${fullPath}`, err);
              } else {
                console.log(`Archivo eliminado: ${fullPath}`);
              }
            });
          } catch (error) {
            console.error(`Error al procesar la eliminación del archivo: ${fileUrl}`, error);
          }
        }
      }
    }

    // Eliminar las reclamaciones en la base de datos
    const deleteReclamationsSql = `
      DELETE FROM salon_reclamacion 
      WHERE id_salon_reclamacion IN (${id_salon_reclamacion.map(() => '?').join(',')})
    `;

    await new Promise<void>((resolve, reject) => {
      connection.query(deleteReclamationsSql, id_salon_reclamacion, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Responder al cliente
    res.json({ message: 'Reclamaciones e imágenes eliminadas correctamente' });

  } catch (error) {
    console.error('Error al eliminar las reclamaciones o las imágenes:', error);
    res.status(500).json({ message: 'Error al eliminar las reclamaciones o las imágenes' });
  }
});


export default router;
