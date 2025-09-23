## Fastify
https://fastify.dev/docs/latest/Guides/Getting-Started/


太好了 — 我会给你一个完整、可运行的 Fastify + MongoDB 电商示例工程，包括：
	•	系统功能拆分（前后端职责）
	•	完整数据库设计（MongoDB / Mongoose 风格）与建表 + mock 数据填充脚本
	•	用 Fastify 实现的 API（产品/分类/购物车/结算/用户）并示例请求
	•	运行说明（如何安装、启动、填数据、测试）

为了简单、可替换性强，我选择 MongoDB + Mongoose（非关系型）作为示例数据库 —— 这种组合对快速搭建原型非常友好。下面的代码和说明你可以直接 copy 到项目里运行。

⸻

1) 功能拆分（高层次）

前端（网站）职责
	•	展示商品列表（可按分类筛选 / 搜索）
	•	单商品页展示详情（含库存状态：available / sold out）
	•	购物车页面（添加/修改/删除商品行）
	•	结算页（提交订单并显示成功/失败）
	•	用户登录/注册（示例中用最简化 session/token 模式）

后端（Fastify）职责
	•	提供 REST API：商品、分类、购物车、结算、用户（简化）
	•	负责事务性操作：结算时检查库存并原子化更新（MongoDB session）
	•	提供 mock 数据脚本、数据模型、并处理基本验证与错误返回

⸻

2) 数据库设计（MongoDB collections / Mongoose schemas）

主要集合：
	•	users — 用户
	•	_id
	•	email (unique)
	•	name
	•	passwordHash (演示：可以用明文或简单 hash；生产请强制 hash)
	•	createdAt
	•	categories — 商品分类（层级 / 单层）
	•	_id
	•	name
	•	slug
	•	description
	•	products — 商品
	•	_id
	•	name
	•	slug
	•	description
	•	price (整数，单位：分)
	•	currency (“USD” / “CNY”…)
	•	category (ObjectId -> categories)
	•	images (string[])
	•	quantity (number) — 可售库存
	•	status (“available” | “sold_out”) — 可通过 quantity 自动计算
	•	createdAt, updatedAt
	•	carts — 购物车 (可以是 session-based 或 user-based)
	•	_id
	•	userId (optional)
	•	items: [{ productId, quantity, priceAtAdd }]
	•	updatedAt
	•	orders
	•	_id
	•	userId (optional)
	•	items: [{ productId, quantity, price }]
	•	amount (总金额)
	•	status (“created”|“paid”|“cancelled”)
	•	createdAt

设计说明：
	•	products.quantity 为库存数量；status 为派生字段（若 quantity ≤ 0 -> sold_out）。
	•	carts 可以和 users 关联，或匿名（用 cookie/session 存 cartId），示例中支持 userId 可选。
	•	orders 在结算时创建，使用 MongoDB 事务来原子性地：检查库存 -> 扣库存 -> 写入订单。

⸻

3) 项目文件 & 代码（完整）

下面给出 package.json、Mongoose models、seed 脚本、以及 server.js（fastify 服务实现主要 API）。把这些保存成文件后即可运行。

⸻

package.json
```
{
  "name": "fastify-ecommerce-sample",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development nodemon server.js",
    "seed": "node seed.js"
  },
  "dependencies": {
    "fastify": "^4.22.0",
    "fastify-cors": "^8.4.0",
    "fastify-jwt": "^5.7.0",
    "mongoose": "^7.0.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

⸻

models.js （Mongoose 模式）
```
// models.js

import mongoose from "mongoose";

const { Schema } = mongoose;

// User
export const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  passwordHash: String,
  createdAt: { type: Date, default: () => new Date() },
});

// Category
export const CategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
});

// Product
export const ProductSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  price: { type: Number, required: true }, // cents
  currency: { type: String, default: "USD" },
  category: { type: Schema.Types.ObjectId, ref: "Category" },
  images: [String],
  quantity: { type: Number, default: 0 },
  status: { type: String, enum: ["available", "sold_out"], default: "available" },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

