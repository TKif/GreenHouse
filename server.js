const express = require('express');
const http = require('http'); // Adicionado para o servidor HTTP do WebSocket
const WebSocket = require('ws'); // Adicionado para WebSocket
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuração de middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Servir arquivos estáticos da pasta 'public'

// Caminhos dos arquivos de dados
const dataPath = path.join(__dirname, 'data', 'sensorData.json');
const paramsPath = path.join(__dirname, 'data', 'params.json');
const historyPath = path.join(__dirname, 'data', 'actuatorHistory.json');

// Garante que o diretório data existe
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Funções utilitárias para ler/escrever JSON
function readJsonFile(filePath, defaultValue = []) { // Adicionado defaultValue padrão
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filePath, defaultValue); // Garante que o arquivo seja criado com o valor padrão
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Erro ao ler arquivo ${filePath}:`, e);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Erro ao escrever arquivo ${filePath}:`, e);
  }
}

// Inicializa arquivos se não existirem (função auxiliar para initializeFile)
function initializeFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, defaultValue);
  }
}

// Inicializa arquivos de dados com seus valores padrão
initializeFile(dataPath, []);
initializeFile(paramsPath, {
  tempThreshold: 25.0,
  minTempThreshold: 18.0, // Novo parâmetro de temperatura mínima
  humThreshold: 70.0,
  soilThreshold: 30,
  autoControl: true
});
initializeFile(historyPath, []);


// Função para agregar dados históricos de sensores (mantida como estava)
function updateHistoricalData(newEntry) {
  const historicalData = readJsonFile(dataPath, []); // Passa defaultValue explicitamente

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

// Função para agregar dados para gráficos (mantida como estava)
function aggregateDataForChart(data) {
  if (!data || data.length === 0) return [];

  const aggregated = [];
  let currentBlock = null;
  let blockTimestamp = null;

  data.forEach(entry => {
    const entryTime = new Date(entry.timestamp);
    const minute = entryTime.getMinutes();
    const roundedMinute = Math.floor(minute / 5) * 5;

    const blockStart = new Date(entryTime);
    blockStart.setMinutes(roundedMinute, 0, 0);
    blockStart.setSeconds(0, 0);
    const newBlockTimestamp = blockStart.toISOString();

    if (newBlockTimestamp !== blockTimestamp) {
      if (currentBlock) {
        aggregated.push({
          timestamp: blockTimestamp,
          temperature: currentBlock.tempSum / currentBlock.count,
          humidity: currentBlock.humSum / currentBlock.count,
          soil: currentBlock.soilSum / currentBlock.count
        });
      }
      currentBlock = {
        tempSum: 0,
        humSum: 0,
        soilSum: 0,
        count: 0
      };
      blockTimestamp = newBlockTimestamp;
    }

    currentBlock.tempSum += entry.temperature;
    currentBlock.humSum += entry.humidity;
    currentBlock.soilSum += entry.soil;
    currentBlock.count += 1;
  });

  if (currentBlock) {
    aggregated.push({
      timestamp: blockTimestamp,
      temperature: currentBlock.tempSum / currentBlock.count,
      humidity: currentBlock.humSum / currentBlock.count,
      soil: currentBlock.soilSum / currentBlock.count
    });
  }

  return aggregated;
}

// Estado atual dos atuadores (simulado no servidor) - PODE SER REMOVIDO SE USAR WS STATE DIRETO
let actuatorState = {
  vent: false,
  irrig: false,
  heat: false
};

// Funçao para logar ações dos atuadores no arquivo historyPath
function logActuatorAction(actuator, action, reason) {
  const history = readJsonFile(historyPath, []); // Garante que o arquivo é lido/criado
  history.push({
    timestamp: new Date().toISOString(),
    actuator: actuator === 'heat' ? 'Iluminação' : (actuator === 'vent' ? 'Ventilação' : 'Irrigação'), // Nome mais amigável
    action: action.toUpperCase(),
    reason: reason
  });
  // Manter um limite para o histórico para não crescer indefinidamente
  const MAX_HISTORY_ENTRIES = 500;
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  }
  writeJsonFile(historyPath, history);
  console.log('Log de Atuador salvo no histórico:', { actuator, action, reason });
}

