import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from "mysql2";
import { RowDataPacket } from 'mysql2';

const router = express.Router();
router.use(bodyParser.json());


router.get("/getAllBrands", async (req, res) => {
  try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
      const offset = (page - 1) * pageSize;
      const search = req.query.search ? `%${req.query.search}%` : "%%";

      /*
      console.log("Page:", page);
      console.log("Page Size:", pageSize);
      console.log("Offset:", offset);
      console.log("Search Query:", search);
    */
      const query = `
          SELECT *
          FROM brands
          WHERE name LIKE ?
          LIMIT ?, ?;
      `;
      const countQuery = `
          SELECT COUNT(DISTINCT name) AS totalItems 
          FROM brands 
          WHERE name LIKE ?;
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

              //console.log("Query Results:", results);

              connection.query(countQuery, [search], (countError, countResults: RowDataPacket[]) => {
                  if (countError) {
                      console.error("Error fetching count:", countError);
                      return connection.rollback(() => {
                          res.status(500).json({ error: "An error occurred while fetching data count" });
                      });
                  }

                  const totalItems = countResults[0].totalItems;

                  //console.log("Total Items:", totalItems);

                  const processedResults = results.map((row: any) => ({
                      id_brand: row.id_brand,
                      name: row.name,
                      active: row.active,
                  }));

                  //console.log("Processed Results:", processedResults);

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


router.post("/addBrand", async (req, res) => {
    try {
      const { name, active = 1 } = req.body;
  
      if (!name) {
        return res
          .status(400)
          .json({ error: "name is required" });
      }
  
      const query = `
    INSERT INTO brands (name, active)
    VALUES (?, ?);
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
          [name, active],
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
                  message: "Brand added successfully",
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



  router.put("/updateBrand", async (req, res) => {
    const { id_brand, name } = req.body;
  
    // Validar que se proporcionen el ID y el nuevo nombre
    if (!id_brand || !name) {
      return res
        .status(400)
        .json({ message: "id_brand y name son requeridos" });
    }
  
    // Iniciar la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error iniciando la transacción:", err);
        return res
          .status(500)
          .json({ message: "Error al iniciar la transacción" });
      }
  
      // Consulta para actualizar el nombre de la marca
      const query = `
        UPDATE brands
        SET name = ?
        WHERE id_brand = ?
      `;
  
      // Ejecutar la consulta con los parámetros correctos
      connection.query<ResultSetHeader>(
        query,
        [name, id_brand], // Asegúrate de que el orden de los parámetros coincida con la consulta
        (err, results) => {
          if (err) {
            console.error("Error al actualizar la marca:", err);
            return connection.rollback(() => {
              res
                .status(500)
                .json({ message: "Error al actualizar la marca" });
            });
          }
  
          // Verificar si se afectaron filas en la base de datos
          if (results.affectedRows === 0) {
            return connection.rollback(() => {
              res.status(404).json({ message: "Marca no encontrada" });
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
            res.status(200).json({ message: "Marca actualizada con éxito" });
          });
        }
      );
    });
  });

  router.post('/deleteBrand', (req, res) => {
    const { id_brand } = req.body;
  
    // Validar que se proporcionen los IDs y que sea un array válido
    if (!id_brand || !Array.isArray(id_brand) || id_brand.length === 0) {
      return res.status(400).json({ message: 'No hay marcas para eliminar' });
    }
  
    // Iniciar la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error iniciando la transacción:', err);
        return res.status(500).json({ message: 'Error al iniciar la transacción' });
      }
  
      // Consulta para eliminar marcas
      const query = `DELETE FROM brands WHERE id_brand IN (?)`;
  
      // Ejecutar la consulta dentro de la transacción
      connection.query<ResultSetHeader>(
        query,
        [id_brand],
        (err, results) => {
          if (err) {
            console.error('Error al eliminar las marcas:', err);
            return connection.rollback(() => {
              res.status(500).json({ message: 'Error al eliminar las marcas' });
            });
          }
  
          // Verificar si se eliminaron filas
          if (results.affectedRows === 0) {
            return connection.rollback(() => {
              res.status(404).json({ message: 'No se encontraron marcas para eliminar' });
            });
          }
  
          // Confirmar la transacción
          connection.commit((commitErr) => {
            if (commitErr) {
              console.error('Error al confirmar la transacción:', commitErr);
              return connection.rollback(() => {
                res.status(500).json({ message: 'Error al confirmar la transacción' });
              });
            }
  
            // Respuesta exitosa
            res.status(200).json({ message: 'Marcas eliminadas con éxito' });
          });
        }
      );
    });
  });



export default router;