const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para arquivos estáticos (CSS, JS, imagens)
app.use(express.static('public'));

// Rota principal com menu
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Estufa Inteligente</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f4f4f9;
          color: #333;
          margin: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .menu {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          width: 100%;
          max-width: 800px;
        }
        .card {
          background: white;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: transform 0.3s;
        }
        .card:hover {
          transform: translateY(-5px);
        }
        .card h2 {
          color: #2e7d32;
          margin-top: 0;
        }
        .btn {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          text-decoration: none;
          margin-top: 15px;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #388E3C;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🌿 Estufa Inteligente</h1>
        <p>Sistema de monitoramento e controle</p>
      </div>
      
      <div class="menu">
        <div class="card">
          <h2>Dashboard</h2>
          <p>Visualização em tempo real dos sensores</p>
          <a href="/dashboard" class="btn">Acessar</a>
        </div>
        
        <div class="card">
          <h2>Controle Manual</h2>
          <p>Acione dispositivos manualmente</p>
          <a href="/control" class="btn">Acessar</a>
        </div>
        
        <div class="card">
          <h2>Configurações</h2>
          <p>Defina parâmetros ideais</p>
          <a href="/settings" class="btn">Acessar</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Suas rotas existentes (mantenha todas)
app.get('/dashboard', (req, res) => {
  // Seu código atual do dashboard
});

app.get('/control', (req, res) => {
  res.send('Página de controle manual em construção');
});

app.get('/settings', (req, res) => {
  res.send('Página de configurações em construção');
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