// --- FUNÇÃO AUXILIAR PARA CONVERTER JSON PARA CSV ---
function jsonToCsv(jsonArray, fields) {
    if (!jsonArray || jsonArray.length === 0) {
        return fields.join(',') + '\n'; // Apenas o cabeçalho se não houver dados
    }

    const header = fields.join(',');
    const rows = jsonArray.map(obj => fields.map(field => {
        let value = obj[field];
        if (value === null || typeof value === 'undefined') {
            value = '';
        }
        // Envolve o valor em aspas se contiver vírgulas ou aspas duplas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }).join(','));

    return [header, ...rows].join('\n');
}


// ========== ROTAS DA API ==========

// Rota para receber dados dos sensores do ESP32 (POST)
app.post('/api/data', (req, res) => {
  const { temperature, humidity, soil } = req.body;

  if (typeof temperature !== 'number' || typeof humidity !== 'number' || typeof soil !== 'number') {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const newEntry = {
    timestamp: new Date().toISOString(),
    temperature,
    humidity,
    soil
  };

  const currentData = readJsonFile(dataPath, []);
  currentData.push(newEntry);
  writeJsonFile(dataPath, currentData); // Mantém o arquivo para dados brutos

  updateHistoricalData(newEntry); // Atualiza os dados históricos agregados

  res.status(200).json({ message: 'Dados recebidos com sucesso!' });
});

// Rota para o dashboard buscar os dados mais recentes dos sensores (GET)
app.get('/api/data', (req, res) => {
  const currentData = readJsonFile(dataPath, []);
  res.json(currentData);
});

// Rota para o dashboard buscar dados históricos agregados
app.get('/api/historico', (req, res) => {
  const historicalData = readJsonFile(dataPath, []);
  res.json(historicalData);
});

// Rota para gerenciar parâmetros de controle
app.get('/api/params', (req, res) => {
  const params = readJsonFile(paramsPath, {});
  res.json(params);
});

app.post('/api/params', (req, res) => {
  const { tempThreshold, minTempThreshold, humThreshold, soilThreshold, autoControl } = req.body;

  // Validação simples
  if (typeof tempThreshold !== 'number' || typeof minTempThreshold !== 'number' ||
      typeof humThreshold !== 'number' || typeof soilThreshold !== 'number' ||
      typeof autoControl !== 'boolean') {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }
  if (minTempThreshold >= tempThreshold) {
      return res.status(400).json({ error: 'Temperatura mínima deve ser menor que a temperatura máxima.' });
  }

  const newParams = { tempThreshold, minTempThreshold, humThreshold, soilThreshold, autoControl };
  writeJsonFile(paramsPath, newParams);
  res.status(200).json({ message: 'Parâmetros salvos com sucesso!' });

  // Envia os novos parâmetros para todos os ESP32 conectados via WebSocket
  espClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'paramsUpdate', params: newParams }));
    }
  });
});

// Rota para receber logs de atuadores do ESP32 via HTTP POST
app.post('/api/actuator/log', (req, res) => {
  const { actuator, action, reason } = req.body;
  if (!actuator || !action || !reason) {
    return res.status(400).json({ error: 'Dados do log inválidos' });
  }

  logActuatorAction(actuator, action, reason);

  res.status(200).json({ message: 'Log de atuador recebido e salvo com sucesso!' });
});

// Rota para o dashboard controlar atuadores manualmente (HTTP POST - Alternativa ao WebSocket)
app.post('/api/actuator', (req, res) => {
  const { actuator, action } = req.body;

  if (!['vent', 'irrig', 'heat'].includes(actuator) || !['on', 'off', 'pulse1s'].includes(action)) {
    return res.status(400).json({ error: 'Comando inválido' });
  }

  if (action === 'on') {
    actuatorState[actuator] = true;
    logActuatorAction(actuator, 'ON', 'Manual (Dashboard HTTP)');
  } else if (action === 'off') {
    actuatorState[actuator] = false;
    logActuatorAction(actuator, 'OFF', 'Manual (Dashboard HTTP)');
  } else if (action === 'pulse1s' && actuator === 'irrig') {
    actuatorState.irrig = true;
    logActuatorAction('irrig', 'ON', 'Pulso 1s (Dashboard HTTP)');
    setTimeout(() => {
      actuatorState.irrig = false;
      logActuatorAction('irrig', 'OFF', 'Pulso 1s (Dashboard HTTP - fim)');
    }, 1000); // 1 segundo
  }

  espClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'command', actuator, action }));
    }
  });

  res.json({ success: true, actuatorState });
});

