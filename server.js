const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const filePath = path.join(__dirname, 'dados.json');

// Cria o arquivo se não existir
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([]));
}

// Rota para receber dados do ESP32
app.post('/api/data', (req, res) => {
  const newData = req.body;
  const existingData = JSON.parse(fs.readFileSync(filePath));
  existingData.push({ ...newData, timestamp: new Date() });
  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
  res.status(200).json({ message: 'Dados recebidos com sucesso!' });
});

// Rota para fornecer dados ao dashboard
app.get('/api/data', (req, res) => {
  const data = JSON.parse(fs.readFileSync(filePath));
  res.json(data);
});

// Rota do dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard disponível em http://localhost:${PORT}/dashboard`);
});
