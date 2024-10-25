import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import multer from "multer";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const router = express.Router();
router.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Si no se usan, cambialos a _
    const uploadDir = path.join(__dirname, "uploadsExcel");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

router.get("/getAllSalon", async (req, res) => {
  const page = parseInt((req.query.page as string) || "1", 10);
  const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : "%%";

  const query = `
    SELECT 
      SQL_CALC_FOUND_ROWS 
      s.*,
      GROUP_CONCAT(DISTINCT TRIM(REPLACE(c.categories, ' ;', '')) SEPARATOR '; ') AS categories
    FROM 
      salon s
    LEFT JOIN 
      categories c ON s.id_salon = c.id_salon
    WHERE 
      s.name LIKE ? OR s.email LIKE ? OR s.created_at LIKE ? OR s.phone LIKE ? OR s.active LIKE ? OR s.state LIKE ? OR c.categories LIKE ?
    GROUP BY 
      s.id_salon
    LIMIT ?, ?;
  `;

  const countQuery = "SELECT FOUND_ROWS() AS totalItems";

  connection.query(
    query,
    [search, search, search, search, search, search, search, offset, pageSize],
    (error, results) => {
      if (error) {
        console.error("Error fetching data:", error);
        res
          .status(500)
          .json({ error: "An error occurred while fetching data" });
        return;
      }

      connection.query(countQuery, (countError, countResults) => {
        if (countError) {
          console.error("Error fetching count:", countError);
          res
            .status(500)
            .json({ error: "An error occurred while fetching data count" });
          return;
        }

        const totalItems = (countResults as any)[0].totalItems;
        res.json({ data: results, totalItems });
      });
    }
  );
});



