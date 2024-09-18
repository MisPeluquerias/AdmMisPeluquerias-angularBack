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
const router = express_1.default.Router();
router.use(body_parser_1.default.json());
router.get('/getAllSalon', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : '%%';
    const query = `
    SELECT 
      SQL_CALC_FOUND_ROWS 
      s.*,
      GROUP_CONCAT(TRIM(REPLACE(c.categories, ' ;', '')) SEPARATOR '; ') AS categories
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
router.get('/exportSalonsToExcel', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
    SELECT 
        s.*,
        GROUP_CONCAT(TRIM(REPLACE(c.categories, ' ;', '')) SEPARATOR '; ') AS categories
    FROM 
        salon s
    LEFT JOIN 
        categories c ON s.id_salon = c.id_salon
    GROUP BY 
        s.id_salon`;
    db_1.default.query(query, (error, results) => __awaiter(void 0, void 0, void 0, function* () {
        if (error) {
            console.error('Error fetching data:', error);
            res.status(500).json({ error: 'An error occurred while fetching data' });
            return;
        }
        try {
            // Crear un nuevo libro de Excel
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Salons');
            // Agregar encabezados
            worksheet.columns = [
                { header: 'ID', key: 'id_salon', width: 10 },
                { header: 'ID Ciudad', key: 'id_city', width: 10 },
                { header: 'Plus Code', key: 'plus_code', width: 20 },
                { header: 'Activo', key: 'active', width: 10 },
                { header: 'Estado', key: 'state', width: 15 },
                { header: 'En Vacaciones', key: 'in_vacation', width: 15 },
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
                { header: 'Horario', key: 'hours_old', width: 30 },
                { header: 'Código Postal Anterior', key: 'zip_code_old', width: 10 },
                { header: 'Resumen Anterior', key: 'overview_old', width: 30 },
                { header: 'Creado en', key: 'created_at', width: 20 },
                { header: 'Actualizado en', key: 'updated_at', width: 20 },
                { header: 'Eliminar', key: 'deleted_at', width: 20 },
                { header: 'Categorías', key: 'categories', width: 30 },
            ];
            // Personalizar la cabecera
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFF' } }; // Texto blanco
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: '808080' } // Color de fondo gris
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            // Habilitar autofiltro para todas las columnas (Ajusta el rango 'A1:Z1' según tu cantidad de columnas)
            worksheet.autoFilter = {
                from: 'A1',
                to: 'Y1' // Ajusta la columna final según tu caso real
            };
            // Agregar filas
            results.forEach((row) => {
                worksheet.addRow(row);
            });
            // Configurar validación de datos para la columna "Estado"
            worksheet.getColumn('state').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Omite la cabecera
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: false,
                        formulae: ['"Validado,Reclamado,No reclamado"'],
                        showErrorMessage: true,
                        errorTitle: 'Entrada no válida',
                        error: 'El valor debe ser uno de: Validado, Reclamado, No reclamado',
                    };
                }
            });
            worksheet.getColumn('categories').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Omite la cabecera
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: false,
                        formulae: ['"Barbería,Peluquería,Estética,Academia,Manicura y Pedicura,Depilación Láser"'],
                        showErrorMessage: true,
                        errorTitle: 'Entrada no válida',
                        error: 'El valor debe ser uno de: Barbería,Peluquería,Estética,Academia,Manicura y Pedicura,Depilación Láser',
                    };
                }
            });
            // Proteger la hoja después de habilitar los filtros
            worksheet.protect('coserty', {
                selectLockedCells: true,
                selectUnlockedCells: true,
                autoFilter: true, // Permite utilizar los filtros en una hoja protegida
                sort: true // Permite ordenar los datos incluso si la hoja está protegida
            });
            // Desbloquear columnas específicas
            ['name', 'state', 'address', 'categories', 'hours_old', 'email', 'phone', 'about_us', 'state', 'url', 'deleted_at'].forEach((col) => {
                worksheet.getColumn(col).eachCell((cell) => {
                    cell.protection = { locked: false };
                });
            });
            // Configurar la respuesta para la descarga
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=salons.xlsx');
            // Escribir el archivo Excel a la respuesta
            yield workbook.xlsx.write(res);
            res.end();
        }
        catch (err) {
            console.error('Error generating Excel file:', err);
            res.status(500).json({ error: 'An error occurred while generating the Excel file' });
        }
    }));
}));
exports.default = router;
