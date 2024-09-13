import express, { Request, Response } from "express";
import connection from "../../db/db"; // Ajusta esta ruta según tu estructura de directorios
import bodyParser from "body-parser";
import { RowDataPacket } from "mysql2";

const router = express.Router();
router.use(bodyParser.json());

router.get("/getCityById", async (req: Request, res: Response) => {
  const id_city = req.query.id_city;

  if (!id_city) {
    return res.status(400).json({ error: "id_city is required" });
  }

  const query = `
    SELECT city.*, province.name as province_name
    FROM city
    INNER JOIN province ON city.id_province = province.id_province
    WHERE id_city = ? `;

  try {
    connection.beginTransaction(async (transactionError) => {
      if (transactionError) {
        console.error("Error starting transaction:", transactionError);
        return res.status(500).json({
          error: "An error occurred while starting the transaction",
        });
      }

      connection.query(
        query,
        [id_city],
        (queryError, results: RowDataPacket[]) => {
          if (queryError) {
            console.error("Error fetching salon:", queryError);
            return connection.rollback(() => {
              res.status(500).json({
                error: "An error occurred while fetching the salon data",
              });
            });
          }

          if (results.length === 0) {
            return connection.rollback(() => {
              res.status(404).json({ message: "Salon not found" });
            });
          }

          connection.commit((commitError) => {
            if (commitError) {
              console.error("Error committing transaction:", commitError);
              return connection.rollback(() => {
                res.status(500).json({
                  error: "An error occurred while committing the transaction",
                });
              });
            }

            res.json({ data: results[0] });
          });
        }
      );
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

router.get("/getProvinces", async (req: Request, res: Response) => {
  const query = `SELECT id_province, name FROM province`;

  connection.query(query, (queryError, results: RowDataPacket[]) => {
    if (queryError) {
      console.error("Error fetching provinces:", queryError);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching the provinces" });
    }

    res.json({ data: results });
  });
});

router.put("/updateCity/:id_city", (req, res) => {
  const { id_city } = req.params;
  const { name, longitud, latitud, zip_code, id_province } = req.body;

  const query = `
        UPDATE city
        SET 
            name=?, 
            longitud=?, 
            latitud=?, 
            zip_code=?, 
            id_province=?
        WHERE id_city=?;
    `;

  connection.query(
    query,
    [name, longitud, latitud, zip_code, id_province, id_city],  // Reordenar los valores
    (error) => {
      if (error) {
        console.error("Error actualizando ciudad:", error.message);
        return res.status(500).json({ message: "Error actualizando ciudad" });
      }

      res.json({ message: "Ciudad actualizada correctamente" });
    }
  );
});




export default router;
