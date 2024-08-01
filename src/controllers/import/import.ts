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

router.get('/getAllSalon', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';

  const query = `
    SELECT 
      SQL_CALC_FOUND_ROWS 
      s.*,
      GROUP_CONCAT(TRIM(REPLACE(c.categories, '; ', '')) SEPARATOR '; ') AS categories
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

  const countQuery = 'SELECT FOUND_ROWS() AS totalItems';

  connection.query(query, [search, search, search, search, search, search, search, offset, pageSize], (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'An error occurred while fetching data' });
      return;
    }

    connection.query(countQuery, (countError, countResults) => {
      if (countError) {
        console.error('Error fetching count:', countError);
        res.status(500).json({ error: 'An error occurred while fetching data count' });
        return;
      }

      const totalItems = (countResults as any)[0].totalItems;
      res.json({ data: results, totalItems });
    });
  });
});

router.post("/updateExcel", upload.single("file"), async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = path.join(__dirname, "/uploadsExcel", req.file.filename);
  //console.log('File Path:', filePath);

  try {
    if (!fs.existsSync(filePath)) {
      console.error("File does not exist:", filePath);
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
      const row = worksheet.getRow(rowIndex);

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
      };

      const categories = row.getCell(25).value;

      //console.log('Updating salon:', salon);

      const salonQuery = `
          UPDATE salon SET
            id_city = ?, plus_code = ?, active = ?, state = ?, in_vacation = ?, name = ?,
            address = ?, latitud = ?, longitud = ?, email = ?, url = ?, phone = ?,
            map = ?, iframe = ?, image = ?, about_us = ?, score_old = ?, hours_old = ?,
            zip_code_old = ?, overview_old = ?, created_at = ?, updated_at = ?, deleted_at = ?
          WHERE id_salon = ?`;

      await new Promise((resolve, reject) => {
        connection.query(
          salonQuery,
          [
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
            salon.id_salon,
          ],
          (error, results) => {
            if (error) {
              console.error("Error updating salon:", error);
              return reject(error);
            }

            resolve(results);
          }
        );
      });

      const deleteQuery = "DELETE FROM categories WHERE id_salon = ?";
      await new Promise((resolve, reject) => {
        connection.query(deleteQuery, [salon.id_salon], (error, results) => {
          if (error) {
            console.error("Error deleting categories:", error);
            return reject(error);
          }
          //console.log('Categories deleted for salon:', salon.id_salon);
          resolve(results);
        });
      });

      /*
        if (typeof categories === 'string') {
          // Eliminar categorías existentes para el id_salon
          const deleteQuery = 'DELETE * FROM categories WHERE id_salon = ?';
          await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [salon.id_salon], (error, results) => {
              if (error) {
                console.error('Error deleting categories:', error);
                return reject(error);
              }
              //console.log('Categories deleted:', results);
              resolve(results);
            });
          });
  



          // Insertar nuevas categorías
          const categoriesArray = categories.split('; ').map((category: string) => category.trim());
          for (const category of categoriesArray) {
            const categoryQuery = `
              INSERT INTO categories (id_salon, categories) VALUES (?, ?)
              ON DUPLICATE KEY UPDATE categories = VALUES(categories)`;
  
            //console.log('Inserting category:', { id_salon: salon.id_salon, category });
  
            await new Promise((resolve, reject) => {
              connection.query(categoryQuery, [salon.id_salon, category], (error, results) => {
                if (error) {
                  console.error('Error inserting category:', error);
                  return reject(error);
                }
                //console.log('Category inserted:', results);
                resolve(results);
                
              });
            });
          }
        }
      }
        */

      if (typeof categories === "string" && categories.trim() !== "") {
        const categoriesArray = categories
          .split("; ")
          .map((category: string) => category.trim());
        for (const category of categoriesArray) {
          const categoryQuery = `
                INSERT INTO categories (id_salon, categories) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE categories = VALUES(categories)`;

          console.log("Inserting category:", {
            id_salon: salon.id_salon,
            category,
          });

          await new Promise((resolve, reject) => {
            connection.query(
              categoryQuery,
              [salon.id_salon, category],
              (error, results) => {
                if (error) {
                  console.error("Error inserting category:", error);
                  return reject(error);
                }
                console.log("Category inserted:", results);
                resolve(results);
              }
            );
          });
        }
      }
    }
    fs.unlinkSync(filePath);

    res.json({ message: "Excel file processed successfully" });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the Excel file" });
  }
});

export default router;