// Rota para o ESP32 ou dashboard verificar o estado atual dos atuadores (via HTTP - menos real-time)
app.get('/api/actuator', (req, res) => {
  res.json(actuatorState);
});

// Rota para o dashboard buscar o histórico de ativações dos atuadores
app.get('/api/history', (req, res) => {
  let history = readJsonFile(historyPath, []);
  const { limit, actuator } = req.query;

  if (actuator) {
    history = history.filter(entry => {
      const friendlyName = entry.actuator.toLowerCase();
      const requestedActuator = actuator.toLowerCase();
      return friendlyName === requestedActuator ||
             (requestedActuator === 'ventilacao' && friendlyName === 'ventilação') ||
             (requestedActuator === 'iluminacao' && friendlyName === 'iluminação');
    });
  }

  if (limit) {
    history = history.slice(Math.max(history.length - parseInt(limit), 0));
  }
  res.json(history);
});

// --- NOVAS ROTAS DE EXPORTAÇÃO CSV ---

app.get('/api/export/sensor-data', (req, res) => {
    const sensorData = readJsonFile(dataPath); // Lê todos os dados de sensores
    const fields = ['timestamp', 'temperature', 'humidity', 'soil'];
    const csv = jsonToCsv(sensorData, fields);

    res.header('Content-Type', 'text/csv');
    res.attachment('sensor_data.csv'); // Define o nome do arquivo para download
    res.send(csv);
});

app.get('/api/export/actuator-history', (req, res) => {
    const actuatorHistory = readJsonFile(historyPath); // Lê todo o histórico de atuadores
    const fields = ['timestamp', 'actuator', 'action', 'reason'];
    const csv = jsonToCsv(actuatorHistory, fields);

    res.header('Content-Type', 'text/csv');
    res.attachment('actuator_history.csv'); // Define o nome do arquivo para download
    res.send(csv);
});


// 1) Cria o servidor HTTP “puro” a partir do Express
const server = http.createServer(app);

// 2) Anexa o WebSocket Server a esse mesmo HTTP server
const wss = new WebSocket.Server({ server });

// 3) Guarda quais conexões são ESP32 para mandar comandos só a elas
const espClients = [];

// 4) Toda vez que alguém se conecta por WS
wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch(e) { return; }

    // registro inicial do ESP32 ou Dashboard
    if (msg.type === 'register') {
      if (msg.role === 'esp32') {
        espClients.push(ws);
        console.log('✅ ESP32 registrado:', ws._socket.remoteAddress);
        // Envia os parâmetros atuais para o ESP32 recém-conectado
        const currentParams = readJsonFile(paramsPath, {});
        ws.send(JSON.stringify({ type: 'paramsUpdate', params: currentParams }));
      } else if (msg.role === 'dashboard') {
        console.log('🔗 Dashboard conectado:', ws._socket.remoteAddress);
      }
      return;
    }

    // comando vindo do dashboard → reenvia para todos os ESP32 registrados
    if (msg.type === 'command') {
      const { actuator, action } = msg;

      logActuatorAction(actuator, action, 'Manual (Dashboard WebSocket)');

      espClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(raw); // Envia a mensagem original (type: 'command', actuator, action)
        }
      });
      return;
    }

    if (msg.type === 'actuatorStatus') {
      console.log('Recebido status de atuador via WS (não usado para persistência de log):', msg.status);
      return;
    }
  });

  ws.on('close', () => {
    const index = espClients.indexOf(ws);
    if (index > -1) {
      espClients.splice(index, 1);
      console.log('❌ ESP32 desconectado.');
    } else {
      console.log('Dispositivo WebSocket desconectado.');
    }
  });

  ws.on('error', error => {
    console.error('Erro no WebSocket:', error);
  });
});


// Servir o arquivo dashboard.html na rota /dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Servir o arquivo index.html na rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Inicia o servidor HTTP e WebSocket
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Dashboard disponível em http://localhost:${PORT}/dashboard`);
});
