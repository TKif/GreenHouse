const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuração de middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Caminhos dos arquivos de dados
const dataPath = path.join(__dirname, 'data', 'sensorData.json');
const paramsPath = path.join(__dirname, 'data', 'params.json');
const historyPath = path.join(__dirname, 'data', 'actuatorHistory.json');

// Garante que o diretório data existe
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Inicializa arquivos se não existirem
initializeFile(dataPath, []);
initializeFile(paramsPath, {
  tempThreshold: 25.0,
  humThreshold: 70.0,
  soilThreshold: 30,
  autoControl: true
});
initializeFile(historyPath, []);

// ========== ROTAS DA API ==========

// Rota para receber dados dos sensores
app.post('/api/data', (req, res) => {
  const { temperature, humidity, soil } = req.body;

  if (typeof temperature !== 'number' || typeof humidity !== 'number' || typeof soil !== 'number') {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const newEntry = {
    temperature,
    humidity,
    soil,
    timestamp: new Date().toISOString()
  };

  // Salva dados brutos
  const sensorData = readJsonFile(dataPath);
  sensorData.push(newEntry);
  writeJsonFile(dataPath, sensorData);

  // Atualiza histórico agregado (médias de 30 minutos)
  updateHistoricalData(newEntry);

  res.status(200).json({ message: 'Dados recebidos com sucesso!' });
});

// Rota para obter dados dos sensores
app.get('/api/data', (req, res) => {
  const data = readJsonFile(dataPath);
  res.json(data);
});

// Rota para histórico agregado
app.get('/api/historico', (req, res) => {
  const historicalData = readJsonFile(dataPath);
  const aggregated = aggregateData(historicalData);
  res.json(aggregated);
});

// Rota para parâmetros de controle
app.get('/api/params', (req, res) => {
  const params = readJsonFile(paramsPath);
  res.json(params);
});

app.post('/api/params', (req, res) => {
  const newParams = req.body;
  
  // Validação básica
  if (typeof newParams.tempThreshold !== 'number' || 
      typeof newParams.humThreshold !== 'number' || 
      typeof newParams.soilThreshold !== 'number') {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  writeJsonFile(paramsPath, newParams);
  res.json({ success: true });
});

// Rota para histórico de atuadores
app.post('/api/history', (req, res) => {
  const newEntries = Array.isArray(req.body) ? req.body : [req.body];
  const history = readJsonFile(historyPath);

  // Adiciona timestamp se não existir
  newEntries.forEach(entry => {
    entry.timestamp = entry.timestamp || new Date().toISOString();
    history.push(entry);
  });

  // Mantém apenas os últimos 1000 registros
  if (history.length > 1000) {
    history.splice(0, history.length - 1000);
  }

  writeJsonFile(historyPath, history);
  res.json({ success: true, count: newEntries.length });
});

app.get('/api/history', (req, res) => {
  const history = readJsonFile(historyPath);
  
  // Filtros opcionais
  let filtered = [...history];
  if (req.query.actuator) {
    filtered = filtered.filter(h => 
      h.actuator.toLowerCase().includes(req.query.actuator.toLowerCase()));
  }
  
  // Ordena por timestamp (mais recente primeiro)
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Limite de resultados
  const limit = parseInt(req.query.limit) || 100;
  res.json(filtered.slice(0, limit));
});

// ========== ROTAS DO FRONTEND ==========

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== FUNÇÕES AUXILIARES ==========

function initializeFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, defaultValue);
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch (e) {
    console.error(`Erro ao ler arquivo ${filePath}:`, e);
    return Array.isArray(defaultValue) ? [] : {};
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Erro ao escrever arquivo ${filePath}:`, e);
  }
}

function updateHistoricalData(newEntry) {
  const historicalData = readJsonFile(dataPath);
  
  // Agrega dados em blocos de 30 minutos
  const now = new Date(newEntry.timestamp);
  const blockStart = new Date(now);
  blockStart.setMinutes(blockStart.getMinutes() < 30 ? 0 : 30, 0, 0);
  const blockKey = blockStart.toISOString();

  // Encontra ou cria bloco
  let block = historicalData.find(b => b.timestamp === blockKey);
  if (!block) {
    block = {
      timestamp: blockKey,
      count: 0,
      tempSum: 0,
      humSum: 0,
      soilSum: 0
    };
    historicalData.push(block);
  }

  // Atualiza médias
  block.count += 1;
  block.tempSum += newEntry.temperature;
  block.humSum += newEntry.humidity;
  block.soilSum += newEntry.soil;

  // Mantém apenas 48 horas de dados (96 blocos de 30 minutos)
  if (historicalData.length > 96) {
    historicalData.splice(0, historicalData.length - 96);
  }

  writeJsonFile(dataPath, historicalData);
}

function aggregateData(data) {
  return data.map(block => ({
    timestamp: block.timestamp,
    temperature: block.tempSum / block.count,
    humidity: block.humSum / block.count,
    soil: block.soilSum / block.count
  }));
}

// Inicia o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