router.post("/updateExcel", upload.single("file"), async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!req.file) {
    console.log("No file uploaded.");
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Verificar tipo de archivo
  if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    console.log("Invalid file type:", req.file.mimetype);
    return res.status(400).json({ error: "Invalid file type" });
  }

  const filePath = path.join(__dirname, "/uploadsExcel", req.file.filename);

  try {
    if (!fs.existsSync(filePath)) {
      console.error("File does not exist:", filePath);
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Verificar la estructura del archivo antes de procesar filas
    const requiredColumns = 27; // Número de columnas requeridas
    if (worksheet.columns.length < requiredColumns) {
      console.log("Invalid Excel file structure. Expected columns:", requiredColumns, "but got:", worksheet.columns.length);
      return res.status(400).json({ error: "Invalid Excel file structure" });
    }

    // Procesar filas: eliminar o insertar/actualizar según corresponda
    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
      const row = worksheet.getRow(rowIndex);

      const eliminarValue = row.getCell(24).value; // Columna 24 es la de "Eliminar"
      const salonId = row.getCell(1).value; // ID del salón (columna 1)

      // Verificar si es necesario eliminar
      if (eliminarValue === 1 && salonId) {
        console.log(`Fila ${rowIndex} marcada para eliminación. Eliminando salón con ID: ${salonId}`);

        // Eliminar categorías relacionadas antes de eliminar el salón
        await new Promise((resolve, reject) => {
          const deleteCategoriesQuery = `DELETE FROM categories WHERE id_salon = ?`;
          connection.query(deleteCategoriesQuery, [salonId], (error, results) => {
            if (error) {
              console.error(`Error deleting categories for salon ID ${salonId}:`, error);
              return reject(error);
            }
            console.log(`Categories for salon ID ${salonId} deleted successfully.`);
            resolve(results);
          });
        });

        // Eliminar servicios y subservicios relacionados antes de eliminar el salón
        await new Promise((resolve, reject) => {
          const deleteSalonServicesQuery = `DELETE FROM salon_service_type WHERE id_salon = ?`;
          connection.query(deleteSalonServicesQuery, [salonId], (error, results) => {
            if (error) {
              console.error(`Error deleting salon services for salon ID ${salonId}:`, error);
              return reject(error);
            }
            console.log(`Salon services for salon ID ${salonId} deleted successfully.`);
            resolve(results);
          });
        });

        // Ahora podemos eliminar el salón
        await new Promise((resolve, reject) => {
          const deleteSalonQuery = `DELETE FROM salon WHERE id_salon = ?`;
          connection.query(deleteSalonQuery, [salonId], (error, results) => {
            if (error) {
              console.error(`Error deleting salon with ID ${salonId}:`, error);
              return reject(error);
            }
            console.log(`Salon with ID ${salonId} deleted successfully.`);
            resolve(results);
          });
        });

        continue; // Saltar a la siguiente fila si se eliminó
      }

      // Si no se va a eliminar, procesamos para actualizar o insertar
      const salon = {
        id_salon: row.getCell(1).value,
        id_city: row.getCell(2).value,
        plus_code: row.getCell(3).value,
        active: row.getCell(4).value,
        state: row.getCell(5).value,
        in_vacation: row.getCell(6).value,
        name: row.getCell(7).value,
        address: row.getCell(8).value,
        latitud: row.getCell(9).value,
        longitud: row.getCell(10).value,
        email: row.getCell(11).value,
        url: row.getCell(12).value,
        phone: row.getCell(13).value,
        map: row.getCell(14).value,
        iframe: row.getCell(15).value,
        image: row.getCell(16).value,
        about_us: row.getCell(17).value,
        score_old: row.getCell(18).value,
        hours_old: row.getCell(19).value,
        zip_code_old: row.getCell(20).value,
        overview_old: row.getCell(21).value,
        created_at: row.getCell(22).value,
        updated_at: row.getCell(23).value,
        deleted_at: row.getCell(24).value,
        categories: row.getCell(25).value,
        services: row.getCell(26).value, // Columna para servicios
        subservices: row.getCell(27).value // Columna para subservicios
      };

      const salonQuery = `
        INSERT INTO salon (id_salon, id_city, plus_code, active, state, in_vacation, name, address, latitud, longitud, email, url, phone, map, iframe, image, about_us, score_old, hours_old, zip_code_old, overview_old, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          id_city = VALUES(id_city), plus_code = VALUES(plus_code), active = VALUES(active), state = VALUES(state), in_vacation = VALUES(in_vacation), name = VALUES(name), address = VALUES(address), latitud = VALUES(latitud), longitud = VALUES(longitud), email = VALUES(email), url = VALUES(url), phone = VALUES(phone), map = VALUES(map), iframe = VALUES(iframe), image = VALUES(image), about_us = VALUES(about_us), score_old = VALUES(score_old), hours_old = VALUES(hours_old), zip_code_old = VALUES(zip_code_old), overview_old = VALUES(overview_old), created_at = VALUES(created_at), updated_at = VALUES(updated_at), deleted_at = VALUES(deleted_at)`;

      await new Promise((resolve, reject) => {
        connection.query(
          salonQuery,
          [
            salon.id_salon,
            salon.id_city,
            salon.plus_code,
            salon.active,
            salon.state,
            salon.in_vacation,
            salon.name,
            salon.address,
            salon.latitud,
            salon.longitud,
            salon.email,
            salon.url,
            salon.phone,
            salon.map,
            salon.iframe,
            salon.image,
            salon.about_us,
            salon.score_old,
            salon.hours_old,
            salon.zip_code_old,
            salon.overview_old,
            salon.created_at,
            salon.updated_at,
            salon.deleted_at,
          ],
          (error, results) => {
            if (error) {
              console.error("Error updating or inserting salon:", error);
              return reject(error);
            }
            resolve(results);
          }
        );
      });

      // Procesar categorías
      const categories = (typeof salon.categories === 'string') ? salon.categories.split(';').map(cat => cat.trim()) : [];
      for (const category of categories) {
        const categoryQuery = `INSERT INTO categories (id_salon, categories) VALUES (?, ?) ON DUPLICATE KEY UPDATE categories = VALUES(categories)`;
        await new Promise((resolve, reject) => {
          connection.query(categoryQuery, [salon.id_salon, category], (error, results) => {
            if (error) {
              console.error("Error inserting or updating category:", error);
              return reject(error);
            }
            resolve(results);
          });
        });
      }

      // Procesar servicios y subservicios
      const services = typeof salon.services === 'string' ? salon.services.split(',').map(s => s.trim()) : [];
      const subservices = typeof salon.subservices === 'string' ? salon.subservices.split(',').map(s => s.trim()) : [];

      // Relacionar servicios y subservicios
      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const relatedSubservices = subservices.filter(sub => sub.startsWith(service));

        for (const subservice of relatedSubservices) {
          const serviceData = await new Promise<{ id_service: number } | null>((resolve, reject) => {
            connection.query('SELECT id_service FROM service WHERE name = ?', [service], (error, results: any) => {
              if (error) {
                console.error(`Error fetching service ID for ${service}:`, error);
                return reject(error);
              }
              if (Array.isArray(results) && results.length > 0) {
                resolve(results[0]);
              } else {
                return reject(new Error(`Service '${service}' does not exist.`));
              }
            });
          });

          if (!serviceData) {
            continue;
          }

          const subserviceData = await new Promise<{ id_service_type: number } | null>((resolve, reject) => {
            connection.query('SELECT id_service_type FROM service_type WHERE name = ? AND id_service = ?', [subservice, serviceData.id_service], (error, results: any) => {
              if (error) {
                console.error(`Error fetching subservice ID for ${subservice}:`, error);
                return reject(error);
              }
              if (Array.isArray(results) && results.length > 0) {
                resolve(results[0]);
              } else {
                return reject(new Error(`Subservice '${subservice}' does not exist for service '${service}'.`));
              }
            });
          });

          if (!subserviceData) {
            continue;
          }

          await new Promise((resolve, reject) => {
            connection.query(
              'INSERT INTO salon_service_type (id_salon, id_service, id_service_type) VALUES (?, ?, ?)',
              [salon.id_salon, serviceData.id_service, subserviceData.id_service_type],
              (error, results) => {
                if (error) {
                  console.error(`Error inserting salon_service_type for salon ID ${salon.id_salon}:`, error);
                  return reject(error);
                }
                resolve(results);
              }
            );
          });
        }
      }
    }

    // Eliminar el archivo temporal después de procesarlo
    fs.unlinkSync(filePath);
    res.json({ message: "Excel file processed successfully" });
  } catch (error:any) {
    console.error("Error processing Excel file:", error);
    res.status(500).json({ error: error.message || "An error occurred while processing the Excel file" });
  }
});






