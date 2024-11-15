import express from "express";
import connection from "../../db/db";
import bodyParser from "body-parser";
import { ResultSetHeader } from "mysql2";
import decodeToken from "../../functions/decodeToken";

const router = express.Router();
router.use(bodyParser.json());

router.get('/getCategoriesJob', (req, res) => {
    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }

        const query = 'SELECT * FROM jobs_cat';
        
        connection.query(query, (error, results) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }

            connection.commit((err) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});

// Endpoint para agregar una oferta de trabajo con transacción
router.post('/addJobOffer', (req, res) => {
    const {id_user,id_salon, category, subcategory, description, requirements, salary, img_job_path } = req.body;



    // Valida que todos los campos necesarios estén presentes
    if (!category || !subcategory || !description || !requirements || !salary || !img_job_path) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const id_user_decode = decodeToken(id_user);


    console.log(id_user_decode,id_salon, category, subcategory, description, requirements, salary, img_job_path);

    // Inicia la transacción
    connection.beginTransaction((transactionError) => {
      if (transactionError) {
        console.error('Error al iniciar la transacción:', transactionError);
        return res.status(500).json({ error: 'Error al iniciar la transacción' });
      }

      // Consulta para insertar la oferta de trabajo en la tabla
      const query = `
        INSERT INTO jobs_offers (id_user, id_salon, category, subcategory, description, requirements, salary, img_job_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Ejecuta la consulta dentro de la transacción
      connection.query(query, [ id_user_decode, id_salon,category, subcategory, description, requirements, salary, img_job_path], (error, results) => {
        if (error) {
          // Realiza un rollback si ocurre un error
          return connection.rollback(() => {
            console.error('Error al insertar la oferta de trabajo:', error);
            res.status(500).json({ error: 'Error al insertar la oferta de trabajo' });
          });
        }

        // Cast explícito para que TypeScript entienda que `results` tiene `insertId`
        const result = results as ResultSetHeader;

        // Realiza el commit si la inserción fue exitosa
        connection.commit((commitError) => {
          if (commitError) {
            // Realiza un rollback si ocurre un error durante el commit
            return connection.rollback(() => {
              console.error('Error al confirmar la transacción:', commitError);
              res.status(500).json({ error: 'Error al confirmar la transacción' });
            });
          }

          // Responde con éxito si todo se completó correctamente
          res.status(201).json({ message: 'Oferta de trabajo agregada con éxito', offerId: result.insertId });
        });
      });
    });
});




router.get('/getImgJob', (req, res) => {
    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }

        const query = 'SELECT * FROM jobs_img';
        
        connection.query(query, (error, results) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }

            connection.commit((err) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});



router.get('/getSubCategoriesByCategory/:id_job_cat', (req, res) => {
    const { id_job_cat } = req.params;

    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }

        const query = 'SELECT * FROM jobs_subcat WHERE id_job_cat = ?';
        
        connection.query(query, [id_job_cat], (error, results) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }

            connection.commit((err) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});


router.get('/getAlljobsOffers', (req, res) => {
    connection.beginTransaction((err) => {
        if (err) {
            console.error('Error iniciando la transacción:', err);
            return res.status(500).send('Error iniciando la transacción');
        }

        const query = 'SELECT * FROM jobs_offers';
        
        connection.query(query, (error, results) => {
            if (error) {
                return connection.rollback(() => {
                    console.error('Error ejecutando la consulta:', error);
                    res.status(500).send('Error en la consulta');
                });
            }

            connection.commit((err) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Error confirmando la transacción:', err);
                        res.status(500).send('Error confirmando la transacción');
                    });
                }
                res.json(results);
            });
        });
    });
});


router.get('/getAlljobsOffersByUser/:id_user', (req, res) => {
    const { id_user } = req.params;
  
    // Decodificar el id_user
    const id_user_decode = decodeToken(id_user as string);
    //console.log('id_user decodificado:', id_user_decode);
  
    if (!id_user_decode) {
      return res.status(400).json({ message: 'Token inválido o no se pudo decodificar' });
    }
  
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error iniciando la transacción:', err);
        return res.status(500).json({ message: 'Error iniciando la transacción' });
      }
  
      const query = 'SELECT * FROM jobs_offers WHERE id_user = ?';
  
      connection.query(query, [id_user_decode], (error, results) => {
        if (error) {
          console.error('Error ejecutando la consulta:', error);
          return connection.rollback(() => {
            res.status(500).json({ message: 'Error ejecutando la consulta' });
          });
        }
  
        connection.commit((commitErr) => {
          if (commitErr) {
            console.error('Error confirmando la transacción:', commitErr);
            return connection.rollback(() => {
              res.status(500).json({ message: 'Error confirmando la transacción' });
            });
          }
  
          res.json(results);
        });
      });
    });
  });


  router.get('/getSalonsByUser/:id_user', (req, res) => {
    const { id_user } = req.params;
  
    // Decodificar el id_user
    const id_user_decode = decodeToken(id_user as string);
  
    if (!id_user_decode) {
      return res.status(400).json({ message: 'Token inválido o no se pudo decodificar' });
    }
  
    connection.beginTransaction((err) => {
      if (err) {
        console.error('Error iniciando la transacción:', err);
        return res.status(500).json({ message: 'Error iniciando la transacción' });
      }
  
      // Consulta con INNER JOIN para obtener los nombres de los salones
      const query = `
        SELECT s.id_salon, s.name AS salon_name
        FROM salon s
        INNER JOIN user_salon us ON s.id_salon = us.id_salon
        WHERE us.id_user = ?
      `;
  
      connection.query(query, [id_user_decode], (error, results) => {
        if (error) {
          console.error('Error ejecutando la consulta:', error);
          return connection.rollback(() => {
            res.status(500).json({ message: 'Error ejecutando la consulta' });
          });
        }
  
        connection.commit((commitErr) => {
          if (commitErr) {
            console.error('Error confirmando la transacción:', commitErr);
            return connection.rollback(() => {
              res.status(500).json({ message: 'Error confirmando la transacción' });
            });
          }
          res.json(results);
          //console.log(results);
        });
      });
    });
  });



export default router;
