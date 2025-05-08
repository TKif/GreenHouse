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

const dataPath = path.join(__dirname, 'sensorData.json');
const historicoPath = path.join(__dirname, 'historico.json');

if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify([]));
if (!fs.existsSync(historicoPath)) fs.writeFileSync(historicoPath, JSON.stringify([]));

app.post('/api/data', (req, res) => {
  const { temperature, humidity, soil } = req.body;

  if (
    typeof temperature !== 'number' ||
    typeof humidity !== 'number' ||
    typeof soil !== 'number'
  ) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const now = new Date();
  const newEntry = { temperature, humidity, soil, timestamp: now };

  // Adiciona ao sensorData.json
  const rawData = JSON.parse(fs.readFileSync(dataPath));
  rawData.push(newEntry);
  fs.writeFileSync(dataPath, JSON.stringify(rawData, null, 2));

  // Atualiza historico.json
  const historico = JSON.parse(fs.readFileSync(historicoPath));
  const bloco = new Date(now);
  bloco.setMinutes(bloco.getMinutes() < 30 ? 0 : 30, 0, 0);
  const blocoKey = bloco.toISOString();

  let blocoAtual = historico.find(h => h.timestamp === blocoKey);
  if (!blocoAtual) {
    blocoAtual = {
      timestamp: blocoKey,
      count: 1,
      temperatureSum: temperature,
      humiditySum: humidity,
      soilSum: soil
    };
    historico.push(blocoAtual);
  } else {
    blocoAtual.count += 1;
    blocoAtual.temperatureSum += temperature;
    blocoAtual.humiditySum += humidity;
    blocoAtual.soilSum += soil;
  }

  if (historico.length > 48) {
    historico.splice(0, historico.length - 48);
  }

  fs.writeFileSync(historicoPath, JSON.stringify(historico, null, 2));
  res.status(200).json({ message: 'Dados recebidos com sucesso!' });
});

app.get('/api/data', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataPath));
  res.json(data);
});

app.get('/api/historico', (req, res) => {
  if (!fs.existsSync(historicoPath)) return res.json([]);
  const historico = JSON.parse(fs.readFileSync(historicoPath));
  const medias = historico.map(h => ({
    timestamp: h.timestamp,
    temperature: h.temperatureSum / h.count,
    humidity: h.humiditySum / h.count,
    soil: h.soilSum / h.count
  }));
  res.json(medias);
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