router.post("/addExcel", upload.single("file"), async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return res.status(400).json({ error: "Invalid file type" });
  }

  const filePath = path.join(__dirname, "/uploadsExcel", req.file.filename);

  try {
    if (!fs.existsSync(filePath)) {
      console.error("File does not exist:", filePath);
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const requiredColumns = 25;
    if (worksheet.columns.length < requiredColumns) {
      return res.status(400).json({ error: "Invalid Excel file structure" });
    }

    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
      const row = worksheet.getRow(rowIndex);

      const salon = {
        id_salon: row.getCell(1).value || "",
        id_city: row.getCell(2).value,
        plus_code: row.getCell(3).value,
        active: row.getCell(4).value || 1,
        state: row.getCell(5).value || 'unclaimed',
        in_vacation: row.getCell(6).value || 0,
        name: row.getCell(7).value,
        address: row.getCell(8).value,
        latitud: row.getCell(9).value,
        longitud: row.getCell(10).value,
        email: row.getCell(11).value,
        url: row.getCell(12).value,
        phone: row.getCell(13).value,
        map: row.getCell(14).value,
        iframe: row.getCell(15).value,
        image: row.getCell(16).value,
        about_us: row.getCell(17).value,
        score_old: row.getCell(18).value,
        hours_old: row.getCell(19).value,
        zip_code_old: row.getCell(20).value,
        overview_old: row.getCell(21).value,
        created_at: row.getCell(22).value,
        updated_at: row.getCell(23).value,
        deleted_at: row.getCell(24).value,
      };
      

      const categories = row.getCell(25).value;

      const salonQuery = `
        INSERT INTO salon (
          id_salon, id_city, plus_code, active, state, in_vacation, name,
          address, latitud, longitud, email, url, phone, map, iframe, image, about_us,
          score_old, hours_old, zip_code_old, overview_old, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          id_city = VALUES(id_city), plus_code = VALUES(plus_code), active = VALUES(active),
          state = VALUES(state), in_vacation = VALUES(in_vacation), name = VALUES(name),
          address = VALUES(address), latitud = VALUES(latitud), longitud = VALUES(longitud),
          email = VALUES(email), url = VALUES(url), phone = VALUES(phone), map = VALUES(map),
          iframe = VALUES(iframe), image = VALUES(image), about_us = VALUES(about_us),
          score_old = VALUES(score_old), hours_old = VALUES(hours_old), zip_code_old = VALUES(zip_code_old),
          overview_old = VALUES(overview_old), created_at = VALUES(created_at), updated_at = VALUES(updated_at),
          deleted_at = VALUES(deleted_at)`;

      await new Promise((resolve, reject) => {
        connection.query(
          salonQuery,
          [
            salon.id_salon, salon.id_city, salon.plus_code, salon.active, salon.state,
            salon.in_vacation, salon.name, salon.address, salon.latitud, salon.longitud,
            salon.email, salon.url, salon.phone, salon.map, salon.iframe, salon.image,
            salon.about_us, salon.score_old, salon.hours_old, salon.zip_code_old,
            salon.overview_old, salon.created_at, salon.updated_at, salon.deleted_at,
          ],
          (error, results) => {
            if (error) {
              console.error("Error adding/updating salon:", error);
              return reject(error);
            }
            resolve(results);
          }
        );
      }).catch(error => {
        return res.status(500).json({ error: "Error adding/updating salon data" });
      });

      if (typeof categories === "string" && categories.trim() !== "") {
        const categoriesArray = categories
          .split("; ")
          .map((category) => category.trim());
        for (const category of categoriesArray) {
          const categoryQuery = `
            INSERT INTO categories (id_salon, categories) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE categories = VALUES(categories)`;

          await new Promise((resolve, reject) => {
            connection.query(
              categoryQuery,
              [salon.id_salon, category],
              (error, results) => {
                if (error) {
                  console.error("Error inserting category:", error);
                  return reject(error);
                }
                resolve(results);
              }
            );
          }).catch(error => {
            return res.status(500).json({ error: "Error inserting category" });
          });
        }
      }
    }

    fs.unlinkSync(filePath);

    res.json({ message: "Excel file processed successfully" });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "An error occurred while processing the Excel file" });
    }
  }
});


