import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from 'mysql2';

const router = express.Router();
router.use(bodyParser.json());



router.get("/getAllCategories", async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
    const offset = (page - 1) * pageSize;
    const search = req.query.search ? `%${req.query.search}%` : "%%";

    const query = `
      SELECT DISTINCT categories
      FROM categories
      WHERE categories LIKE ?
      LIMIT ?, ?;
    `;
    const countQuery = "SELECT FOUND_ROWS() AS totalItems";

    // Inicia la transacción
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res.status(500).json({ error: "An error occurred while starting transaction" });
      }

      // Ejecuta la primera consulta
      connection.query(query, [search, offset, pageSize], (error, results) => {
        if (error) {
          console.error("Error fetching data:", error);
          return connection.rollback(() => {
            res.status(500).json({ error: "An error occurred while fetching data" });
          });
        }

        // Ejecuta la segunda consulta
        connection.query(countQuery, (countError, countResults) => {
          if (countError) {
            console.error("Error fetching count:", countError);
            return connection.rollback(() => {
              res.status(500).json({ error: "An error occurred while fetching data count" });
            });
          }

          const totalItems = (countResults as any)[0].totalItems;

          let processedResults: Array<{
            category: string;
          }> = [];

          if (Array.isArray(results)) {
            processedResults = results.map((row: any) => ({
              category: row.categories,
            }));
          }

          // Si todo salió bien, confirma la transacción
          connection.commit((commitError) => {
            if (commitError) {
              console.error("Error committing transaction:", commitError);
              return connection.rollback(() => {
                res.status(500).json({ error: "An error occurred while committing transaction" });
              });
            }

            // Responde con los datos
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


router.post("/addCategory", async (req, res) => {
  try {
      const { id_salon, category, destacado = 0, active = 1 } = req.body;

      if (!id_salon || !category) {
          return res.status(400).json({ error: "id_salon and category are required" });
      }

      const query = `
          INSERT INTO categories (id_salon, categories, destacado, active)
          VALUES (?, ?, ?, ?);
      `;

      // Inicia la transacción
      connection.beginTransaction((err) => {
          if (err) {
              console.error("Error starting transaction:", err);
              return res.status(500).json({ error: "An error occurred while starting transaction" });
          }

          // Ejecuta la consulta de inserción
          connection.query<ResultSetHeader>(query, [id_salon, category, destacado, active], (error, results) => {
              if (error) {
                  console.error("Error inserting data:", error);
                  return connection.rollback(() => {
                      res.status(500).json({ error: "An error occurred while inserting data" });
                  });
              }

              const insertId = results.insertId;

              // Si todo salió bien, confirma la transacción
              connection.commit((commitError) => {
                  if (commitError) {
                      console.error("Error committing transaction:", commitError);
                      return connection.rollback(() => {
                          res.status(500).json({ error: "An error occurred while committing transaction" });
                      });
                  }

                  // Responde con un mensaje de éxito
                  res.status(201).json({ message: "Category added successfully", categoryId: insertId });
              });
          });
      });
  } catch (err) {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred" });
  }
});






export default router;
