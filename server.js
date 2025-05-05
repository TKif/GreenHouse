const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware importante
app.use(express.json());
app.use(express.static('public')); // Pasta para arquivos estáticos

// Rota principal com menu
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Estufa Inteligente</title>
      <style>
        /* Mantenha seu CSS aqui ou use arquivo externo */
      </style>
    </head>
    <body>
      <h1>🌿 Estufa Inteligente</h1>
      <a href="/dashboard">Dashboard</a>
    </body>
    </html>
  `);
});

// Rota do Dashboard - Versão Simplificada para Teste
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <script>
        // Função para testar se o JavaScript está carregando
        console.log("Dashboard carregado!");
      </script>
    </head>
    <body>
      <h2>Dashboard Funcionando</h2>
      <p id="data">Carregando dados...</p>
      <script>
        // Teste simples de fetch
        fetch('/api/data')
          .then(response => response.json())
          .then(data => {
            document.getElementById('data').textContent = 
              "Dados recebidos: " + JSON.stringify(data);
          });
      </script>
    </body>
    </html>
  `);
});

// Rota de API necessária para o dashboard
app.get('/api/data', (req, res) => {
  res.json({
    temperature: 25.5,
    humidity: 60,
    soil: 45,
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
