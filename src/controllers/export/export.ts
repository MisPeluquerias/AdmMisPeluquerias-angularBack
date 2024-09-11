import express from 'express';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import ExcelJS from 'exceljs';

const router = express.Router();
router.use(bodyParser.json());

router.get('/getAllSalon', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
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

router.get('/exportSalonsToExcel', async (req, res) => {
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

  connection.query(query, async (error, results) => {
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
      worksheet.getRow(1).eachCell((cell:any) => {
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
      (results as any[]).forEach((row) => {
        worksheet.addRow(row);
      });

      // Configurar validación de datos para la columna "Estado"
      worksheet.getColumn('state').eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, rowNumber: number) => {
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

      // Proteger la hoja después de habilitar los filtros
      worksheet.protect('coserty', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        autoFilter: true, // Permite utilizar los filtros en una hoja protegida
        sort: true // Permite ordenar los datos incluso si la hoja está protegida
      });

      // Desbloquear columnas específicas
      ['name', 'state', 'address', 'categories', 'hours_old', 'email','phone','about_us','state','url','deleted_at'].forEach((col) => {
        worksheet.getColumn(col).eachCell((cell:any) => {
          cell.protection = { locked: false };
        });
      });

      // Configurar la respuesta para la descarga
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=salons.xlsx');

      // Escribir el archivo Excel a la respuesta
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Error generating Excel file:', err);
      res.status(500).json({ error: 'An error occurred while generating the Excel file' });
    }
  });
});

export default router;
