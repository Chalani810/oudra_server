const { spawn } = require("child_process");

const predictRevenue = (req, res) => {
  const inputData = req.body;


  const requiredFields = [
    "event_type",
    "product_name",
    "quantity",
    "unit_price",
    "duration_days",
    "season_period",
    "month",
    "year",
  ];

  const missingFields = requiredFields.filter((field) => !(field in inputData));
  if (missingFields.length > 0) {
    console.error(`Missing fields: ${missingFields}`);
    return res
      .status(400)
      .json({ error: `Missing required fields: ${missingFields.join(", ")}` });
  }

  const pythonPath =
    "C:\\Users\\CHALANI AMARASOORIYA\\Desktop\\Glimmer\\server02\\venv\\Scripts\\python.exe";
  const scriptPath = "app\\scripts\\predict.py";

  const python = spawn(pythonPath, [scriptPath, JSON.stringify(inputData)]);

  let result = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    result += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
    console.error(`Python stderr: ${data}`);
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python exited with code ${code}. Error: ${errorOutput}`);
      return res
        .status(500)
        .json({ error: errorOutput || "Prediction failed." });
    }
    try {
      const prediction = parseFloat(result.trim());
      if (isNaN(prediction)) {
        throw new Error("Invalid prediction output");
      }
      res.json({ prediction });
    } catch (error) {
      console.error(`Parse error: ${error.message}, Output: ${result}`);
      res.status(500).json({ error: "Invalid prediction output" });
    }
  });
};

module.exports = { predictRevenue };
