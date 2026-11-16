const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

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
      version: '1.2.0',
      description: 'REST API для меню ресторану (Cloud Ready)',
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

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});