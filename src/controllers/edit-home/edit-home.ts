import express from 'express';
import multer from 'multer';
import path from 'path';
import connection from '../../db/db';
import bodyParser from 'body-parser';
import { RowDataPacket } from 'mysql2';
import { Request, Response } from 'express';

const router = express.Router();
router.use(bodyParser.json());


router.get('/getSalonById', async (req: Request, res: Response) => {
  const id_salon = req.query.id_salon; 
  
  if (!id_salon) {
    return res.status(400).json({ error: 'id_salon is required' });
  }
  
  const query = `
  SELECT 
    s.*,
    GROUP_CONCAT(TRIM(REPLACE(c.categories, '; ', '')) SEPARATOR '; ') AS categories,
    ci.name as city_name,
    ci.zip_code as city_zip_code,
    p.id_province,
    p.name as province_name
  FROM 
    salon s
  LEFT JOIN 
    categories c ON s.id_salon = c.id_salon
  LEFT JOIN
    city ci ON s.id_city = ci.id_city
  LEFT JOIN
    province p ON ci.id_province = p.id_province
  WHERE 
    s.id_salon = ?
  GROUP BY 
    s.id_salon;
  `;

  connection.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error('Error starting transaction:', transactionError);
      res.status(500).json({ error: 'An error occurred while starting the transaction' });
      return;
    }

    connection.query(query, [id_salon], (queryError, results: RowDataPacket[]) => {
      if (queryError) {
        console.error('Error fetching salon:', queryError);
        connection.rollback(() => {
          res.status(500).json({ error: 'An error occurred while fetching the salon data' });
        });
        return;
      }

      if (results.length === 0) {
        connection.rollback(() => {
          res.status(404).json({ message: 'Salon not found' });
        });
        return;
      }

      connection.commit((commitError) => {
        if (commitError) {
          console.error('Error committing transaction:', commitError);
          connection.rollback(() => {
            res.status(500).json({ error: 'An error occurred while committing the transaction' });
          });
          return;
        }

        res.json({ data: results[0] });
      });
    });
  });
});




router.put('/updateSalon', async (req: Request, res: Response) => {
  const {
    id_salon,
    id_city,
    plus_code,
    active,
    state,
    in_vacation,
    name,
    address,
    latitud,
    longitud,
    email,
    url,
    phone,
    map,
    iframe,
    image,
    about_us,
    score_old,
    hours_old,
    zip_code_old,
    overview_old,
    categories
  } = req.body;

  console.log('Datos recibidos:', req.body);

  if (!id_salon) {
    return res.status(400).json({ error: 'id_salon is required' });
  }

  const updateSalonQuery = `
    UPDATE salon
    SET 
      id_city = ?,
      plus_code = ?,
      active = ?,
      state = ?,
      in_vacation = ?,
      name = ?,
      address = ?,
      latitud = ?,
      longitud = ?,
      email = ?,
      url = ?,
      phone = ?,
      map = ?,
      iframe = ?,
      image = ?,
      about_us = ?,
      score_old = ?,
      hours_old = ?,
      zip_code_old = ?,
      overview_old = ?
    WHERE id_salon = ?;
  `;

  const deleteCategoriesQuery = `
    DELETE FROM categories WHERE id_salon = ?;
  `;

  const insertCategoryQuery = `
    INSERT INTO categories (id_salon, categories) VALUES (?, ?);
  `;

  try {
    await new Promise<void>((resolve, reject) => {
      connection.beginTransaction((transactionError) => {
        if (transactionError) {
          console.error('Error starting transaction:', transactionError);
          return reject(transactionError);
        }

        connection.query(
          updateSalonQuery,
          [
            id_city,
            plus_code,
            active,
            state,
            in_vacation,
            name,
            address,
            latitud,
            longitud,
            email,
            url,
            phone,
            map,
            iframe,
            image,
            about_us,
            score_old,
            hours_old,
            zip_code_old,
            overview_old,
            id_salon
          ],
          (queryError) => {
            if (queryError) {
              console.error('Error updating salon:', queryError);
              connection.rollback(() => reject(queryError));
              return;
            }

            connection.query(deleteCategoriesQuery, [id_salon], (deleteError) => {
              if (deleteError) {
                console.error('Error deleting categories:', deleteError);
                connection.rollback(() => reject(deleteError));
                return;
              }

              const categoryArray: string[] = categories.split(';').map((category: string) => category.trim());

              const categoryInserts = categoryArray.map((category: string) => {
                return new Promise<void>((resolveInsert, rejectInsert) => {
                  connection.query(insertCategoryQuery, [id_salon, category], (insertError) => {
                    if (insertError) {
                      return rejectInsert(insertError);
                    }
                    resolveInsert();
                  });
                });
              });

              Promise.all(categoryInserts)
                .then(() => {
                  connection.commit((commitError) => {
                    if (commitError) {
                      console.error('Error committing transaction:', commitError);
                      connection.rollback(() => reject(commitError));
                      return;
                    }

                    resolve();
                  });
                })
                .catch((insertError) => {
                  console.error('Error inserting categories:', insertError);
                  connection.rollback(() => reject(insertError));
                });
            });
          }
        );
      });
    });

    res.json({ message: 'Salon and categories updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the salon and categories' });
  }
});

router.get('/getProvinces', async (req: Request, res: Response) => {
  const query = `SELECT id_province, name FROM province`;

  connection.query(query, (queryError, results: RowDataPacket[]) => {
    if (queryError) {
      console.error('Error fetching provinces:', queryError);
      return res.status(500).json({ error: 'An error occurred while fetching the provinces' });
    }

    res.json({ data: results });
  });
});

router.get('/getCitiesByProvince', async (req: Request, res: Response) => {
  const id_province = req.query.id_province;

  if (!id_province) {
    return res.status(400).json({ error: 'id_province is required' });
  }

  const query = `
    SELECT 
      p.name as province_name,
      c.id_city,
      c.name as city_name,
      c.zip_code
    FROM 
      province p
    JOIN 
      city c ON p.id_province = c.id_province
    WHERE 
      p.id_province = ?;
  `;

  connection.query(query, [id_province], (queryError, results: RowDataPacket[]) => {
    if (queryError) {
      console.error('Error fetching cities and province:', queryError);
      return res.status(500).json({ error: 'An error occurred while fetching the city and province data' });
    }

    res.json({ data: results });
  });
});

router.put("/updateSalonHours/:id", async (req, res) => {
  const { id } = req.params;
  const { hours_old } = req.body;

  if (!hours_old) {
    return res.status(400).json({ error: "Missing hours_old field" });
  }

  const query = "UPDATE salon SET hours_old = ?, updated_at = NOW() WHERE id_salon = ?";

  connection.beginTransaction((transactionError) => {
    if (transactionError) {
      console.error("Error starting transaction:", transactionError);
      return res.status(500).json({ error: "An error occurred while starting the transaction" });
    }

    connection.query(query, [hours_old, id], (queryError, results) => {
      if (queryError) {
        console.error("Error updating salon hours:", queryError);
        return connection.rollback(() => {
          res.status(500).json({ error: "An error occurred while updating salon hours" });
        });
      }

      const result: any = results;
      if (result.affectedRows === 0) {
        return connection.rollback(() => {
          res.status(404).json({ error: "Salon not found" });
        });
      }

      connection.commit((commitError) => {
        if (commitError) {
          console.error("Error committing transaction:", commitError);
          return connection.rollback(() => {
            res.status(500).json({ error: "An error occurred while committing the transaction" });
          });
        }

        res.json({ message: "Salon hours updated successfully" });
      });
    });
  });
});

export default router;
