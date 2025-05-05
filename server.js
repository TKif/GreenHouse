const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: '*' // Altere para origem específica para maior segurança
}));
app.use(bodyParser.json());
app.use(express.static('public'));

const filePath = path.join(__dirname, 'sensorData.json');

// Cria arquivo se não existir
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

// Rota para receber dados do ESP32
app.post('/api/data', (req, res) => {
  const { temperature, humidity, soil } = req.body;

  // Validação básica
  if (
    typeof temperature !== 'number' ||
    typeof humidity !== 'number' ||
    typeof soil !== 'number'
  ) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const newEntry = {
    temperature,
    humidity,
    soil,
    timestamp: new Date()
  };

  const data = JSON.parse(fs.readFileSync(filePath));
  data.push(newEntry);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  res.status(200).json({ message: 'Dados recebidos com sucesso!' });
});

// Rota para fornecer dados ao dashboard (com limite)
app.get('/api/data', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const data = JSON.parse(fs.readFileSync(filePath));
  const limitedData = data.slice(-limit);
  res.json(limitedData);
});

// Rota para exibir dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard disponível em http://localhost:${PORT}/dashboard`);
});
