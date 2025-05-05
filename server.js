const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Armazenamento
let sensorData = [];
let deviceState = {
  fan: false,
  waterPump: false,
  uvLight: false,
  lastWaterDuration: 0
};

let idealParams = {
  temperature: 23,
  humidity: 60,
  soilMoisture: 55,
  autoMode: true
};

// Rotas da API
app.post('/api/data', (req, res) => {
  const newData = {
    ...req.body,
    timestamp: new Date()
  };
  sensorData.push(newData);
  if (sensorData.length > 100) sensorData = sensorData.slice(-100);
  
  res.json({ status: 'success', state: deviceState });
});

app.get('/api/data', (req, res) => {
  res.json({
    last: sensorData[sensorData.length - 1] || {},
    history: sensorData,
    deviceState,
    idealParams
  });
});

app.post('/api/control', (req, res) => {
  deviceState = { ...deviceState, ...req.body };
  res.json(deviceState);
});

app.post('/api/params', (req, res) => {
  idealParams = { ...idealParams, ...req.body };
  res.json(idealParams);
});

// Dashboard
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Controle de Estufa</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; }
        .card { background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        button, input[type="submit"] { 
          padding: 10px 15px; margin: 5px; border: none; border-radius: 5px; 
          background: #4CAF50; color: white; cursor: pointer; 
        }
        .disabled { background: #cccccc; }
        input[type="number"] { width: 80px; padding: 8px; }
        .sensor-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        #chart-container { height: 300px; }
      </style>
    </head>
    <body>
      <h1>🌿 Controle Inteligente de Estufa</h1>
      
      <div class="grid">
        <!-- Dados em Tempo Real -->
        <div class="card">
          <h2>📊 Monitoramento</h2>
          <div id="currentData">
            <p>🌡️ Temperatura: <span id="tempValue" class="sensor-value">--</span> °C</p>
            <p>💧 Umidade: <span id="humValue" class="sensor-value">--</span> %</p>
            <p>🌱 Solo: <span id="soilValue" class="sensor-value">--</span> %</p>
          </div>
          <div id="chart-container">
            <canvas id="sensorChart"></canvas>
          </div>
        </div>
        
        <!-- Controles -->
        <div class="card">
          <h2>⚙️ Controle</h2>
          <form id="paramsForm">
            <h3>Parâmetros Ideais</h3>
            <div>
              <label>Temperatura (°C):</label>
              <input type="number" id="tempParam" step="0.1" required>
            </div>
            <div>
              <label>Umidade Solo (%):</label>
              <input type="number" id="soilParam" required>
            </div>
            <div>
              <label><input type="checkbox" id="autoMode"> Modo Automático</label>
            </div>
            <input type="submit" value="Salvar">
          </form>
          
          <h3>Controle Manual</h3>
          <div>
            <button onclick="controlDevice('fan', true)">Ligar Ventoinha</button>
            <button onclick="controlDevice('fan', false)">Desligar</button>
          </div>
          <div>
            <button onclick="controlDevice('waterPump', 5)">Regar (5s)</button>
          </div>
        </div>
      </div>

      <script>
        // Elementos
        const ctx = document.getElementById('sensorChart').getContext('2d');
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [],
            datasets: [
              { label: 'Temperatura (°C)', data: [], borderColor: 'red', tension: 0.1 },
              { label: 'Umidade (%)', data: [], borderColor: 'blue', tension: 0.1 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });

        // Atualiza dados
        async function updateData() {
          try {
            const response = await fetch('/api/data');
            const data = await response.json();
            
            // Atualiza valores atuais
            if (data.last) {
              document.getElementById('tempValue').textContent = data.last.temperature || '--';
              document.getElementById('humValue').textContent = data.last.humidity || '--';
              document.getElementById('soilValue').textContent = data.last.soil || '--';
            }
            
            // Atualiza gráfico
            updateChart(data.history);
            
            // Atualiza formulário
            document.getElementById('tempParam').value = data.idealParams.temperature;
            document.getElementById('soilParam').value = data.idealParams.soilMoisture;
            document.getElementById('autoMode').checked = data.idealParams.autoMode;
          } catch (error) {
            console.error('Erro:', error);
          }
        }

        function updateChart(data) {
          if (!data || data.length === 0) return;
          
          const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
          chart.data.labels = labels.slice(-15);
          chart.data.datasets[0].data = data.map(d => d.temperature).slice(-15);
          chart.data.datasets[1].data = data.map(d => d.humidity).slice(-15);
          chart.update();
        }

        // Controles
        async function controlDevice(device, value) {
          await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [device]: value })
          });
          updateData();
        }

        // Parâmetros
        document.getElementById('paramsForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const params = {
            temperature: parseFloat(document.getElementById('tempParam').value),
            soilMoisture: parseInt(document.getElementById('soilParam').value),
            autoMode: document.getElementById('autoMode').checked
          };
          
          await fetch('/api/params', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          alert('Parâmetros atualizados!');
        });

        // Inicialização
        updateData();
        setInterval(updateData, 5000);
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
