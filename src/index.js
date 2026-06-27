require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║    🏨 Hotel Management System          ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║  ✅ Servidor en puerto: ${PORT}           ║`);
  console.log(`║  🌍 http://localhost:${PORT}              ║`);
  console.log(`║  📊 API: http://localhost:${PORT}/api/v1  ║`);
  console.log(`║  💊 Health: /health                    ║`);
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});
