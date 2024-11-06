import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { RowDataPacket } from 'mysql2';
import { ResultSetHeader } from 'mysql2';
import { OkPacket } from 'mysql2';


const router = express.Router();
router.use(bodyParser.json());
router.use(express.json());


router.get('/getAllCategoriesJobs', async (req, res) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.pageSize as string || '10', 10);
  const offset = (page - 1) * pageSize;
  const search = req.query.search ? `%${req.query.search}%` : '%%';

  // Consulta con condición para buscar tanto en el nombre de la categoría como en el nombre de la subcategoría
  const query = `
    SELECT SQL_CALC_FOUND_ROWS jobs_cat.id_job_cat, jobs_cat.name AS categoryName, 
      jobs_subcat.id_job_subcat, jobs_subcat.name AS subcategoryName
    FROM jobs_cat
    LEFT JOIN jobs_subcat ON jobs_cat.id_job_cat = jobs_subcat.id_job_cat
    WHERE jobs_cat.name LIKE ? OR jobs_subcat.name LIKE ?
    ORDER BY jobs_cat.id_job_cat
    LIMIT ?, ?;
  `;

  const queryParams: any[] = [search, search, offset, pageSize];

  // Ejecuta la consulta principal
  connection.query(query, queryParams, (error, results: any[]) => {
    if (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'An error occurred while fetching data' });
      return;
    }

    // Consulta para contar el total de elementos con el mismo criterio de búsqueda
    connection.query('SELECT FOUND_ROWS() AS totalItems', (countError, countResults) => {
      if (countError) {
        console.error('Error fetching count:', countError);
        res.status(500).json({ error: 'An error occurred while fetching data count' });
        return;
      }

      const totalItems = (countResults as RowDataPacket[])[0]?.totalItems;

      // Agrupar resultados por categoría
      const categories = results.reduce((acc: any[], row) => {
        const { id_job_cat, categoryName, id_job_subcat, subcategoryName } = row;
        let category = acc.find((cat) => cat.id_job_cat === id_job_cat);

        if (!category) {
          category = {
            id_job_cat,
            name: categoryName,
            subcategories: [],
          };
          acc.push(category);
        }

        if (id_job_subcat) {
          category.subcategories.push({
            id_job_subcat,
            name: subcategoryName,
          });
        }

        return acc;
      }, []);

      // Respuesta con las categorías y el total de elementos
      res.json({ data: categories, totalItems });
    });
  });
});


   
   router.post("/addCategoryWithSubcategoriesJobs", (req, res) => {
    const { category, subCategories } = req.body;
    console.log("Datos recibidos en el servidor:");
    console.log("category:", category);
    console.log("subCategories:", subCategories);
  
    if (!category || !Array.isArray(subCategories) || subCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos: se requiere 'category' y 'subCategories' como arreglo.",
      });
    }
  
    // Inicia la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res.status(500).json({
          success: false,
          message: "Error starting transaction",
          error: err,
        });
      }
  
      // Inserta la categoría en `jobs_cat`
      const categoryQuery = "INSERT INTO jobs_cat (name, active) VALUES (?, 1)";
      connection.query(categoryQuery, [category], (err, categoryResult: ResultSetHeader) => {
        if (err) {
          console.error("Error inserting category:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error inserting category",
              error: err,
            });
          });
        }
      
        const categoryId = categoryResult.insertId;  // ID de la categoría insertada
  
        // Prepara las subcategorías para la inserción en `jobs_subcat`
        const subcategoryQuery = "INSERT INTO jobs_subcat (id_job_cat, name) VALUES ?";
        const subcategoryValues = subCategories.map((subcategory) => [
          categoryId,
          subcategory,
        ]);
  
        // Inserta las subcategorías en `jobs_subcat`
        connection.query(subcategoryQuery, [subcategoryValues], (err) => {
          if (err) {
            console.error("Error inserting subcategories:", err);
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error inserting subcategories",
                error: err,
              });
            });
          }
  
          // Confirma la transacción si todo salió bien
          connection.commit((err) => {
            if (err) {
              console.error("Error committing transaction:", err);
              return connection.rollback(() => {
                res.status(500).json({
                  success: false,
                  message: "Error committing transaction",
                  error: err,
                });
              });
            }
  
            // Respuesta final exitosa con la opción de devolver datos adicionales (como categoryId)
            res.json({
              success: true,
              message: "Category and subcategories added successfully",
               // Opcional: devolver si es útil para el frontend
            });
          });
        });
      });
    });
  });




  router.post("/delete", (req, res) => {
    const { categoryIds } = req.body;
  
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Faltan los IDs de las categorías en el cuerpo de la solicitud",
      });
    }
  
    // Inicia la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res.status(500).json({
          success: false,
          message: "Error starting transaction",
          error: err,
        });
      }
  
      // Elimina las subcategorías para todas las categorías dadas
      const deleteSubcategoriesQuery = "DELETE FROM jobs_subcat WHERE id_job_cat IN (?)";
      connection.query(deleteSubcategoriesQuery, [categoryIds], (err) => {
        if (err) {
          console.error("Error deleting subcategories:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error deleting subcategories",
              error: err,
            });
          });
        }
  
        // Luego elimina las categorías
        const deleteCategoriesQuery = "DELETE FROM jobs_cat WHERE id_job_cat IN (?)";
        connection.query(deleteCategoriesQuery, [categoryIds], (err) => {
          if (err) {
            console.error("Error deleting categories:", err);
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error deleting categories",
                error: err,
              });
            });
          }
  
          // Confirma la transacción si todo salió bien
          connection.commit((err) => {
            if (err) {
              console.error("Error committing transaction:", err);
              return connection.rollback(() => {
                res.status(500).json({
                  success: false,
                  message: "Error committing transaction",
                  error: err,
                });
              });
            }
  
            // Respuesta final exitosa
            res.json({
              success: true,
              message: "Categories and their subcategories deleted successfully",
            });
          });
        });
      });
    });
  });


  

  router.put("/updateCategoryJob/:id", (req, res) => {
    const { id } = req.params; // Obtener el ID de la categoría de los parámetros de la URL
    const { name } = req.body; // Obtener el nuevo nombre de la categoría del cuerpo de la solicitud
  
    // Verificar que los datos necesarios estén presentes
    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos: se requiere 'id' y 'name'."
      });
    }
  
    // Iniciar una transacción para asegurar la consistencia de los datos
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error al iniciar la transacción:", err);
        return res.status(500).json({
          success: false,
          message: "Error al iniciar la transacción",
          error: err
        });
      }
  
      // Consulta para actualizar la categoría en la tabla `jobs_cat`
      const updateQuery = "UPDATE jobs_cat SET name = ? WHERE id_job_cat = ?";
      connection.query(updateQuery, [name, id], (err, result) => {
        if (err) {
          console.error("Error al actualizar la categoría:", err);
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error al actualizar la categoría",
              error: err
            });
          });
        }
  
        // Confirmar la transacción si no hubo errores
        connection.commit((err) => {
          if (err) {
            console.error("Error al confirmar la transacción:", err);
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error al confirmar la transacción",
                error: err
              });
            });
          }
  
          // Responder exitosamente si todo salió bien
          res.json({
            success: true,
            message: "Categoría actualizada exitosamente"
          });
        });
      });
    });
  });
  



  router.put('/updateSubcategories/:category_id', (req, res) => {
    const category_id = parseInt(req.params.category_id, 10);
    let { subcategories } = req.body;
  
    // Verificación de datos básicos
    if (!subcategories || !category_id) {
      console.error('Error: No se proporcionaron subcategorías o el ID de la categoría.');
      return res.status(400).json({ error: 'Debe proporcionar las subcategorías y el ID de la categoría.' });
    }
  
    // Si `subcategories` es un string, dividirlo en un array usando coma y espacio
    if (typeof subcategories === 'string') {
      subcategories = subcategories.split(',').map(subcat => subcat.trim()).filter(subcat => subcat.length > 0);
    } else if (!Array.isArray(subcategories)) {
      // Si `subcategories` no es un array o string, retornar un error
      return res.status(400).json({ error: 'El formato de subcategorías es incorrecto. Debe ser un string o un array.' });
    }
  
    // Iniciar la transacción
    connection.beginTransaction((transErr) => {
      if (transErr) {
        console.error('Error al iniciar la transacción:', transErr);
        return res.status(500).json({ error: 'Error al iniciar la transacción.' });
      }
  
      // Obtener los IDs de subcategorías existentes para esta categoría
      const existingQuery = 'SELECT id_job_subcat, name FROM jobs_subcat WHERE id_job_cat = ?';
      connection.query(existingQuery, [category_id], (err, results) => {
        if (err) {
          console.error('Error obteniendo subcategorías existentes:', err);
          return connection.rollback(() => {
            res.status(500).json({ error: 'Error al obtener subcategorías existentes.' });
          });
        }
  
        const existingResults = results as RowDataPacket[];
        const existingSubcategoryMap = new Map(existingResults.map((row: RowDataPacket) => [row.name, row.id_job_subcat]));
  
        // Identificar subcategorías a agregar, actualizar y eliminar
        const subcategoriesToAdd = subcategories.filter((subcat:any) => !existingSubcategoryMap.has(subcat));
        const subcategoriesToUpdate = subcategories.filter((subcat:any) => existingSubcategoryMap.has(subcat));
        const idsToDelete = existingResults
          .filter(row => !subcategories.includes(row.name))
          .map(row => row.id_job_subcat);
  
        // Paso 1: Eliminar subcategorías que ya no están presentes en `subcategories`
        const deletePromises = idsToDelete.map((id_job_subcat) => {
          const deleteQuery = 'DELETE FROM jobs_subcat WHERE id_job_subcat = ?';
          return new Promise((resolve, reject) => {
            connection.query(deleteQuery, [id_job_subcat], (error) => {
              if (error) {
                console.error('Error eliminando subcategoría:', error);
                reject(error);
              } else {
                resolve(null);
              }
            });
          });
        });
  
        // Ejecutar eliminaciones
        Promise.all(deletePromises)
          .then(() => {
            // Paso 2: Insertar nuevas subcategorías
            const insertPromises = subcategoriesToAdd.map((subcat:any) => {
              const insertQuery = 'INSERT INTO jobs_subcat (name, id_job_cat) VALUES (?, ?)';
              return new Promise((resolve, reject) => {
                connection.query(insertQuery, [subcat, category_id], (error) => {
                  if (error) {
                    console.error('Error insertando subcategoría:', error);
                    reject(error);
                  } else {
                    resolve(null);
                  }
                });
              });
            });
  
            // Ejecutar inserciones y luego confirmar la transacción
            return Promise.all(insertPromises);
          })
          .then(() => {
            // Confirmar la transacción
            connection.commit((commitErr) => {
              if (commitErr) {
                console.error('Error al confirmar la transacción:', commitErr);
                return connection.rollback(() => {
                  res.status(500).json({ error: 'Error al confirmar la transacción.' });
                });
              }
              res.json({ message: 'Subcategorías actualizadas con éxito.' });
            });
          })
          .catch((error) => {
            console.error('Error en la actualización de subcategorías:', error);
            connection.rollback(() => {
              res.status(500).json({ error: 'Error durante la actualización de subcategorías.' });
            });
          });
      });
    });
  });
  
  
  
  
  

   router.get("/getCategories", async (req, res) => {
    connection.beginTransaction((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error starting transaction",
          error: err,
        });
      }
  
      // Usar DISTINCT para seleccionar solo servicios únicos por nombre
      const query = "SELECT DISTINCT categories FROM categories";
  
      connection.query(query, (err, results) => {
        if (err) {
          return connection.rollback(() => {
            res.status(500).json({
              success: false,
              message: "Error fetching categories",
              error: err,
            });
          });
        }
  
        connection.commit((err) => {
          if (err) {
            return connection.rollback(() => {
              res.status(500).json({
                success: false,
                message: "Error committing transaction",
                error: err,
              });
            });
          }
          res.json(results);
        });
      });
    });
  });


export default router;