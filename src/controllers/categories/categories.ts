import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from "mysql2";
import { RowDataPacket } from 'mysql2';


const router = express.Router();
router.use(bodyParser.json());





router.get("/getAllCategories", async (req, res) => {
  try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
      const offset = (page - 1) * pageSize;
      const search = req.query.search ? `%${req.query.search}%` : "%%";

      const query = `
          SELECT categories, COUNT(id_salon) AS totalSalones
          FROM categories
          WHERE categories LIKE ?
          GROUP BY categories
          LIMIT ?, ?;
      `;

      const countQuery = `
          SELECT COUNT(DISTINCT categories) AS totalItems 
          FROM categories 
          WHERE categories LIKE ?;
      `;

      connection.beginTransaction((err) => {
          if (err) {
              console.error("Error starting transaction:", err);
              return res.status(500).json({ error: "An error occurred while starting transaction" });
          }

          connection.query(query, [search, offset, pageSize], (error, results: RowDataPacket[]) => {
              if (error) {
                  console.error("Error fetching data:", error);
                  return connection.rollback(() => {
                      res.status(500).json({ error: "An error occurred while fetching data" });
                  });
              }

              connection.query(countQuery, [search], (countError, countResults: RowDataPacket[]) => {
                  if (countError) {
                      console.error("Error fetching count:", countError);
                      return connection.rollback(() => {
                          res.status(500).json({ error: "An error occurred while fetching data count" });
                      });
                  }

                  const totalItems = countResults[0].totalItems;

                  const processedResults = results.map((row: any) => ({
                      category: row.categories,
                      totalSalones: row.totalSalones,
                  }));

                  connection.commit((commitError) => {
                      if (commitError) {
                          console.error("Error committing transaction:", commitError);
                          return connection.rollback(() => {
                              res.status(500).json({ error: "An error occurred while committing transaction" });
                          });
                      }

                      res.json({ data: processedResults, totalItems });
                  });
              });
          });
      });
  } catch (err) {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred" });
  }
});







router.put("/updateCategory", (req, res) => {
  const { OldCategory, newCategory } = req.body;
  /*console.log(
    "Categoría antigua:",
    OldCategory,
    "Nueva categoría:",
    newCategory
  );*/

  // Validar que se proporcionen ambas categorías
  if (!OldCategory || !newCategory) {
    return res
      .status(400)
      .json({ message: "OldCategory y newCategory son requeridos" });
  }

  // Iniciar la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res
        .status(500)
        .json({ message: "Error al iniciar la transacción" });
    }

    // Consulta para actualizar la categoría
    const query = `
      UPDATE categories
      SET categories = ?
      WHERE categories = ?
    `;

    // Ejecutar la consulta con tipo explícito para los resultados
    connection.query<ResultSetHeader>(
      query,
      [newCategory, OldCategory],
      (err, results) => {
        if (err) {
          console.error("Error al actualizar la categoría:", err);
          return connection.rollback(() => {
            res
              .status(500)
              .json({ message: "Error al actualizar la categoría" });
          });
        }

        // Verificar si se afectaron filas en la base de datos
        if (results.affectedRows === 0) {
          return connection.rollback(() => {
            res.status(404).json({ message: "Categoría no encontrada" });
          });
        }

        // Confirmar la transacción
        connection.commit((commitErr) => {
          if (commitErr) {
            console.error("Error al confirmar la transacción:", commitErr);
            return connection.rollback(() => {
              res
                .status(500)
                .json({ message: "Error al confirmar la transacción" });
            });
          }

          // Respuesta exitosa
          res.status(200).json({ message: "Categoría actualizada con éxito" });
        });
      }
    );
  });
});

router.post("/addCategory", async (req, res) => {
  try {
    const {id_salon=15451, category, destacado = 0, active = 1 } = req.body;

    if (!category) {
      return res
        .status(400)
        .json({ error: "id_salon and category are required" });
    }

    const query = `
  INSERT INTO categories (id_salon,categories, destacado, active)
  VALUES (?, ?, ?, ?);
`;

    // Inicia la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res
          .status(500)
          .json({ error: "An error occurred while starting transaction" });
      }

      // Ejecuta la consulta de inserción
      connection.query<ResultSetHeader>(
        query,
        [id_salon,category, destacado, active],
        (error, results) => {
          if (error) {
            console.error("Error inserting data:", error);
            return connection.rollback(() => {
              res
                .status(500)
                .json({ error: "An error occurred while inserting data" });
            });
          }

          const insertId = results.insertId;

          // Si todo salió bien, confirma la transacción
          connection.commit((commitError) => {
            if (commitError) {
              console.error("Error committing transaction:", commitError);
              return connection.rollback(() => {
                res
                  .status(500)
                  .json({
                    error: "An error occurred while committing transaction",
                  });
              });
            }

            // Responde con un mensaje de éxito
            res
              .status(201)
              .json({
                message: "Category added successfully",
                categoryId: insertId,
              });
          });
        }
      );
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});




router.put("/updateService/:id_service", (req, res) => {
  const { id_service } = req.params;
  const { service_name } = req.body;

  // Validar que se proporcione un nombre de servicio
  if (!service_name || !id_service) {
    return res
      .status(400)
      .json({ message: "El ID del servicio y el nombre son requeridos" });
  }

  // Iniciar la transacción
  connection.beginTransaction((err) => {
    if (err) {
      console.error("Error iniciando la transacción:", err);
      return res
        .status(500)
        .json({ message: "Error al iniciar la transacción" });
    }

    // Consulta para actualizar el nombre del servicio
    const updateServiceQuery = `
      UPDATE service
      SET name = ?
      WHERE id_service = ?
    `;

    connection.query<ResultSetHeader>(
      updateServiceQuery,
      [service_name, id_service],
      (err, results) => {
        if (err) {
          console.error("Error al actualizar el servicio:", err);
          return connection.rollback(() => {
            res
              .status(500)
              .json({ message: "Error al actualizar el servicio" });
          });
        }

        // Si no se afectaron filas, el servicio no fue encontrado
        if (results.affectedRows === 0) {
          return connection.rollback(() => {
            res.status(404).json({ message: "Servicio no encontrado" });
          });
        }

        // Confirmar la transacción
        connection.commit((commitErr) => {
          if (commitErr) {
            console.error("Error al confirmar la transacción:", commitErr);
            return connection.rollback(() => {
              res
                .status(500)
                .json({ message: "Error al confirmar la transacción" });
            });
          }

          // Respuesta exitosa
          res.status(200).json({ message: "Servicio actualizado con éxito" });
        });
      }
    );
  });
});



router.post('/delete', (req, res) => {
  const { names } = req.body;

  if (!names || !Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ message: 'No hay categorías para eliminar' });
  }

  const query = `DELETE FROM categories WHERE categories IN (?)`;

  connection.query(query, [names], (err, results) => {
    if (err) {
      console.error('Error al eliminar las categorías:', err);
      return res.status(500).json({ message: 'Error al eliminar las categorías' });
    }

    res.status(200).json({ message: 'Categorías eliminadas con éxito' });
  });
});


export default router;
