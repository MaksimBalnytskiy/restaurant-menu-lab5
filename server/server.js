const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

// Логування вхідних запитів
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const DEFAULT_DISH_IMAGE = '/images/placeholder.jpg';

let dishes = [
  {
    id: "1",
    title: "Піца Маргарита",
    description: "Класична італійська піца з томатним соусом, моцарелою та свіжим базиліком.",
    price: 220,
    imageUrl: "/images/pizza.jpg",
    createdAt: new Date()
  },
  {
    id: "2",
    title: "Салат Цезар",
    description: "Свіжий айсберг, курка гриль, соус цезар, сухарики та пармезан.",
    price: 195,
    imageUrl: "/images/caesar.jpg",
    createdAt: new Date()
  }
];

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Restaurant API Documentation',
      version: '1.3.0',
      description: 'REST API для меню ресторану з інтеграцією Google AI',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./server.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @openapi
 * /api/dishes:
 *   get:
 *     summary: Отримати меню ресторану
 *     responses:
 *       200:
 *         description: Успішно отримано меню
 */
app.get('/api/dishes', (req, res) => {
  res.json(dishes);
});

/**
 * @openapi
 * /api/dishes:
 *   post:
 *     summary: Додати нову страву
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               imageUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Страву успішно додано
 *       400:
 *         description: Помилка валідації
 */
app.post('/api/dishes', (req, res) => {
  let { title, description, price, imageUrl } = req.body;

  if (!title || !description || price === undefined || typeof title !== 'string' || typeof description !== 'string') {
    return res.status(400).json({ error: "Поля title, description та price є обов'язковими!" });
  }

  title = title.trim();
  description = description.trim();
  imageUrl = imageUrl ? imageUrl.trim() : "";

  if (title.length < 2 || description.length < 5) {
    return res.status(400).json({ error: "Дані занадто короткі." });
  }

  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: "Ціна має бути додатнім числом." });
  }

  const newDish = {
    id: Date.now().toString(),
    title,
    description,
    price,
    imageUrl: imageUrl || DEFAULT_DISH_IMAGE,
    createdAt: new Date()
  };

  dishes.push(newDish);
  res.status(201).json(newDish);
});

/**
 * @openapi
 * /api/ai/recommend:
 *   post:
 *     summary: Отримати рекомендацію страви від ШІ-офіціанта
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Згенерована рекомендація ШІ
 *       400:
 *         description: Некоректний запит
 */
app.post('/api/ai/recommend', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    return res.status(400).json({ error: "Введіть коректний запит для ШІ-помічника." });
  }

  // Розумна резервна евристика на випадок будь-яких проблем з мережею чи ключем
  const lowerMsg = message.toLowerCase();
  let matchedDish = dishes[0];

  if (lowerMsg.includes('салат') || lowerMsg.includes('легк')) {
    matchedDish = dishes.find(d => d.title.toLowerCase().includes('салат')) || dishes[1];
  } else if (lowerMsg.includes('піц') || lowerMsg.includes('італ')) {
    matchedDish = dishes.find(d => d.title.toLowerCase().includes('піца')) || dishes[0];
  } else {
    matchedDish = dishes[Math.floor(Math.random() * dishes.length)];
  }

  const smartReply = `Рекомендую скуштувати "${matchedDish.title}" за ${matchedDish.price} грн. ${matchedDish.description} Це ідеальний вибір із нашого меню!`;

  if (!GEMINI_API_KEY) {
    return res.json({ reply: smartReply, source: "smart-fallback" });
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Ти привітний офіціант ресторану "Смаколик". Актуальне меню: ${JSON.stringify(dishes)}. Побажання відвідувача: "${message}". Дай коротку, ввічливу пораду українською мовою.` }] }]
      })
    });

    if (!aiResponse.ok) {
      return res.json({ reply: smartReply, source: "fallback-on-error" });
    }

    const data = await aiResponse.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.json({ reply: smartReply, source: "fallback-empty" });
    }

    res.json({ reply: reply.trim(), source: "google-gemini" });
  } catch (error) {
    res.json({ reply: smartReply, source: "fallback-exception" });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});