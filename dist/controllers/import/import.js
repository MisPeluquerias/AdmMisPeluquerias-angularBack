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
const multer_1 = __importDefault(require("multer"));
const exceljs_1 = __importDefault(require("exceljs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        // Si no se usan, cambialos a _
        const uploadDir = path_1.default.join(__dirname, "uploadsExcel");
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({ storage: storage });
router.get('/getAllSalon', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
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
    db_1.default.query(query, [search, search, search, search, search, search, search, offset, pageSize], (error, results) => {
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
router.post("/updateExcel", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.set("Cache-Control", "no-store");
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    // Verificar tipo de archivo
    if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return res.status(400).json({ error: "Invalid file type" });
    }
    const filePath = path_1.default.join(__dirname, "/uploadsExcel", req.file.filename);
    try {
        if (!fs_1.default.existsSync(filePath)) {
            console.error("File does not exist:", filePath);
            throw new Error(`File not found: ${filePath}`);
        }
        const workbook = new exceljs_1.default.Workbook();
        yield workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        // Verificar la estructura del archivo
        const requiredColumns = 25;
        if (worksheet.columns.length < requiredColumns) {
            return res.status(400).json({ error: "Invalid Excel file structure" });
        }
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
            if (salon.deleted_at && salon.deleted_at === 1) { // Puedes ajustar la condición según cómo manejes los valores eliminados
                try {
                    // Eliminar categorías asociadas
                    const deleteCategoriesQuery = `DELETE FROM categories WHERE id_salon = ?`;
                    yield new Promise((resolve, reject) => {
                        db_1.default.query(deleteCategoriesQuery, [salon.id_salon], (error, results) => {
                            if (error) {
                                console.error("Error deleting categories:", error);
                                return reject(error);
                            }
                            resolve(results);
                        });
                    });
                    // Eliminar el salón después de eliminar las categorías asociadas
                    const deleteSalonQuery = `DELETE FROM salon WHERE id_salon = ?`;
                    yield new Promise((resolve, reject) => {
                        db_1.default.query(deleteSalonQuery, [salon.id_salon], (error, results) => {
                            if (error) {
                                console.error("Error deleting salon:", error);
                                return reject(error);
                            }
                            resolve(results);
                        });
                    });
                    continue; // Pasar a la siguiente fila en el archivo Excel
                }
                catch (error) {
                    return res.status(500).json({ error: "Error deleting salon data" });
                }
            }
            const categories = row.getCell(25).value;
            const salonQuery = `
        UPDATE salon SET
          id_city = ?, plus_code = ?, active = ?, state = ?, in_vacation = ?, name = ?,
          address = ?, latitud = ?, longitud = ?, email = ?, url = ?, phone = ?,
          map = ?, iframe = ?, image = ?, about_us = ?, score_old = ?, hours_old = ?,
          zip_code_old = ?, overview_old = ?, created_at = ?, updated_at = ?, deleted_at = ?
        WHERE id_salon = ?`;
            yield new Promise((resolve, reject) => {
                db_1.default.query(salonQuery, [
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
                ], (error, results) => {
                    if (error) {
                        console.error("Error updating salon:", error);
                        return reject(error);
                    }
                    resolve(results);
                });
            }).catch(error => {
                return res.status(500).json({ error: "Error updating salon data" });
            });
            const deleteQuery = "DELETE FROM categories WHERE id_salon = ?";
            yield new Promise((resolve, reject) => {
                db_1.default.query(deleteQuery, [salon.id_salon], (error, results) => {
                    if (error) {
                        console.error("Error deleting categories:", error);
                        return reject(error);
                    }
                    resolve(results);
                });
            }).catch(error => {
                return res.status(500).json({ error: "Error deleting categories" });
            });
            if (typeof categories === "string" && categories.trim() !== "") {
                const categoriesArray = categories
                    .split("; ")
                    .map((category) => category.trim());
                for (const category of categoriesArray) {
                    const categoryQuery = `
            INSERT INTO categories (id_salon, categories) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE categories = VALUES(categories)`;
                    yield new Promise((resolve, reject) => {
                        db_1.default.query(categoryQuery, [salon.id_salon, category], (error, results) => {
                            if (error) {
                                console.error("Error inserting category:", error);
                                return reject(error);
                            }
                            resolve(results);
                        });
                    }).catch(error => {
                        return res.status(500).json({ error: "Error inserting category" });
                    });
                }
            }
        }
        fs_1.default.unlinkSync(filePath); // Eliminar archivo solo si todo fue exitoso
        res.json({ message: "Excel file processed successfully" });
    }
    catch (error) {
        console.error("Error processing Excel file:", error);
        res.status(500).json({ error: "An error occurred while processing the Excel file" });
    }
}));
router.post("/addExcel", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.set("Cache-Control", "no-store");
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return res.status(400).json({ error: "Invalid file type" });
    }
    const filePath = path_1.default.join(__dirname, "/uploadsExcel", req.file.filename);
    try {
        if (!fs_1.default.existsSync(filePath)) {
            console.error("File does not exist:", filePath);
            throw new Error(`File not found: ${filePath}`);
        }
        const workbook = new exceljs_1.default.Workbook();
        yield workbook.xlsx.readFile(filePath);
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
            yield new Promise((resolve, reject) => {
                db_1.default.query(salonQuery, [
                    salon.id_salon, salon.id_city, salon.plus_code, salon.active, salon.state,
                    salon.in_vacation, salon.name, salon.address, salon.latitud, salon.longitud,
                    salon.email, salon.url, salon.phone, salon.map, salon.iframe, salon.image,
                    salon.about_us, salon.score_old, salon.hours_old, salon.zip_code_old,
                    salon.overview_old, salon.created_at, salon.updated_at, salon.deleted_at,
                ], (error, results) => {
                    if (error) {
                        console.error("Error adding/updating salon:", error);
                        return reject(error);
                    }
                    resolve(results);
                });
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
                    yield new Promise((resolve, reject) => {
                        db_1.default.query(categoryQuery, [salon.id_salon, category], (error, results) => {
                            if (error) {
                                console.error("Error inserting category:", error);
                                return reject(error);
                            }
                            resolve(results);
                        });
                    }).catch(error => {
                        return res.status(500).json({ error: "Error inserting category" });
                    });
                }
            }
        }
        fs_1.default.unlinkSync(filePath);
        res.json({ message: "Excel file processed successfully" });
    }
    catch (error) {
        console.error("Error processing Excel file:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "An error occurred while processing the Excel file" });
        }
    }
}));
router.get('/downloadExcel', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Crear un nuevo libro de trabajo
        const workbook = new exceljs_1.default.Workbook();
        const worksheet = workbook.addWorksheet('Salons');
        // Agregar la cabecera
        worksheet.columns = [
            { header: 'ID Salon', key: 'id_salon', width: 10, hidden: true },
            { header: 'ID Ciudad', key: 'id_city', width: 10 },
            { header: 'Plus Code', key: 'plus_code', width: 20 },
            { header: 'Activo', key: 'active', width: 10, hidden: true },
            { header: 'Estado', key: 'state', width: 15, hidden: true },
            { header: 'En Vacaciones', key: 'in_vacation', width: 15, hidden: true },
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
        yield workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({ error: 'An error occurred while generating the Excel file' });
    }
}));
exports.default = router;