ProductSchema.pre("save", function (next) {
  this.status = this.quantity > 0 ? "available" : "sold_out";
  this.updatedAt = new Date();
  next();
});

// Cart (one doc per user or session)
export const CartSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: "Product" },
      quantity: { type: Number, default: 1 },
      priceAtAdd: { type: Number, required: true },
    },
  ],
  updatedAt: { type: Date, default: () => new Date() },
});

// Order
export const OrderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: "Product" },
      quantity: Number,
      price: Number,
    },
  ],
  amount: Number,
  status: { type: String, enum: ["created", "paid", "cancelled"], default: "created" },
  createdAt: { type: Date, default: () => new Date() },
});

export function registerModels(connection) {
  const User = connection.model("User", UserSchema);
  const Category = connection.model("Category", CategorySchema);
  const Product = connection.model("Product", ProductSchema);
  const Cart = connection.model("Cart", CartSchema);
  const Order = connection.model("Order", OrderSchema);

  return { User, Category, Product, Cart, Order };
}

```
⸻

seed.js （建表 + 填充 mock 数据）
```
// seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { registerModels } from "./models.js";

dotenv.config();

const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fastify_ecom";

async function main() {
  await mongoose.connect(MONGO, {});

  const { User, Category, Product, Cart, Order } = registerModels(mongoose);

  // 清理旧数据（小心使用）
  await Promise.all([User.deleteMany({}), Category.deleteMany({}), Product.deleteMany({}), Cart.deleteMany({}), Order.deleteMany({})]);

  // 创建分类
  const cat1 = await Category.create({ name: "T-Shirts", slug: "tshirts", description: "Comfortable tees" });
  const cat2 = await Category.create({ name: "Hoodies", slug: "hoodies", description: "Warm hoodies" });
  const cat3 = await Category.create({ name: "Accessories", slug: "accessories", description: "Nice stuff" });

  // 创建商品
  const products = [
    {
      name: "Plain White Tee",
      slug: "plain-white-tee",
      description: "A comfortable white t-shirt",
      price: 1999,
      currency: "USD",
      category: cat1._id,
      images: ["https://placehold.co/600x400?text=White+Tee"],
      quantity: 10,
    },
    {
      name: "Black Hoodie",
      slug: "black-hoodie",
      description: "Cozy black hoodie",
      price: 4999,
      currency: "USD",
      category: cat2._id,
      images: ["https://placehold.co/600x400?text=Black+Hoodie"],
      quantity: 0,
    },
    {
      name: "Canvas Tote",
      slug: "canvas-tote",
      description: "Reusable tote bag",
      price: 1299,
      currency: "USD",
      category: cat3._id,
      images: ["https://placehold.co/600x400?text=Canvas+Tote"],
      quantity: 25,
    },
  ];

  for (const p of products) {
    await Product.create(p);
  }

  // 创建示例用户
  const pass = await bcrypt.hash("password123", 8);
  const user = await User.create({ name: "Demo User", email: "demo@example.com", passwordHash: pass });

  // 创建一个空购物车
  await Cart.create({ userId: user._id, items: [] });

  console.log("Seeding done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

⸻

server.js （Fastify 实现的 API）
```
// server.js
import Fastify from "fastify";
import cors from "fastify-cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fastifyJwt from "fastify-jwt";
import { registerModels } from "./models.js";

dotenv.config();

const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fastify_ecom";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const fastify = Fastify({ logger: true });

await mongoose.connect(MONGO);
const models = registerModels(mongoose);

// register plugins
fastify.register(cors, { origin: true });
fastify.register(fastifyJwt, { secret: JWT_SECRET });

// simple auth helpers
fastify.decorate("authenticate", async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// --- routes ---

// Auth: register & login (very simple)
fastify.post("/api/auth/register", async (request, reply) => {
  const { name, email, password } = request.body;
  if (!email || !password) return reply.code(400).send({ error: "email/password required" });
  const exist = await models.User.findOne({ email });
  if (exist) return reply.code(409).send({ error: "email exists" });
  const hash = await bcrypt.hash(password, 8);
  const user = await models.User.create({ name, email, passwordHash: hash });
  const token = fastify.jwt.sign({ id: user._id, email: user.email });
  reply.send({ token, user: { id: user._id, email: user.email, name: user.name } });
});

fastify.post("/api/auth/login", async (request, reply) => {
  const { email, password } = request.body;
  const user = await models.User.findOne({ email });
  if (!user) return reply.code(401).send({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return reply.code(401).send({ error: "invalid credentials" });
  const token = fastify.jwt.sign({ id: user._id, email: user.email });
  reply.send({ token, user: { id: user._id, email: user.email, name: user.name } });
});

// Categories
fastify.get("/api/categories", async (req, reply) => {
  const cats = await models.Category.find().lean();
  reply.send(cats);
});

// Products listing with optional category filter & pagination
fastify.get("/api/products", async (request, reply) => {
  const { category, q, page = 1, limit = 20 } = request.query;
  const filter = {};
  if (category) filter.category = category;
  if (q) filter.name = { $regex: q, $options: "i" };
  const skip = (page - 1) * limit;
  const total = await models.Product.countDocuments(filter);
  const items = await models.Product.find(filter).populate("category").skip(skip).limit(parseInt(limit, 10)).lean();
  reply.send({ total, page: Number(page), items });
});

// Get product details
fastify.get("/api/products/:id", async (request, reply) => {
  const prod = await models.Product.findById(request.params.id).populate("category").lean();
  if (!prod) return reply.code(404).send({ error: "not found" });
  reply.send(prod);
});

// Cart: get or create cart for user (simplified)
// For simplification, pass Authorization: Bearer <token> to identify user; otherwise anonymous cart not persisted here.
fastify.get("/api/cart", { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userId = request.user.id;
  let cart = await models.Cart.findOne({ userId }).lean();
  if (!cart) {
    cart = await models.Cart.create({ userId, items: [] });
  }
  reply.send(cart);
});

// Add item to cart
fastify.post("/api/cart/items", { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userId = request.user.id;
  const { productId, quantity = 1 } = request.body;
  const product = await models.Product.findById(productId);
  if (!product) return reply.code(404).send({ error: "product not found" });
  // price snapshot
  const priceAtAdd = product.price;

  let cart = await models.Cart.findOne({ userId });
  if (!cart) cart = await models.Cart.create({ userId, items: [] });

  const existing = cart.items.find((it) => it.productId.toString() === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ productId, quantity, priceAtAdd });
  }
  cart.updatedAt = new Date();
  await cart.save();
  reply.send(cart);
});

// Update item quantity
fastify.put("/api/cart/items/:productId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userId = request.user.id;
  const { productId } = request.params;
  const { quantity } = request.body;
  const cart = await models.Cart.findOne({ userId });
  if (!cart) return reply.code(404).send({ error: "cart not found" });
  const item = cart.items.find((it) => it.productId.toString() === productId);
  if (!item) return reply.code(404).send({ error: "item not in cart" });
  item.quantity = quantity;
  cart.updatedAt = new Date();
  await cart.save();
  reply.send(cart);
});

// Remove item from cart
fastify.delete("/api/cart/items/:productId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userId = request.user.id;
  const { productId } = request.params;
  const cart = await models.Cart.findOne({ userId });
  if (!cart) return reply.code(404).send({ error: "cart not found" });
  cart.items = cart.items.filter((it) => it.productId.toString() !== productId);
  cart.updatedAt = new Date();
  await cart.save();
  reply.send(cart);
});

// Checkout: core logic - transactional
fastify.post("/api/checkout", { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userId = request.user.id;
  const { paymentMethod } = request.body; // demo only

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await models.Cart.findOne({ userId }).session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return reply.code(400).send({ error: "cart empty" });
    }

    // 1. Check stock
    for (const it of cart.items) {
      const prod = await models.Product.findById(it.productId).session(session);
      if (!prod) {
        await session.abortTransaction();
        session.endSession();
        return reply.code(404).send({ error: `product ${it.productId} not found` });
      }
      if (prod.quantity < it.quantity) {
        await session.abortTransaction();
        session.endSession();
        return reply.code(400).send({ error: `insufficient stock for ${prod._id}` });
      }
    }

    // 2. Deduct stock
    let amount = 0;
    for (const it of cart.items) {
      const prod = await models.Product.findById(it.productId).session(session);
      prod.quantity -= it.quantity;
      await prod.save({ session });
      amount += it.quantity * it.priceAtAdd;
    }

    // 3. Create order
    const order = await models.Order.create(
      [
        {
          userId,
          items: cart.items.map((it) => ({ productId: it.productId, quantity: it.quantity, price: it.priceAtAdd })),
          amount,
          status: "paid", // demo assume payment success
        },
      ],
      { session }
    );

    // 4. Clear cart
    cart.items = [];
    cart.updatedAt = new Date();
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    reply.send({ order: order[0] });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    request.log.error(err);
    reply.code(500).send({ error: "checkout failed" });
  }
});

// Admin helpful: list orders
fastify.get("/api/orders", async (req, reply) => {
  const items = await models.Order.find().populate("items.productId").lean();
  reply.send(items);
});

// start server
const PORT = process.env.PORT || 3000;
fastify.listen({ port: Number(PORT), host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening at ${address}`);
});

