const express = require("express");
require("dotenv").config();
const mysql = require("mysql2");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
const connection = mysql.createConnection({
  host: "containers-us-west-62.railway.app",
  user: "root",
  password: "07CQZmsKDf2UePxN8c09",
  database: "railway",
  port: "7082",
  multipleStatements: true,
});

connection.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to database");
});

// Route to return all the cars with all the options and images
app.get("/cars", (req, res) => {
  connection.query("SET SESSION group_concat_max_len = 1000000;", (err) => {
    if (err) throw err;

    const sql = `
            SELECT
                Cars.*,
                GROUP_CONCAT(DISTINCT Options.option_description) as options,
                GROUP_CONCAT(DISTINCT Images.imgUrl) as images
            FROM Cars
            LEFT JOIN Options ON Cars.id = Options.car_id
            LEFT JOIN Images ON Cars.id = Images.car_id
            GROUP BY Cars.id;
          `;

    connection.query(sql, (err, results) => {
      if (err) throw err;
      // parse options and images into arrays
      const cars = results.map((car) => ({
        ...car,
        options: car.options ? car.options.split(",") : [],
        images: car.images ? car.images.split(",") : [],
      }));
      res.json(cars);
    });
  });
});

// Route to return a single car based on the car id
app.get("/cars/:id", (req, res) => {
  console.log();
  const sql = `
            SET SESSION group_concat_max_len = 1000000;
            SELECT
                Cars.*,
                GROUP_CONCAT(DISTINCT Options.option_description) as options,
                GROUP_CONCAT(DISTINCT Images.imgUrl) as images
            FROM Cars
            LEFT JOIN CarOptions ON Cars.id = CarOptions.car_id
            LEFT JOIN Options ON CarOptions.option_id = Options.id
            LEFT JOIN Images ON Cars.id = Images.car_id
            WHERE Cars.id = ?
            GROUP BY Cars.id;
        `;
  connection.query(sql, [req.params.id], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      const car = results[0];
      // parse options and images into arrays
      car.options = car.options ? car.options.split(",") : [];
      car.images = car.images ? car.images.split(",") : [];
      res.json(car);
    } else {
      res.status(404).json({ message: "No car found with this id" });
    }
  });
});

// Route to delete a car based on ID
app.delete("/cars/:id", (req, res) => {
  const carId = req.params.id;

  // delete car options
  connection.query(
    "DELETE FROM Options WHERE car_id = ?",
    [carId],
    (error, results) => {
      if (error) {
        console.error("Error deleting car options: ", error);
        return res.status(500).json({ error: "Failed to delete car options" });
      }

      // delete car images
      connection.query(
        "DELETE FROM Images WHERE car_id = ?",
        [carId],
        (error, results) => {
          if (error) {
            console.error("Error deleting car images: ", error);
            return res
              .status(500)
              .json({ error: "Failed to delete car images" });
          }

          // delete car
          connection.query(
            "DELETE FROM Cars WHERE id = ?",
            [carId],
            (error, results) => {
              if (error) {
                console.error("Error deleting car: ", error);
                return res.status(500).json({ error: "Failed to delete car" });
              }

              res.json({ message: "Car deleted successfully" });
            }
          );
        }
      );
    }
  );
});

// Route to add a new car
app.post("/cars", (req, res) => {
  const {
    model,
    price,
    engine: { type, horsepower },
    transmission,
    emissionStandard,
    year,
    km,
    options,
    imgUrl,
  } = req.body;

  // Insert the car into the Cars table
  const car = {
    model,
    price,
    type,
    horsepower,
    transmission,
    emissionStandard,
    year,
    km,
  };
  connection.query("INSERT INTO Cars SET ?", car, (error, result) => {
    if (error) {
      console.error("Error adding new car: ", error);
      res.status(500).json({ error: "Failed to add new car" });
    } else {
      const carId = result.insertId;

      // Insert options into CarOptions table
      if (options && options.length > 0) {
        const optionsQuery =
          "INSERT INTO Options (car_id, option_description) VALUES ?";
        const optionsValues = options.map((url) => [carId, url]);
        connection.query(optionsQuery, [optionsValues], (error) => {
          if (error) {
            console.error("Error adding car images: ", error);
            res.status(500).json({ error: "Failed to add new car" });
          }
        });
      }
      // Insert images into Images table
      if (imgUrl && imgUrl.length > 0) {
        const imagesQuery = "INSERT INTO Images (car_id, imgUrl) VALUES ?";
        const imageValues = imgUrl.map((url) => [carId, url]);
        connection.query(imagesQuery, [imageValues], (error) => {
          if (error) {
            console.error("Error adding car images: ", error);
            res.status(500).json({ error: "Failed to add new car" });
          }
        });
      }

      res.json({ message: "Car added successfully" });
    }
  });
});

// Start the server
app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