router.get('/downloadExcel', async (req, res) => {
  try {
    // Crear un nuevo libro de trabajo
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Salons');

    // Agregar la cabecera
    worksheet.columns = [
      { header: 'ID Salon', key: 'id_salon', width: 10, hidden:true },
      { header: 'ID Ciudad', key: 'id_city', width: 10 },
      { header: 'Plus Code', key: 'plus_code', width: 20 },
      { header: 'Activo', key: 'active', width: 10,hidden:true },
      { header: 'Estado', key: 'state', width: 15,hidden:true },
      { header: 'En Vacaciones', key: 'in_vacation', width: 15,hidden:true },
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Latitud', key: 'latitud', width: 15 },
      { header: 'Longitud', key: 'longitud', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'URL', key: 'url', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Mapa', key: 'map', width: 30 },
      { header: 'Iframe', key: 'iframe', width: 30 },
      { header: 'Imagen', key: 'image', width: 30 },
      { header: 'Acerca de Nosotros', key: 'about_us', width: 30 },
      { header: 'Puntuación Anterior', key: 'score_old', width: 15 },
      { header: 'Horas Anteriores', key: 'hours_old', width: 30 },
      { header: 'Código Postal Anterior', key: 'zip_code_old', width: 10 },
      { header: 'Resumen Anterior', key: 'overview_old', width: 30 },
      { header: 'Creado en', key: 'created_at', width: 20 },
      { header: 'Actualizado en', key: 'updated_at', width: 20 },
      { header: 'Eliminado en', key: 'deleted_at', width: 20 },
      { header: 'Categorías', key: 'categories', width: 30 },
      { header: "Servicio", key: "services", width: 30 },
      { header: "Subservicio", key: "subservices", width: 50 },
      
    ];

    // Aplicar formato a la cabecera
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }; // Texto blanco
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '808080' } // Color de fondo gris
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Configurar la respuesta para descargar el archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=salons_template.xlsx');

    // Escribir el archivo en la respuesta
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).json({ error: 'An error occurred while generating the Excel file' });
  }
});


export default router;