```
⸻

4) 运行说明
	1.	准备

git init fastify-ecom
cd fastify-ecom
# 将上面的文件保存到项目中:
# package.json, models.js, seed.js, server.js
npm install

	2.	启动 MongoDB（本机）或指向你的 MongoDB 实例
设置 .env（可选）：

MONGO_URI=mongodb://127.0.0.1:27017/fastify_ecom
JWT_SECRET=some-secret
PORT=3000

	3.	填充 mock 数据

npm run seed

	4.	启动服务

npm start
# 或开发时用 nodemon
npm run dev

	5.	测试 API（示例 curl）

	•	注册/登录

curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@example.com","password":"password123"}'
# 得到 {token, user}

把返回的 token 放入后续请求的 Authorization: Bearer token
	•	列出产品

curl http://localhost:3000/api/products

	•	查看购物车

curl -H "Authorization: Bearer <token>" http://localhost:3000/api/cart

	•	添加商品到 cart

curl -X POST http://localhost:3000/api/cart/items -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"productId":"<PRODUCT_ID>","quantity":1}'

	•	结算

curl -X POST http://localhost:3000/api/checkout -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"paymentMethod":"dummy"}'


⸻

5) 额外建议与可扩展点（生产考虑）
	•	支付：真实环境整合第三方支付（Stripe/PayPal）并在支付回调里完成订单 status 更新。
	•	库存 & 并发：当前用 MongoDB 事务处理库存扣减。对于高并发场景需优化（乐观锁、扣减队列）。
	•	安全：密码必须安全哈希（示例已用 bcrypt），还要防 SQL/NoSQL 注入、速率限制、验证输入。
	•	验证与错误处理：用 fastify schema (ajv) 对 body/query 参数验证。
	•	缓存与 CDN：商品图片通过 CDN，页面静态资源通过 CDN；产品列表可加入 Redis 缓存。
	•	匿名购物车：实现 cookie / session 存储 cartId，未登录时仍能保存购物车。
	•	单元/集成测试：加 jest/mocha 做自动化测试。

⸻

6) 是否需要我为你做任何一项？

我可以继续为你：
	•	把上面拆好的文件打包成一个 GitHub 仓库结构（并生成 README + docker-compose）；
	•	增加 TypeScript 版本的 server + 类型定义；
	•	添加前端示例（React + fetch）对接这些 API，包含登录、商品列表、购物车、结算完整流程；
	•	或者把 checkout 的事务逻辑改成更完整的幂等设计（处理重复请求 / 并发扣库存）。

你想先要哪一个？


## Convex

